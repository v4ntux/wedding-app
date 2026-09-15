import { existsSync } from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

export const BOT_TOKEN = (process.env.BOT_TOKEN ?? '').trim();
// Username бота (без @) — для кнопок «Создать приглашение» на сайте.
export const BOT_USERNAME = (process.env.BOT_USERNAME ?? '').trim().replace(/^@/, '');
// То, что узнаём уже после запуска. Username бот сообщает сам при старте —
// студии он нужен для кнопки «Отправить песню боту», даже если в .env пусто.
export const RUNTIME = { botUsername: BOT_USERNAME };
// Админы: несколько id через запятую — ADMIN_CHAT_IDS=111,222,333
// (старый ADMIN_CHAT_ID тоже поддерживается).
export const ADMIN_CHAT_IDS = String(process.env.ADMIN_CHAT_IDS ?? process.env.ADMIN_CHAT_ID ?? '')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isInteger(n) && n > 0);

export function isAdmin(id) {
  return ADMIN_CHAT_IDS.includes(Number(id));
}
// BASE_URL можно задавать без протокола (nvate.up.railway.app) — допишем https://
// сами. Без этого Telegram не покажет Web App кнопки: они требуют HTTPS.
const RAW_BASE = (process.env.BASE_URL ?? 'http://localhost:3000').trim().replace(/\/+$/, '');
export const BASE_URL = /^https?:\/\//i.test(RAW_BASE) ? RAW_BASE : `https://${RAW_BASE}`;
export const PORT = Number(process.env.PORT ?? 3000);
export const DEV_NO_AUTH = process.env.DEV_NO_AUTH === '1';
// Ссылка поддержки для кнопки Support в боте (напр. https://t.me/username). Необязательно.
export const SUPPORT_URL = (process.env.SUPPORT_URL ?? 'https://t.me/nvate_admin').trim();

// Тайлы карты студии и админки. По умолчанию OpenStreetMap: ключей не просит,
// но и нагрузку держит на добром слове — под заметный трафик поставьте сюда
// своего провайдера ({z}/{x}/{y} подставляются платформой).
export const MAP_TILES = (process.env.MAP_TILES ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png').trim();

// Google Places (console.cloud.google.com, «Places API (New)»): даёт мгновенный и
// точный поиск заведений, как у chungdoi. Без ключа поиск идёт по бесплатным источникам.
export const GOOGLE_MAPS_API_KEY = (process.env.GOOGLE_MAPS_API_KEY ?? '').trim();

// YouTube Data API v3 (тот же Google Cloud, «YouTube Data API v3»). Без ключа
// поиск песен идёт через страницу выдачи youtube.com.
export const YOUTUBE_API_KEY = (process.env.YOUTUBE_API_KEY ?? '').trim();

// Где лежат файлы библиотеки nVate. local — папка uploads на volume; s3 —
// Cloudflare R2 или другое S3-совместимое хранилище. Ключи — только здесь, в
// переменных сервера: студия получает адреса песен через API.
export const MUSIC_STORAGE = (process.env.MUSIC_STORAGE ?? '').trim().toLowerCase() === 's3' ? 's3' : 'local';
export const S3 = Object.freeze({
  endpoint: (process.env.S3_ENDPOINT ?? '').trim().replace(/\/+$/, ''),   // https://<account>.r2.cloudflarestorage.com
  region: (process.env.S3_REGION ?? '').trim() || 'auto',
  bucket: (process.env.S3_BUCKET ?? '').trim(),
  accessKeyId: (process.env.S3_ACCESS_KEY_ID ?? '').trim(),
  secretAccessKey: (process.env.S3_SECRET_ACCESS_KEY ?? '').trim(),
  // Публичный домен бакета (необязательно). Без него сервер выдаёт ссылки с подписью.
  publicUrl: (process.env.S3_PUBLIC_URL ?? '').trim().replace(/\/+$/, ''),
  urlTtl: Math.min(7 * 24 * 3600, Math.max(300, Number(process.env.S3_URL_TTL) || 12 * 3600)),
});

// Audius: открытый каталог полных песен. Ключ не нужен, API узнаёт нас по имени приложения.
export const AUDIUS_API = (process.env.AUDIUS_API_URL ?? '').trim().replace(/\/+$/, '') || 'https://api.audius.co';
export const AUDIUS_APP_NAME = (process.env.AUDIUS_APP_NAME ?? '').trim() || 'nvate';

// Шаблоны открыток живут в templates/<id>/ (см. src/templateStore.js) —
// новый дизайн добавляется папкой, без правок кода.

// Дополнительные функции заказа. Новая опция = строка здесь: форма, расчёт
// цены, карточка админа и рендер подхватят её сами.
export const ADDONS = [
  {
    id: 'domain',
    price: 120_000,
    listed: false,
    uz: 'Shaxsiy domen (1 yil)',
    ru: 'Свой домен на 1 год',
    uzNote: 'ali-zebo.uz koʻrinishidagi manzil',
    ruNote: 'Адрес вида ali-zebo.uz вместо общей ссылки',
  },
];

export function findAddon(id) {
  return ADDONS.find((a) => a.id === id) ?? null;
}

// Именные ссылки: цена за каждого гостя — добавляй сколько хочешь.
export const GUEST_LINK_PRICE = 10_000;
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
