// Поиск песен на YouTube.
//
// Узбекская музыка живёт на YouTube, а музыкальные API (iTunes, Deezer, Spotify)
// отдают только тридцатисекундные превью. В приглашении такой трек играет
// официальный плеер YouTube, поэтому годится только то, что автор разрешил
// встраивать, а начало не выбирается: звук идёт с начала ролика.
//
// С ключом YOUTUBE_API_KEY поиск идёт через Data API v3 (официально, 10 000
// единиц квоты в сутки бесплатно, запрос стоит ~101). Без ключа — через страницу
// выдачи youtube.com: работает сразу, но зависит от её разметки.

import { YOUTUBE_API_KEY } from './config.js';

const SEARCH_TTL = 10 * 60_000;
const EMBED_TTL = 24 * 60 * 60_000;
const MAX_SECONDS = 15 * 60;          // часовые миксы и концерты свадьбе не нужны
const searchCache = new Map();
const embedCache = new Map();

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

const card = (video) => ({
  ...video,
  url: `https://www.youtube.com/watch?v=${video.id}`,
  thumb: `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`,
});

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
    part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '10', regionCode: 'UZ', q, key,
  })}`, { signal: AbortSignal.timeout(8000) });
  const found = await search.json();
  if (!search.ok) throw new Error(found?.error?.message || `search ${search.status}`);
  const ids = (found.items ?? []).map((item) => item.id?.videoId).filter(Boolean);
  if (!ids.length) return [];
  const details = await fetch(`https://www.googleapis.com/youtube/v3/videos?${new URLSearchParams({
    part: 'snippet,contentDetails', id: ids.join(','), key,
  })}`, { signal: AbortSignal.timeout(8000) });
  const videos = await details.json();
  if (!details.ok) throw new Error(videos?.error?.message || `videos ${details.status}`);
  return (videos.items ?? []).map((v) => ({
    id: v.id,
    title: text(v.snippet?.title, 140),
    channel: text(v.snippet?.channelTitle, 80),
    duration: isoDuration(v.contentDetails?.duration),
    embeddable: true,
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

export async function searchYoutube(query) {
  const q = text(query, 100);
  if (q.length < 2) return [];
  const key = q.toLowerCase();
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
  const allowed = await Promise.all(candidates.map((video) => (video.embeddable ? true : embedInfo(video.id))));
  const results = candidates
    .filter((_, i) => allowed[i])
    .slice(0, 8)
    .map(({ embeddable, ...video }) => card(video));
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
