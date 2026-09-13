import { existsSync } from 'node:fs';
import path from 'node:path';
import * as db from './db.js';
import { lockPayments } from './storage.js';
import { slugify, coupleSlugBase, uniqueSlug } from './slug.js';
import { findMusicPreset, MAX_GUESTS, MAX_PHOTOS } from './config.js';
import { guestPrice, addonPrice, pricedAddons } from './pricing.js';
import { findTemplate } from './templateStore.js';
import { UPLOADS_DIR } from './upload.js';
import { normalizeDesign } from './design.js';
import { findVenue } from './venues.js';

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

/* Канонический ключ трека — ровно та строка, что лежит в music_value.
   Нужен, чтобы спросить у базы, откуда этот трек обычно запускают. У полных
   треков ключ — имя файла: трек с полки nvate у всех пар один и тот же. */
export function musicKey(form) {
  try {
    const { musicType, musicValue } = validateMusic(form);
    return musicType === 'none' ? null : musicValue;
  } catch (_) {
    return null;
  }
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
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weddingDate);
  const dateUtc = dateParts
    ? new Date(Date.UTC(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3])))
    : null;
  const validCalendarDate = Boolean(dateUtc)
    && dateUtc.getUTCFullYear() === Number(dateParts[1])
    && dateUtc.getUTCMonth() === Number(dateParts[2]) - 1
    && dateUtc.getUTCDate() === Number(dateParts[3]);
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  if (!validCalendarDate || dateUtc.getTime() < todayUtc) {
    throw new ValidationError(uz ? 'Taqvimda sanani tanlang' : 'Выберите дату в календаре', 'datetime');
  }
  const weddingTime = cleanStr(form.weddingTime, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(weddingTime)) {
    throw new ValidationError(uz ? 'Vaqtni kiriting' : 'Укажите время', 'datetime');
  }

  const mapEnabled = form.mapEnabled === true;
  let lat = 42.116169;
  let lng = 60.0625143;
  if (mapEnabled) {
    lat = Number(form.lat);
    lng = Number(form.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new ValidationError(uz ? 'Xaritada joyni belgilang' : 'Отметьте локацию на карте', 'location');
    }
  }
  const address = cleanStr(form.address, 300) || null;
  if (!address) throw new ValidationError(uz ? 'To‘yxona nomini kiriting' : 'Укажите название места', 'location');

  const template = findTemplate(form.templateId);
  if (!template || template.listed === false) {
    throw new ValidationError(uz ? 'Shablonni tanlang' : 'Выберите шаблон', 'template');
  }

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
  const premiumPrice = guestNames.length * guestPrice();
  if (!premium) guestNames = null;
  // Дополнительные функции: клиент присылает список id, цена берётся из каталога,
  // а не из запроса — подделать сумму нельзя.
  const wanted = new Set(
    (Array.isArray(form.addons) ? form.addons : []).map((id) => String(id)).slice(0, 20)
  );
  const chosen = pricedAddons().filter((a) => a.listed !== false && wanted.has(a.id));
  const extras = Object.fromEntries(chosen.map((a) => [a.id, true]));
  extras.design = normalizeDesign(form.design);
  // Тойхона из справочника: вид и ориентир под названием в приглашении берём
  // из каталога, а не из формы — подписать место чужим адресом нельзя.
  const venue = typeof form.venueId === 'string' ? findVenue(form.venueId) : null;
  if (venue && !venue.draft) extras.venue = { id: venue.id, name: venue.name, kind: venue.kind, address: venue.address };
  const addonsPrice = chosen.reduce((sum, a) => sum + a.price, 0);
  const domainEnabled = Boolean(extras.domain);
  const domainPrice = domainEnabled ? addonPrice('domain', 0) : 0;

  /* Контакты: у пары спрашиваем только номер телефона. Telegram (id и
     username) приходит из initData самого бота — переписывать его руками
     значило бы просить человека продиктовать то, что мы уже знаем.
     Поля phone2 и contactTg остались ради заявок, созданных до этой версии:
     форма их больше не шлёт, но старые записи обязаны открываться. */
  const phone = cleanStr(form.phone, 20) || null;
  const phone2 = cleanStr(form.phone2, 40) || null;
  const contactTg = cleanStr(form.contactTg, 40).replace(/^@/, '') || null;

  const PHONE_RE = /^\+?[\d\s()-]{7,20}$/;

  if (phone && (!PHONE_RE.test(phone) || phone.replace(/\D/g, '').length < 7)) {
    throw new ValidationError(uz ? 'Telefon raqami noto‘g‘ri' : 'Некорректный номер телефона', 'review');
  }

  if (requirePhone && !phone) {
    throw new ValidationError(
      uz ? 'Telefon raqamingizni yozing' : 'Впишите номер телефона',
      'review'
    );
  }

  const submissionKey = cleanStr(form.submissionKey, 64);
  if (requirePhone && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionKey)) {
    throw new ValidationError(uz ? 'Arizani qayta ochib yuboring' : 'Перезагрузите форму и отправьте снова', 'review');
  }

  return {
    lang, groomName, brideName, weddingDate, weddingTime, address, lat, lng, mapEnabled,
    photos, musicType, musicValue, musicStart, musicEnd,
    template, premium, guestNames, premiumPrice, domainEnabled, domainPrice,
    extras, addonsPrice,
    totalPrice: template.price + premiumPrice + addonsPrice,
    phone, phone2, contactTg, submissionKey,
  };
}

