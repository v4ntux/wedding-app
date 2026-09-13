// Песня целиком по ссылке: YouTube, TikTok, Instagram — через yt-dlp.
//
// Берём звуковую дорожку m4a: AAC играет везде, включая iPhone, и перекодировать
// ничего не нужно — ffmpeg в образе не держим. TikTok отдельной дорожки не даёт,
// тогда берём ролик mp4 целиком: браузер сыграет из него звук.

import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { YTDLP_BIN, YTDLP_COOKIES } from './config.js';

export const MAX_SONG_SECONDS = 15 * 60;
const PARALLEL = 2;          // yt-dlp тяжёлый: больше двух скачиваний сразу сервер не держит

function run(bin, args, timeout) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout, maxBuffer: 4 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      if (!error) { resolve(String(stdout)); return; }
      error.detail = String(stderr || '').trim().slice(-500);
      reject(error);
    });
  });
}

let ready = null;
export function downloadReady() {
  ready ??= run(YTDLP_BIN, ['--version'], 15_000).then(
    (version) => { console.log(`[download] yt-dlp ${version.trim()}`); return true; },
    () => { console.warn('[download] yt-dlp не найден — песни с YouTube играют через плеер YouTube'); return false; },
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

/* Скачивает звук во временную папку. Возвращает { buffer, name } или null. */
export function downloadAudio(url, { maxBytes, exec = run } = {}) {
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
      if (YTDLP_COOKIES.trim()) {
        const cookies = path.join(dir, 'cookies.txt');
        await writeFile(cookies, YTDLP_COOKIES);
        args.push('--cookies', cookies);
      }
      args.push('--', url);
      try {
        await exec(YTDLP_BIN, args, 150_000);
      } catch (error) {
        console.error('[download] yt-dlp failed:', error.detail || error.message);
        return null;
      }
      const name = (await readdir(out).catch(() => [])).find((file) => !/\.(part|ytdl|json)$/i.test(file));
      if (!name) return null;
      const buffer = await readFile(path.join(out, name));
      return buffer.length <= maxBytes ? { buffer, name } : null;
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });
}
