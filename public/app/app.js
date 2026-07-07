/* global ymaps */
'use strict';

const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
if (tg) {
  tg.ready();
  tg.expand();
}

const $ = (id) => document.getElementById(id);

/* ── Словари ──────────────────────────────────────────────────── */

const I18N = {
  uz: {
    heroTitle: 'Taklifnoma',
    heroSub: 'To‘y taklifnomasini yarating — mehmonlaringiz uchun chiroyli sayt',
    sec1: 'Kelin-kuyov', sec2: 'Sana va vaqt', sec3: 'Manzil', sec4: 'Shablon',
    sec5: 'Suratlar', sec6: 'Musiqa', sec7: 'Ismli taklifnomalar',
    groom: 'Kuyov ismi', bride: 'Kelin ismi', phGroom: 'Ali', phBride: 'Zebo',
    pickDate: 'Taqvimda sanani tanlang', time: 'Vaqt',
    locHint: 'Joyni qidiring yoki xaritani bosing — mehmonlar Google va Yandex xarita havolalarini oladi.',
    searchPh: 'Masalan: Navro‘z to‘yxonasi', find: 'Qidirish',
    address: 'Joy nomi (qisqa)', phAddress: 'Masalan: Navro‘z to‘yxonasi',
    noPin: '📍 Belgi qo‘yilmagan',
    tplHint: 'Kartochkada tayyor demo ko‘rinadi — ismlaringiz bilan. Chapga-o‘ngga varaqlang.',
    demo: 'DEMO', pick: 'Tanlash',
    photoBadge: (n) => `📷 ${n}+ surat`,
    photoReq: (n) => `Tanlangan shablon uchun kamida ${n} ta surat kerak. JPG, PNG yoki WebP.`,
    photoReqNoTpl: 'Avval shablonni tanlang — har bir shablon o‘z suratlar sonini so‘raydi.',
    add: 'Qo‘shish', photoOf: (a, b) => `${a} ta yuklandi (kamida ${b} ta kerak)`,
    mtNone: 'Musiqasiz', mtCatalog: '🔥 Top musiqalar', mtOwn: 'O‘z musiqam',
    musicQPh: 'Qo‘shiq yoki ijrochi...', uses: 'marta tanlangan', empty: 'Hech narsa topilmadi',
    ownHint: 'Havola qo‘ying (YouTube / Instagram / TikTok) yoki fayl yuklang (MP3/M4A, 16 MB gacha)',
    upload: 'Fayl yuklash', or: 'yoki', uploading: 'Yuklanmoqda...', extracting: 'Audio ajratilmoqda...',
    extractUnavail: 'Bu havoladan audio olish hozircha ishlamaydi — fayl yuklang yoki YouTube havolasini qo‘ying',
    cutTitle: 'Musiqani kesish — oltin dastaklarni suring (ixtiyoriy)',
    cutStart: 'Boshlanishi (soniya)', cutEnd: 'Tugashi (soniya)', listen: '▶ Tinglash', selected: 'Tanlandi:', change: 'O‘zgartirish',
    premium: 'Har bir mehmon uchun shaxsiy havola va murojaat',
    guestsHint: (m) => `Har qatorda bitta ism, ko‘pi bilan ${m} ta. Misol: project.uz/ali-and-zebo/aziz → «Hurmatli Aziz!»`,
    guests: (n) => `${n} mehmon`,
    total: 'Jami:', submit: 'Ariza yuborish', sending: 'Yuborilmoqda...',
    confirmTitle: 'Taklifnomangiz shunday ko‘rinadi', phoneLabel: 'Telefon raqamingiz',
    confirmNote: 'Administrator tez orada siz bilan bog‘lanadi (Telegram yoki telefon orqali)',
    confirmOk: 'Tasdiqlayman', back: 'Ortga',
    okTitle: 'Ariza yuborildi!',
    okText: 'Administrator to‘lovni tasdiqlash uchun siz bilan bog‘lanadi. To‘lovdan so‘ng taklifnoma havolasini olasiz.',
    close: '✕ Yopish', choose: 'Shu shablonni tanlash', sum: 'so‘m',
    eGroom: 'Kuyov ismini kiriting', eBride: 'Kelin ismini kiriting',
    eDate: 'Taqvimda sanani tanlang', eTime: 'Vaqtni kiriting',
    eLoc: 'Xaritada joyni belgilang', eWait: 'Suratlar yuklanishini kuting',
    ePhotos: (n) => `Kamida ${n} ta surat yuklang`, eTpl: 'Shablonni tanlang',
    eGuests: 'Mehmonlar ismini kiriting yoki xizmatni o‘chiring',
    ePhone: 'Telefon raqamingizni kiriting',
    eMusic: 'Musiqa havolasi noto‘g‘ri', eNet: 'Tarmoq xatosi, qayta urinib ko‘ring',
    eFile: 'Bu format qo‘llab-quvvatlanmaydi', eBig: 'Fayl juda katta',
    eGeo: 'O‘zbekistonda topilmadi — boshqa nom yozing yoki xaritada o‘zingiz belgilang',
    months: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
    monthsGen: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
    wdShort: ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'],
    wdFull: ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'],
    dateLabel: (wd, d, m, y) => `${wd}, ${d}-${m}, ${y}`,
  },
  ru: {
    heroTitle: 'Taklifnoma',
    heroSub: 'Создайте свадебное приглашение — красивый сайт для ваших гостей',
    sec1: 'Пара', sec2: 'Дата и время', sec3: 'Локация', sec4: 'Шаблон',
    sec5: 'Фотографии', sec6: 'Музыка', sec7: 'Именные приглашения',
    groom: 'Имя жениха', bride: 'Имя невесты', phGroom: 'Али', phBride: 'Зебо',
    pickDate: 'Выберите дату в календаре', time: 'Время',
    locHint: 'Найдите место или нажмите на карту — гости получат ссылки на Google и Yandex Maps.',
    searchPh: 'Например: тойхона Versal', find: 'Найти',
    address: 'Название места (коротко)', phAddress: 'Например: тойхона Versal',
    noPin: '📍 Метка не поставлена',
    tplHint: 'В карточке уже живое демо с вашими именами. Листайте влево-вправо.',
    demo: 'DEMO', pick: 'Выбрать',
    photoBadge: (n) => `📷 ${n}+ фото`,
    photoReq: (n) => `Для выбранного шаблона нужно минимум ${n} фото. JPG, PNG или WebP.`,
    photoReqNoTpl: 'Сначала выберите шаблон — каждый шаблон требует своё число фото.',
    add: 'Добавить', photoOf: (a, b) => `Загружено ${a} (нужно минимум ${b})`,
    mtNone: 'Без музыки', mtCatalog: '🔥 Топ музыка', mtOwn: 'Своя музыка',
    musicQPh: 'Песня или исполнитель...', uses: 'раз выбрали', empty: 'Ничего не найдено',
    ownHint: 'Вставьте ссылку (YouTube / Instagram / TikTok) или загрузите файл (MP3/M4A, до 16 МБ)',
    upload: 'Загрузить файл', or: 'или', uploading: 'Загрузка...', extracting: 'Извлекаем аудио...',
    extractUnavail: 'Извлечь аудио из этой ссылки пока нельзя — загрузите файл или дайте ссылку YouTube',
    cutTitle: 'Обрезка музыки — двигайте золотые ручки (необязательно)',
    cutStart: 'Начало (сек)', cutEnd: 'Конец (сек)', listen: '▶ Прослушать', selected: 'Выбрано:', change: 'Изменить',
    premium: 'Личная ссылка и обращение для каждого гостя',
    guestsHint: (m) => `По одному имени на строку, максимум ${m}. Пример: project.uz/ali-and-zebo/aziz → «Hurmatli Aziz!»`,
    guests: (n) => `${n} гостей`,
    total: 'Итого:', submit: 'Отправить заявку', sending: 'Отправляем...',
    confirmTitle: 'Так будет выглядеть ваше приглашение', phoneLabel: 'Ваш номер телефона',
    confirmNote: 'Администратор скоро свяжется с вами (в Telegram или по телефону)',
    confirmOk: 'Подтверждаю', back: 'Назад',
    okTitle: 'Заявка отправлена!',
    okText: 'Администратор свяжется с вами для подтверждения и оплаты. После оплаты вы получите ссылку на приглашение.',
    close: '✕ Закрыть', choose: 'Выбрать этот шаблон', sum: 'сум',
    eGroom: 'Укажите имя жениха', eBride: 'Укажите имя невесты',
    eDate: 'Выберите дату в календаре', eTime: 'Укажите время',
    eLoc: 'Отметьте локацию на карте', eWait: 'Дождитесь загрузки фотографий',
    ePhotos: (n) => `Загрузите минимум ${n} фото`, eTpl: 'Выберите шаблон',
    eGuests: 'Добавьте имена гостей или отключите услугу',
    ePhone: 'Укажите номер телефона',
    eMusic: 'Некорректная ссылка на музыку', eNet: 'Ошибка сети, попробуйте ещё раз',
    eFile: 'Формат не поддерживается', eBig: 'Файл слишком большой',
    eGeo: 'В Узбекистане не найдено — попробуйте иначе или отметьте на карте сами',
    months: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
    monthsGen: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    wdShort: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    wdFull: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
    dateLabel: (wd, d, m, y) => `${wd}, ${d} ${m} ${y}`,
  },
};

