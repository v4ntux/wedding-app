// Личная музыка пары: песни, присланные боту, и файлы, загруженные в студии.
//
// Узбекская музыка ходит по Telegram-каналам: переслать песню боту быстрее, чем
// искать её где-то ещё. Звук лежит в uploads, сведения — в таблице tracks. В
// студии это источник «Mening» — та же карточка Track, что у библиотеки nVate,
// Audius и YouTube.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { detectFileType, saveUpload, UPLOADS_DIR } from './upload.js';
import * as db from './db.js';

// Больше Bot API скачать не даст, и в студии держим тот же предел.
export const MAX_TRACK_BYTES = 20 * 1024 * 1024;
const PAGE = 20;
const AUDIO_NAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp3|m4a|ogg|wav)$/;

const text = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export const uploadIdValid = (id) => AUDIO_NAME_RE.test(String(id ?? ''));

/* «Artist - Title.mp3» → { artist, title }. Без дефиса всё имя — название. */
export function metaFromFileName(name) {
  const base = text(String(name ?? '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/_+/g, ' '), 200);
  const pair = /^(.+?)\s+[-–—]\s+(.+)$/.exec(base);
  if (pair) return { artist: text(pair[1], 120), title: text(pair[2], 120) };
  return { artist: '', title: text(base, 120) };
}

export function personalTrack(row) {
  return {
    id: row.file,
    provider: 'upload',
    title: row.title,
    artist: row.artist ?? '',
    duration: row.duration == null ? null : Number(row.duration),
    cover: null,
    playback: 'audio',
    audioUrl: `/uploads/${row.file}`,
  };
}

/* Файл уже лежит в uploads (загрузка из студии). */
export async function registerTrack(file, meta = {}) {
  const id = await db.insertTrack({
    ownerId: meta.ownerId ?? null,
    file,
    title: text(meta.title, 120) || 'Musiqa',
    artist: text(meta.artist, 120) || null,
    duration: meta.duration,
    source: meta.source ?? 'upload',
    sourceId: meta.sourceId ?? null,
    topStart: meta.topStart ?? null,
    tgUniqueId: meta.tgUniqueId ?? null,
    library: meta.library === true,
  });
  return db.getTrack(id);
}

/* Байты → трек. null, если это не звук. Повторно пересланный из Telegram файл
   у того же владельца не дублируется — вернётся уже сохранённый трек. */
export async function addTrack(buffer, meta = {}) {
  if (meta.tgUniqueId && meta.ownerId != null) {
    const known = await db.trackByTelegram(meta.ownerId, meta.tgUniqueId);
    if (known) return { track: known, duplicate: true };
  }
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_TRACK_BYTES) return null;
  if (detectFileType(buffer)?.kind !== 'audio') return null;
  const saved = saveUpload(buffer);
  try {
    return { track: await registerTrack(saved.file, meta), duplicate: false };
  } catch (error) {
    // Две одинаковые пересылки подряд: уникальный индекс пропустил только первую.
    const concurrent = meta.tgUniqueId && await db.trackByTelegram(meta.ownerId, meta.tgUniqueId);
    if (concurrent) return { track: concurrent, duplicate: true };
    throw error;
  }
}

/* Своя музыка пары — только своя: без владельца список пуст. */
export async function searchUserTracks(query, { owner = null, page = 0 } = {}) {
  if (owner === null || owner === undefined) return { items: [], next: null };
  const needle = text(query, 100).toLowerCase();
  const rows = await db.listTracksByOwner(owner, 200);
  const all = rows
    .filter((row) => !needle || `${row.title} ${row.artist ?? ''}`.toLowerCase().includes(needle))
    .map(personalTrack);
  const from = page * PAGE;
  return { items: all.slice(from, from + PAGE), next: from + PAGE < all.length ? page + 1 : null };
}

/* Файл по имени. Файлы, загруженные до таблицы tracks, сведений не имеют — но
   играть обязаны. */
export async function uploadTrack(file) {
  if (!uploadIdValid(file)) return false;
  const row = await db.trackByFile(file);
  if (row) return personalTrack(row);
  if (!existsSync(path.join(UPLOADS_DIR, file))) return false;
  return personalTrack({ file, title: 'Musiqa', artist: '', duration: null });
}

/* Подпись трека для карточки заявки: «Название — Исполнитель». */
export async function trackLabel(file) {
  const track = file ? await db.trackByFile(file) : null;
  return track ? [track.title, track.artist].filter(Boolean).join(' — ') : null;
}
