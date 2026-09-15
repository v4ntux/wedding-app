// Импорт песни: ссылка, ролик YouTube или видеофайл → своя песня пары.
//
// Извлечение идёт от секунд до минут, поэтому это задача с номером: студия её
// ставит и переспрашивает, как дела, бот ждёт её сам. Одновременно работают две
// задачи, остальные стоят в очереди. Уже извлечённая песня второй раз не
// качается: у той же пары вернётся сразу, у другой — переиспользуется файл.

import crypto from 'node:crypto';
import * as db from './db.js';
import { saveUpload } from './upload.js';
import { personalTrack, registerTrack } from './music.js';
import { songMeta, youtubeCover, youtubeIdOf, youtubeIdValid } from './youtube.js';
import { ImportError, MAX_MEDIA_BYTES, extractLink, extractVideo, extractorStatus, linkOf, siteOf } from './extract.js';

const CONCURRENCY = 2;
const QUEUE_MAX = 40;
const PER_OWNER = 3;
const KEEP_MS = 30 * 60_000;
const SITE_LABELS = {
  youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook', vk: 'VK', x: 'X',
  soundcloud: 'SoundCloud', likee: 'Likee', ok: 'OK', pinterest: 'Pinterest', web: 'Link', video: 'Video',
};

const jobs = new Map();
const queue = [];
let running = 0;

const text = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const active = (job) => job.status === 'queued' || job.status === 'working';

function view(job) {
  return {
    id: job.id,
    kind: job.kind,
    site: job.site,
    label: job.label,
    status: job.status,       // queued | working | done | error
    stage: job.stage,         // queued | fetching | converting | saving | done
    progress: job.progress,   // 0…1 или null, пока неизвестно
    error: job.error,
    track: job.track,
  };
}

function remember(owner, fields, extra) {
  const job = {
    id: crypto.randomUUID(), owner, ...fields,
    status: 'queued', stage: 'queued', progress: null, error: null, track: null,
    created: Date.now(), finished: 0, waiters: [],
    ...extra,
  };
  jobs.set(job.id, job);
  return job;
}

/* Эта песня уже извлекалась: своя — вернуть, чужая — тот же файл новой паре. */
async function reuse(owner, source, sourceId) {
  if (!sourceId) return null;
  const mine = await db.trackBySource(owner, source, sourceId);
  if (mine) return personalTrack(mine);
  const other = await db.trackBySource(null, source, sourceId);
  if (!other) return null;
  const copy = await registerTrack(other.file, {
    ownerId: owner, title: other.title, artist: other.artist, duration: other.duration,
    source, sourceId, cover: other.cover,
  });
  return personalTrack(copy);
}

async function enqueue(owner, fields) {
  const same = [...jobs.values()].find((job) => job.owner === owner && active(job) && job.sourceId === fields.sourceId);
  if (same) return view(same);
  const known = await reuse(owner, fields.source, fields.sourceId);
  if (known) {
    const { buffer: _drop, ...rest } = fields;
    return view(remember(owner, rest, { status: 'done', stage: 'done', progress: 1, track: known, finished: Date.now() }));
  }
  const tools = await extractorStatus();
  if (fields.kind === 'video' ? !tools.video : !tools.link) throw new ImportError('unavailable');
  const busy = [...jobs.values()].filter((job) => job.owner === owner && active(job)).length;
  if (busy >= PER_OWNER || queue.length >= QUEUE_MAX) throw new ImportError('busy');
  const job = remember(owner, fields);
  queue.push(job);
  pump();
  return view(job);
}

function pump() {
  while (running < CONCURRENCY && queue.length) {
    const job = queue.shift();
    running += 1;
    work(job).finally(() => {
      running -= 1;
      pump();
    });
  }
}

