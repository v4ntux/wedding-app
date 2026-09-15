// Звук из ссылки и из видео: yt-dlp и ffmpeg.
//
// Пара кидает ссылку (YouTube, TikTok, Instagram…) или загружает видео — сервер
// вытаскивает звуковую дорожку в mp3, и дальше это обычная своя песня. Сами
// инструменты — отдельные программы: в Docker они ставятся при сборке, локально
// путь задают YTDLP_BIN и FFMPEG_BIN. Нет программы — импорт честно отвечает
// «недоступно», а остальная студия работает как работала.
//
// Ссылку открывают только встроенные разборщики сайтов yt-dlp (generic выключен),
// а адрес внутренней сети отсекается ещё до запуска: произвольную страницу по
// просьбе пары сервер не откроет.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import dns from 'node:dns/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { FFMPEG_BIN, YTDLP_BIN, YTDLP_COOKIES, YTDLP_JS_RUNTIME, YTDLP_PROXY } from './config.js';
import { detectFileType } from './upload.js';

export const MAX_SECONDS = 15 * 60;               // часовые миксы свадьбе не нужны
export const MAX_MEDIA_BYTES = 60 * 1024 * 1024;  // видео с телефона
const MAX_AUDIO_BYTES = 40 * 1024 * 1024;
const MAX_THUMB_BYTES = 3 * 1024 * 1024;
const LINK_TIMEOUT = 4 * 60_000;
const VIDEO_TIMEOUT = 3 * 60_000;

const text = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export class ImportError extends Error {
  constructor(code, detail = '') {
    super(`import: ${code}${detail ? ` (${detail})` : ''}`);
    // link | unsupported | blocked | private | long | big | gone | noaudio | format | timeout | busy | unavailable | failed
    this.code = code;
  }
}

/* ── Запуск программ ── */

function spawnRun(bin, args, { timeout = 60_000, onLine = null } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    } catch (error) {
      resolve({ code: -1, stdout: '', stderr: '', error, timedOut: false });
      return;
    }
    let stdout = '';
    let stderr = '';
    let rest = '';
    let timedOut = false;
    let settled = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeout);
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    child.stdout.on('data', (chunk) => {
      const part = chunk.toString();
      if (stdout.length < 1_000_000) stdout += part;
      if (!onLine) return;
      rest += part;
      const lines = rest.split(/\r\n|\n|\r/);
      rest = lines.pop();
      for (const line of lines) if (line) onLine(line);
    });
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-24_000); });
    child.on('error', (error) => finish({ code: -1, stdout, stderr, error, timedOut }));
    child.on('close', (code) => {
      if (onLine && rest) onLine(rest);
      finish({ code, stdout, stderr, timedOut });
    });
  });
}

let run = spawnRun;
/* Тесты подменяют запуск программ: yt-dlp и ffmpeg в CI не нужны. */
export function useRunner(fn) {
  run = fn || spawnRun;
  status = null;
}

const systemLookup = (host) => dns.lookup(host, { all: true, verbatim: true });
let lookup = systemLookup;
export function useLookup(fn) { lookup = fn || systemLookup; }

let status = null;
/* Есть ли чем извлекать: { link, video }. Проверяется один раз за запуск. */
export function extractorStatus() {
  status ||= Promise.all([
    run(YTDLP_BIN, ['--version'], { timeout: 20_000 }),
    run(FFMPEG_BIN, ['-hide_banner', '-version'], { timeout: 20_000 }),
  ]).then(([yt, ff]) => {
    const video = ff.code === 0;
    const link = video && yt.code === 0;
    if (!link) {
      const missing = [yt.code === 0 ? '' : 'yt-dlp', video ? '' : 'ffmpeg'].filter(Boolean).join(' и ');
      console.warn(`[import] не найден ${missing}: импорт по ссылке${video ? '' : ' и из видео'} выключен`);
    }
    return { link, video };
  });
  return status;
}

/* ── Ссылка ── */

const LINK_RE = /https?:\/\/[^\s<>"'«»]+/i;

function privateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
  }
  const v6 = String(ip).toLowerCase();
  if (v6 === '::' || v6 === '::1') return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
  if (mapped) return privateAddress(mapped[1]);
  return /^(?:fc|fd|fe[89ab])/.test(v6);
}

/* Первая ссылка из вставленного текста («смотри https://vt.tiktok.com/… #fyp»).
   null — ссылки нет, она не http(s) или ведёт во внутреннюю сеть. */
