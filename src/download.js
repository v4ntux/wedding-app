// Песня целиком по ссылке: YouTube, TikTok, Instagram — через yt-dlp.
//
// Берём звуковую дорожку m4a: AAC играет везде, включая iPhone, и перекодировать
// ничего не нужно — ffmpeg в образе не держим. TikTok отдельной дорожки не даёт,
// тогда берём ролик mp4 целиком: браузер сыграет из него звук.
//
// Адреса дата-центров YouTube встречает вопросом «Sign in to confirm you're not
// a bot» — так он отвечает и Railway. Помогают cookies запасного аккаунта
// (YTDLP_COOKIES) или другой адрес (YTDLP_PROXY). Cookies живут файлом на
// volume: после каждого запуска yt-dlp дописывает туда обновлённую сессию, а
// копия из переменной устарела бы через день-другой.

import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { YTDLP_BIN, YTDLP_COOKIES, YTDLP_PROXY } from './config.js';

export const MAX_SONG_SECONDS = 15 * 60;
const PARALLEL = 2;          // yt-dlp тяжёлый: больше двух скачиваний сразу сервер не держит
const TIMEOUT = 120_000;
const DATA_DIR = path.resolve(process.env.NVATE_DATA_DIR || path.join(process.cwd(), 'data'));
export const COOKIE_JAR = path.join(DATA_DIR, 'ytdlp', 'cookies.txt');

/* Почему песню не отдали. Код уходит в студию — паре объясняют, что делать
   дальше, — а «blocked» ещё и в админку: YouTube перестал пускать сервер. */
export class DownloadError extends Error {
  constructor(code, detail = '') {
    super(`download ${code}`);
    this.code = code;          // blocked | too-long | too-big | unavailable | failed
    this.detail = detail;
  }
}

export function failureCode(log) {
  const text = String(log ?? '');
  // «Sign in to confirm your age» — возрастной запрет, а не проверка на бота.
  if (/confirm your age|age.restricted|inappropriate for some users/i.test(text)) return 'unavailable';
  if (/not a bot|sign in to confirm|LOGIN_REQUIRED|HTTP Error 429/i.test(text)) return 'blocked';
  if (/does not pass filter/i.test(text)) return 'too-long';
  if (/larger than max-filesize/i.test(text)) return 'too-big';
  if (/video unavailable|private video|has been removed|not available in your country|members.only|premieres in/i.test(text)) return 'unavailable';
  return 'failed';
}

const health = { okAt: null, blockedAt: null, failedAt: null, lastError: null };

export function downloadHealth() {
  return { ...health, cookies: Boolean(YTDLP_COOKIES.trim()), proxy: Boolean(YTDLP_PROXY) };
}

function remember(code, detail) {
  const at = Date.now();
  if (code === 'blocked') health.blockedAt = at;
  else if (code === 'failed') health.failedAt = at;
  else return;                 // длинная или закрытая песня — дело песни, а не сервера
  health.lastError = { code, at, detail: String(detail ?? '').trim().slice(-300) };
}

function run(bin, args, timeout) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout, maxBuffer: 4 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      // Отказ фильтра длины или размера yt-dlp печатает в stdout и выходит без ошибки.
      const log = `${stdout ?? ''}\n${stderr ?? ''}`.trim();
      if (!error) { resolve(log); return; }
      error.detail = log.slice(-600);
      reject(error);
    });
  });
}

let ready = null;
export function downloadReady() {
  ready ??= run(YTDLP_BIN, ['--version'], 15_000).then(
    (version) => { console.log(`[download] yt-dlp ${version.trim()}`); return true; },
    () => { console.warn('[download] yt-dlp не найден — песни с YouTube скачивать нечем'); return false; },
  );
  return ready;
}

let active = 0;
const waiting = [];
async function turn(work) {
  if (active < PARALLEL) active += 1;
  else await new Promise((resolve) => waiting.push(resolve));
  try {
    return await work();
  } finally {
    const next = waiting.shift();
    if (next) next(); else active -= 1;
  }
}

