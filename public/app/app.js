/* global ymaps, UI */
/* Taklifnoma — приложение.
   Разделы: состояние и черновик · i18n · роутер экранов · главная ·
   галерея · мои приглашения · движок мастера · шаги · отправка · старт. */
'use strict';

const { $, h, debounce, toast, sheet, skeletons, countUp, revealOnScroll, petals, haptic, tg } = UI;

if (tg) { tg.ready(); tg.expand(); }

/* ════ Состояние и черновик ════ */

const state = {
  config: null,
  lat: null,
  lng: null,
  templateId: null,
  dateIso: null,
  photos: [],                  // { name, previewUrl, uploading }
  music: { type: 'none', value: null, name: '', previewUrl: null, start: null, end: null },
  step: 0,
  draftRestored: false,
};

const DRAFT_KEY = 'tk_draft_v1';

// Автосохранение: Telegram закрывает WebView без предупреждения — черновик обязателен.
const saveDraft = debounce(() => {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      v: 1,
      groom: $('groom').value,
      bride: $('bride').value,
      dateIso: state.dateIso,
      time: $('time').value,
      lat: state.lat,
      lng: state.lng,
      address: $('address').value,
      templateId: state.templateId,
      photos: state.photos.filter((p) => p.name).map((p) => p.name),
      music: {
        type: state.music.type, value: state.music.value, name: state.music.name,
        start: state.music.start, end: state.music.end,
      },
      premium: $('premium').checked,
      guests: $('guests').value,
      phone: $('phone').value,
      step: state.step,
    }));
  } catch (_) { /* переполненное хранилище не критично */ }
}, 400);

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch (_) { /* — */ }
}

function restoreDraft() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (_) { return false; }
  if (!d || d.v !== 1) return false;
  const hasContent = d.groom || d.bride || d.templateId || (d.photos || []).length;
  if (!hasContent) return false;
  $('groom').value = d.groom || '';
  $('bride').value = d.bride || '';
  state.dateIso = d.dateIso || null;
  if (d.time) $('time').value = d.time;
  state.lat = Number.isFinite(d.lat) ? d.lat : null;
  state.lng = Number.isFinite(d.lng) ? d.lng : null;
  $('address').value = d.address || '';
  state.templateId = d.templateId || null;
  state.photos = (d.photos || []).map((name) => ({ name, previewUrl: '/uploads/' + name, uploading: false }));
  if (d.music && d.music.type && d.music.type !== 'none') {
    const m = d.music;
    let previewUrl = null;
    if (m.type === 'upload') previewUrl = '/uploads/' + m.value;
    else if (m.type === 'itunes' && m.value?.url) previewUrl = m.value.url;
    else if (m.type === 'custom' && /\.(mp3|ogg|m4a|wav)(\?|$)/i.test(m.value || '')) previewUrl = m.value;
    state.music = { type: m.type, value: m.value, name: m.name || '', previewUrl, start: m.start ?? null, end: m.end ?? null };
  }
  $('premium').checked = Boolean(d.premium);
  $('guests-block').hidden = !d.premium;
  $('guests').value = d.guests || '';
  $('phone').value = d.phone || '';
  state.step = Math.min(Number(d.step) || 0, WIZARD.length - 1);
  state.draftRestored = true;
  return true;
}

/* ════ Словари ════ */

