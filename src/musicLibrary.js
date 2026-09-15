// Библиотека nVate: свои полные песни, которые видят все пары.
//
// Файлы лежат в хранилище (src/objectStore.js: uploads или Cloudflare R2),
// сведения — в таблице music_tracks. Пополняет библиотеку админ: загрузкой в
// панели или кнопкой «В библиотеку» под песней, которую прислали боту. Снятая с
// полки песня пропадает из студии, но приглашения, где её уже выбрали, играют
// дальше.

import * as db from './db.js';
import { detectFileType } from './upload.js';
import { objectUrl, putObject, removeObject } from './objectStore.js';

export const MUSIC_CATEGORIES = ['wedding', 'romantic', 'uzbek', 'piano', 'classic', 'emotional', 'chill'];
export const MAX_COVER_BYTES = 4 * 1024 * 1024;
const PAGE = 20;
const CONTENT_TYPES = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', wav: 'audio/wav',
  jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
};

const text = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const categoryOf = (value) => (MUSIC_CATEGORIES.includes(value) ? value : 'wedding');
const seconds = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= 7200 ? Math.round(n * 100) / 100 : null;
};

export const libraryIdValid = (id) => /^\d{1,12}$/.test(String(id ?? ''));

export function libraryTrack(row) {
  return {
    id: String(row.id),
    provider: 'nvate',
    title: row.title,
    artist: row.artist ?? '',
    duration: row.duration == null ? null : Number(row.duration),
    cover: row.cover_key ? objectUrl(row.cover_storage || row.storage, row.cover_key) : null,
    category: row.category,
    playback: 'audio',
    audioUrl: `/api/music/audio/nvate/${row.id}`,
  };
}

function adminTrack(row) {
  return {
    ...libraryTrack(row),
    license: row.license ?? '',
    active: Number(row.is_active) === 1,
    uses: Number(row.uses) || 0,
    storage: row.storage,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function searchLibraryTracks(query, { page = 0, category = null } = {}) {
  const rows = await db.searchLibrary({
    query: text(query, 100),
    category: MUSIC_CATEGORIES.includes(category) ? category : null,
    limit: PAGE + 1,
    offset: page * PAGE,
  });
  return { items: rows.slice(0, PAGE).map(libraryTrack), next: rows.length > PAGE ? page + 1 : null };
}

/* Песня для нового выбора — только с полки. false: такой нет или её сняли. */
export async function activeLibraryTrack(id) {
  if (!libraryIdValid(id)) return false;
  const row = await db.getLibraryTrack(Number(id));
  return row && Number(row.is_active) === 1 ? libraryTrack(row) : false;
}

/* Адрес звука — и у снятых с полки: их ещё играют оформленные приглашения. */
export async function libraryAudioLocation(id) {
  if (!libraryIdValid(id)) return null;
  const row = await db.getLibraryTrack(Number(id));
  return row ? objectUrl(row.storage, row.audio_key) : null;
}

export async function adminLibrary() {
  return (await db.searchLibrary({ activeOnly: false, limit: 500 })).map(adminTrack);
}

export async function createLibraryTrack(buffer, meta = {}) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return null;
  const type = detectFileType(buffer);
  if (type?.kind !== 'audio') return null;
  const stored = await putObject({ buffer, ext: type.ext, contentType: CONTENT_TYPES[type.ext] });
  const id = await db.insertLibraryTrack({
    title: text(meta.title, 120) || 'Musiqa',
    artist: text(meta.artist, 120),
    category: categoryOf(meta.category),
    duration: seconds(meta.duration),
    storage: stored.storage,
    audioKey: stored.key,
    license: text(meta.license, 200),
    source: 'nvate',
  });
  return adminTrack(await db.getLibraryTrack(id));
}

export async function setLibraryCover(id, buffer) {
  if (!libraryIdValid(id) || !Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_COVER_BYTES) return null;
  const row = await db.getLibraryTrack(Number(id));
  if (!row) return null;
  const type = detectFileType(buffer);
  if (type?.kind !== 'image') return null;
  const stored = await putObject({ buffer, ext: type.ext, contentType: CONTENT_TYPES[type.ext] });
  await db.updateLibraryTrack(row.id, { coverKey: stored.key, coverStorage: stored.storage });
  if (row.cover_key) await removeObject(row.cover_storage || row.storage, row.cover_key).catch(() => {});
  return adminTrack(await db.getLibraryTrack(row.id));
}

/* Правки из админки: название, исполнитель, категория, лицензия, видимость. */
export async function saveLibraryEdits(list) {
  for (const item of Array.isArray(list) ? list.slice(0, 500) : []) {
    if (!libraryIdValid(item?.id)) continue;
    const row = await db.getLibraryTrack(Number(item.id));
    if (!row) continue;
    const patch = {};
    if (Object.hasOwn(item, 'title')) patch.title = text(item.title, 120) || row.title;
    if (Object.hasOwn(item, 'artist')) patch.artist = text(item.artist, 120) || null;
    if (Object.hasOwn(item, 'category')) patch.category = categoryOf(item.category);
    if (Object.hasOwn(item, 'license')) patch.license = text(item.license, 200) || null;
    if (Object.hasOwn(item, 'active')) patch.active = item.active === true;
    if (seconds(item.duration)) patch.duration = seconds(item.duration);
    await db.updateLibraryTrack(row.id, patch);
  }
  return adminLibrary();
}

/* Кнопка админа под песней, присланной боту: на полку и обратно. Файл уже лежит
   в uploads — копировать его никуда не нужно. Возвращает, на полке ли песня. */
export async function toggleLibraryFromTrack(track) {
  const known = await db.libraryTrackByLegacy(track.id);
  if (known) {
    const active = Number(known.is_active) !== 1;
    await db.updateLibraryTrack(known.id, { active });
    return active;
  }
  await db.insertLibraryTrack({
    title: text(track.title, 120) || 'Musiqa',
    artist: text(track.artist, 120),
    category: 'wedding',
    duration: seconds(track.duration),
    storage: 'local',
    audioKey: track.file,
    source: track.source || 'bot',
    legacyTrackId: track.id,
  });
  return true;
}

export async function inLibrary(trackId) {
  const known = await db.libraryTrackByLegacy(trackId);
  return Boolean(known && Number(known.is_active) === 1);
}

try {
  const moved = await db.migrateLegacyShelf();
  if (moved) console.log(`[music] со старой полки перенесено песен: ${moved}`);
} catch (error) {
  // Вторая копия сервера перенесла те же песни мгновением раньше.
  if (!/unique|duplicate/i.test(String(error.message))) console.error('[music] перенос старой полки не удался:', error.message);
}
