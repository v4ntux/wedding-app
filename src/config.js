import { existsSync } from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

export const BOT_TOKEN = (process.env.BOT_TOKEN ?? '').trim();
// Username бота (без @) — для кнопок «Создать приглашение» на сайте.
export const BOT_USERNAME = (process.env.BOT_USERNAME ?? '').trim().replace(/^@/, '');
// Админы: несколько id через запятую — ADMIN_CHAT_IDS=111,222,333
// (старый ADMIN_CHAT_ID тоже поддерживается).
export const ADMIN_CHAT_IDS = String(process.env.ADMIN_CHAT_IDS ?? process.env.ADMIN_CHAT_ID ?? '')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isInteger(n) && n > 0);

export function isAdmin(id) {
  return ADMIN_CHAT_IDS.includes(Number(id));
}
export const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
export const PORT = Number(process.env.PORT ?? 3000);
export const DEV_NO_AUTH = process.env.DEV_NO_AUTH === '1';
// Ссылка поддержки для кнопки Support в боте (напр. https://t.me/username). Необязательно.
export const SUPPORT_URL = (process.env.SUPPORT_URL ?? 'https://t.me/nvate_admin').trim();

// Яндекс-карты: без ключа работают в режиме разработки, для продакшена получите ключ
// на developer.tech.yandex.ru и пропишите в .env
export const YANDEX_MAPS_API_KEY = (process.env.YANDEX_MAPS_API_KEY ?? '').trim();

// Google Places (console.cloud.google.com, «Places API (New)»): даёт мгновенный и
// точный поиск заведений, как у chungdoi. Без ключа поиск идёт по бесплатным источникам.
export const GOOGLE_MAPS_API_KEY = (process.env.GOOGLE_MAPS_API_KEY ?? '').trim();

// Извлечение аудио из видео (Instagram/TikTok/YouTube) — cobalt-совместимый API.
// Например self-hosted cobalt (github.com/imputnet/cobalt) или платный инстанс.
export const EXTRACT_API_URL = (process.env.EXTRACT_API_URL ?? '').trim();
export const EXTRACT_API_KEY = (process.env.EXTRACT_API_KEY ?? '').trim();

// Шаблоны открыток живут в templates/<id>/ (см. src/templateStore.js) —
// новый дизайн добавляется папкой, без правок кода.

// Именные ссылки: цена за каждого гостя — добавляй сколько хочешь.
export const GUEST_LINK_PRICE = 9_900;
export const MAX_GUESTS = 100;
export const MAX_PHOTOS = 6;

// Устаревшие локальные пресеты (совместимость со старыми заявками music_type='preset').
export const MUSIC_PRESETS = [
  { id: 'track1', name: "An'anaviy melodiya", url: '/music/track1.mp3' },
  { id: 'track2', name: 'Romantik melodiya', url: '/music/track2.mp3' },
];

export function findMusicPreset(id) {
  return MUSIC_PRESETS.find((m) => m.id === id) ?? null;
}