const I18N = {
  uz: {
    navTpl: 'Shablonlar', navMine: 'Taklifnomalarim',
    landSub: 'Onlayn to‘y taklifnomasini yarating — jonli sayt, xarita, musiqa va to‘ygacha sanoq bilan. Bir necha daqiqada.',
    landQuote: '«Hayot olg‘a shoshadi, ammo muhabbat doim o‘z yo‘lini topadi»',
    ctaCreate: 'Hozir yaratish',
    howTitle: 'Qanday ishlaydi?',
    step1T: 'Shablonni tanlang', step1D: 'Har bir dizayn — ismlaringiz bilan jonli demo',
    step2T: 'Ma’lumotlarni to‘ldiring', step2D: 'Sana, manzil, suratlar va musiqa — 8 qulay qadam',
    step3T: 'Taklifnomani ulashing', step3D: 'To‘lovdan so‘ng havolani mehmonlarga yuboring',
    statCouples: 'baxtli juftlik', statTemplates: 'noyob shablon', statLangs: 'til',
    bandText: 'Eng baxtli kuningiz shu yerdan boshlanadi',
    bentoTitle: 'Taklifnomada nimalar bor?',
    b1T: 'Jonli xarita', b1D: 'To‘yxona taklifnomaning ichida — mehmonlar bir bosishda yo‘l topadi',
    b2T: 'Musiqa', b2D: 'Katalogdan yoki o‘zingiznikini yuklang',
    b3T: 'Jonli sanoq', b3D: 'To‘ygacha qolgan kunlar real vaqtda',
    b4T: 'Ismli havolalar', b4D: 'Har bir mehmonga shaxsiy murojaat',
    b5T: 'Ikki til', b5D: 'O‘zbek va rus tillarida',
    b6T: 'Qoralama avtosaqlanadi', b6D: 'Istalgan payt qaytib davom ettiring — hech narsa yo‘qolmaydi',
    tplTitle: 'Taklifnoma shablonlari',
    tplSub: 'Kartochkada jonli demo. «Demo» — to‘liq ko‘rish, «Tanlash» — yaratishni boshlash.',
    mineTitle: 'Mening taklifnomalarim',
    mineEmpty: 'Hozircha taklifnomalar yo‘q — birinchisini yarating!',
    mineOpenTg: 'Ro‘yxatni ko‘rish uchun formani Telegram-bot orqali oching.',
    stNew: '⏳ Tasdiqlash kutilmoqda', stPaid: '✅ Tayyor', stCancelled: '✖ Bekor qilingan',
    open: 'Ochish', copy: 'Nusxa olish', copied: 'Havola nusxalandi',
    createNew: '+ Yangi taklifnoma yaratish',
    /* студия */
    stepTitles: ['Kelin-kuyov', 'Sana va vaqt', 'Manzil', 'Dizayn', 'Suratlar', 'Musiqa', 'Qo‘shimchalar', 'Yakuniy ko‘rik'],
    stepOf: (a, b) => `${a} / ${b}-qadam`,
    next: 'Davom etish', back: 'Ortga', send: 'Ariza yuborish', sending: 'Yuborilmoqda...',
    leadNames: 'Ismlaringiz taklifnomaning yuragida turadi.',
    hintNames: 'Ismlar taklifnomada yozilganidek ko‘rinadi — xohlagancha yozing.',
    leadDate: 'To‘y qachon? Mehmonlar sanani va to‘ygacha sanoqni ko‘radi.',
    leadVenue: 'Joyni qidiring — xaritada darhol ko‘rsatamiz. Mehmonlar taklifnomada jonli xaritani oladi.',
    leadTpl: 'Dizayn tanlang — har bir kartochkada ismlaringiz bilan jonli demo.',
    leadMusic: 'Taklifnoma ochilganda yangraydigan musiqa (ixtiyoriy).',
    leadExtra: 'Har bir mehmonga shaxsiy havola: «Hurmatli Aziz!» deb murojaat qiladi.',
    leadReview: 'Hammasi tayyor — taklifnomangizni ko‘rib chiqing va yuboring.',
    groom: 'Kuyov ismi', bride: 'Kelin ismi', phGroom: 'Ali', phBride: 'Zebo',
    pickDate: 'Taqvimda sanani tanlang', time: 'Vaqt',
    searchPh: 'Masalan: Navro‘z to‘yxonasi', find: 'Qidirish',
    address: 'Joy nomi (qisqa)', phAddress: 'Masalan: Navro‘z to‘yxonasi',
    noPin: '📍 Belgi qo‘yilmagan',
    demo: 'DEMO', pick: 'Tanlash', chooseThis: 'Shu shablonni tanlash',
    photoBadge: (n) => `📷 ${n}+ surat`,
    photoReq: (n) => `Tanlangan shablon uchun kamida ${n} ta surat kerak. JPG, PNG yoki WebP.`,
    photoReqNoTpl: 'Avval dizayn qadamida shablonni tanlang.',
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
    total: 'Jami:', fullPreview: 'To‘liq ko‘rish',
    rcCouple: 'Kelin-kuyov', rcDate: 'Sana', rcVenue: 'Manzil', rcTpl: 'Shablon', rcPremium: 'Ismli taklifnomalar', rcMusic: 'Musiqa',
    phoneLabel: 'Telefon raqamingiz',
    confirmNote: '📩 Administrator tez orada siz bilan bog‘lanadi (Telegram yoki telefon orqali). To‘lovdan so‘ng havolani olasiz.',
    okTitle: 'Ariza yuborildi!',
    okText: 'Administrator to‘lovni tasdiqlash uchun siz bilan bog‘lanadi. To‘lovdan so‘ng taklifnoma havolasini olasiz.',
    close: '✕ Yopish', sum: 'so‘m',
    draftRestored: 'Qoralamangiz tiklandi — davom eting ✨',
    draftSaved: 'Qoralama saqlandi',
    eGroom: 'Kuyov ismini kiriting', eBride: 'Kelin ismini kiriting',
    eDate: 'Taqvimda sanani tanlang', eTime: 'Vaqtni kiriting',
    eLoc: 'Xaritada joyni belgilang', eWait: 'Suratlar yuklanishini kuting',
    ePhotos: (n) => `Kamida ${n} ta surat yuklang`, eTpl: 'Shablonni tanlang',
    eGuests: 'Mehmonlar ismini kiriting yoki xizmatni o‘chiring',
    ePhone: 'Telefon raqamingizni kiriting',
    eMusic: 'Musiqa havolasi noto‘g‘ri', eNet: 'Tarmoq xatosi, qayta urinib ko‘ring',
    eFile: 'Bu format qo‘llab-quvvatlanmaydi', eBig: 'Fayl juda katta',
    eGeo: 'O‘zbekistonda topilmadi — boshqa nom yozing yoki xaritada belgilang',
    months: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
    monthsGen: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
    wdShort: ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'],
    wdFull: ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'],
    dateLabel: (wd, d, m, y) => `${wd}, ${d}-${m}, ${y}`,
  },
  ru: {
    navTpl: 'Шаблоны', navMine: 'Мои приглашения',
    landSub: 'Создавайте свадебные приглашения онлайн — живой сайт с картой, музыкой и отсчётом до свадьбы. За несколько минут.',
    landQuote: '«Жизнь мчится вперёд, но любовь всегда находит свой путь»',
    ctaCreate: 'Создать сейчас',
    howTitle: 'Как это работает?',
    step1T: 'Выберите шаблон', step1D: 'Каждый дизайн — живое демо с вашими именами',
    step2T: 'Заполните данные', step2D: 'Дата, локация, фото и музыка — 8 удобных шагов',
    step3T: 'Отправьте приглашение', step3D: 'После оплаты поделитесь ссылкой с гостями',
    statCouples: 'счастливых пар', statTemplates: 'уникальных шаблонов', statLangs: 'языка',
    bandText: 'Ваш самый счастливый день начинается здесь',
    bentoTitle: 'Что внутри приглашения?',
    b1T: 'Живая карта', b1D: 'Тойхона прямо в приглашении — гости найдут дорогу в один тап',
    b2T: 'Музыка', b2D: 'Из каталога или загрузите свою',
    b3T: 'Живой отсчёт', b3D: 'Дни до свадьбы в реальном времени',
    b4T: 'Именные ссылки', b4D: 'Личное обращение к каждому гостю',
    b5T: 'Два языка', b5D: 'На узбекском и русском',
    b6T: 'Черновик сохраняется сам', b6D: 'Вернитесь в любой момент — ничего не потеряется',
    tplTitle: 'Шаблоны приглашений',
    tplSub: 'В карточке — живое демо. «Демо» — полный просмотр, «Выбрать» — начать создание.',
    mineTitle: 'Мои приглашения',
    mineEmpty: 'Пока нет приглашений — создайте первое!',
    mineOpenTg: 'Чтобы увидеть список, откройте форму через Telegram-бота.',
    stNew: '⏳ Ожидает подтверждения', stPaid: '✅ Готово', stCancelled: '✖ Отклонено',
    open: 'Открыть', copy: 'Скопировать', copied: 'Ссылка скопирована',
    createNew: '+ Создать новое приглашение',
    stepTitles: ['Пара', 'Дата и время', 'Локация', 'Дизайн', 'Фотографии', 'Музыка', 'Дополнения', 'Финальный обзор'],
    stepOf: (a, b) => `Шаг ${a} из ${b}`,
    next: 'Продолжить', back: 'Назад', send: 'Отправить заявку', sending: 'Отправляем...',
    leadNames: 'Ваши имена — сердце приглашения.',
    hintNames: 'Имена появятся в приглашении ровно так, как вы их напишете.',
    leadDate: 'Когда свадьба? Гости увидят дату и живой отсчёт до торжества.',
    leadVenue: 'Найдите место — мы сразу покажем его на карте. Гости получат живую карту в приглашении.',
    leadTpl: 'Выберите дизайн — в каждой карточке живое демо с вашими именами.',
    leadMusic: 'Музыка, которая заиграет при открытии приглашения (необязательно).',
    leadExtra: 'Личная ссылка для каждого гостя: приглашение обратится «Hurmatli Aziz!»',
    leadReview: 'Всё готово — посмотрите приглашение и отправьте заявку.',
    groom: 'Имя жениха', bride: 'Имя невесты', phGroom: 'Али', phBride: 'Зебо',
    pickDate: 'Выберите дату в календаре', time: 'Время',
    searchPh: 'Например: тойхона Versal', find: 'Найти',
    address: 'Название места (коротко)', phAddress: 'Например: тойхона Versal',
    noPin: '📍 Метка не поставлена',
    demo: 'DEMO', pick: 'Выбрать', chooseThis: 'Выбрать этот шаблон',
    photoBadge: (n) => `📷 ${n}+ фото`,
    photoReq: (n) => `Для выбранного шаблона нужно минимум ${n} фото. JPG, PNG или WebP.`,
    photoReqNoTpl: 'Сначала выберите шаблон на шаге «Дизайн».',
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
    total: 'Итого:', fullPreview: 'На весь экран',
    rcCouple: 'Пара', rcDate: 'Дата', rcVenue: 'Локация', rcTpl: 'Шаблон', rcPremium: 'Именные приглашения', rcMusic: 'Музыка',
    phoneLabel: 'Ваш номер телефона',
    confirmNote: '📩 Администратор скоро свяжется с вами (в Telegram или по телефону). После оплаты вы получите ссылку.',
    okTitle: 'Заявка отправлена!',
    okText: 'Администратор свяжется с вами для подтверждения и оплаты. После оплаты вы получите ссылку на приглашение.',
    close: '✕ Закрыть', sum: 'сум',
    draftRestored: 'Черновик восстановлен — продолжайте ✨',
    draftSaved: 'Черновик сохранён',
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

function money(n) {
  return n.toLocaleString('ru-RU') + ' ' + t('sum');
}

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
  for (const [id, on] of [['hsw-uz', LANG === 'uz'], ['hsw-ru', LANG === 'ru']]) $(id).classList.toggle('active', on);
  updateDateLabel();
  renderCalendar();
  renderTimeChips();
  updateStudioChrome();
  if (state.config) {
    renderGallery($('gallery'), 'screen');
    renderGallery($('tpl-grid'), 'step');
    renderStrip();
    updatePhotoTexts();
    renderPhotos();
    $('guests-hint').textContent = t('guestsHint', state.config.maxGuests);
    $('guest-count').textContent = t('guests', guestNames().length);
    $('premium-price').textContent = '(+' + money(state.config.premiumGuestsPrice) + ')';
    updateSelectedMusic();
    if (currentScreen === 'mine') loadMine();
    if (state.step === WIZARD.length - 1 && currentScreen === 'studio') renderReceipt();
  }
}

function setLang(lang) {
  LANG = lang;
  localStorage.setItem('tk_lang', lang);
  applyI18n();
}

/* ════ Роутер экранов ════ */

let currentScreen = 'home';
const SCREENS = ['home', 'templates', 'mine', 'studio'];

function showScreen(name) {
  currentScreen = name;
  for (const s of SCREENS) $('screen-' + s).hidden = s !== name;
  // студия — погружение: навигация уступает место прогрессу мастера
  document.querySelector('.topnav').hidden = name === 'studio';
  $('nav-tpl').classList.toggle('active', name === 'templates');
  $('nav-mine').classList.toggle('active', name === 'mine');
  if (name === 'templates') renderGallery($('gallery'), 'screen');
  if (name === 'mine') loadMine();
  if (name === 'studio') enterStudio();
  else updateTgBack();
  window.scrollTo({ top: 0 });
}

/* Кнопка «назад» Telegram: внутри мастера листает шаги */
function updateTgBack() {
  try {
    if (!tg?.BackButton) return;
    if (currentScreen === 'studio') {
      tg.BackButton.show();
    } else {
      tg.BackButton.hide();
    }
  } catch (_) { /* вне Telegram */ }
}
try {
  tg?.BackButton?.onClick(() => {
    if (currentScreen !== 'studio') return;
    if (state.step > 0) goStep(state.step - 1, -1);
    else showScreen('home');
  });
} catch (_) { /* — */ }

/* ════ Главная: живое демо в телефоне, статистика, лента ════ */

let heroIdx = 0;
let heroTimer = null;

function heroDemoSrc(tpl) {
  return `${tpl.demoUrl}?lang=${LANG}&groom=${encodeURIComponent(t('phGroom'))}&bride=${encodeURIComponent(t('phBride'))}`;
}

function startHeroDemo() {
  if (!state.config || heroTimer) return;
  const tpls = state.config.templates;
  $('hero-demo').src = heroDemoSrc(tpls[0]);
  heroTimer = setInterval(() => {
    if (currentScreen !== 'home' || document.hidden) return;
    heroIdx = (heroIdx + 1) % tpls.length;
    const f = $('hero-demo');
    f.style.opacity = '0';
    setTimeout(() => {
      f.src = heroDemoSrc(tpls[heroIdx]);
      f.style.opacity = '1';
    }, 350);
  }, 8000);
  $('hero-demo').style.transition = 'opacity .35s ease';
}

// Аврора медленно тянется за указателем — живой фон
function initAurora() {
  const aur = $('aurora');
  if (!aur) return;
  document.addEventListener('pointermove', (e) => {
    const x = (e.clientX / window.innerWidth - .5) * 46;
    const y = (e.clientY / window.innerHeight - .5) * 34;
    aur.style.setProperty('--mx', x.toFixed(1) + 'px');
    aur.style.setProperty('--my', y.toFixed(1) + 'px');
  }, { passive: true });
}

// 3D-наклон телефона за указателем
function initTilt() {
  const stage = $('hero-stage');
  const phone = $('hero-phone');
  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5;
    const y = (e.clientY - r.top) / r.height - .5;
    phone.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg');
    phone.style.setProperty('--rx', (-y * 8).toFixed(2) + 'deg');
  });
  stage.addEventListener('pointerleave', () => {
    phone.style.setProperty('--rx', '0deg');
    phone.style.setProperty('--ry', '0deg');
  });
}