let LANG = localStorage.getItem('tk_lang') || null;
const t = (key, ...args) => {
  const v = I18N[LANG || 'uz'][key];
  return typeof v === 'function' ? v(...args) : v;
};

const YT_RE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/;
const SOCIAL_RE = /(instagram\.com|tiktok\.com)/i;

const state = {
  config: null,
  lat: null,
  lng: null,
  templateId: null,
  dateIso: null,
  photos: [],                  // { name, previewUrl, uploading }
  music: { type: 'none', value: null, name: '', previewUrl: null, start: null, end: null },
};

function money(n) {
  return n.toLocaleString('ru-RU') + ' ' + t('sum');
}

function showError(msg) {
  const el = $('form-error');
  el.textContent = msg;
  el.hidden = !msg;
}

/* ── Прогрессивное раскрытие блоков ───────────────────────────── */

const STEPS = [
  { key: 'names', done: () => $('groom').value.trim() && $('bride').value.trim() },
  { key: 'datetime', done: () => state.dateIso && $('time').value },
  { key: 'location', done: () => state.lat !== null },
  { key: 'template', done: () => !!state.templateId },
  {
    key: 'photos',
    done: () => {
      const req = requiredPhotos() ?? 1;
      return state.photos.filter((p) => p.name).length >= req && !state.photos.some((p) => p.uploading);
    },
  },
  { key: 'music', done: () => true },
  { key: 'premium', done: () => !$('premium').checked || guestNames().length > 0 },
];

function sectionOf(step) {
  return document.querySelector(`section[data-step="${step}"]`);
}

// Открывает следующий блок, когда предыдущие заполнены. Открытые не прячем.
function revealSteps() {
  let allDone = true;
  for (const s of STEPS) {
    const sec = sectionOf(s.key);
    if (allDone && sec.hidden) {
      sec.hidden = false;
      sec.classList.add('reveal');
      setTimeout(() => sec.classList.remove('reveal'), 700);
      if (s.key === 'location' && ymap) setTimeout(() => ymap.container.fitToViewport(), 150);
    }
    if (!s.done()) allDone = false;
  }
}

