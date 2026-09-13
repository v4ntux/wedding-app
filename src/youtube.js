// Песни с YouTube: поиск, названия и «Топ выбор».
//
// Узбекская музыка живёт на YouTube, а музыкальные API (iTunes, Deezer, Spotify)
// отдают только тридцатисекундные превью. Поэтому YouTube служит каталогом, а
// звук выбранной песни сервер забирает к себе целиком (src/download.js): так у
// неё есть волна и выбор начала. Без yt-dlp песня играет официальным плеером —
// тогда годится только то, что автор разрешил встраивать.
//
// С ключом YOUTUBE_API_KEY поиск идёт через Data API v3 (официально, 10 000
// единиц квоты в сутки бесплатно, запрос стоит ~101). Без ключа — через страницу
// выдачи youtube.com: работает сразу, но зависит от её разметки.

import { YOUTUBE_API_KEY } from './config.js';

const SEARCH_TTL = 10 * 60_000;
const EMBED_TTL = 24 * 60 * 60_000;
const TOP_TTL = 24 * 60 * 60_000;
const MAX_SECONDS = 15 * 60;          // часовые миксы и концерты свадьбе не нужны
const searchCache = new Map();
const embedCache = new Map();
const topCache = new Map();
const cards = new Map();              // карточки из поиска: по ним скачанная песня получает имя

const BROWSER = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
  'Accept-Language': 'uz,ru;q=0.8,en;q=0.6',
  // Без согласия на cookie европейские узлы отдают страницу-заглушку.
  Cookie: 'CONSENT=YES+cb; SOCS=CAI',
};

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/;
const text = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function youtubeIdOf(url) {
  return String(url ?? '').match(YOUTUBE_RE)?.[1] ?? null;
}

/* «3:45» или «1:02:03» → секунды. */
export function parseDuration(value) {
  const parts = String(value ?? '').trim().split(':');
  if (!parts[0] || parts.some((part) => !/^\d+$/.test(part))) return null;
  return parts.reduce((sum, part) => sum * 60 + Number(part), 0);
}

function isoDuration(value) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(value ?? ''));
  return m ? Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0) : null;
}

/* «Shahzoda - Yomg'ir | Шахзода - Ёмгир (AUDIO)» → исполнитель и название.
   В списке песня должна читаться как песня, а не как заголовок ролика. */
export function songMeta(title, channel = '') {
  const raw = text(title, 200);
  let name = raw.split(/\s+[|/]\s+/)[0]
    .replace(/\s*[(\[][^)\]]*(?:official|video|audio|clip|klip|lyric|премьера|mp3|hd|4k)[^)\]]*[)\]]/giu, '')
    .trim();
  const pair = /^(.+?)\s+[-–—]\s+(.+)$/.exec(name);
  if (pair) name = pair[2];
  const artist = pair ? pair[1] : text(channel, 120).replace(/\s*-\s*topic$/i, '').replace(/\s*(?:official|vevo)$/i, '');
  return { title: text(name, 120) || text(raw, 120), artist: text(artist, 120) };
}

const card = (video) => ({
  id: video.id,
  ...songMeta(video.title, video.channel),
  duration: video.duration ?? null,
  url: `https://www.youtube.com/watch?v=${video.id}`,
  thumb: `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`,
});

function remember(song) {
  cards.set(song.id, song);
  if (cards.size > 2000) cards.delete(cards.keys().next().value);
}

/* Страница выдачи: все данные лежат JSON-ом в ytInitialData. */
export function parseResultsPage(html) {
  const marker = html.indexOf('ytInitialData');
  const start = marker < 0 ? -1 : html.indexOf('{', marker);
  const end = start < 0 ? -1 : html.indexOf(';</script>', start);
  if (start < 0 || end < 0) return [];
  let data;
  try { data = JSON.parse(html.slice(start, end)); } catch { return []; }
  const found = [];
  (function walk(node) {
    if (!node || typeof node !== 'object' || found.length >= 30) return;
    if (node.videoRenderer) {
      const v = node.videoRenderer;
      const duration = parseDuration(v.lengthText?.simpleText);
      // Без длительности — это прямой эфир или премьера.
      if (v.videoId && duration) {
        found.push({
          id: v.videoId,
          title: text((v.title?.runs ?? []).map((run) => run.text).join('') || v.title?.simpleText, 140),
          channel: text(v.ownerText?.runs?.[0]?.text, 80),
          duration,
        });
      }
      return;
    }
    for (const key of Object.keys(node)) walk(node[key]);
  })(data);
  return found;
}

async function searchPage(q) {
  const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, {
    headers: BROWSER,
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`results ${response.status}`);
  return parseResultsPage(await response.text());
}

async function searchOfficial(q) {
  const key = YOUTUBE_API_KEY;
  const search = await fetch(`https://www.googleapis.com/youtube/v3/search?${new URLSearchParams({
    part: 'snippet', type: 'video', maxResults: '12', regionCode: 'UZ', q, key,
  })}`, { signal: AbortSignal.timeout(8000) });
  const found = await search.json();
  if (!search.ok) throw new Error(found?.error?.message || `search ${search.status}`);
  const ids = (found.items ?? []).map((item) => item.id?.videoId).filter(Boolean);
  if (!ids.length) return [];
  const details = await fetch(`https://www.googleapis.com/youtube/v3/videos?${new URLSearchParams({
    part: 'snippet,contentDetails,status', id: ids.join(','), key,
  })}`, { signal: AbortSignal.timeout(8000) });
  const videos = await details.json();
  if (!details.ok) throw new Error(videos?.error?.message || `videos ${details.status}`);
  return (videos.items ?? []).map((v) => ({
    id: v.id,
    title: text(v.snippet?.title, 140),
    channel: text(v.snippet?.channelTitle, 80),
    duration: isoDuration(v.contentDetails?.duration),
    embeddable: v.status?.embeddable === true,
  })).filter((v) => v.duration);
}