let statsShown = false;
function initStats() {
  if (!state.config) return;
  const pops = state.config.populars || {};
  const couples = Object.values(pops).reduce((a, b) => a + Number(b), 0);
  const io = new IntersectionObserver((en) => {
    if (!en[0].isIntersecting || statsShown) return;
    statsShown = true;
    countUp($('stat-couples'), Math.max(couples, 1));
    countUp($('stat-templates'), state.config.templates.length, 900);
    io.disconnect();
  }, { threshold: .4 });
  io.observe($('stats'));
}

function renderStrip() {
  const box = $('strip');
  box.innerHTML = '';
  for (const tpl of state.config.templates) {
    const [c0, c1, c2] = tpl.colors;
    const card = h('div', { class: 'strip-card', onclick: () => { haptic.tap(); showScreen('templates'); } },
      h('div', { class: 'strip-swatch', style: `background:linear-gradient(160deg,${c0},${c0} 60%,${c2})` },
        h('span', { style: `color:${c1}` }, `${t('phGroom')} & ${t('phBride')}`)),
      h('div', { class: 'strip-meta' }, h('b', {}, tpl.name), h('span', {}, money(tpl.price))));
    box.appendChild(card);
  }
}

/* ════ Галерея шаблонов (экран и шаг мастера — один рендер) ════ */