// Ошибка: открыть нужный блок, подсветить и проскроллить к нему.
function goToError(step, msg) {
  $('confirm-modal').hidden = true;
  const sec = sectionOf(step) || sectionOf('names');
  // раскрываем все блоки до ошибочного включительно
  for (const s of STEPS) {
    sectionOf(s.key).hidden = false;
    if (s.key === (step || 'names')) break;
  }
  sec.classList.remove('sec-error');
  void sec.offsetWidth; // перезапуск анимации
  sec.classList.add('sec-error');
  setTimeout(() => sec.classList.remove('sec-error'), 1800);
  sec.scrollIntoView({ behavior: 'smooth', block: 'center' });
  showError(msg);
}

/* ── Язык ─────────────────────────────────────────────────────── */

function applyI18n() {
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  $('groom').placeholder = t('phGroom');
  $('bride').placeholder = t('phBride');
  $('geo-search').placeholder = t('searchPh');
  $('address').placeholder = t('phAddress');
  $('music-q').placeholder = t('musicQPh');
  $('coords-hint').textContent = state.lat === null ? t('noPin') : `📍 ${state.lat.toFixed(5)}, ${state.lng.toFixed(5)}`;
  $('sw-uz').classList.toggle('active', LANG === 'uz');
  $('sw-ru').classList.toggle('active', LANG === 'ru');
  updateDateLabel();
  renderCalendar();
  if (state.config) {
    renderTemplates();
    updatePhotoTexts();
    renderPhotos();
    $('guests-hint').textContent = t('guestsHint', state.config.maxGuests);
    $('guest-count').textContent = t('guests', guestNames().length);
    updateSelectedMusic();
  }
}

function setLang(lang) {
  LANG = lang;
  localStorage.setItem('tk_lang', lang);
  applyI18n();
}

function initLangScreen() {
  const start = () => {
    $('form-screen').hidden = false;
    $('bottom-bar').hidden = false;
    revealSteps();
  };
  if (LANG) {
    $('lang-screen').remove();
    start();
    applyI18n();
    return;
  }
  LANG = 'uz'; // язык по умолчанию — узбекский
  const pick = (lang) => {
    setLang(lang);
    $('lang-screen').classList.add('hide');
    setTimeout(() => $('lang-screen').remove(), 500);
    start();
  };
  $('lang-uz').addEventListener('click', () => pick('uz'));
  $('lang-ru').addEventListener('click', () => pick('ru'));
}

$('sw-uz').addEventListener('click', () => setLang('uz'));
$('sw-ru').addEventListener('click', () => setLang('ru'));

/* ── Конфиг ───────────────────────────────────────────────────── */

async function loadConfig() {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error('config');
  state.config = await res.json();
  loadYmaps(state.config.yandexMapsKey);
  renderTemplates();
  renderTopTracks();
  updatePhotoTexts();
  renderPhotos();
  $('premium-price').textContent = '(+' + money(state.config.premiumGuestsPrice) + ')';
  $('guests-hint').textContent = t('guestsHint', state.config.maxGuests);
  $('guest-count').textContent = t('guests', 0);
  updateTotal();
}

/* ── Календарь ────────────────────────────────────────────────── */

const today = new Date();
today.setHours(0, 0, 0, 0);
let calView = new Date(today.getFullYear(), today.getMonth(), 1);

function isoOf(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + m + '-' + d;
}

function renderCalendar() {
  if (!LANG) return;
  const y = calView.getFullYear();
  const m = calView.getMonth();
  $('cal-title').textContent = t('months')[m] + ' ' + y;
  $('cal-prev').disabled = y === today.getFullYear() && m === today.getMonth();

  const grid = $('cal-grid');
  grid.innerHTML = '';
  for (const wd of t('wdShort')) {
    const el = document.createElement('div');
    el.className = 'cal-wd';
    el.textContent = wd;
    grid.appendChild(el);
  }
  const firstIdx = (new Date(y, m, 1).getDay() + 6) % 7;
  for (let i = 0; i < firstIdx; i++) grid.appendChild(document.createElement('div'));

  const daysInMonth = new Date(y, m + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(y, m, day);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cal-day';
    btn.textContent = day;
    if (date < today) btn.disabled = true;
    if (date.getTime() === today.getTime()) btn.classList.add('today');
    if (state.dateIso === isoOf(date)) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      state.dateIso = isoOf(date);
      updateDateLabel();
      renderCalendar();
      revealSteps();
    });
    grid.appendChild(btn);
  }
}

function updateDateLabel() {
  if (!state.dateIso) {
    $('date-label').textContent = t('pickDate');
    return;
  }
  const [y, m, d] = state.dateIso.split('-').map(Number);
  const wd = t('wdFull')[new Date(y, m - 1, d).getDay()];
  $('date-label').textContent = t('dateLabel', wd, d, t('monthsGen')[m - 1], y);
}

$('cal-prev').addEventListener('click', () => {
  calView = new Date(calView.getFullYear(), calView.getMonth() - 1, 1);
  renderCalendar();
});
$('cal-next').addEventListener('click', () => {
  calView = new Date(calView.getFullYear(), calView.getMonth() + 1, 1);
  renderCalendar();
});

/* ── Время ────────────────────────────────────────────────────── */

const TIME_PRESETS = ['11:00', '12:00', '17:00', '18:00', '19:00', '20:00'];