/* Можно ли встроить ролик: oEmbed отвечает 401, если автор запретил показ на
   других сайтах, и 404, если ролика нет. Сетевую ошибку не кешируем. */
export async function embedInfo(id) {
  const hit = embedCache.get(id);
  if (hit && hit.until > Date.now()) return hit.info;
  let response;
  try {
    response = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, {
      signal: AbortSignal.timeout(6000),
    });
  } catch {
    return null;
  }
  let info = false;
  if (response.ok) {
    const data = await response.json().catch(() => ({}));
    info = { title: text(data.title, 140), channel: text(data.author_name, 80) };
  } else if (response.status >= 500) {
    return null;
  }
  embedCache.set(id, { info, until: Date.now() + EMBED_TTL });
  if (embedCache.size > 2000) embedCache.delete(embedCache.keys().next().value);
  return info;
}

/* embeddable: false — песню скачиваем к себе, и запрет автора на встраивание ей
   не мешает; проверять каждый ролик через oEmbed тогда незачем. */
export async function searchYoutube(query, { embeddable = true } = {}) {
  const q = text(query, 100);
  if (q.length < 2) return [];
  const key = `${embeddable ? 'embed' : 'any'}:${q.toLowerCase()}`;
  const hit = searchCache.get(key);
  if (hit && hit.until > Date.now()) return hit.results;

  let found = [];
  if (YOUTUBE_API_KEY) {
    try { found = await searchOfficial(q); } catch (error) { console.error('[youtube] api search failed:', error.message); }
  }
  if (!found.length) {
    try { found = await searchPage(q); } catch (error) { console.error('[youtube] page search failed:', error.message); }
  }

  const candidates = found.filter((video) => video.duration <= MAX_SECONDS).slice(0, 12);
  const allowed = await Promise.all(candidates.map((video) => (!embeddable || video.embeddable ? true : embedInfo(video.id))));
  const results = candidates.filter((_, i) => allowed[i]).slice(0, 10).map(card);
  results.forEach(remember);
  if (results.length) {
    searchCache.set(key, { results, until: Date.now() + SEARCH_TTL });
    if (searchCache.size > 300) searchCache.delete(searchCache.keys().next().value);
  }
  return results;
}

/* Ссылка, вставленная парой: проверяем, что ролик есть и его можно встроить. */
export async function youtubeVideo(url) {
  const id = youtubeIdOf(url);
  if (!id) return { status: 'bad-link' };
  const info = await embedInfo(id);
  if (info === null) return { status: 'unavailable' };
  if (info === false) return { status: 'blocked' };
  return { status: 'ok', video: card({ id, title: info.title, channel: info.channel, duration: null }) };
}

/* Имя скачанной песни: из недавнего поиска, иначе у oEmbed. */
export async function songInfo(id) {
  const known = cards.get(id);
  if (known) return known;
  const info = await embedInfo(id);
  return info ? { ...songMeta(info.title, info.channel), duration: null } : {};
}

/* ── «Топ выбор» ──
   Под роликом YouTube рисует график «самые пересматриваемые моменты». Его точки
   лежат на странице ролика тепловой картой. */
export function parseHeatmap(html) {
  const m = /"markerType":"MARKER_TYPE_HEATMAP","markers":(\[.*?\])/.exec(String(html ?? ''));
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

/* Откуда песню переслушивают чаще всего — обычно это припев. Начало смотрят все
   подряд, поэтому вступление и хвост не считаем, а ровный график пика не даёт.
   Встаём на две секунды раньше пика, чтобы не срезать фразу. */
export function peakMoment(markers) {
  const points = (Array.isArray(markers) ? markers : [])
    .map((m) => ({ at: Number(m.startMillis) / 1000, len: Number(m.durationMillis) / 1000, v: Number(m.intensityScoreNormalized) }))
    .filter((p) => Number.isFinite(p.at) && Number.isFinite(p.v));
  if (points.length < 20) return null;
  const last = points.at(-1);
  const end = last.at + (Number.isFinite(last.len) ? last.len : 0);
  const body = points.filter((p) => p.at >= Math.max(15, end * .1) && p.at <= end * .85);
  if (!body.length) return null;
  const best = body.reduce((a, b) => (b.v > a.v ? b : a));
  const values = body.map((p) => p.v).sort((a, b) => a - b);
  if (best.v - values[Math.floor(values.length / 2)] < .04) return null;
  return Math.max(0, Math.floor(best.at - 2));
}

export async function topMoment(id) {
  if (!/^[\w-]{11}$/.test(String(id ?? ''))) return null;
  const hit = topCache.get(id);
  if (hit && hit.until > Date.now()) return hit.top;
  let top;
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${id}`, { headers: BROWSER, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    top = peakMoment(parseHeatmap(await response.text()));
  } catch {
    return null;
  }
  topCache.set(id, { top, until: Date.now() + TOP_TTL });
  if (topCache.size > 2000) topCache.delete(topCache.keys().next().value);
  return top;
}