function sortedTemplates() {
  const pop = state.config.populars || {};
  return [...state.config.templates].sort((a, b) => (pop[b.id] || 0) - (pop[a.id] || 0));
}

function liveQuery() {
  const g = encodeURIComponent($('groom').value.trim() || t('phGroom'));
  const b = encodeURIComponent($('bride').value.trim() || t('phBride'));
  return `?groom=${g}&bride=${b}&lang=${LANG}`;
}

// mode 'screen': выбор ведёт в студию; mode 'step': выбор отмечает шаблон в мастере.
function renderGallery(box, mode) {
  if (!state.config || !box) return;
  box.innerHTML = '';
  const pop = state.config.populars || {};

  sortedTemplates().forEach((tpl, i) => {
    const selected = mode === 'step' && state.templateId === tpl.id;
    const card = h('div', { class: 'g-card' + (selected ? ' selected' : ''), dataset: { id: tpl.id } });
    if (i === 0 && (pop[tpl.id] || 0) > 0) card.appendChild(h('div', { class: 'tpl-ribbon' }, 'TOP'));
    if (selected) card.appendChild(h('div', { class: 'tpl-check' }, '✓'));

    const frame = h('iframe', { loading: 'lazy', src: tpl.demoUrl + liveQuery() });
    card.appendChild(h('div', { class: 'g-frame-wrap' }, frame));

    const pickLabel = mode === 'step' ? t('pick') : t('pick');
    const onPick = () => {
      haptic.tap();
      state.templateId = tpl.id;
      saveDraft();
      if (mode === 'screen') {
        showScreen('studio');
      } else {
        renderGallery(box, 'step');
        updatePhotoTexts();
      }
    };
    card.appendChild(h('div', { class: 'tpl-body' },
      h('div', { class: 'tpl-name-row' },
        h('div', { class: 'tpl-name' }, tpl.name),
        h('div', { class: 'tpl-price' }, money(tpl.price))),
      h('div', { class: 'tpl-meta' }, t('photoBadge', tpl.minPhotos)),
      h('div', { class: 'tpl-btns' },
        h('button', { type: 'button', class: 'btn btn--ghost', onclick: (e) => { e.stopPropagation(); openDemo(tpl, onPick); } }, t('demo')),
        h('button', { type: 'button', class: 'btn btn--gold', onclick: (e) => { e.stopPropagation(); onPick(); } }, pickLabel))));
    if (mode === 'step') card.addEventListener('click', onPick);
    box.appendChild(card);
  });
}

function openDemo(tpl, onPick) {
  sheet.open({
    src: tpl.demoUrl + liveQuery(),
    actionLabel: t('chooseThis'),
    onAction: onPick,
  });
}

/* ════ Мои приглашения ════ */

async function loadMine() {
  const box = $('mine-list');
  box.innerHTML = '';
  box.appendChild(skeletons(3, 'skel--mine'));
  try {
    const res = await fetch('/api/my', { headers: { 'X-Init-Data': tg ? tg.initData : '' } });
    if (res.status === 401) {
      box.innerHTML = '';
      box.appendChild(h('div', { class: 'empty' }, h('span', { class: 'empty-ic' }, '🔒'), t('mineOpenTg')));
      return;
    }
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error();
    box.innerHTML = '';
    if (!data.apps.length) {
      box.appendChild(h('div', { class: 'empty' }, h('span', { class: 'empty-ic' }, '💌'), t('mineEmpty')));
      return;
    }
    for (const a of data.apps) box.appendChild(mineCard(a));
  } catch (_) {
    box.innerHTML = '';
    box.appendChild(h('div', { class: 'empty' }, h('span', { class: 'empty-ic' }, '📡'), t('eNet')));
  }
}

function mineCard(a) {
  const tpl = state.config?.templates.find((x) => x.id === a.templateId);
  const badgeCls = a.status === 'paid' ? 'badge--paid' : a.status === 'cancelled' ? 'badge--cancelled' : 'badge--new';
  const badgeTxt = a.status === 'paid' ? t('stPaid') : a.status === 'cancelled' ? t('stCancelled') : t('stNew');
  const card = h('div', { class: 'mine-card' },
    h('div', { class: 'mine-head' },
      h('div', { class: 'mine-names' }, `${a.groom} & ${a.bride}`),
      h('span', { class: `badge ${badgeCls}` }, badgeTxt)),
    h('div', { class: 'mine-meta' }, `${a.date} · ${a.time}` + (tpl ? ` · ${tpl.name}` : '') + ` · ${money(a.total)}`));
  if (a.url) {
    const copyBtn = h('button', { type: 'button', class: 'btn btn--ghost btn--sm' }, t('copy'));
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(a.url);
        toast(t('copied'), 'ok', 2000);
      } catch (_) { /* буфер недоступен */ }
    });
    card.appendChild(h('div', { class: 'mine-link-row' },
      h('a', { class: 'mine-link', href: a.url, target: '_blank', rel: 'noopener' }, a.url.replace(/^https?:\/\//, '')),
      copyBtn));
  }
  return card;
}

/* ════ Движок мастера ════ */

const WIZARD = [
  { id: 'names', validate: vNames },
  { id: 'datetime', validate: vDate },
  { id: 'location', validate: vVenue, onEnter: ensureMap },
  { id: 'template', validate: vTemplate, onEnter: () => renderGallery($('tpl-grid'), 'step') },
  { id: 'photos', validate: vPhotos, onEnter: () => { updatePhotoTexts(); renderPhotos(); } },
  { id: 'music', validate: () => null },
  { id: 'premium', validate: vPremium },
  { id: 'review', validate: () => null, onEnter: enterReview },
];

function stepSection(i) {
  return document.querySelector(`section.step[data-step="${WIZARD[i].id}"]`);
}

function enterStudio() {
  goStep(state.step, 0, true);
  updateTgBack();
  if (state.draftRestored) {
    state.draftRestored = false;
    toast(t('draftRestored'), 'info', 2600);
  }
}

function updateStudioChrome() {
  const total = WIZARD.length;
  const i = state.step;
  $('step-title').textContent = t('stepTitles')[i];
  $('step-count').textContent = t('stepOf', i + 1, total);
  $('progress-fill').style.width = ((i + 1) / total * 100) + '%';
  $('studio-prev').hidden = i === 0;
  $('studio-next-label').textContent = i === total - 1 ? t('send') : t('next');
  $('studio-eye').hidden = !state.templateId || i === total - 1;
}