function renderTimeChips() {
  const box = $('time-chips');
  box.innerHTML = '';
  for (const tt of TIME_PRESETS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + ($('time').value === tt ? ' active' : '');
    chip.textContent = tt;
    chip.addEventListener('click', () => {
      $('time').value = tt;
      renderTimeChips();
      revealSteps();
    });
    box.appendChild(chip);
  }
}
$('time').addEventListener('input', () => { renderTimeChips(); revealSteps(); });
renderTimeChips();

/* ── Яндекс-карта ─────────────────────────────────────────────── */

const UZ_BOUNDS = [[37.0, 55.9], [45.7, 73.2]]; // границы поиска: Узбекистан

let ymap = null;
let placemark = null;

function loadYmaps(key) {
  const s = document.createElement('script');
  s.src = 'https://api-maps.yandex.ru/2.1/?lang=ru_RU' + (key ? '&apikey=' + encodeURIComponent(key) : '');
  s.onload = () => ymaps.ready(initMap);
  s.onerror = () => showError(t('eNet'));
  document.head.appendChild(s);
}

function initMap() {
  ymap = new ymaps.Map('map', {
    center: [41.311, 69.279],
    zoom: 11,
    controls: ['zoomControl', 'geolocationControl'],
  });
  ymap.events.add('click', (e) => {
    const c = e.get('coords');
    setPoint(c[0], c[1]);
    fillShortAddress(c);
    revealSteps();
  });
}

