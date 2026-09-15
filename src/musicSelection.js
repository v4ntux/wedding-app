// Выбранная песня приглашения: проверка того, что прислала студия, сведения
// из самого источника и то, как песня зазвучит у гостей.
//
// В заявке песня хранится компактно: music_type — источник, music_value — id
// песни в нём, music_start — начало в секундах (до сотых), music_meta — JSON с
// названием, исполнителем, обложкой, длительностью и громкостью. Адресов звука в
// заявке нет: их выдаёт сервер, когда песню играют.

import { findMusicPreset } from './config.js';
import { providerOf, validTrackId } from './musicProviders.js';
import { youtubeCover, youtubeIdOf } from './youtube.js';

export const VOLUME = Object.freeze({ min: 0.1, max: 1, default: 1 });
const MAX_SECONDS = 7200;

const text = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const round2 = (n) => Math.round(n * 100) / 100;
const blank = (value) => value === null || value === undefined || value === '';

export class MusicError extends Error {
  constructor(reason) {
    super(`music: ${reason}`);
    this.reason = reason;          // provider | track | duration | start | volume | gone
  }
}

function httpsUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw.length > 600) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

/* Выбор из формы — к виду, в котором он хранится. Старые версии студии
   присылали musicType/musicValue/musicStart — их понимаем тоже. */
export function readSelection(form) {
  let raw = form?.music;
  if (blank(raw) || raw === false) {
    const legacy = form?.musicType;
    if (!legacy || legacy === 'none') return null;
    if (legacy === 'upload') raw = { provider: 'upload', trackId: form.musicValue, startAt: form.musicStart };
    else if (legacy === 'youtube') raw = { provider: 'youtube', trackId: youtubeIdOf(form.musicValue), startAt: form.musicStart };
    else throw new MusicError('provider');
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new MusicError('provider');

  const provider = String(raw.provider ?? '');
  if (!providerOf(provider)) throw new MusicError('provider');
  const trackId = String(raw.trackId ?? '');
  if (!validTrackId(provider, trackId)) throw new MusicError('track');

  let duration = blank(raw.duration) ? null : Number(raw.duration);
  if (duration !== null) {
    if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_SECONDS) throw new MusicError('duration');
    duration = round2(duration);
  }

  const startAt = blank(raw.startAt) ? 0 : Number(raw.startAt);
  if (!Number.isFinite(startAt) || startAt < 0 || startAt > MAX_SECONDS) throw new MusicError('start');
  if (duration !== null && startAt >= duration) throw new MusicError('start');

  const volume = blank(raw.volume) ? VOLUME.default : Number(raw.volume);
  if (!Number.isFinite(volume) || volume < VOLUME.min || volume > VOLUME.max) throw new MusicError('volume');

  return {
    provider,
    trackId,
    title: text(raw.title, 120),
    artist: text(raw.artist, 120),
    // Обложка YouTube всегда своя по id; у библиотеки адрес выдаёт сервер — в заявке его не храним.
    cover: provider === 'youtube' ? youtubeCover(trackId) : provider === 'audius' ? httpsUrl(raw.cover) : null,
    duration,
    startAt: round2(startAt),
    volume: round2(volume),
  };
}

/* Название, исполнитель и длительность — у самого источника: присланному
   студией верим, только если источник промолчал (сеть). Песню, которой больше
   нет, принять нельзя. */
export async function resolveSelection(selection) {
  if (!selection) return null;
  let track = null;
  try {
    track = await providerOf(selection.provider).get(selection.trackId);
  } catch {
    track = null;
  }
  if (track === false) throw new MusicError('gone');
  const merged = { ...selection };
  if (track) {
    merged.title = text(track.title, 120) || merged.title;
    merged.artist = text(track.artist, 120) || merged.artist;
    if (Number(track.duration) > 0) merged.duration = round2(Number(track.duration));
    if (selection.provider === 'audius') merged.cover = httpsUrl(track.cover);
  }
  if (merged.duration !== null && merged.startAt >= merged.duration) throw new MusicError('start');
  merged.title ||= 'Musiqa';
  return merged;
}

export function selectionColumns(selection) {
  if (!selection) return { musicType: 'none', musicValue: null, musicStart: null, musicEnd: null, musicMeta: null };
  return {
    musicType: selection.provider,
    musicValue: selection.trackId,
    musicStart: selection.startAt,
    musicEnd: null,
    musicMeta: {
      title: selection.title,
      artist: selection.artist,
      cover: selection.cover,
      duration: selection.duration,
      volume: selection.volume,
    },
  };
}

export function parseMusicMeta(value) {
  if (!value) return null;
  try {
    const meta = typeof value === 'string' ? JSON.parse(value) : value;
    return meta && typeof meta === 'object' ? meta : null;
  } catch {
    return null;
  }
}

/* Как песня играет в приглашении. Старые заявки (preset, iTunes, ссылка на
   YouTube, прямой mp3) продолжают звучать так же, как звучали. */
export function invitationMusic(app) {
  const start = round2(Math.max(0, Number(app.music_start) || 0));
  const end = Math.max(0, Number(app.music_end) || 0);
  const meta = parseMusicMeta(app.music_meta);
  const level = Number(meta?.volume);
  const volume = Number.isFinite(level) ? Math.min(VOLUME.max, Math.max(VOLUME.min, level)) : VOLUME.default;
  const value = String(app.music_value ?? '');
  const audio = (url) => ({ kind: 'audio', url, start, end, volume });

  switch (app.music_type) {
    case 'nvate':
    case 'audius':
      return validTrackId(app.music_type, value) ? audio(`/api/music/audio/${app.music_type}/${value}`) : null;
    case 'upload':
      return validTrackId('upload', value) ? audio(`/uploads/${value}`) : null;
    case 'youtube': {
      const id = youtubeIdOf(value);
      return id ? { kind: 'youtube', videoId: id, start, volume } : null;
    }
    case 'preset': {
      const preset = findMusicPreset(value);
      return preset ? audio(preset.url) : null;
    }
    case 'itunes': {
      try {
        const url = httpsUrl(JSON.parse(value)?.url);
        return url ? audio(url) : null;
      } catch {
        return null;
      }
    }
    case 'custom':
      return /^https?:\/\/\S+\.(mp3|ogg|m4a|wav)(\?\S*)?$/i.test(value) ? audio(value) : null;
    default:
      return null;
  }
}