// Создаёт заявку (телефон обязателен — берётся из окна подтверждения).
export async function submitApplication(form, tgUser) {
  const v = validateForm(form, { requirePhone: true });

  const existing = (await db.getApplicationBySubmissionKey(tgUser.id, v.submissionKey));
  if (existing) return { id: existing.id, app: existing, duplicate: true };

  const application = {
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
    mapEnabled: v.mapEnabled,
    musicType: v.musicType,
    musicValue: v.musicValue,
    musicStart: v.musicStart,
    musicEnd: v.musicEnd,
    templateId: v.template.id,
    templatePrice: v.template.price,
    premium: v.premium,
    premiumPrice: v.premiumPrice,
    domainEnabled: v.domainEnabled,
    domainPrice: v.domainPrice,
    extras: v.extras,
    guestNames: v.guestNames,
    photos: v.photos,
    totalPrice: v.totalPrice,
    submissionKey: v.submissionKey,
  };

  let id;
  try {
    id = (await db.insertApplication(application));
  } catch (error) {
    const concurrent = (await db.getApplicationBySubmissionKey(tgUser.id, v.submissionKey));
    if (!concurrent) throw error;
    return { id: concurrent.id, app: concurrent, duplicate: true };
  }

  return { id, app: (await db.getApplication(id)) };
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
    map_enabled: v.mapEnabled ? 1 : 0,
    domain_enabled: v.domainEnabled ? 1 : 0,
    domain_price: v.domainPrice,
    extras: JSON.stringify(v.extras),
    music_type: v.musicType,
    music_value: v.musicValue,
    music_start: v.musicStart,
    music_end: v.musicEnd,
    template_id: v.template.id,
    photos: JSON.stringify(v.photos),
  };
}

// Админ подтвердил оплату: выдаём slug, создаём именные ссылки.
export async function payApplication(id, meta = {}) {
  return db.transaction(async () => {
  await lockPayments();
  const app = (await db.getApplication(id));
  if (!app) throw new ValidationError(`Заявка #${id} не найдена`);
  if (app.status === 'paid') throw new ValidationError('Заявка уже оплачена');
  if (app.status === 'cancelled') throw new ValidationError('Заявка была отклонена');
  // Дизайн могли снять с платформы, пока заявка ждала оплаты: подтвердить её
  // значит выдать паре битую ссылку, поэтому останавливаемся заранее.
  if (!findTemplate(app.template_id)) {
    throw new ValidationError(`Дизайн «${app.template_id}» снят с платформы — заявку нельзя подтвердить, предложите паре выбрать другой`);
  }

  const slug = (await uniqueSlug(coupleSlugBase(app.groom_name, app.bride_name), db.slugTaken));
  if (!(await db.markPaid(id, slug))) throw new ValidationError('Заявка уже обработана');
  // Кто подтвердил, когда (paid_at ставит markPaid) и скриншот чека.
  (await db.recordConfirmation(id, meta.adminId ?? null, meta.adminName ?? null, meta.proof ?? null));

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
      (await db.insertGuest(id, name, gslug));
      guests.push({ name, slug: gslug });
    }
  }

  return { app: (await db.getApplication(id)), guests };
  });
}

export async function cancelApplication(id) {
  const app = (await db.getApplication(id));
  if (!app) throw new ValidationError(`Заявка #${id} не найдена`);
  if (!(await db.markCancelled(id))) throw new ValidationError('Заявка уже обработана');
  return (await db.getApplication(id));
}

export function mapsLinks(lat, lng) {
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    yandex: `https://yandex.ru/maps/?pt=${lng},${lat}&z=17&l=map`,
  };
}

export { findMusicPreset };