function goStep(next, dir, force = false) {
  if (!force && dir > 0) {
    const err = WIZARD[state.step].validate();
    if (err) {
      const sec = stepSection(state.step);
      sec.classList.remove('sec-error');
      void sec.offsetWidth;
      sec.classList.add('sec-error');
      setTimeout(() => sec.classList.remove('sec-error'), 900);
      toast(err, 'err');
      return;
    }
  }
  state.step = Math.max(0, Math.min(next, WIZARD.length - 1));
  WIZARD.forEach((s, i) => {
    const sec = stepSection(i);
    sec.hidden = i !== state.step;
    sec.classList.remove('enter', 'enter-back');
  });
  const sec = stepSection(state.step);
  sec.classList.add(dir < 0 ? 'enter-back' : 'enter');
  updateStudioChrome();
  WIZARD[state.step].onEnter?.();
  saveDraft();
  if (dir !== 0) haptic.impact('light');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Валидация шагов ── */
function vNames() {
  if (!$('groom').value.trim()) return t('eGroom');
  if (!$('bride').value.trim()) return t('eBride');
  return null;
}
function vDate() {
  if (!state.dateIso) return t('eDate');
  if (!$('time').value) return t('eTime');
  return null;
}
function vVenue() {
  if (state.lat === null || state.lng === null) return t('eLoc');
  return null;
}
function vTemplate() {
  if (!state.templateId) return t('eTpl');
  return null;
}
function vPhotos() {
  if (state.photos.some((p) => p.uploading)) return t('eWait');
  const req = requiredPhotos() ?? 1;
  if (state.photos.filter((p) => p.name).length < req) return t('ePhotos', req);
  return null;
}
function vPremium() {
  if ($('premium').checked && (guestNames().length === 0 || guestNames().length > (state.config?.maxGuests ?? 20))) return t('eGuests');
  return null;
}

/* ════ Конфиг ════ */

async function loadConfig() {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error('config');
  state.config = await res.json();
  renderGallery($('gallery'), 'screen');
  renderGallery($('tpl-grid'), 'step');
  renderStrip();
  renderTopTracks();
  updatePhotoTexts();
  renderPhotos();
  $('premium-price').textContent = '(+' + money(state.config.premiumGuestsPrice) + ')';
  $('guests-hint').textContent = t('guestsHint', state.config.maxGuests);
  $('guest-count').textContent = t('guests', guestNames().length);
  startHeroDemo();
  initStats();
}

/* ════ Шаг: календарь и время ════ */

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
  for (const wd of t('wdShort')) grid.appendChild(h('div', { class: 'cal-wd' }, wd));
  const firstIdx = (new Date(y, m, 1).getDay() + 6) % 7;
  for (let i = 0; i < firstIdx; i++) grid.appendChild(document.createElement('div'));

  const daysInMonth = new Date(y, m + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(y, m, day);
    const btn = h('button', { type: 'button', class: 'cal-day' }, String(day));
    if (date < today) btn.disabled = true;
    if (date.getTime() === today.getTime()) btn.classList.add('today');
    if (state.dateIso === isoOf(date)) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      state.dateIso = isoOf(date);
      haptic.tap();
      updateDateLabel();
      renderCalendar();
      saveDraft();
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

const TIME_PRESETS = ['11:00', '12:00', '17:00', '18:00', '19:00', '20:00'];

function renderTimeChips() {
  const box = $('time-chips');
  box.innerHTML = '';
  for (const tt of TIME_PRESETS) {
    const chip = h('button', { type: 'button', class: 'chip' + ($('time').value === tt ? ' active' : '') }, tt);
    chip.addEventListener('click', () => {
      $('time').value = tt;
      haptic.tap();
      renderTimeChips();
      saveDraft();
    });
    box.appendChild(chip);
  }
}

/* ════ Шаг: локация ════ */

const UZ_BOUNDS = [[37.0, 55.9], [45.7, 73.2]];
let ymap = null;
let placemark = null;
let ymapsRequested = false;

// Карту грузим лениво — только когда пользователь дошёл до шага локации.
function ensureMap() {
  if (ymapsRequested) {
    setTimeout(() => ymap?.container.fitToViewport(), 120);
    return;
  }
  ymapsRequested = true;
  const key = state.config?.yandexMapsKey;
  const s = document.createElement('script');
  s.src = 'https://api-maps.yandex.ru/2.1/?lang=ru_RU' + (key ? '&apikey=' + encodeURIComponent(key) : '');
  s.onload = () => ymaps.ready(initMap);
  s.onerror = () => toast(t('eNet'), 'err');
  document.head.appendChild(s);
}

function initMap() {
  ymap = new ymaps.Map('map', {
    center: state.lat !== null ? [state.lat, state.lng] : [41.311, 69.279],
    zoom: state.lat !== null ? 15 : 11,
    controls: ['zoomControl', 'geolocationControl'],
  });
  if (state.lat !== null) setPoint(state.lat, state.lng);
  ymap.events.add('click', (e) => {
    const c = e.get('coords');
    setPoint(c[0], c[1]);
    fillShortAddress(c);
    haptic.tap();
    saveDraft();
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

/* Поиск сразу в нескольких источниках: Google (через сервер) + Яндекс + Photon + Nominatim */
async function googleResults(q) {
  if (!state.config?.googleGeoEnabled) return [];
  const res = await fetch('/api/geo?lang=' + LANG + '&q=' + encodeURIComponent(q));
  if (!res.ok) return [];
  const j = await res.json();
  return j.results || [];
}

async function yandexResults(q) {
  if (!state.config?.yandexMapsKey || !window.ymaps || !ymaps.geocode) return [];
  const r = await ymaps.geocode(q, { boundedBy: UZ_BOUNDS, strictBounds: true, results: 5 });
  const out = [];
  for (let i = 0; i < r.geoObjects.getLength(); i++) {
    const o = r.geoObjects.get(i);
    const c = o.geometry.getCoordinates();
    out.push({ lat: c[0], lng: c[1], name: String(o.properties.get('name') || ''), desc: String(o.properties.get('description') || '') });
  }
  return out.filter((r2) => r2.name);
}

async function photonResults(q) {
  const res = await fetch('https://photon.komoot.io/api/?limit=6&bbox=55.9,37.0,73.2,45.7&q=' + encodeURIComponent(q));
  if (!res.ok) return [];
  const j = await res.json();
  return (j.features || [])
    .filter((f) => f.geometry && Array.isArray(f.geometry.coordinates))
    .filter((f) => !f.properties.countrycode || f.properties.countrycode.toUpperCase() === 'UZ')
    .map((f) => ({
      lat: Number(f.geometry.coordinates[1]),
      lng: Number(f.geometry.coordinates[0]),
      name: String(f.properties.name || f.properties.street || ''),
      desc: [f.properties.city || f.properties.county, f.properties.state].filter(Boolean).join(', '),
    }))
    .filter((r) => r.name);
}

async function nominatimResults(q) {
  const res = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=uz&accept-language=' + LANG + '&q=' + encodeURIComponent(q));
  if (!res.ok) return [];
  const list = await res.json();
  return list
    .map((it) => ({
      lat: Number(it.lat),
      lng: Number(it.lon),
      name: String(it.name || (it.display_name || '').split(',')[0] || ''),
      desc: String(it.display_name || '').split(',').slice(1, 3).join(',').trim(),
    }))
    .filter((r) => r.name);
}

async function geoSearchUz(q) {
  const settled = await Promise.allSettled([googleResults(q), yandexResults(q), photonResults(q), nominatimResults(q)]);
  const all = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []));
  const out = [];
  for (const r of all) {
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) continue;
    const dup = out.some((x) =>
      Math.abs(x.lat - r.lat) < 0.01 && Math.abs(x.lng - r.lng) < 0.01 &&
      x.name.toLowerCase() === r.name.toLowerCase());
    if (!dup) out.push(r);
    if (out.length >= 8) break;
  }
  return out;
}

async function reverseNameUz(lat, lng) {
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
    if (name && !$('address').value.trim()) {
      $('address').value = name.slice(0, 120);
      saveDraft();
    }
  });
}

