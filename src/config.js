import { existsSync } from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

export const BOT_TOKEN = (process.env.BOT_TOKEN ?? '').trim();
export const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID ?? 0);
export const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
export const PORT = Number(process.env.PORT ?? 3000);
export const DEV_NO_AUTH = process.env.DEV_NO_AUTH === '1';

// Яндекс-карты: без ключа работают в режиме разработки, для продакшена получите ключ
// на developer.tech.yandex.ru и пропишите в .env
export const YANDEX_MAPS_API_KEY = (process.env.YANDEX_MAPS_API_KEY ?? '').trim();

// Извлечение аудио из видео (Instagram/TikTok/YouTube) — cobalt-совместимый API.
// Например self-hosted cobalt (github.com/imputnet/cobalt) или платный инстанс.
export const EXTRACT_API_URL = (process.env.EXTRACT_API_URL ?? '').trim();
export const EXTRACT_API_KEY = (process.env.EXTRACT_API_KEY ?? '').trim();

// Шаблоны открыток. Рендер — src/templates/<id>.js, демо — /demo/<id>.
// minPhotos — сколько фото требует дизайн; colors — палитра карточки в форме.
export const TEMPLATES = [
  { id: 'marsala', name: 'Marsala', price: 129_000, minPhotos: 1, demoUrl: '/demo/marsala', colors: ['#5C2233', '#F4EFE4', '#C08A97'] },
  { id: 'atlas', name: 'Atlas', price: 149_000, minPhotos: 1, demoUrl: '/demo/atlas', colors: ['#F7F2E8', '#B08D4F', '#A54B3F'] },
  { id: 'oqshom', name: 'Oqshom', price: 179_000, minPhotos: 1, demoUrl: '/demo/oqshom', colors: ['#212C24', '#C2A660', '#E7D8B7'] },
];

export const PREMIUM_GUESTS_PRICE = 99_000;
export const MAX_GUESTS = 20;
export const MAX_PHOTOS = 6;

// Устаревшие локальные пресеты (совместимость со старыми заявками music_type='preset').
export const MUSIC_PRESETS = [
  { id: 'track1', name: "An'anaviy melodiya", url: '/music/track1.mp3' },
  { id: 'track2', name: 'Romantik melodiya', url: '/music/track2.mp3' },
];

export function findTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}

export function findMusicPreset(id) {
  return MUSIC_PRESETS.find((m) => m.id === id) ?? null;
}
