// Audius — открытый каталог полных песен с официальным публичным API.
//
// Сервер ищет песни и отдаёт их студии той же карточкой Track, что и остальные
// источники. Звук идёт не через нас: адрес /api/music/audio/audius/<id> ведёт
// на поток Audius, а тот — на ближайший узел с файлом.

import { AUDIUS_API, AUDIUS_APP_NAME } from './config.js';

const TIMEOUT = 7000;
const SEARCH_TTL = 10 * 60_000;
const PAGE = 20;
const ID_RE = /^[A-Za-z0-9]{3,16}$/;
const cache = new Map();
const text = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export const audiusIdValid = (id) => ID_RE.test(String(id ?? ''));

async function call(pathname, params = {}) {
  const url = new URL(`${AUDIUS_API}/v1${pathname}`);
  for (const [key, value] of Object.entries({ ...params, app_name: AUDIUS_APP_NAME })) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`audius ${response.status}`);
  const body = await response.json();
  return body?.data ?? null;
}

/* Карточка песни. Закрытые, удалённые и платные песни в выдачу не попадают:
   послушать их всё равно нельзя. */
export function audiusTrack(raw) {
  if (!raw || !audiusIdValid(raw.id)) return null;
  if (raw.is_delete || raw.is_available === false || raw.is_streamable === false) return null;
  if (raw.is_stream_gated || raw.access?.stream === false) return null;
  const duration = Number(raw.duration);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const art = raw.artwork && typeof raw.artwork === 'object' ? raw.artwork : {};
  const cover = [art['480x480'], art['150x150'], art['1000x1000']]
    .find((url) => /^https:\/\/[^\s"'<>]+$/.test(String(url ?? ''))) ?? null;
  return {
    id: raw.id,
    provider: 'audius',
    title: text(raw.title, 120) || 'Audius',
    artist: text(raw.user?.name, 120),
    duration,
    cover,
    playback: 'audio',
    audioUrl: `/api/music/audio/audius/${raw.id}`,
  };
}

// Без запроса открывается подборка — чтобы вкладка не была пустой до первой буквы.
const BROWSE_QUERY = 'wedding';

export async function searchAudius(query, { page = 0 } = {}) {
  const q = text(query, 100);
  const search = q.length >= 2 ? q : BROWSE_QUERY;
  const key = `${search.toLowerCase()}#${page}`;
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  // Одна лишняя строка говорит, есть ли следующая страница.
  const data = await call('/tracks/search', { query: search, limit: PAGE + 1, offset: page * PAGE });
  const rows = Array.isArray(data) ? data : [];
  const seen = new Set();
  const items = rows.slice(0, PAGE).map(audiusTrack).filter((track) => {
    if (!track || seen.has(track.id)) return false;
    seen.add(track.id);
    return true;
  });
  const value = { items, next: rows.length > PAGE ? page + 1 : null };
  cache.set(key, { value, until: Date.now() + SEARCH_TTL });
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  return value;
}

/* Песня по id: Track, false — такой нет или слушать нельзя, null — Audius не ответил. */
export async function getAudiusTrack(id) {
  if (!audiusIdValid(id)) return false;
  let raw;
  try {
    raw = await call(`/tracks/${id}`);
  } catch {
    return null;
  }
  return audiusTrack(raw) ?? false;
}

export function audiusStreamUrl(id) {
  if (!audiusIdValid(id)) return null;
  return `${AUDIUS_API}/v1/tracks/${id}/stream?app_name=${encodeURIComponent(AUDIUS_APP_NAME)}`;
}