function hideGeoResults() {
  const el = $('geo-results');
  el.hidden = true;
  el.innerHTML = '';
}

function showGeoResults(list) {
  const el = $('geo-results');
  el.innerHTML = '';
  for (const r of list) {
    const row = h('button', { type: 'button', class: 'geo-row' },
      h('b', {}, r.name),
      h('span', {}, r.desc || `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`));
    row.addEventListener('click', () => applyGeoResult(r));
    el.appendChild(row);
  }
  el.hidden = list.length === 0;
}

function previewGeoResult(r) {
  if (ymap) ymap.setCenter([r.lat, r.lng], 16, { duration: 300 });
  setPoint(r.lat, r.lng);
}

function applyGeoResult(r) {
  hideGeoResults();
  haptic.tap();
  previewGeoResult(r);
  if (r.name) $('address').value = r.name.slice(0, 120);
  $('geo-search').value = r.name;
  saveDraft();
}

let geoBusy = false;
let geoTimer = null;
let geoSeq = 0;

async function searchPlace() {
  const q = $('geo-search').value.trim();
  if (q.length < 2 || geoBusy) return;
  clearTimeout(geoTimer);
  geoSeq++;
  geoBusy = true;
  const btn = $('geo-search-btn');
  btn.disabled = true;
  try {
    const found = await geoSearchUz(q);
    if (!found.length) {
      hideGeoResults();
      toast(t('eGeo'), 'err');
      return;
    }
    if (found.length === 1) {
      applyGeoResult(found[0]);
    } else {
      showGeoResults(found);
      previewGeoResult(found[0]);
    }
  } catch (_) {
    toast(t('eNet'), 'err');
  } finally {
    geoBusy = false;
    btn.disabled = false;
  }
}

/* ════ Шаг: фотографии ════ */

function selectedTemplate() {
  return state.config?.templates.find((x) => x.id === state.templateId) ?? null;
}

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
    const tile = h('div', { class: 'photo-tile' }, h('img', { src: item.previewUrl, alt: '' }));
    if (item.uploading) {
      tile.appendChild(h('div', { class: 'ph-loading' }, '⏳'));
    } else {
      const rm = h('button', { type: 'button', class: 'ph-remove' }, '✕');
      rm.addEventListener('click', () => {
        state.photos = state.photos.filter((p) => p !== item);
        haptic.tap();
        renderPhotos();
        saveDraft();
      });
      tile.appendChild(rm);
    }
    grid.appendChild(tile);
  }
  if (state.photos.length < max) {
    const add = h('button', { type: 'button', class: 'photo-add' }, h('span', {}, '+'), t('add'));
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

/* ════ Шаг: музыка ════ */

const YT_RE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/;
const SOCIAL_RE = /(instagram\.com|tiktok\.com)/i;

let previewAudio = new Audio();
let musicLoaded = false;

function trackRow(track, extra) {
  const row = h('div', { class: 'track-row' });
  if (track.art) row.appendChild(h('img', { src: track.art, alt: '' }));
  const info = h('div', { class: 'track-info' }, h('b', {}, track.name), h('span', {}, track.artist || ''));
  if (extra) info.appendChild(h('div', { class: 'track-fire' }, extra));
  const play = h('button', { type: 'button' }, '▶');
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
  const pick = h('button', { type: 'button', class: 'pick' }, '✓');
  pick.addEventListener('click', () => {
    previewAudio.pause();
    haptic.tap();
    state.music = {
      type: 'itunes',
      value: { name: track.name, artist: track.artist, url: track.url },
      name: track.name + (track.artist ? ' — ' + track.artist : ''),
      previewUrl: track.url,
      start: null,
      end: null,
    };
    $('music-catalog').hidden = true;
    updateSelectedMusic();
    saveDraft();
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
  box.innerHTML = '';
  box.appendChild(skeletons(5, 'skel--row'));
  try {
    const res = await fetch('/api/music?q=' + encodeURIComponent(q));
    const data = await res.json();
    box.innerHTML = '';
    if (!data.tracks.length) {
      box.appendChild(h('div', { class: 'empty' }, h('span', { class: 'empty-ic' }, '🎧'), t('empty')));
      return;
    }
    for (const tr of data.tracks) box.appendChild(trackRow(tr));
  } catch (_) {
    box.innerHTML = '';
    box.appendChild(h('div', { class: 'empty' }, h('span', { class: 'empty-ic' }, '📡'), t('eNet')));
  }
}

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

/* Волновой тример */
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

  audio.onloadedmetadata = () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      trim.dur = audio.duration;
      drawTrim();
    }
  };

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
    const hh = Math.max(3, peaks[i] * (H - 18));
    ctx.fillStyle = inside ? '#8ea6ff' : 'rgba(142,166,255,.26)';
    ctx.beginPath();
    ctx.roundRect(i * bw + 1, (H - hh) / 2, Math.max(2, bw - 2), hh, 2);
    ctx.fill();
  }

  const lx = trim.startFrac * W;
  const rx = trim.endFrac * W;
  $('trim-sel').style.left = lx + 'px';
  $('trim-sel').style.width = Math.max(0, rx - lx) + 'px';
  $('trim-l').style.left = Math.max(0, lx - 9) + 'px';
  $('trim-r').style.left = Math.min(W - 18, rx - 9) + 'px';

  const s = trim.startFrac * trim.dur;
  const e = trim.endFrac * trim.dur;
  $('trim-lbl').textContent = fmtTime(s) + ' — ' + fmtTime(e);
  state.music.start = trim.startFrac <= 0.001 ? null : Math.round(s);
  state.music.end = trim.endFrac >= 0.999 ? null : Math.round(e);
}

