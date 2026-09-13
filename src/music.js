// Полные треки платформы.
//
// iTunes, Deezer и Spotify отдают по API только 30-секундные превью: пара
// ставила начало на 0:17, и гости слышали тринадцать секунд и петлю. Поэтому
// звук живёт у нас. Песню находят поиском по YouTube — сервер забирает её
// целиком, одну на всех. Её же можно переслать боту (узбекская музыка и так
// ходит по Telegram-каналам) или загрузить файлом. Сам звук лежит в uploads,
// сведения о нём — в таблице tracks.

import { detectFileType, saveUpload } from './upload.js';
import { downloadAudio } from './download.js';
import { songInfo, songMeta, topMoment } from './youtube.js';
import * as db from './db.js';

// Больше Bot API скачать не даст, и в студии держим тот же предел.
export const MAX_TRACK_BYTES = 20 * 1024 * 1024;

const text = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/* «Artist - Title.mp3» → { artist, title }. Без дефиса всё имя — название. */
export function metaFromFileName(name) {
  const base = text(String(name ?? '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/_+/g, ' '), 200);
  const pair = /^(.+?)\s+[-–—]\s+(.+)$/.exec(base);
  if (pair) return { artist: text(pair[1], 120), title: text(pair[2], 120) };
  return { artist: '', title: text(base, 120) };
}

export function publicTrack(row) {
  return {
    id: Number(row.id),
    title: row.title,
    artist: row.artist ?? '',
    duration: row.duration == null ? null : Number(row.duration),
    file: row.file,
    url: `/uploads/${row.file}`,
    uses: Number(row.uses) || 0,
    library: Number(row.library) === 1,
    youtubeId: row.source === 'youtube' ? row.source_id : null,
  };
}

/* Файл уже лежит в uploads (загрузка из студии, извлечение по ссылке). */
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

/* Песня с YouTube одна на всех: первая пара ждёт скачивания, следующие получают
   готовый файл сразу. Владельца у неё нет — это общая песня, а не чья-то личная. */
const fetching = new Map();

export async function youtubeSong(id, { download = downloadAudio, info = songInfo, top = topMoment } = {}) {
  const known = await db.trackBySource('youtube', id);
  if (known) return known;
  if (!fetching.has(id)) {
    fetching.set(id, fetchYoutubeSong(id, { download, info, top }).finally(() => fetching.delete(id)));
  }
  return fetching.get(id);
}

async function fetchYoutubeSong(id, { download, info, top }) {
  const [file, meta, topStart] = await Promise.all([
    download(`https://www.youtube.com/watch?v=${id}`, { maxBytes: MAX_TRACK_BYTES }),
    info(id).catch(() => ({})),
    top(id).catch(() => null),
  ]);
  if (!file) return null;
  const named = songMeta(file.name.replace(/\.[a-z0-9]{2,5}$/i, ''));
  try {
    const added = await addTrack(file.buffer, {
      source: 'youtube',
      sourceId: id,
      title: meta.title || named.title,
      artist: meta.artist || named.artist,
      duration: meta.duration,
      topStart,
    });
    return added?.track ?? null;
  } catch (error) {
    // Вторая копия сервера скачала ту же песню чуть раньше.
    const raced = await db.trackBySource('youtube', id);
    if (raced) return raced;
    throw error;
  }
}

/* TikTok, Instagram: звук из ролика становится личной песней пары. */
export async function linkSong(url, ownerId, { download = downloadAudio } = {}) {
  const file = await download(url, { maxBytes: MAX_TRACK_BYTES });
  if (!file) return null;
  const named = metaFromFileName(file.name);
  const added = await addTrack(file.buffer, {
    ownerId,
    source: 'link',
    title: named.title || new URL(url).hostname.replace(/^www\./, ''),
    artist: named.artist,
  });
  return added?.track ?? null;
}

export async function libraryTracks() {
  return (await db.listLibrary()).map(publicTrack);
}

export async function userTracks(ownerId) {
  return (await db.listTracksByOwner(ownerId)).map(publicTrack);
}

/* Правки полки из админки: названия и состав. Кого нет в списке — снят с полки,
   но файл остаётся: его уже могут играть оформленные приглашения. */
export async function saveLibrary(list) {
  const incoming = new Map();
  for (const item of Array.isArray(list) ? list : []) {
    const id = Number(item?.id);
    if (Number.isInteger(id)) incoming.set(id, item);
  }
  for (const row of await db.listLibrary()) {
    const item = incoming.get(Number(row.id));
    if (!item) {
      await db.setTrackLibrary(row.id, false);
      continue;
    }
    await db.updateTrackMeta(row.id, text(item.title, 120) || row.title, text(item.artist, 120));
  }
  return libraryTracks();
}

/* Подпись трека для карточки заявки: «Название — Исполнитель». */
export async function trackLabel(file) {
  const track = file ? await db.trackByFile(file) : null;
  return track ? [track.title, track.artist].filter(Boolean).join(' — ') : null;
}
