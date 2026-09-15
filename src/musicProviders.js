// Источники музыки за одним фасадом.
//
// Студия и приглашение не знают, откуда песня: у любой одна карточка Track и
// один способ её проиграть. Новый источник (Spotify, свой каталог) — это ещё
// одна запись в PROVIDERS, без правок интерфейса.
//
// Track: { id, provider, title, artist, duration, cover, playback, audioUrl? }
//   playback 'audio'   — звук по audioUrl (наш адрес: сервер сам ведёт к файлу);
//   playback 'youtube' — официальный плеер YouTube по id.
//
// search(query, { page, category, owner }) → { items: Track[], next: number|null }
// get(id)           → Track; false — песни нет или слушать нельзя; null — источник не ответил
// audioLocation(id) → куда вести /api/music/audio/<provider>/<id> (только у 'audio')

import { activeLibraryTrack, libraryAudioLocation, libraryIdValid, searchLibraryTracks } from './musicLibrary.js';
import { audiusIdValid, audiusStreamUrl, getAudiusTrack, searchAudius } from './audius.js';
import { searchYoutube, youtubeIdValid, youtubeTrack } from './youtube.js';
import { searchUserTracks, uploadIdValid, uploadTrack } from './music.js';
import { topSongs } from './musicTop.js';

export const PROVIDERS = Object.freeze({
  nvate: {
    label: 'nVate', playback: 'audio', browse: true, categories: true,
    validId: libraryIdValid, search: searchLibraryTracks, get: activeLibraryTrack, audioLocation: libraryAudioLocation,
  },
  audius: {
    label: 'Audius', playback: 'audio', browse: true,
    validId: audiusIdValid, search: searchAudius, get: getAudiusTrack, audioLocation: audiusStreamUrl,
  },
  youtube: {
    // Пустая строка поиска — не пустой экран, а «Топ nVate»: что выбирают другие пары.
    label: 'YouTube', playback: 'youtube', browse: true, studio: true,
    validId: youtubeIdValid,
    search: (query, options) => (String(query ?? '').trim().length >= 2 ? searchYoutube(query, options) : topSongs(options)),
    get: youtubeTrack,
  },
  upload: {
    label: 'Mening', playback: 'audio', browse: true, personal: true, studio: true,
    validId: uploadIdValid, search: searchUserTracks, get: uploadTrack, audioLocation: (id) => `/uploads/${id}`,
  },
});

export const providerOf = (id) => (typeof id === 'string' && Object.hasOwn(PROVIDERS, id) ? PROVIDERS[id] : null);

export const validTrackId = (provider, id) => Boolean(providerOf(provider)?.validId(id));

/* В студии пара выбирает только из YouTube и своей музыки (ссылка, файл, бот).
   nVate и Audius остались за фасадом ради уже оформленных приглашений: их песни
   играют, но новых из этих источников студия не ищет. */
export const studioProvider = (id) => (providerOf(id)?.studio ? providerOf(id) : null);

/* Что студии нужно знать об источниках, чтобы нарисовать вкладки. */
export function publicProviders() {
  return Object.entries(PROVIDERS).filter(([, p]) => p.studio).map(([id, p]) => ({
    id,
    label: p.label,
    playback: p.playback,
    browse: p.browse,
    personal: Boolean(p.personal),
    categories: Boolean(p.categories),
  }));
}