async function work(job) {
  job.status = 'working';
  job.stage = job.kind === 'video' ? 'converting' : 'fetching';
  try {
    let buffer;
    let thumb = null;
    let meta;
    if (job.kind === 'video') {
      const out = await extractVideo(job.buffer);
      job.buffer = null;
      buffer = out.buffer;
      meta = { title: job.label, artist: job.artist, duration: out.duration };
    } else {
      const out = await extractLink(job.url, {
        onProgress(stage, progress) {
          job.stage = stage;
          if (progress !== null) job.progress = progress;
        },
      });
      buffer = out.buffer;
      thumb = out.thumb;
      const named = job.site === 'youtube'
        ? songMeta(out.info.title, out.info.uploader)
        : { title: out.info.title, artist: out.info.artist || out.info.uploader };
      meta = { ...named, duration: out.info.duration };
    }

    job.stage = 'saving';
    job.progress = null;
    const saved = saveUpload(buffer);
    if (saved?.kind !== 'audio') throw new ImportError('failed', 'saved file is not audio');
    let cover = job.site === 'youtube' && youtubeIdValid(job.sourceId) ? youtubeCover(job.sourceId) : null;
    if (!cover && thumb) {
      const image = saveUpload(thumb);
      if (image?.kind === 'image') cover = `/uploads/${image.file}`;
    }
    const row = await registerTrack(saved.file, {
      ownerId: job.owner,
      title: text(meta.title, 120) || job.label,
      artist: text(meta.artist, 120),
      duration: meta.duration,
      source: job.source,
      sourceId: job.sourceId,
      cover,
    });
    job.track = personalTrack(row);
    job.label = job.track.title;
    job.status = 'done';
    job.stage = 'done';
    job.progress = 1;
  } catch (error) {
    job.buffer = null;
    job.status = 'error';
    job.error = error instanceof ImportError ? error.code : 'failed';
    if (job.error === 'failed' || job.error === 'unavailable') console.error(`[import] ${job.kind} ${job.site} failed:`, error.message);
  } finally {
    job.finished = Date.now();
    for (const resolve of job.waiters.splice(0)) resolve(view(job));
  }
}

/* Любая ссылка из вставленного текста. Ссылка на YouTube идёт как ролик: у него
   стабильный id, обложка и «Топ выбор». */
export async function importLink(owner, raw) {
  const url = await linkOf(raw);
  if (!url) throw new ImportError('link');
  const id = youtubeIdOf(url);
  if (id) return importYoutube(owner, id);
  const site = siteOf(url);
  return enqueue(owner, { kind: 'link', site, source: 'link', sourceId: url.slice(0, 500), url, label: SITE_LABELS[site] });
}

export async function importYoutube(owner, id) {
  if (!youtubeIdValid(id)) throw new ImportError('link');
  return enqueue(owner, {
    kind: 'link', site: 'youtube', source: 'youtube', sourceId: id,
    url: `https://www.youtube.com/watch?v=${id}`, label: SITE_LABELS.youtube,
  });
}

/* Видеофайл из студии или бота. Одно и то же видео дважды не разбирается. */
export async function importVideo(owner, buffer, meta = {}) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new ImportError('format');
  if (buffer.length > MAX_MEDIA_BYTES) throw new ImportError('big');
  const sourceId = crypto.createHash('sha1').update(buffer).digest('hex');
  return enqueue(owner, {
    kind: 'video', site: 'video', source: 'video', sourceId, buffer,
    label: text(meta.title, 120) || SITE_LABELS.video, artist: text(meta.artist, 120),
  });
}

/* Задача глазами её владельца: чужую не покажем. */
export function importJob(owner, id) {
  const job = jobs.get(String(id ?? ''));
  return job && job.owner === owner ? view(job) : null;
}

/* Бот ждёт результат, а не переспрашивает. */
export function waitForImport(id) {
  const job = jobs.get(String(id ?? ''));
  if (!job) return Promise.resolve(null);
  if (!active(job)) return Promise.resolve(view(job));
  return new Promise((resolve) => job.waiters.push(resolve));
}

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) if (!active(job) && now - job.finished > KEEP_MS) jobs.delete(id);
}, 5 * 60_000).unref();
