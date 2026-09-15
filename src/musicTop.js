// «Топ nVate»: песни, которые пары чаще всего ставят в свои приглашения.
//
// Показывается в поиске YouTube, пока строка пуста: песню, выбранную одной
// парой, видят следующие. В топ идёт только то, что пришло с YouTube — сам
// ролик или звук, скачанный из ролика. Личные файлы и песни из бота чужим парам
// не показываем. Порядок — сколько заявок уже играет песню; при равенстве
// выше та, которую выбрали позже.

import * as db from './db.js';
import { youtubeCover, youtubeIdValid } from './youtube.js';

const PAGE = 10;
const LIMIT = 50;
const TTL = 60_000;
let cache = null;

const text = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function metaOf(value) {
  try {
    const meta = typeof value === 'string' ? JSON.parse(value) : value;
    return meta && typeof meta === 'object' ? meta : {};
  } catch {
    return {};
  }
}

async function build() {
  const songs = new Map();
  for (const row of await db.topMusicRows(200)) {
    const meta = metaOf(row.meta);
    let id = null;
    let fallback = {};
    if (row.type === 'youtube' && youtubeIdValid(row.value)) {
      id = row.value;
    } else if (row.type === 'upload') {
      const track = await db.trackByFile(row.value);
      if (track?.source === 'youtube' && youtubeIdValid(track.source_id)) {
        id = track.source_id;
        fallback = track;
      }
    }
    if (!id) continue;
    const title = text(meta.title || fallback.title, 120);
    const artist = text(meta.artist || fallback.artist, 120);
    const duration = Number(meta.duration || fallback.duration);
    const uses = Number(row.uses) || 0;
    const last = String(row.last ?? '');
    const known = songs.get(id);
    if (known) {
      known.uses += uses;
      if (last > known.last) known.last = last;
      if (!known.title) Object.assign(known, { title, artist });
      if (!known.duration && duration > 0) known.duration = Math.round(duration * 100) / 100;
    } else {
      songs.set(id, { id, title, artist, duration: duration > 0 ? Math.round(duration * 100) / 100 : null, uses, last });
    }
  }
  return [...songs.values()]
    .filter((song) => song.title)
    .sort((a, b) => b.uses - a.uses || b.last.localeCompare(a.last))
    .slice(0, LIMIT)
    .map((song) => ({
      id: song.id,
      provider: 'youtube',
      title: song.title,
      artist: song.artist,
      duration: song.duration,
      cover: youtubeCover(song.id),
      playback: 'youtube',
      uses: song.uses,
    }));
}

/* Страница топа в форме выдачи поиска: { items, next }. Список живёт минуту. */
export async function topSongs({ page = 0 } = {}) {
  if (!cache || cache.until < Date.now()) cache = { list: await build(), until: Date.now() + TTL };
  const from = Math.max(0, Number(page) || 0) * PAGE;
  return { items: cache.list.slice(from, from + PAGE), next: from + PAGE < cache.list.length ? page + 1 : null };
}

export function forgetTopSongs() {
  cache = null;
}