function trimPointer(e) {
  const rect = $('trim-box').getBoundingClientRect();
  return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
}

function onTrimMove(e) {
  const f = trimPointer(e);
  if (trim.drag === 'trim-l') trim.startFrac = Math.min(f, trim.endFrac - 0.03);
  else trim.endFrac = Math.max(f, trim.startFrac + 0.03);
  drawTrim();
}

function onTrimUp() {
  trim.drag = null;
  document.removeEventListener('pointermove', onTrimMove);
  saveDraft();
}

/* ════ Шаг: премиум ════ */

function guestNames() {
  return $('guests').value.split('\n').map((s) => s.trim()).filter(Boolean);
}

/* ════ Шаг: обзор и отправка ════ */

let lastPreviewHtml = '';

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

function renderReceipt() {
  const tpl = selectedTemplate();
  if (!tpl) return;
  const box = $('rv-lines');
  box.innerHTML = '';
  const line = (k, v) => box.appendChild(h('div', { class: 'rc-line' }, h('span', {}, k), h('span', {}, v)));
  line(t('rcCouple'), `${$('groom').value.trim()} & ${$('bride').value.trim()}`);
  const [y, m, d] = (state.dateIso || '--').split('-').map(Number);
  line(t('rcDate'), state.dateIso ? `${d} ${t('monthsGen')[m - 1]} ${y} · ${$('time').value}` : '—');
  if ($('address').value.trim()) line(t('rcVenue'), $('address').value.trim());
  if (state.music.type !== 'none') line(t('rcMusic'), state.music.name.slice(0, 34));
  line(t('rcTpl'), `${tpl.name} · ${money(tpl.price)}`);
  let total = tpl.price;
  if ($('premium').checked) {
    total += state.config.premiumGuestsPrice;
    line(t('rcPremium'), `${t('guests', guestNames().length)} · +${money(state.config.premiumGuestsPrice)}`);
  }
  $('rv-total').textContent = money(total);
}

async function enterReview() {
  renderReceipt();
  const frame = $('rv-frame');
  frame.removeAttribute('srcdoc');
  try {
    const res = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg ? tg.initData : '', form: collectForm() }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      if (data.step) jumpToStepId(data.step, data.error);
      else toast(data.error || t('eNet'), 'err');
      return;
    }
    lastPreviewHtml = data.html;
    frame.srcdoc = data.html;
  } catch (_) {
    toast(t('eNet'), 'err');
  }
}

function jumpToStepId(id, msg) {
  const idx = WIZARD.findIndex((s) => s.id === id);
  if (idx >= 0) goStep(idx, -1, true);
  if (msg) toast(msg, 'err');
}

async function submitApplication() {
  const phone = $('phone').value.trim();
  if (!/^\+?[\d\s()-]{7,20}$/.test(phone)) {
    $('phone').classList.add('err');
    setTimeout(() => $('phone').classList.remove('err'), 1500);
    toast(t('ePhone'), 'err');
    $('phone').focus();
    return;
  }
  const btn = $('studio-next');
  btn.disabled = true;
  $('studio-next-label').textContent = t('sending');
  try {
    const res = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg ? tg.initData : '', form: collectForm() }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      if (data.step && data.step !== 'confirm') jumpToStepId(data.step, data.error);
      else toast(data.error || t('eNet'), 'err');
      return;
    }
    clearDraft();
    haptic.ok();
    petals($('petals'));
    $('success-screen').hidden = false;
    try { tg?.BackButton?.hide(); } catch (_) { /* — */ }
  } catch (_) {
    toast(t('eNet'), 'err');
  } finally {
    btn.disabled = false;
    $('studio-next-label').textContent = state.step === WIZARD.length - 1 ? t('send') : t('next');
  }
}

/* ════ Привязка событий ════ */

