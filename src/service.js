import { existsSync } from 'node:fs';
import path from 'node:path';
import * as db from './db.js';
import { slugify, coupleSlugBase, uniqueSlug } from './slug.js';
import { findMusicPreset, GUEST_LINK_PRICE, MAX_GUESTS, MAX_PHOTOS } from './config.js';
import { findTemplate } from './templateStore.js';
import { UPLOADS_DIR } from './upload.js';

export class ValidationError extends Error {
  constructor(message, step = null) {
    super(message);
    this.step = step; // подсказка форме, к какому блоку вернуться
  }
}

const PHOTO_NAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
const AUDIO_NAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp3|m4a|ogg|wav)$/;
const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/;

function cleanStr(v, maxLen) {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, maxLen);
}

export function youtubeId(url) {
  const m = String(url ?? '').match(YOUTUBE_RE);
  return m ? m[1] : null;
}

function validateMusic(form) {
  const type = form.musicType;
  if (type === 'itunes') {
    const v = form.musicValue ?? {};
    const name = cleanStr(v.name, 120);
    const artist = cleanStr(v.artist, 120);
    const url = cleanStr(v.url, 400);
    if (!name || !/^https:\/\/\S+$/.test(url)) throw new ValidationError('Трек из каталога не распознан', 'music');
    return { musicType: 'itunes', musicValue: JSON.stringify({ name, artist, url }) };
  }
  if (type === 'upload') {
    const file = cleanStr(form.musicValue, 60);
    if (!AUDIO_NAME_RE.test(file) || !existsSync(path.join(UPLOADS_DIR, file))) {
      throw new ValidationError('Аудиофайл не найден — загрузите заново', 'music');
    }
    return { musicType: 'upload', musicValue: file };
  }
  if (type === 'youtube') {
    const url = cleanStr(form.musicValue, 300);
    if (!youtubeId(url)) throw new ValidationError('Не удалось распознать ссылку YouTube', 'music');
    return { musicType: 'youtube', musicValue: url };
  }
  if (type === 'custom') {
    const url = cleanStr(form.musicValue, 300);
    if (!/^https?:\/\/\S+$/.test(url)) throw new ValidationError('Ссылка на музыку должна начинаться с http(s)://', 'music');
    return { musicType: 'custom', musicValue: url };
  }
  return { musicType: 'none', musicValue: null };
}

function validateCut(form) {
  let start = Number(form.musicStart);
  let end = Number(form.musicEnd);
  start = Number.isFinite(start) && start >= 0 && start < 7200 ? Math.round(start) : null;
  end = Number.isFinite(end) && end > 0 && end <= 7200 ? Math.round(end) : null;
  if (start !== null && end !== null && end <= start) end = null;
  return { musicStart: start, musicEnd: end };
}

// Полная валидация формы. Возвращает чистые данные; бросает ValidationError со step.
export function validateForm(form, { requirePhone = false } = {}) {
  if (!form || typeof form !== 'object') throw new ValidationError('Пустая форма');

  const lang = form.lang === 'ru' ? 'ru' : 'uz';
  const uz = lang === 'uz';

  const groomName = cleanStr(form.groomName, 100);
  const brideName = cleanStr(form.brideName, 100);
  if (!groomName) throw new ValidationError(uz ? 'Kuyov ismini kiriting' : 'Укажите имя жениха', 'names');
  if (!brideName) throw new ValidationError(uz ? 'Kelin ismini kiriting' : 'Укажите имя невесты', 'names');

  const weddingDate = cleanStr(form.weddingDate, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weddingDate) || Number.isNaN(Date.parse(weddingDate))) {
    throw new ValidationError(uz ? 'Taqvimda sanani tanlang' : 'Выберите дату в календаре', 'datetime');
  }
  const weddingTime = cleanStr(form.weddingTime, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(weddingTime)) {
    throw new ValidationError(uz ? 'Vaqtni kiriting' : 'Укажите время', 'datetime');
  }

  const lat = Number(form.lat);
  const lng = Number(form.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new ValidationError(uz ? 'Xaritada joyni belgilang' : 'Отметьте локацию на карте', 'location');
  }
  const address = cleanStr(form.address, 300) || null;

  const template = findTemplate(form.templateId);
  if (!template) throw new ValidationError(uz ? 'Shablonni tanlang' : 'Выберите шаблон', 'template');

  // Фотографии: только реально загруженные; минимум диктует выбранный шаблон.
  const rawPhotos = Array.isArray(form.photos) ? form.photos : [];
  const photos = [];
  for (const p of rawPhotos) {
    if (typeof p !== 'string' || !PHOTO_NAME_RE.test(p)) continue;
    if (!existsSync(path.join(UPLOADS_DIR, p))) continue;
    if (!photos.includes(p)) photos.push(p);
  }
  if (photos.length < template.minPhotos) {
    throw new ValidationError(uz
      ? `Bu shablon uchun kamida ${template.minPhotos} ta surat kerak`
      : `Для этого шаблона нужно минимум ${template.minPhotos} фото`, 'photos');
  }
  if (photos.length > MAX_PHOTOS) throw new ValidationError(`Максимум ${MAX_PHOTOS} фото`, 'photos');

  const { musicType, musicValue } = validateMusic(form);
  const { musicStart, musicEnd } = validateCut(form);

  // Именные ссылки: каждая — GUEST_LINK_PRICE; список пуст → услуги нет.
  const rawGuests = Array.isArray(form.guestNames) ? form.guestNames : [];
  let guestNames = [...new Set(rawGuests.map((n) => cleanStr(n, 50)).filter(Boolean))];
  if (guestNames.length > MAX_GUESTS) {
    throw new ValidationError(uz ? `Ko‘pi bilan ${MAX_GUESTS} ta mehmon` : `Максимум ${MAX_GUESTS} гостей`, 'guests');
  }
  const premium = guestNames.length > 0;
  const premiumPrice = guestNames.length * GUEST_LINK_PRICE;
  if (!premium) guestNames = null;

  // Контакты: Telegram username и телефон обязательны, второй телефон — по желанию.
  let phone = cleanStr(form.phone, 20);
  let phone2 = cleanStr(form.phone2, 20) || null;
  let contactTg = cleanStr(form.contactTg, 40).replace(/^@/, '') || null;
  if (requirePhone) {
    if (!contactTg || !/^[A-Za-z0-9_]{4,32}$/.test(contactTg)) {
      throw new ValidationError(uz ? 'Telegram username kiriting (masalan: @aziz_uz)' : 'Укажите Telegram username (например: @aziz_uz)', 'review');
    }
    if (!/^\+?[\d\s()-]{7,20}$/.test(phone)) {
      throw new ValidationError(uz ? 'Telefon raqamingizni kiriting' : 'Укажите номер телефона', 'review');
    }
  } else {
    phone = phone || null;
  }
  if (phone2 && !/^\+?[\d\s()-]{7,20}$/.test(phone2)) phone2 = null;

  return {
    lang, groomName, brideName, weddingDate, weddingTime, address, lat, lng,
    photos, musicType, musicValue, musicStart, musicEnd,
    template, premium, guestNames, premiumPrice,
    totalPrice: template.price + premiumPrice,
    phone, phone2, contactTg,
  };
}