export async function linkOf(raw) {
  const found = String(raw ?? '').slice(0, 2000).match(LINK_RE)?.[0];
  if (!found) return null;
  let url;
  try {
    url = new URL(found.replace(/[.,;:!?)\]]+$/, ''));
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
  if (url.port && !['80', '443'].includes(url.port)) return null;
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (net.isIP(host)) {
    if (privateAddress(host)) return null;
  } else {
    if (!host.includes('.') || /(?:^|\.)(?:localhost|local|internal|lan)$/.test(host)) return null;
    try {
      const addresses = await lookup(host);
      if (!addresses.length || addresses.some((entry) => privateAddress(entry.address))) return null;
    } catch {
      return null;
    }
  }
  url.hash = '';
  return url.href;
}

const SITES = [
  ['youtube', /(?:^|\.)(?:youtube\.com|youtu\.be|youtube-nocookie\.com)$/],
  ['tiktok', /(?:^|\.)tiktok\.com$/],
  ['instagram', /(?:^|\.)instagram\.com$/],
  ['facebook', /(?:^|\.)(?:facebook\.com|fb\.watch)$/],
  ['vk', /(?:^|\.)(?:vk\.com|vk\.ru|vkvideo\.ru)$/],
  ['x', /(?:^|\.)(?:twitter\.com|x\.com)$/],
  ['soundcloud', /(?:^|\.)soundcloud\.com$/],
  ['likee', /(?:^|\.)likee\.video$/],
  ['ok', /(?:^|\.)ok\.ru$/],
  ['pinterest', /(?:^|\.)pinterest\.com$/],
];

/* Сайт по ссылке: youtube, tiktok, instagram… или web — «какой-то другой». */
export function siteOf(href) {
  let host = '';
  try {
    host = new URL(String(href)).hostname.toLowerCase();
  } catch {
    return 'web';
  }
  return SITES.find(([, re]) => re.test(host))?.[0] ?? 'web';
}

/* Что пошло не так — по выводу программы. */
export function importErrorOf({ stdout = '', stderr = '', timedOut = false, error = null } = {}) {
  if (error?.code === 'ENOENT') return 'unavailable';
  if (timedOut) return 'timeout';
  const out = `${stderr}\n${stdout}`;
  if (/does not pass filter/i.test(out)) return 'long';
  if (/larger than max-filesize/i.test(out)) return 'big';
  if (/not a bot|sign in to confirm|HTTP Error 429|too many requests|rate[- ]?limit/i.test(out)) return 'blocked';
  if (/unsupported url|no suitable extractor|is not a valid url/i.test(out)) return 'unsupported';
  if (/private (?:video|account)|login required|requires authentication|members[- ]only|confirm your age|age[- ]restricted|not available in your country|geo[- ]?restrict/i.test(out)) return 'private';
  if (/video unavailable|has been removed|no longer available|does not exist|HTTP Error 404|HTTP Error 410/i.test(out)) return 'gone';
  if (/matches no streams|does not contain any stream|no audio/i.test(out)) return 'noaudio';
  if (/invalid data found|could not find codec|moov atom not found/i.test(out)) return 'format';
  return 'failed';
}

/* Длительность по заголовку файла: ffmpeg печатает её, даже когда выход не задан. */
export async function probeSeconds(file) {
  const out = await run(FFMPEG_BIN, ['-hide_banner', '-nostdin', '-i', file], { timeout: 30_000 });
  const m = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(out.stderr);
  if (!m) return null;
  const seconds = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return seconds > 0 ? Math.round(seconds * 100) / 100 : null;
}

/* Cookies для закрытых сайтов: путь к файлу или его содержимое (можно base64). */
async function cookiesFile(dir) {
  if (!YTDLP_COOKIES) return null;
  if (!YTDLP_COOKIES.includes('\n') && existsSync(YTDLP_COOKIES)) return YTDLP_COOKIES;
  const raw = /^[A-Za-z0-9+/=\s]+$/.test(YTDLP_COOKIES)
    ? Buffer.from(YTDLP_COOKIES, 'base64').toString('utf8')
    : YTDLP_COOKIES.replace(/\\n/g, '\n');
  const file = path.join(dir, 'cookies.txt');
  await writeFile(file, raw, { mode: 0o600 });
  return file;
}