function wireEvents() {
  /* навигация */
  $('nav-brand').addEventListener('click', () => showScreen('home'));
  $('nav-tpl').addEventListener('click', () => showScreen('templates'));
  $('nav-mine').addEventListener('click', () => showScreen('mine'));
  $('hero-cta').addEventListener('click', () => { haptic.impact('medium'); showScreen('templates'); });
  $('home-cta2').addEventListener('click', () => { haptic.impact('medium'); showScreen('templates'); });
  $('mine-create').addEventListener('click', () => showScreen('templates'));
  $('hsw-uz').addEventListener('click', () => setLang('uz'));
  $('hsw-ru').addEventListener('click', () => setLang('ru'));

  /* студия */
  $('studio-exit').addEventListener('click', () => { toast(t('draftSaved'), 'info', 1600); showScreen('home'); });
  $('studio-prev').addEventListener('click', () => goStep(state.step - 1, -1));
  $('studio-next').addEventListener('click', () => {
    if (state.step === WIZARD.length - 1) submitApplication();
    else goStep(state.step + 1, 1);
  });
  $('studio-eye').addEventListener('click', () => {
    const tpl = selectedTemplate();
    if (tpl) sheet.open({ src: tpl.demoUrl + liveQuery() });
  });
  $('rv-expand').addEventListener('click', () => {
    if (lastPreviewHtml) sheet.open({ srcdoc: lastPreviewHtml });
  });
  $('sheet-close').addEventListener('click', () => sheet.close());
  $('succ-mine').addEventListener('click', () => {
    $('success-screen').hidden = true;
    resetWizard();
    showScreen('mine');
  });

  /* имена: живое демо в карточках */
  const refreshFrames = debounce(() => {
    document.querySelectorAll('.g-frame-wrap iframe').forEach((f) => {
      const base = f.src.split('?')[0];
      f.src = base + liveQuery();
    });
  }, 900);
  ['groom', 'bride'].forEach((id) => {
    $(id).addEventListener('input', () => { saveDraft(); refreshFrames(); });
  });
  $('address').addEventListener('input', saveDraft);
  $('phone').addEventListener('input', saveDraft);

  /* календарь и время */
  $('cal-prev').addEventListener('click', () => {
    calView = new Date(calView.getFullYear(), calView.getMonth() - 1, 1);
    renderCalendar();
  });
  $('cal-next').addEventListener('click', () => {
    calView = new Date(calView.getFullYear(), calView.getMonth() + 1, 1);
    renderCalendar();
  });
  $('time').addEventListener('input', () => { renderTimeChips(); saveDraft(); });

  /* локация */
  $('geo-search-btn').addEventListener('click', searchPlace);
  $('geo-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchPlace();
    }
  });
  $('geo-search').addEventListener('input', () => {
    clearTimeout(geoTimer);
    const q = $('geo-search').value.trim();
    if (q.length < 3) {
      hideGeoResults();
      return;
    }
    geoTimer = setTimeout(async () => {
      const seq = ++geoSeq;
      try {
        const found = await geoSearchUz(q);
        if (seq !== geoSeq) return;
        showGeoResults(found);
        if (found.length) previewGeoResult(found[0]);
      } catch (_) { /* подсказки не критичны */ }
    }, 350);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-row') && !e.target.closest('#geo-results')) hideGeoResults();
  });

  /* фотографии */
  $('photo-input').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const max = state.config ? state.config.maxPhotos : 6;
    for (const file of files) {
      if (state.photos.length >= max) break;
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { toast(t('eFile'), 'err'); continue; }
      if (file.size > 8 * 1024 * 1024) { toast(t('eBig'), 'err'); continue; }
      const item = { name: null, previewUrl: URL.createObjectURL(file), uploading: true };
      state.photos.push(item);
      renderPhotos();
      try {
        const data = await uploadFile(file);
        item.name = data.file;
      } catch (err) {
        state.photos = state.photos.filter((p) => p !== item);
        toast(err.message, 'err');
      }
      item.uploading = false;
      renderPhotos();
      saveDraft();
    }
  });

  /* музыка: табы */
  document.querySelectorAll('#music-tabs .chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#music-tabs .chip').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      haptic.tap();
      const mt = btn.dataset.mt;
      $('music-catalog').hidden = mt !== 'catalog';
      $('music-own').hidden = mt !== 'own';
      previewAudio.pause();
      if (mt === 'none') {
        state.music = { type: 'none', value: null, name: '', previewUrl: null, start: null, end: null };
        updateSelectedMusic();
        saveDraft();
      }
      if (mt === 'catalog' && !musicLoaded) {
        musicLoaded = true;
        loadTracks('');
      }
    });
  });

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
    saveDraft();
    if (wasItunes) $('music-catalog').hidden = false;
    else $('music-own').hidden = false;
  });

  /* своя музыка */
  $('music-link').addEventListener('change', async () => {
    const url = $('music-link').value.trim();
    if (!url) return;
    if (!/^https?:\/\/\S+$/.test(url)) {
      toast(t('eMusic'), 'err');
      return;
    }
    const yt = url.match(YT_RE);
    const social = SOCIAL_RE.test(url);

    if ((yt || social) && state.config.extractEnabled) {
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
        saveDraft();
        return;
      } catch (_) {
        if (!yt) {
          toast(t('extractUnavail'), 'err');
          return;
        }
      } finally {
        linkEl.disabled = false;
        linkEl.value = old;
      }
    }

    if (yt) {
      state.music = { type: 'youtube', value: url, name: 'YouTube · ' + yt[1], previewUrl: null, start: null, end: null };
      $('music-own').hidden = true;
      updateSelectedMusic();
      saveDraft();
      return;
    }
    if (social) {
      toast(t('extractUnavail'), 'err');
      return;
    }
    const playable = /\.(mp3|ogg|m4a|wav)(\?|$)/i.test(url);
    state.music = { type: 'custom', value: url, name: url.slice(0, 60), previewUrl: playable ? url : null, start: null, end: null };
    $('music-own').hidden = true;
    updateSelectedMusic();
    saveDraft();
  });

  $('music-upload-btn').addEventListener('click', () => $('music-file').click());
  $('music-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) { toast(t('eBig'), 'err'); return; }
    const btn = $('music-upload-btn');
    btn.disabled = true;
    btn.textContent = t('uploading');
    try {
      const data = await uploadFile(file);
      if (data.kind !== 'audio') throw new Error(t('eFile'));
      state.music = { type: 'upload', value: data.file, name: file.name, previewUrl: '/uploads/' + data.file, start: null, end: null };
      $('music-own').hidden = true;
      updateSelectedMusic();
      saveDraft();
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = t('upload');
    }
  });

  /* тример */
  ['trim-l', 'trim-r'].forEach((id) => {
    $(id).addEventListener('pointerdown', (e) => {
      e.preventDefault();
      trim.drag = id;
      document.addEventListener('pointermove', onTrimMove);
      document.addEventListener('pointerup', onTrimUp, { once: true });
    });
  });
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
  $('cut-start').addEventListener('input', () => {
    const v = parseInt($('cut-start').value, 10);
    state.music.start = Number.isFinite(v) && v >= 0 ? v : null;
    saveDraft();
  });
  $('cut-end').addEventListener('input', () => {
    const v = parseInt($('cut-end').value, 10);
    state.music.end = Number.isFinite(v) && v > 0 ? v : null;
    saveDraft();
  });

  /* премиум */
  $('premium').addEventListener('change', () => {
    $('guests-block').hidden = !$('premium').checked;
    haptic.tap();
    saveDraft();
  });
  $('guests').addEventListener('input', () => {
    $('guest-count').textContent = t('guests', guestNames().length);
    saveDraft();
  });
}

/* Чистый лист после отправленной заявки */
function resetWizard() {
  state.step = 0;
  state.dateIso = null;
  state.lat = null;
  state.lng = null;
  state.templateId = null;
  state.photos = [];
  state.music = { type: 'none', value: null, name: '', previewUrl: null, start: null, end: null };
  for (const id of ['groom', 'bride', 'address', 'geo-search', 'guests', 'phone', 'music-link']) $(id).value = '';
  $('time').value = '18:00';
  $('premium').checked = false;
  $('guests-block').hidden = true;
  if (placemark && ymap) { ymap.geoObjects.remove(placemark); placemark = null; }
  updateSelectedMusic();
  renderPhotos();
  renderCalendar();
  updateDateLabel();
  updateStudioChrome();
}

/* ════ Старт ════ */

function initLangScreen() {
  const boot = () => {
    $('app').hidden = false;
    applyI18n();
    revealOnScroll('.rv');
    showScreen('home');
  };
  if (LANG) {
    $('lang-screen').remove();
    boot();
    return;
  }
  LANG = 'uz';
  const pick = (lang) => {
    setLang(lang);
    haptic.impact('medium');
    $('lang-screen').classList.add('hide');
    setTimeout(() => $('lang-screen').remove(), 500);
    boot();
  };
  $('lang-uz').addEventListener('click', () => pick('uz'));
  $('lang-ru').addEventListener('click', () => pick('ru'));
}

wireEvents();
restoreDraft();
initAurora();
initTilt();
initLangScreen();
$('gallery').appendChild(skeletons(3, 'skel--card'));
loadConfig().catch(() => toast(t('eNet'), 'err'));