// Создаёт заявку (телефон обязателен — берётся из окна подтверждения).
export function submitApplication(form, tgUser) {
  const v = validateForm(form, { requirePhone: true });

  const id = db.insertApplication({
    tgUserId: tgUser.id,
    tgUsername: tgUser.username ?? null,
    phone: v.phone,
    phone2: v.phone2,
    contactTg: v.contactTg,
    eventType: v.template.event ?? 'wedding',
    lang: v.lang,
    groomName: v.groomName,
    brideName: v.brideName,
    weddingDate: v.weddingDate,
    weddingTime: v.weddingTime,
    address: v.address,
    lat: v.lat,
    lng: v.lng,
    musicType: v.musicType,
    musicValue: v.musicValue,
    musicStart: v.musicStart,
    musicEnd: v.musicEnd,
    templateId: v.template.id,
    templatePrice: v.template.price,
    premium: v.premium,
    premiumPrice: v.premiumPrice,
    guestNames: v.guestNames,
    photos: v.photos,
    totalPrice: v.totalPrice,
  });

  return { id, app: db.getApplication(id) };
}

// Объект «как из БД» для предпросмотра перед подтверждением (ничего не сохраняет).
export function buildPreviewApp(form) {
  const v = validateForm(form, { requirePhone: false });
  return {
    lang: v.lang,
    groom_name: v.groomName,
    bride_name: v.brideName,
    wedding_date: v.weddingDate,
    wedding_time: v.weddingTime,
    address: v.address,
    lat: v.lat,
    lng: v.lng,
    music_type: v.musicType,
    music_value: v.musicValue,
    music_start: v.musicStart,
    music_end: v.musicEnd,
    template_id: v.template.id,
    photos: JSON.stringify(v.photos),
  };
}

// Админ подтвердил оплату: выдаём slug, создаём именные ссылки.
export function payApplication(id, meta = {}) {
  const app = db.getApplication(id);
  if (!app) throw new ValidationError(`Заявка #${id} не найдена`);
  if (app.status === 'paid') throw new ValidationError('Заявка уже оплачена');
  if (app.status === 'cancelled') throw new ValidationError('Заявка была отклонена');

  const slug = uniqueSlug(coupleSlugBase(app.groom_name, app.bride_name), db.slugTaken);
  if (!db.markPaid(id, slug)) throw new ValidationError('Заявка уже обработана');
  // Кто подтвердил, когда (paid_at ставит markPaid) и скриншот чека.
  db.recordConfirmation(id, meta.adminId ?? null, meta.adminName ?? null, meta.proof ?? null);

  const guests = [];
  if (app.premium) {
    const names = JSON.parse(app.guest_names ?? '[]');
    const used = new Set();
    for (const name of names) {
      let gslug = slugify(name) || 'mehmon';
      if (used.has(gslug)) {
        let i = 2;
        while (used.has(`${gslug}-${i}`)) i++;
        gslug = `${gslug}-${i}`;
      }
      used.add(gslug);
      db.insertGuest(id, name, gslug);
      guests.push({ name, slug: gslug });
    }
  }

  return { app: db.getApplication(id), guests };
}

export function cancelApplication(id) {
  const app = db.getApplication(id);
  if (!app) throw new ValidationError(`Заявка #${id} не найдена`);
  if (!db.markCancelled(id)) throw new ValidationError('Заявка уже обработана');
  return db.getApplication(id);
}

export function mapsLinks(lat, lng) {
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    yandex: `https://yandex.ru/maps/?pt=${lng},${lat}&z=17&l=map`,
  };
}

export { findMusicPreset };