/* Ссылка → { buffer (mp3), thumb (картинка или null), info }. */
export async function extractLink(url, { onProgress = () => {} } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'nvate-link-'));
  try {
    const args = [
      '--ignore-config', '--no-playlist', '--no-warnings', '--no-cache-dir', '--no-mtime',
      '--use-extractors', 'default,-generic',
      '--match-filter', `!is_live & duration <=? ${MAX_SECONDS}`,
      '--max-filesize', '300M', '--socket-timeout', '20', '--retries', '2',
      '-f', 'bestaudio/best', '-x', '--audio-format', 'mp3', '--audio-quality', '5',
      '--write-thumbnail', '--convert-thumbnails', 'jpg',
      '--newline', '--progress', '--no-simulate',
      '-O', 'after_move:%(.{id,title,track,artist,uploader,channel,duration,extractor_key})j',
      '-o', path.join(dir, 'media.%(ext)s'),
    ];
    if (/[\\/]/.test(FFMPEG_BIN)) args.push('--ffmpeg-location', FFMPEG_BIN);
    if (YTDLP_JS_RUNTIME && YTDLP_JS_RUNTIME !== 'none') args.push('--js-runtimes', YTDLP_JS_RUNTIME);
    if (YTDLP_PROXY) args.push('--proxy', YTDLP_PROXY);
    const cookies = await cookiesFile(dir);
    if (cookies) args.push('--cookies', cookies);
    args.push('--', url);

    let info = null;
    const result = await run(YTDLP_BIN, args, {
      timeout: LINK_TIMEOUT,
      onLine(line) {
        const row = line.trim();
        if (row.startsWith('{')) {
          try { info = JSON.parse(row); } catch { /* не строка сведений */ }
          return;
        }
        const pct = /^\[download\]\s+([\d.]+)%/.exec(row);
        if (pct) onProgress('fetching', Math.min(1, Number(pct[1]) / 100));
        else if (row.startsWith('[ExtractAudio]')) onProgress('converting', null);
      },
    });

    const files = await readdir(dir).catch(() => []);
    const audioName = files.find((name) => name.endsWith('.mp3'));
    if (!audioName) throw new ImportError(importErrorOf(result), result.stderr.slice(-400).trim());
    const file = path.join(dir, audioName);
    if ((await stat(file)).size > MAX_AUDIO_BYTES) throw new ImportError('big');
    const buffer = await readFile(file);
    if (detectFileType(buffer)?.kind !== 'audio') throw new ImportError('failed', 'output is not audio');
    const duration = (await probeSeconds(file)) ?? (Number(info?.duration) > 0 ? Number(info.duration) : null);
    if (duration && duration > MAX_SECONDS + 5) throw new ImportError('long');

    let thumb = null;
    const thumbName = files.find((name) => /\.(?:jpe?g|png|webp)$/i.test(name));
    if (thumbName) {
      const bytes = await readFile(path.join(dir, thumbName)).catch(() => null);
      if (bytes && bytes.length <= MAX_THUMB_BYTES && detectFileType(bytes)?.kind === 'image') thumb = bytes;
    }
    return {
      buffer,
      thumb,
      info: {
        id: text(info?.id, 80),
        title: text(info?.track || info?.title, 200),
        artist: text(info?.artist, 120),
        uploader: text(info?.uploader || info?.channel, 120),
        duration,
      },
    };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/* Видео (или любой звук, который браузер не прочтёт) → { buffer (mp3), duration }. */
export async function extractVideo(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new ImportError('format');
  if (buffer.length > MAX_MEDIA_BYTES) throw new ImportError('big');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'nvate-video-'));
  try {
    const input = path.join(dir, 'input');
    const output = path.join(dir, 'audio.mp3');
    await writeFile(input, buffer);
    const result = await run(FFMPEG_BIN, [
      '-hide_banner', '-nostdin', '-y', '-i', input,
      '-map', '0:a:0', '-vn', '-sn', '-dn', '-ac', '2', '-ar', '44100',
      '-c:a', 'libmp3lame', '-q:a', '5', '-t', String(MAX_SECONDS), output,
    ], { timeout: VIDEO_TIMEOUT });
    const bytes = await readFile(output).catch(() => null);
    if (result.code !== 0 || !bytes?.length) {
      const reason = importErrorOf(result);
      throw new ImportError(result.code === 0 ? 'noaudio' : reason === 'failed' ? 'format' : reason, result.stderr.slice(-300).trim());
    }
    if (bytes.length > MAX_AUDIO_BYTES) throw new ImportError('big');
    if (detectFileType(bytes)?.kind !== 'audio') throw new ImportError('format');
    return { buffer: bytes, duration: await probeSeconds(output) };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/* Что пришло в загрузку: звук, который браузер сыграет как есть, видео (звук
   из него вытащит ffmpeg) или ни то ни другое. У MP4 тип решает бренд: M4A —
   это песня, остальное — ролик. */
const AUDIO_BRANDS = new Set(['M4A ', 'M4B ', 'M4P ', 'F4A ', 'F4B ']);
export function mediaKind(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf.toString('latin1', 4, 8) === 'ftyp') return AUDIO_BRANDS.has(buf.toString('latin1', 8, 12)) ? 'audio' : 'video';
  const type = detectFileType(buf);
  if (type) return type.kind === 'audio' ? 'audio' : null;
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'video';            // webm, mkv
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 11) === 'AVI') return 'video';
  if (buf.toString('latin1', 0, 3) === 'FLV') return 'video';
  if (buf.length > 188 && buf[0] === 0x47 && buf[188] === 0x47) return 'video';                          // MPEG-TS
  return null;
}