/* cookies.txt ломается при вставке в переменную: табы становятся пробелами,
   переводы строк — буквами \n, теряется заголовок. Такой файл yt-dlp молча не
   читает, поэтому чиним его сами. */
export function normalizeCookies(text) {
  let body = String(text ?? '').replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');
  if (!body.trim()) return '';
  if (!body.includes('\n') && body.includes('\\n')) body = body.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  const lines = body.split('\n').map((line) => {
    if (line.includes('\t')) return line;
    const row = line.trim();
    if (!row || (row.startsWith('#') && !row.startsWith('#HttpOnly_'))) return row;
    const parts = row.split(/\s+/);
    return parts.length >= 7 ? [...parts.slice(0, 6), parts.slice(6).join(' ')].join('\t') : row;
  });
  if (!/^# (Netscape )?HTTP Cookie File/i.test(lines[0])) lines.unshift('# Netscape HTTP Cookie File');
  return `${lines.join('\n')}\n`;
}

/* Сессию из переменной кладём на volume один раз, дальше файл ведёт yt-dlp.
   Поменяли переменную — файл засевается заново. */
async function sessionJar(cookies, jar) {
  const seed = normalizeCookies(cookies);
  if (!seed || !jar) return null;
  const mark = `${jar}.seed`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  const [known, current] = await Promise.all([
    readFile(mark, 'utf8').catch(() => ''),
    readFile(jar, 'utf8').catch(() => ''),
  ]);
  if (known.trim() !== hash || !current.trim()) {
    await mkdir(path.dirname(jar), { recursive: true });
    await writeFile(jar, seed, { mode: 0o600 });
    await writeFile(mark, hash);
  }
  return jar;
}

async function keepSession(copy, jar) {
  const text = await readFile(copy, 'utf8').catch(() => '');
  if (/^# (Netscape )?HTTP Cookie File/i.test(text) && text.includes('\t')) {
    await writeFile(jar, text, { mode: 0o600 }).catch(() => {});
  }
}

/* Скачивает звук во временную папку. Возвращает { buffer, name }; не вышло —
   бросает DownloadError с причиной. */
export function downloadAudio(url, { maxBytes, exec = run, cookies = YTDLP_COOKIES, jar = COOKIE_JAR, proxy = YTDLP_PROXY } = {}) {
  return turn(async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'nvate-song-'));
    try {
      const out = path.join(dir, 'out');
      const args = [
        '--no-playlist', '--no-progress', '--no-warnings', '--no-mtime',
        '--js-runtimes', 'node',
        '-f', 'bestaudio[ext=m4a]/best[ext=mp4]',
        '--match-filter', `duration <= ${MAX_SONG_SECONDS}`,
        '--max-filesize', String(maxBytes),
        '-o', path.join(out, '%(title).150B.%(ext)s'),
      ];
      // yt-dlp переписывает файл cookies при выходе. Даём ему копию — два
      // скачивания разом не пишут в один файл, — и забираем её обратно.
      const saved = await sessionJar(cookies, jar);
      const copy = saved ? path.join(dir, 'cookies.txt') : null;
      if (copy) {
        await copyFile(saved, copy);
        args.push('--cookies', copy);
      }
      if (proxy) args.push('--proxy', proxy);
      args.push('--', url);

      let log = '';
      try {
        log = String((await exec(YTDLP_BIN, args, TIMEOUT)) ?? '');
      } catch (error) {
        const detail = String(error.detail || error.message || '');
        const code = error.killed ? 'failed' : failureCode(detail);
        remember(code, detail);
        console.error(`[download] yt-dlp failed (${code}):`, detail.slice(-500));
        throw new DownloadError(code, detail);
      } finally {
        if (copy) await keepSession(copy, saved);
      }

      const name = (await readdir(out).catch(() => [])).find((file) => !/\.(part|ytdl|json)$/i.test(file));
      const buffer = name ? await readFile(path.join(out, name)) : null;
      if (!buffer || buffer.length > maxBytes) {
        const code = buffer ? 'too-big' : failureCode(log);
        remember(code, log);
        throw new DownloadError(code, log.slice(-600));
      }
      health.okAt = Date.now();
      return { buffer, name };
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });
}