function setPoint(lat, lng) {
  state.lat = lat;
  state.lng = lng;
  if (placemark) {
    placemark.geometry.setCoordinates([lat, lng]);
  } else if (ymap) {
    placemark = new ymaps.Placemark([lat, lng], {}, { preset: 'islands#redHeartIcon' });
    ymap.geoObjects.add(placemark);
  }
  $('coords-hint').textContent = `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

// Геокодинг только по Узбекистану: Яндекс при наличии ключа, иначе Nominatim.
async function geoSearchUz(q) {
  if (state.config?.yandexMapsKey) {
    try {
      const r = await ymaps.geocode(q, { boundedBy: UZ_BOUNDS, strictBounds: true, results: 1 });
      const o = r.geoObjects.get(0);
      if (!o) return null;
      const c = o.geometry.getCoordinates();
      return { lat: c[0], lng: c[1], name: String(o.properties.get('name') || '') };
    } catch (_) { /* фолбэк на Nominatim ниже */ }
  }
  const res = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=uz&accept-language=' + LANG + '&q=' + encodeURIComponent(q));
  const list = res.ok ? await res.json() : [];
  if (!list.length) return null;
  return {
    lat: Number(list[0].lat),
    lng: Number(list[0].lon),
    name: String(list[0].name || (list[0].display_name || '').split(',')[0] || ''),
  };
}

// Короткое название места (например «Navro‘z to‘yxonasi»), не полный адрес.
async function reverseNameUz(lat, lng) {
  if (state.config?.yandexMapsKey) {
    try {
      const r = await ymaps.geocode([lat, lng], { results: 1 });
      const o = r.geoObjects.get(0);
      if (o) return String(o.properties.get('name') || '');
    } catch (_) { /* фолбэк ниже */ }
  }
  try {
    const res = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=' + LANG + '&lat=' + lat + '&lon=' + lng);
    if (res.ok) {
      const d = await res.json();
      return String(d.name || (d.display_name || '').split(',')[0] || '');
    }
  } catch (_) { /* адрес введут вручную */ }
  return '';
}

function fillShortAddress(coords) {
  if ($('address').value.trim()) return;
  reverseNameUz(coords[0], coords[1]).then((name) => {
    if (name && !$('address').value.trim()) $('address').value = name.slice(0, 120);
  });
}

async function searchPlace() {
  const q = $('geo-search').value.trim();
  if (!q || !ymap) return;
  const btn = $('geo-search-btn');
  btn.disabled = true;
  try {
    const found = await geoSearchUz(q);
    if (!found) {
      showError(t('eGeo'));
      return;
    }
    showError('');
    ymap.setCenter([found.lat, found.lng], 16, { duration: 300 });
    setPoint(found.lat, found.lng);
    if (!$('address').value.trim() && found.name) {
      $('address').value = found.name.slice(0, 120);
    }
    revealSteps();
  } catch (_) {
    showError(t('eNet'));
  } finally {
    btn.disabled = false;
  }
}

$('geo-search-btn').addEventListener('click', searchPlace);
$('geo-search').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    searchPlace();
  }
});

/* ── Карусель шаблонов с живым демо ───────────────────────────── */

function liveQuery() {
  const g = encodeURIComponent($('groom').value.trim());
  const b = encodeURIComponent($('bride').value.trim());
  return `?groom=${g}&bride=${b}&lang=${LANG}`;
}

function sortedTemplates() {
  const pop = state.config.populars || {};
  return [...state.config.templates].sort((a, b) => (pop[b.id] || 0) - (pop[a.id] || 0));
}

function renderTemplates() {
  if (!state.config) return;
  const box = $('templates');
  box.innerHTML = '';
  const pop = state.config.populars || {};

  sortedTemplates().forEach((tpl, i) => {
    const card = document.createElement('div');
    card.className = 'tpl-card' + (state.templateId === tpl.id ? ' selected' : '');
    card.dataset.id = tpl.id;

    if (i < 2 && (pop[tpl.id] || 0) > 0) {
      const ribbon = document.createElement('div');
      ribbon.className = 'tpl-ribbon';
      ribbon.textContent = 'TOP';
      card.appendChild(ribbon);
    }
    if (state.templateId === tpl.id) {
      const check = document.createElement('div');
      check.className = 'tpl-check';
      check.textContent = '✓';
      card.appendChild(check);
    }

    const wrap = document.createElement('div');
    wrap.className = 'tpl-frame-wrap';
    const frame = document.createElement('iframe');
    frame.loading = 'lazy';
    frame.src = tpl.demoUrl + liveQuery();
    wrap.appendChild(frame);

    const body = document.createElement('div');
    body.className = 'tpl-body';
    const nameRow = document.createElement('div');
    nameRow.className = 'tpl-name-row';
    const name = document.createElement('div');
    name.className = 'tpl-name';
    name.textContent = tpl.name;
    const price = document.createElement('div');
    price.className = 'tpl-price';
    price.textContent = money(tpl.price);
    nameRow.appendChild(name);
    nameRow.appendChild(price);
    const meta = document.createElement('div');
    meta.className = 'tpl-meta';
    meta.textContent = t('photoBadge', tpl.minPhotos);
    const btns = document.createElement('div');
    btns.className = 'tpl-btns';
    const demoBtn = document.createElement('button');
    demoBtn.type = 'button';
    demoBtn.className = 'btn-demo';
    demoBtn.textContent = t('demo');
    demoBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      openDemo(tpl);
    });
    const pickBtn = document.createElement('button');
    pickBtn.type = 'button';
    pickBtn.className = 'btn-pick';
    pickBtn.textContent = t('pick');
    pickBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      selectTemplate(tpl.id);
    });
    btns.appendChild(demoBtn);
    btns.appendChild(pickBtn);
    body.appendChild(nameRow);
    body.appendChild(meta);
    body.appendChild(btns);

    card.appendChild(wrap);
    card.appendChild(body);
    card.addEventListener('click', () => selectTemplate(tpl.id));
    box.appendChild(card);
  });
}

function selectTemplate(id) {
  state.templateId = id;
  document.querySelectorAll('.tpl-card').forEach((c) => {
    const sel = c.dataset.id === id;
    c.classList.toggle('selected', sel);
    const old = c.querySelector('.tpl-check');
    if (old) old.remove();
    if (sel) {
      const check = document.createElement('div');
      check.className = 'tpl-check';
      check.textContent = '✓';
      c.appendChild(check);
    }
  });
  updatePhotoTexts();
  renderPhotos();
  updateTotal();
  revealSteps();
}

function selectedTemplate() {
  return state.config?.templates.find((x) => x.id === state.templateId) ?? null;
}

// Живое обновление демо в карточках при вводе имён (с задержкой).
let liveTimer = null;
['groom', 'bride'].forEach((id) => {
  $(id).addEventListener('input', () => {
    revealSteps();
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => {
      document.querySelectorAll('.tpl-frame-wrap iframe').forEach((f) => {
        const base = f.src.split('?')[0];
        f.src = base + liveQuery();
      });
    }, 800);
  });
});

// Медленная автопрокрутка карусели; пауза при касании.
let carouselIdx = 0;
let carouselPausedUntil = 0;
setInterval(() => {
  const box = $('templates');
  if (!box || box.children.length === 0) return;
  if (sectionOf('template').hidden || state.templateId) return;
  if (Date.now() < carouselPausedUntil) return;
  carouselIdx = (carouselIdx + 1) % box.children.length;
  const card = box.children[carouselIdx];
  box.scrollTo({ left: card.offsetLeft - 16, behavior: 'smooth' });
}, 4500);
$('tpl-carousel').addEventListener('pointerdown', () => { carouselPausedUntil = Date.now() + 15000; });
$('tpl-carousel').addEventListener('touchstart', () => { carouselPausedUntil = Date.now() + 15000; }, { passive: true });

/* ── Демо на весь экран ───────────────────────────────────────── */

let demoTemplate = null;

function openDemo(tpl) {
  demoTemplate = tpl;
  $('demo-frame').src = tpl.demoUrl + liveQuery();
  $('demo-modal').hidden = false;
}

$('demo-close').addEventListener('click', () => {
  $('demo-modal').hidden = true;
  $('demo-frame').src = 'about:blank';
});
$('demo-select').addEventListener('click', () => {
  if (demoTemplate) selectTemplate(demoTemplate.id);
  $('demo-modal').hidden = true;
  $('demo-frame').src = 'about:blank';
});

/* ── Фотографии ───────────────────────────────────────────────── */

function requiredPhotos() {
  return selectedTemplate()?.minPhotos ?? null;
}

function updatePhotoTexts() {
  const req = requiredPhotos();
  $('photo-req').textContent = req === null ? t('photoReqNoTpl') : t('photoReq', req);
}

function renderPhotos() {
  const grid = $('photo-grid');
  grid.innerHTML = '';
  const max = state.config ? state.config.maxPhotos : 6;
  for (const item of state.photos) {
    const tile = document.createElement('div');
    tile.className = 'photo-tile';
    const img = document.createElement('img');
    img.src = item.previewUrl;
    img.alt = '';
    tile.appendChild(img);
    if (item.uploading) {
      const load = document.createElement('div');
      load.className = 'ph-loading';
      load.textContent = '⏳';
      tile.appendChild(load);
    } else {
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'ph-remove';
      rm.textContent = '✕';
      rm.addEventListener('click', () => {
        state.photos = state.photos.filter((p) => p !== item);
        renderPhotos();
      });
      tile.appendChild(rm);
    }
    grid.appendChild(tile);
  }
  if (state.photos.length < max) {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'photo-add';
    add.innerHTML = '<span>+</span>' + t('add');
    add.addEventListener('click', () => $('photo-input').click());
    grid.appendChild(add);
  }
  const done = state.photos.filter((p) => p.name).length;
  $('photo-hint').textContent = t('photoOf', done, requiredPhotos() ?? 1);
}

async function uploadFile(file) {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Init-Data': tg ? tg.initData : '' },
    body: file,
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || t('eNet'));
  return data;
}

$('photo-input').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  e.target.value = '';
  const max = state.config ? state.config.maxPhotos : 6;
  for (const file of files) {
    if (state.photos.length >= max) break;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { showError(t('eFile')); continue; }
    if (file.size > 8 * 1024 * 1024) { showError(t('eBig')); continue; }
    const item = { name: null, previewUrl: URL.createObjectURL(file), uploading: true };
    state.photos.push(item);
    renderPhotos();
    try {
      const data = await uploadFile(file);
      item.name = data.file;
      showError('');
    } catch (err) {
      state.photos = state.photos.filter((p) => p !== item);
      showError(err.message);
    }
    item.uploading = false;
    renderPhotos();
    revealSteps();
  }
});

/* ── Музыка: табы ─────────────────────────────────────────────── */

let previewAudio = new Audio();
let musicLoaded = false;

document.querySelectorAll('#music-tabs .chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#music-tabs .chip').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const mt = btn.dataset.mt;
    $('music-catalog').hidden = mt !== 'catalog';
    $('music-own').hidden = mt !== 'own';
    previewAudio.pause();
    if (mt === 'none') {
      state.music = { type: 'none', value: null, name: '', previewUrl: null, start: null, end: null };
      updateSelectedMusic();
    }
    if (mt === 'catalog' && !musicLoaded) {
      musicLoaded = true;
      loadTracks('');
    }
  });
});

function trackRow(track, extra) {
  const row = document.createElement('div');
  row.className = 'track-row';
  if (track.art) {
    const img = document.createElement('img');
    img.src = track.art;
    img.alt = '';
    row.appendChild(img);
  }
  const info = document.createElement('div');
  info.className = 'track-info';
  const b = document.createElement('b');
  b.textContent = track.name;
  const span = document.createElement('span');
  span.textContent = track.artist || '';
  info.appendChild(b);
  info.appendChild(span);
  if (extra) {
    const fire = document.createElement('div');
    fire.className = 'track-fire';
    fire.textContent = extra;
    info.appendChild(fire);
  }
  const play = document.createElement('button');
  play.type = 'button';
  play.textContent = '▶';
  play.addEventListener('click', () => {
    if (previewAudio.src === track.url && !previewAudio.paused) {
      previewAudio.pause();
      play.textContent = '▶';
    } else {
      previewAudio.src = track.url;
      previewAudio.play();
      document.querySelectorAll('.track-row button').forEach((x) => { if (x.textContent === '⏸') x.textContent = '▶'; });
      play.textContent = '⏸';
      previewAudio.onended = () => { play.textContent = '▶'; };
    }
  });
  const pick = document.createElement('button');
  pick.type = 'button';
  pick.className = 'pick';
  pick.textContent = '✓';
  pick.addEventListener('click', () => {
    previewAudio.pause();
    state.music = {
      type: 'itunes',
      value: { name: track.name, artist: track.artist, url: track.url },
      name: track.name + (track.artist ? ' — ' + track.artist : ''),
      previewUrl: track.url,
      start: null,
      end: null,
    };
    // «птичка» выбрана — каталог убираем, остаётся только выбранный трек
    $('music-catalog').hidden = true;
    updateSelectedMusic();
  });
  row.appendChild(info);
  row.appendChild(play);
  row.appendChild(pick);
  return row;
}

function renderTopTracks() {
  const box = $('top-tracks');
  box.innerHTML = '';
  for (const tr of state.config.topTracks || []) {
    box.appendChild(trackRow(tr, `🔥 ${tr.uses} ${t('uses')}`));
  }
}

async function loadTracks(q) {
  const box = $('track-list');
  box.innerHTML = '<p class="hint">...</p>';
  try {
    const res = await fetch('/api/music?q=' + encodeURIComponent(q));
    const data = await res.json();
    box.innerHTML = '';
    if (!data.tracks.length) {
      box.innerHTML = `<p class="hint">${t('empty')}</p>`;
      return;
    }
    for (const tr of data.tracks) box.appendChild(trackRow(tr));
  } catch (_) {
    box.innerHTML = `<p class="hint">${t('eNet')}</p>`;
  }
}

$('music-q-btn').addEventListener('click', () => loadTracks($('music-q').value.trim()));
$('music-q').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    loadTracks($('music-q').value.trim());
  }
});

$('sel-change').addEventListener('click', () => {
  const wasItunes = state.music.type === 'itunes';
  state.music = { type: 'none', value: null, name: '', previewUrl: null, start: null, end: null };
  updateSelectedMusic();
  if (wasItunes) $('music-catalog').hidden = false;
  else $('music-own').hidden = false;
});

/* ── Своя музыка: ссылка / извлечение / файл ─────────────────── */

$('music-link').addEventListener('change', async () => {
  const url = $('music-link').value.trim();
  if (!url) return;
  if (!/^https?:\/\/\S+$/.test(url)) {
    showError(t('eMusic'));
    return;
  }
  showError('');
  const yt = url.match(YT_RE);
  const social = SOCIAL_RE.test(url);

  if ((yt || social) && state.config.extractEnabled) {
    // пробуем вытащить аудио из видео
    const linkEl = $('music-link');
    linkEl.disabled = true;
    const old = linkEl.value;
    linkEl.value = t('extracting');
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Init-Data': tg ? tg.initData : '' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error('extract');
      state.music = { type: 'upload', value: data.file, name: '🎬 ' + url.slice(0, 50), previewUrl: '/uploads/' + data.file, start: null, end: null };
      $('music-own').hidden = true;
      updateSelectedMusic();
      return;
    } catch (_) {
      if (!yt) {
        showError(t('extractUnavail'));
        return;
      }
      // для YouTube есть запасной вариант — встроенный плеер
    } finally {
      linkEl.disabled = false;
      linkEl.value = old;
    }
  }

  if (yt) {
    state.music = { type: 'youtube', value: url, name: 'YouTube · ' + yt[1], previewUrl: null, start: null, end: null };
    $('music-own').hidden = true;
    updateSelectedMusic();
    return;
  }
  if (social) {
    showError(t('extractUnavail'));
    return;
  }
  const playable = /\.(mp3|ogg|m4a|wav)(\?|$)/i.test(url);
  state.music = { type: 'custom', value: url, name: url.slice(0, 60), previewUrl: playable ? url : null, start: null, end: null };
  $('music-own').hidden = true;
  updateSelectedMusic();
});

$('music-upload-btn').addEventListener('click', () => $('music-file').click());
$('music-file').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 16 * 1024 * 1024) { showError(t('eBig')); return; }
  const btn = $('music-upload-btn');
  btn.disabled = true;
  btn.textContent = t('uploading');
  try {
    const data = await uploadFile(file);
    if (data.kind !== 'audio') throw new Error(t('eFile'));
    state.music = { type: 'upload', value: data.file, name: file.name, previewUrl: '/uploads/' + data.file, start: null, end: null };
    showError('');
    $('music-own').hidden = true;
    updateSelectedMusic();
  } catch (err) {
    showError(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = t('upload');
  }
});

/* ── Выбранный трек + тример ──────────────────────────────────── */

function updateSelectedMusic() {
  const sel = $('music-selected');
  if (state.music.type === 'none') {
    sel.hidden = true;
    return;
  }
  sel.hidden = false;
  $('sel-name').textContent = state.music.name;
  if (state.music.previewUrl) {
    $('trimmer').hidden = false;
    $('cut-num-row').hidden = true;
    setupTrimmer(state.music.previewUrl);
  } else {
    $('trimmer').hidden = true;
    $('cut-num-row').hidden = state.music.type !== 'youtube';
    $('cut-start').value = state.music.start ?? '';
    $('cut-end').value = state.music.end ?? '';
  }
}

$('cut-start').addEventListener('input', () => {
  const v = parseInt($('cut-start').value, 10);
  state.music.start = Number.isFinite(v) && v >= 0 ? v : null;
});
$('cut-end').addEventListener('input', () => {
  const v = parseInt($('cut-end').value, 10);
  state.music.end = Number.isFinite(v) && v > 0 ? v : null;
});

// Волновой тример: canvas + перетаскиваемые золотые ручки.
const trim = { dur: 30, peaks: null, startFrac: 0, endFrac: 1, drag: null };

function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

async function setupTrimmer(url) {
  const audio = $('cut-audio');
  audio.src = url;
  trim.dur = 30;
  trim.peaks = null;
  trim.startFrac = 0;
  trim.endFrac = 1;
  state.music.start = null;
  state.music.end = null;

  audio.onloadedmetadata = () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      trim.dur = audio.duration;
      drawTrim();
    }
  };

  // пробуем настоящую волну; если CORS не пускает — рисуем стилизованную
  try {
    const buf = await (await fetch(url)).arrayBuffer();
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const ab = await ctx.decodeAudioData(buf);
    trim.dur = ab.duration;
    const ch = ab.getChannelData(0);
    const N = 90;
    const step = Math.floor(ch.length / N);
    const peaks = [];
    for (let i = 0; i < N; i++) {
      let m = 0;
      for (let j = i * step; j < (i + 1) * step; j += 60) {
        const v = Math.abs(ch[j]);
        if (v > m) m = v;
      }
      peaks.push(Math.min(1, m * 1.4));
    }
    trim.peaks = peaks;
    ctx.close();
  } catch (_) {
    const peaks = [];
    for (let i = 0; i < 90; i++) {
      peaks.push(0.25 + 0.65 * Math.abs(Math.sin(i * 0.55) * Math.cos(i * 0.19) + Math.sin(i * 1.7) * 0.3) / 1.3);
    }
    trim.peaks = peaks;
  }
  drawTrim();
}

function drawTrim() {
  const box = $('trim-box');
  const canvas = $('trim-wave');
  const W = box.clientWidth;
  const H = box.clientHeight;
  if (!W) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const peaks = trim.peaks || [];
  const n = peaks.length || 1;
  const bw = W / n;
  for (let i = 0; i < n; i++) {
    const frac = i / n;
    const inside = frac >= trim.startFrac && frac <= trim.endFrac;
    const h = Math.max(3, peaks[i] * (H - 18));
    ctx.fillStyle = inside ? '#e2c786' : 'rgba(226,199,134,.28)';
    ctx.beginPath();
    ctx.roundRect(i * bw + 1, (H - h) / 2, Math.max(2, bw - 2), h, 2);
    ctx.fill();
  }

  const selEl = $('trim-sel');
  const lEl = $('trim-l');
  const rEl = $('trim-r');
  const lx = trim.startFrac * W;
  const rx = trim.endFrac * W;
  selEl.style.left = lx + 'px';
  selEl.style.width = Math.max(0, rx - lx) + 'px';
  lEl.style.left = Math.max(0, lx - 9) + 'px';
  rEl.style.left = Math.min(W - 18, rx - 9) + 'px';

  const s = trim.startFrac * trim.dur;
  const e = trim.endFrac * trim.dur;
  $('trim-lbl').textContent = fmtTime(s) + ' — ' + fmtTime(e);
  state.music.start = trim.startFrac <= 0.001 ? null : Math.round(s);
  state.music.end = trim.endFrac >= 0.999 ? null : Math.round(e);
}

function trimPointer(e) {
  const box = $('trim-box');
  const rect = box.getBoundingClientRect();
  return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
}

['trim-l', 'trim-r'].forEach((id) => {
  $(id).addEventListener('pointerdown', (e) => {
    e.preventDefault();
    trim.drag = id;
    document.addEventListener('pointermove', onTrimMove);
    document.addEventListener('pointerup', onTrimUp, { once: true });
  });
});

function onTrimMove(e) {
  const f = trimPointer(e);
  if (trim.drag === 'trim-l') trim.startFrac = Math.min(f, trim.endFrac - 0.03);
  else trim.endFrac = Math.max(f, trim.startFrac + 0.03);
  drawTrim();
}

function onTrimUp() {
  trim.drag = null;
  document.removeEventListener('pointermove', onTrimMove);
}

$('cut-test').addEventListener('click', () => {
  const audio = $('cut-audio');
  const start = trim.startFrac * trim.dur;
  const end = trim.endFrac * trim.dur;
  audio.currentTime = start;
  audio.play();
  const stopAt = () => {
    if (audio.currentTime >= end) {
      audio.pause();
      audio.removeEventListener('timeupdate', stopAt);
    }
  };
  audio.addEventListener('timeupdate', stopAt);
});

/* ── Премиум и итог ───────────────────────────────────────────── */

function guestNames() {
  return $('guests').value.split('\n').map((s) => s.trim()).filter(Boolean);
}

$('premium').addEventListener('change', () => {
  $('guests-block').hidden = !$('premium').checked;
  updateTotal();
  revealSteps();
});
$('guests').addEventListener('input', () => {
  $('guest-count').textContent = t('guests', guestNames().length);
  revealSteps();
});

function updateTotal() {
  if (!state.config) return;
  const tpl = selectedTemplate();
  if (!tpl) {
    $('total').textContent = '—';
    return;
  }
  let total = tpl.price;
  if ($('premium').checked) total += state.config.premiumGuestsPrice;
  $('total').textContent = money(total);
}

/* ── Отправка: предпросмотр → подтверждение ───────────────────── */

function collectForm() {
  return {
    lang: LANG,
    groomName: $('groom').value.trim(),
    brideName: $('bride').value.trim(),
    weddingDate: state.dateIso,
    weddingTime: $('time').value,
    lat: state.lat,
    lng: state.lng,
    address: $('address').value.trim(),
    photos: state.photos.filter((p) => p.name).map((p) => p.name),
    musicType: state.music.type,
    musicValue: state.music.value,
    musicStart: state.music.start,
    musicEnd: state.music.end,
    templateId: state.templateId,
    premium: $('premium').checked,
    guestNames: $('premium').checked ? guestNames() : [],
    phone: $('phone').value.trim(),
  };
}

function validateClient(form) {
  if (!form.groomName) return { step: 'names', msg: t('eGroom') };
  if (!form.brideName) return { step: 'names', msg: t('eBride') };
  if (!form.weddingDate) return { step: 'datetime', msg: t('eDate') };
  if (!form.weddingTime) return { step: 'datetime', msg: t('eTime') };
  if (form.lat === null || form.lng === null) return { step: 'location', msg: t('eLoc') };
  if (!form.templateId) return { step: 'template', msg: t('eTpl') };
  if (state.photos.some((p) => p.uploading)) return { step: 'photos', msg: t('eWait') };
  const req = requiredPhotos() ?? 1;
  if (form.photos.length < req) return { step: 'photos', msg: t('ePhotos', req) };
  if (form.premium && form.guestNames.length === 0) return { step: 'premium', msg: t('eGuests') };
  if (form.premium && form.guestNames.length > state.config.maxGuests) return { step: 'premium', msg: t('eGuests') };
  return null;
}

$('submit').addEventListener('click', async () => {
  const form = collectForm();
  const err = validateClient(form);
  if (err) {
    goToError(err.step, err.msg);
    return;
  }
  showError('');
  const btn = $('submit');
  btn.disabled = true;
  try {
    const res = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg ? tg.initData : '', form }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      goToError(data.step || 'names', data.error || t('eNet'));
      return;
    }
    $('confirm-frame').srcdoc = data.html;
    $('confirm-modal').hidden = false;
  } catch (_) {
    showError(t('eNet'));
  } finally {
    btn.disabled = false;
  }
});

$('confirm-back').addEventListener('click', () => {
  $('confirm-modal').hidden = true;
  $('confirm-frame').srcdoc = '';
});

$('confirm-ok').addEventListener('click', async () => {
  const phone = $('phone').value.trim();
  if (!/^\+?[\d\s()-]{7,20}$/.test(phone)) {
    $('phone').classList.add('err');
    setTimeout(() => $('phone').classList.remove('err'), 1500);
    return;
  }
  const btn = $('confirm-ok');
  btn.disabled = true;
  btn.textContent = t('sending');
  try {
    const form = collectForm();
    const res = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg ? tg.initData : '', form }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw Object.assign(new Error(data.error || t('eNet')), { step: data.step });
    $('confirm-modal').hidden = true;
    $('form-screen').hidden = true;
    $('bottom-bar').hidden = true;
    $('success-screen').hidden = false;
    if (tg) setTimeout(() => tg.close(), 4000);
  } catch (e) {
    if (e.step) goToError(e.step, e.message);
    else showError(e.message || t('eNet'));
  } finally {
    btn.disabled = false;
    btn.textContent = t('confirmOk');
  }
});

/* ── Старт ────────────────────────────────────────────────────── */

initLangScreen();
loadConfig().catch(() => showError('Server?'));
