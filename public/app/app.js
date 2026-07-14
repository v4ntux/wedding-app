/* global ymaps, UI */
/* nvate WebApp — задачный флоу без повторов:
   Язык → Шаблон (выбор один раз) → 7 шагов → Отправка.
   Разделы: состояние и черновик · i18n · роутер · галерея · мои приглашения ·
   мастер · шаги (календарь, карта, фото, музыка, гости, обзор) · отправка · старт. */
'use strict';

const { $, h, debounce, toast, sheet, skeletons, revealOnScroll, petals, haptic, tg } = UI;

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
  guests: [],                  // имена гостей, по 8 000 за каждого
  revealed: 0,                 // индекс последнего раскрытого блока
  draftRestored: false,
};

const DRAFT_KEY = 'tk_draft_v2';
const SENT_KEY = 'tk_sent_v1';

// Автосохранение: Telegram закрывает WebView без предупреждения — черновик обязателен.
const saveDraft = debounce(() => {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      v: 2,
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
      guests: state.guests,
      contactTg: $('contact-tg').value,
      phone: $('phone').value,
      phone2: $('phone2').value,
      revealed: state.revealed,
    }));
  } catch (_) { /* переполненное хранилище не критично */ }
}, 400);

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch (_) { /* — */ }
}

function restoreDraft() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (_) { return false; }
  if (!d || d.v !== 2) return false;
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
  state.guests = Array.isArray(d.guests) ? d.guests.map((g) => String(g)).slice(0, 100) : [];
  $('contact-tg').value = d.contactTg || '';
  $('phone').value = d.phone || '';
  $('phone2').value = d.phone2 || '';
  state.revealed = Math.min(Number(d.revealed ?? d.step) || 0, WIZARD.length - 1);
  state.draftRestored = true;
  return true;
}

function sentMap() {
  try { return JSON.parse(localStorage.getItem(SENT_KEY) || '{}'); } catch (_) { return {}; }
}
function markSent(url) {
  try {
    const m = sentMap();
    m[url] = 1;
    localStorage.setItem(SENT_KEY, JSON.stringify(m));
  } catch (_) { /* — */ }
}

/* ════ Словари ════ */

const I18N = {
  uz: {
    navTpl: 'Shablonlar', navMine: 'Taklifnomalarim',
    tplTitle: 'Shablonni tanlang',
    tplSub: '«Demo» — jonli namuna, «Tanlash» — shu dizayn bilan boshlash.',
    demo: 'Demo', pick: 'Tanlash', picked: '✓ Tanlangan', chooseThis: 'Shu shablonni tanlash',
    photoBadge: (n) => `📷 ${n}+ surat`,
    mineTitle: 'Mening taklifnomalarim',
    mineEmpty: 'Hozircha taklifnomalar yo‘q — birinchisini yarating!',
    mineOpenTg: 'Ro‘yxatni ko‘rish uchun formani Telegram-bot orqali oching.',
    stNew: '⏳ Tasdiqlash kutilmoqda', stPaid: '✅ Tayyor', stCancelled: '✖ Bekor qilingan',
    open: 'Ochish', copy: 'Nusxa', copied: 'Havola nusxalandi', share: 'Yuborish', sent: '✓ Yuborildi',
    createNew: '+ Yangi taklifnoma',
    rcTplLine: 'Shablon', rcGuestsLine: 'Nomli havolalar',
    stepTitles: ['Kelin-kuyov', 'Sana va vaqt', 'Manzil', 'Suratlar', 'Musiqa', 'Mehmonlar', 'Yakuniy ko‘rik'],
    tNames: 'Kelin-kuyov', tDate: 'Sana va vaqt', tVenue: 'Manzil', tPhotos: 'Suratlar', tMusic: 'Musiqa', tGuests: 'Mehmonlar', tReview: 'Yakuniy ko‘rik',
    stepOf: (a, b) => `${a} / ${b}-qadam`,
    next: 'Davom etish', back: 'Ortga', send: 'Ariza yuborish', sending: 'Yuborilmoqda...',
    leadNames: 'Ismlaringiz taklifnomaning yuragida turadi.',
    hintNames: 'Ismlar taklifnomada yozilganidek ko‘rinadi — xohlagancha yozing.',
    groom: 'Kuyov ismi', bride: 'Kelin ismi', phGroom: 'Ali', phBride: 'Zebo',
    leadDate: 'To‘y qachon? Mehmonlar sanani va to‘ygacha sanoqni ko‘radi.',
    pickDate: 'Taqvimda sanani tanlang', time: 'Vaqt',
    leadVenue: 'Joyni qidiring yoki xaritaga bosing — mehmonlar jonli xaritani oladi.',
    searchPh: 'Masalan: Navro‘z to‘yxonasi', find: 'Qidirish',
    address: 'Joy nomi (qisqa)', phAddress: 'Masalan: Navro‘z to‘yxonasi',
    noPin: '📍 Belgi qo‘yilmagan',
    photoReq: (n) => `Kamida ${n} ta surat kerak. JPG, PNG yoki WebP.`,
    add: 'Qo‘shish', photoOf: (a, b) => `${a} ta yuklandi (kamida ${b} ta kerak)`,
    leadMusic: 'Taklifnoma ochilganda yangraydigan musiqa (ixtiyoriy).',
    mtNone: 'Musiqasiz', mtCatalog: '🔥 Top musiqalar', mtOwn: 'O‘z musiqam',
    musicQPh: 'Qo‘shiq yoki ijrochi...', uses: 'marta tanlangan', empty: 'Hech narsa topilmadi',
    ownHint: 'Havola qo‘ying (YouTube / Instagram / TikTok) yoki fayl yuklang (MP3/M4A, 16 MB gacha)',
    upload: 'Fayl yuklash', or: 'yoki', uploading: 'Yuklanmoqda...', extracting: 'Audio ajratilmoqda...',
    extractUnavail: 'Bu havoladan audio olish hozircha ishlamaydi — fayl yuklang yoki YouTube havolasini qo‘ying',
    cutTitle: 'Musiqani kesish — oltin dastaklarni suring (ixtiyoriy)',
    cutStart: 'Boshlanishi (soniya)', cutEnd: 'Tugashi (soniya)', listen: '▶ Tinglash', change: 'O‘zgartirish',
    leadGuests: 'Har bir mehmonga nomli havola: sahifada «Hurmatli Aziz aka…» deb yoziladi (ixtiyoriy).',
    guestAdd: '+ Mehmon qo‘shish', guestPh: 'Masalan: Aziz aka',
    guestsTotalLbl: 'Nomli havolalar:',
    guestEach: (p) => `har biri ${p}`,
    guestsHint: 'Istalgancha mehmon qo‘shing — har bir nomli havola 8 000 so‘m. Bo‘sh qatorlar hisobga olinmaydi.',
    leadReview: 'Hammasi tayyor — taklifnomani ko‘rib chiqing va yuboring.',
    total: 'Jami:', fullPreview: 'To‘liq ko‘rish',
    rcCouple: 'Kelin-kuyov', rcDate: 'Sana', rcVenue: 'Manzil', rcMusic: 'Musiqa',
    changeTpl: 'O‘zgartirish',
    tgLabel: 'Telegram username', phoneLabel: 'Telefon raqam', phone2Label: 'Qo‘shimcha: username yoki raqam',
    contactRule: 'Yuborish uchun shulardan kamida 2 tasini to‘ldiring.',
    eContacts: 'Kamida 2 ta aloqa maydonini to‘ldiring',
    confirmNote: '📩 Administrator tez orada bog‘lanadi (Telegram yoki telefon). To‘lovdan so‘ng havolani olasiz.',
    okTitle: 'Ariza yuborildi!',
    okText: 'Administrator to‘lovni tasdiqlash uchun bog‘lanadi. So‘ng taklifnoma havolasini olasiz.',
    close: '✕ Yopish', sum: 'so‘m',
    draftRestored: 'Qoralamangiz tiklandi — davom eting ✨',
    draftSaved: 'Qoralama saqlandi',
    eGroom: 'Kuyov ismini kiriting', eBride: 'Kelin ismini kiriting',
    eDate: 'Taqvimda sanani tanlang', eTime: 'Vaqtni kiriting',
    eLoc: 'Xaritada joyni belgilang', eWait: 'Suratlar yuklanishini kuting',
    ePhotos: (n) => `Kamida ${n} ta surat yuklang`, eTpl: 'Avval shablonni tanlang',
    eTg: 'Telegram username kiriting (masalan: @aziz_uz)',
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
    tplTitle: 'Выберите шаблон',
    tplSub: '«Демо» — живой пример, «Выбрать» — начать с этим дизайном.',
    demo: 'Демо', pick: 'Выбрать', picked: '✓ Выбран', chooseThis: 'Выбрать этот шаблон',
    photoBadge: (n) => `📷 ${n}+ фото`,
    mineTitle: 'Мои приглашения',
    mineEmpty: 'Пока нет приглашений — создайте первое!',
    mineOpenTg: 'Чтобы увидеть список, откройте форму через Telegram-бота.',
    stNew: '⏳ Ожидает подтверждения', stPaid: '✅ Готово', stCancelled: '✖ Отклонено',
    open: 'Открыть', copy: 'Копия', copied: 'Ссылка скопирована', share: 'Отправить', sent: '✓ Отправлено',
    createNew: '+ Новое приглашение',
    rcTplLine: 'Шаблон', rcGuestsLine: 'Именные ссылки',
    stepTitles: ['Пара', 'Дата и время', 'Локация', 'Фотографии', 'Музыка', 'Гости', 'Финальный обзор'],
    tNames: 'Пара', tDate: 'Дата и время', tVenue: 'Локация', tPhotos: 'Фотографии', tMusic: 'Музыка', tGuests: 'Гости', tReview: 'Финальный обзор',
    stepOf: (a, b) => `Шаг ${a} из ${b}`,
    next: 'Продолжить', back: 'Назад', send: 'Отправить заявку', sending: 'Отправляем...',
    leadNames: 'Ваши имена — сердце приглашения.',
    hintNames: 'Имена появятся в приглашении ровно так, как вы их напишете.',
    groom: 'Имя жениха', bride: 'Имя невесты', phGroom: 'Али', phBride: 'Зебо',
    leadDate: 'Когда свадьба? Гости увидят дату и живой отсчёт.',
    pickDate: 'Выберите дату в календаре', time: 'Время',
    leadVenue: 'Найдите место или коснитесь карты — гости получат живую карту.',
    searchPh: 'Например: тойхона Versal', find: 'Найти',
    address: 'Название места (коротко)', phAddress: 'Например: тойхона Versal',
    noPin: '📍 Метка не поставлена',
    photoReq: (n) => `Нужно минимум ${n} фото. JPG, PNG или WebP.`,
    add: 'Добавить', photoOf: (a, b) => `Загружено ${a} (нужно минимум ${b})`,
    leadMusic: 'Музыка, которая заиграет при открытии приглашения (необязательно).',
    mtNone: 'Без музыки', mtCatalog: '🔥 Топ музыка', mtOwn: 'Своя музыка',
    musicQPh: 'Песня или исполнитель...', uses: 'раз выбрали', empty: 'Ничего не найдено',
    ownHint: 'Вставьте ссылку (YouTube / Instagram / TikTok) или загрузите файл (MP3/M4A, до 16 МБ)',
    upload: 'Загрузить файл', or: 'или', uploading: 'Загрузка...', extracting: 'Извлекаем аудио...',
    extractUnavail: 'Извлечь аудио из этой ссылки пока нельзя — загрузите файл или дайте ссылку YouTube',
    cutTitle: 'Обрезка музыки — двигайте золотые ручки (необязательно)',
    cutStart: 'Начало (сек)', cutEnd: 'Конец (сек)', listen: '▶ Прослушать', change: 'Изменить',
    leadGuests: 'Каждому гостю — именная ссылка: на странице будет «Hurmatli Aziz aka…» (необязательно).',
    guestAdd: '+ Добавить гостя', guestPh: 'Например: Азиз ака',
    guestsTotalLbl: 'Именные ссылки:',
    guestEach: (p) => `по ${p} за каждого`,
    guestsHint: 'Добавляйте сколько угодно гостей — каждая именная ссылка 8 000 сум. Пустые строки не считаются.',
    leadReview: 'Всё готово — посмотрите приглашение и отправьте заявку.',
    total: 'Итого:', fullPreview: 'На весь экран',
    rcCouple: 'Пара', rcDate: 'Дата', rcVenue: 'Локация', rcMusic: 'Музыка',
    changeTpl: 'Изменить',
    tgLabel: 'Telegram username', phoneLabel: 'Номер телефона', phone2Label: 'Доп.: username или номер',
    contactRule: 'Для отправки заполните минимум 2 из них.',
    eContacts: 'Заполните минимум 2 поля контактов',
    confirmNote: '📩 Администратор скоро свяжется (Telegram или телефон). После оплаты вы получите ссылку.',
    okTitle: 'Заявка отправлена!',
    okText: 'Администратор свяжется для подтверждения оплаты. Затем вы получите ссылку.',
    close: '✕ Закрыть', sum: 'сум',
    draftRestored: 'Черновик восстановлен — продолжайте ✨',
    draftSaved: 'Черновик сохранён',
    eGroom: 'Укажите имя жениха', eBride: 'Укажите имя невесты',
    eDate: 'Выберите дату в календаре', eTime: 'Укажите время',
    eLoc: 'Отметьте локацию на карте', eWait: 'Дождитесь загрузки фотографий',
    ePhotos: (n) => `Загрузите минимум ${n} фото`, eTpl: 'Сначала выберите шаблон',
    eTg: 'Укажите Telegram username (например: @aziz_uz)',
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
  $('contact-rule').textContent = t('contactRule');
  for (const [id, on] of [['hsw-uz', LANG === 'uz'], ['hsw-ru', LANG === 'ru']]) $(id).classList.toggle('active', on);
  updateDateLabel();
  renderCalendar();
  renderTimeChips();
  updateProgress();
  if (state.config) {
    renderGallery();
    updatePhotoTexts();
    renderPhotos();
    renderGuests();
    updateSelectedMusic();
    if (currentScreen === 'mine') loadMine();
    if (state.revealed === WIZARD.length - 1 && currentScreen === 'studio') renderReceipt();
  }
}

function setLang(lang) {
  LANG = lang;
  localStorage.setItem('tk_lang', lang);
  applyI18n();
}

/* ════ Роутер экранов ════ */

let currentScreen = 'templates';
const SCREENS = ['templates', 'mine', 'studio'];

function showScreen(name) {
  currentScreen = name;
  for (const s of SCREENS) $('screen-' + s).hidden = s !== name;
  document.querySelector('.topnav').hidden = name === 'studio';
  $('nav-tpl').classList.toggle('active', name === 'templates');
  $('nav-mine').classList.toggle('active', name === 'mine');
  if (name === 'templates') renderGallery();
  if (name === 'mine') loadMine();
  if (name === 'studio') enterStudio();
  else updateTgBack();
  window.scrollTo({ top: 0 });
}

/* Кнопка «назад» Telegram: внутри мастера листает шаги */
function updateTgBack() {
  try {
    if (!tg?.BackButton) return;
    if (currentScreen === 'studio') tg.BackButton.show();
    else tg.BackButton.hide();
  } catch (_) { /* вне Telegram */ }
}
try {
  tg?.BackButton?.onClick(() => {
    if (currentScreen !== 'studio') return;
    showScreen('templates');
  });
} catch (_) { /* — */ }

/* ════ Галерея шаблонов: материальные карточки, выбор один раз ════ */

function liveQuery() {
  const g = encodeURIComponent($('groom').value.trim() || t('phGroom'));
  const b = encodeURIComponent($('bride').value.trim() || t('phBride'));
  return `?groom=${g}&bride=${b}&lang=${LANG}`;
}

function sortedTemplates() {
  const pop = state.config.populars || {};
  return [...state.config.templates].sort((a, b) => (pop[b.id] || 0) - (pop[a.id] || 0));
}

function renderGallery() {
  const box = $('gallery');
  if (!state.config || !box) return;
  box.innerHTML = '';
  const pop = state.config.populars || {};

  sortedTemplates().forEach((tpl, i) => {
    const selected = state.templateId === tpl.id;
    const [c0, c1, c2] = tpl.colors.length ? tpl.colors : ['#F4EFF7', '#755C97', '#C6AD7C'];
    const card = h('div', { class: 'g-card' + (selected ? ' selected' : '') });
    if (i === 0 && (pop[tpl.id] || 0) > 0) card.appendChild(h('div', { class: 'tpl-ribbon' }, 'TOP'));
    if (selected) card.appendChild(h('div', { class: 'tpl-check' }, '✓'));

    // Материальная превью-карточка: цвет шаблона × фактура бумаги
    card.appendChild(h('div', { class: 'tpl-prev', style: `background-color:${c0}` },
      h('span', { class: 'tp-eyebrow', style: `color:${c2}` }, 'Taklifnoma'),
      h('span', { class: 'tp-names', style: `color:${c1}` },
        t('phGroom'), h('i', { style: `color:${c2}` }, ' & '), t('phBride')),
      h('span', { class: 'tp-rule', style: `background:${c2}` }),
      h('span', { class: 'tp-date', style: `color:${c2}` }, '19 · 09 · 2026')));

    const onPick = () => {
      haptic.tap();
      state.templateId = tpl.id;
      saveDraft();
      renderGallery();
      updatePhotoTexts();
      showScreen('studio');
    };
    card.appendChild(h('div', { class: 'tpl-body' },
      h('div', { class: 'tpl-name-row' },
        h('div', { class: 'tpl-name' }, tpl.name),
        h('div', { class: 'tpl-price' }, money(tpl.price))),
      h('div', { class: 'tpl-meta' }, t('photoBadge', tpl.minPhotos)),
      h('div', { class: 'tpl-btns' },
        h('button', {
          type: 'button', class: 'btn btn--ghost',
          onclick: (e) => { e.stopPropagation(); openDemo(tpl, onPick); },
        }, t('demo')),
        h('button', {
          type: 'button', class: 'btn btn--gold',
          onclick: (e) => { e.stopPropagation(); onPick(); },
        }, selected ? t('picked') : t('pick')))));
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

function selectedTemplate() {
  return state.config?.templates.find((x) => x.id === state.templateId) ?? null;
}

/* ════ Мои приглашения: дата, ссылка, цена, именные ссылки с отправкой ════ */

function shareUrl(url, text) {
  const link = 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text || '');
  try {
    if (tg?.openTelegramLink) { tg.openTelegramLink(link); return; }
  } catch (_) { /* вне Telegram */ }
  window.open(link, '_blank', 'noopener');
}

function linkRow(url, label, appTitle) {
  const sent = Boolean(sentMap()[url]);
  const row = h('div', { class: 'link-row' + (sent ? ' sent' : '') });
  row.appendChild(h('div', { class: 'link-info' },
    h('b', {}, label),
    h('a', { href: url, target: '_blank', rel: 'noopener', class: 'link-url' }, url.replace(/^https?:\/\//, ''))));
  const copyBtn = h('button', { type: 'button', class: 'btn btn--ghost-dark btn--sm' }, t('copy'));
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast(t('copied'), 'ok', 1800);
      markSent(url);
      row.classList.add('sent');
      shareBtn.textContent = t('sent');
    } catch (_) { /* буфер недоступен */ }
  });
  const shareBtn = h('button', { type: 'button', class: 'btn btn--gold btn--sm' }, sent ? t('sent') : t('share'));
  shareBtn.addEventListener('click', () => {
    haptic.tap();
    shareUrl(url, appTitle);
    markSent(url);
    row.classList.add('sent');
    shareBtn.textContent = t('sent');
  });
  row.appendChild(h('div', { class: 'link-btns' }, copyBtn, shareBtn));
  return row;
}

async function loadMine() {
  const box = $('mine-list');
  box.innerHTML = '';
  box.appendChild(skeletons(2, 'skel--mine'));
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
  const title = `${a.groom} & ${a.bride}`;

  const card = h('div', { class: 'mine-card' },
    h('div', { class: 'mine-head' },
      h('div', { class: 'mine-names' }, title),
      h('span', { class: `badge ${badgeCls}` }, badgeTxt)),
    h('div', { class: 'mine-meta' }, `${a.date} · ${a.time}` + (tpl ? ` · ${tpl.name}` : '')));

  // Цена с разбивкой: шаблон + именные ссылки
  const priceBox = h('div', { class: 'mine-price' });
  priceBox.appendChild(h('div', { class: 'rc-line' }, h('span', {}, t('rcTplLine')), h('span', {}, money(a.templatePrice ?? a.total))));
  if (a.guestsPrice > 0) {
    priceBox.appendChild(h('div', { class: 'rc-line' },
      h('span', {}, `${t('rcGuestsLine')} (${(a.guests || []).length || '—'})`),
      h('span', {}, '+' + money(a.guestsPrice))));
  }
  priceBox.appendChild(h('div', { class: 'rc-line rc-line--total' }, h('span', {}, t('total')), h('b', {}, money(a.total))));
  card.appendChild(priceBox);

  if (a.url) {
    card.appendChild(linkRow(a.url, title, title));
    if ((a.guests || []).length) {
      const gbox = h('div', { class: 'mine-guests' });
      for (const g of a.guests) gbox.appendChild(linkRow(g.url, g.name, title));
      card.appendChild(gbox);
    }
  }
  return card;
}

/* ════ Мастер: 7 шагов, шаблон выбран заранее ════ */

const WIZARD = [
  { id: 'names', validate: vNames },
  { id: 'datetime', validate: vDate },
  { id: 'location', validate: vVenue, onEnter: ensureMap },
  { id: 'photos', validate: vPhotos, onEnter: () => { updatePhotoTexts(); renderPhotos(); } },
  { id: 'music', validate: () => null },
  { id: 'guests', validate: () => null, onEnter: renderGuests },
  { id: 'review', validate: () => null, onEnter: enterReview },
];

function blockEl(i) {
  return document.querySelector(`.block[data-step="${WIZARD[i].id}"]`);
}

function scrollToBlock(el) {
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - 74;
  window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
}

function updateProgress() {
  const pct = ((state.revealed + 1) / WIZARD.length) * 100;
  $('progress-fill').style.width = pct + '%';
  const tpl = selectedTemplate();
  if (tpl) {
    $('studio-tpl-name').textContent = tpl.name;
    $('studio-tpl-price').textContent = money(tpl.price);
  }
  $('studio-eye').hidden = !state.templateId;
  $('submit-label').textContent = t('send');
}

// Показывает блоки 0..revealed; кнопку «Продолжить» — только на фронтире.
function renderBlocks() {
  WIZARD.forEach((w, i) => {
    const sec = blockEl(i);
    if (!sec) return;
    sec.hidden = i > state.revealed;
    const go = sec.querySelector('.block-go');
    if (go && w.id !== 'review') go.hidden = i !== state.revealed;
  });
}

function showBlockErr(i, msg) {
  const sec = blockEl(i);
  if (!sec) return;
  const box = sec.querySelector('.block-err');
  if (box) { box.textContent = msg; box.hidden = false; }
  sec.classList.remove('sec-error');
  void sec.offsetWidth;
  sec.classList.add('sec-error');
  setTimeout(() => sec.classList.remove('sec-error'), 900);
  haptic.err();
}

function clearBlockErr(i) {
  const box = blockEl(i)?.querySelector('.block-err');
  if (box) box.hidden = true;
}

// Блок заполнен верно → следующий выезжает САМ, без кнопки «Продолжить».
// Необязательные блоки (музыка, гости) валидны сразу, поэтому цепочка
// раскрывается с паузой 420 мс — блоки «вытекают» один за другим, а не вываливаются разом.
let cascading = false;
function maybeAdvance() {
  if (state.revealed >= WIZARD.length - 1) { cascading = false; return; }
  if (WIZARD[state.revealed].validate()) { cascading = false; return; }
  clearBlockErr(state.revealed);
  state.revealed++;
  renderBlocks();
  const next = blockEl(state.revealed);
  next.classList.remove('block-in');
  void next.offsetWidth;
  next.classList.add('block-in');
  WIZARD[state.revealed].onEnter?.();
  updateProgress();
  haptic.impact('light');
  saveDraft();
  if (!cascading) {
    cascading = true;
    setTimeout(() => scrollToBlock(next), 80);
  }
  setTimeout(maybeAdvance, 420);
}

function enterStudio() {
  if (!state.templateId) {
    toast(t('eTpl'), 'err');
    showScreen('templates');
    return;
  }
  renderBlocks();
  for (let i = 0; i <= state.revealed; i++) WIZARD[i].onEnter?.();
  updateProgress();
  updateTgBack();
  window.scrollTo({ top: 0 });
  if (state.draftRestored) {
    state.draftRestored = false;
    toast(t('draftRestored'), 'info', 2600);
  }
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
function vPhotos() {
  if (state.photos.some((p) => p.uploading)) return t('eWait');
  const req = requiredPhotos() ?? 1;
  if (state.photos.filter((p) => p.name).length < req) return t('ePhotos', req);
  return null;
}

/* ════ Конфиг ════ */

async function loadConfig() {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error('config');
  state.config = await res.json();
  renderGallery();
  renderTopTracks();
  updatePhotoTexts();
  renderPhotos();
  renderGuests();
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

/* ════ Шаг: локация (карта без инструментов, края растворяются) ════ */

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
  // Без единого контрола: просто карта — ищи или коснись.
  ymap = new ymaps.Map('map', {
    center: state.lat !== null ? [state.lat, state.lng] : [41.311, 69.279],
    zoom: state.lat !== null ? 15 : 11,
    controls: [],
  }, { suppressMapOpenBlock: true });
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

function requiredPhotos() {
  return selectedTemplate()?.minPhotos ?? null;
}

function updatePhotoTexts() {
  const req = requiredPhotos();
  $('photo-req').textContent = req === null ? t('eTpl') : t('photoReq', req);
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

/* ════ Шаг: музыка — два чётких состояния: выбор ↔ выбрано ════ */

const YT_RE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/;
const SOCIAL_RE = /(instagram\.com|tiktok\.com)/i;

let previewAudio = new Audio();
let musicLoaded = false;
let lastMusicTab = 'catalog'; // куда вернуть кнопкой «Изменить»

function setMusicTab(mt) {
  document.querySelectorAll('#music-tabs .chip').forEach((b) => b.classList.toggle('active', b.dataset.mt === mt));
  $('music-catalog').hidden = mt !== 'catalog';
  $('music-own').hidden = mt !== 'own';
  if (mt !== 'none') lastMusicTab = mt;
  if (mt === 'catalog' && !musicLoaded) {
    musicLoaded = true;
    loadTracks('');
  }
}

function setMusic(music) {
  previewAudio.pause();
  state.music = music;
  updateSelectedMusic();
  saveDraft();
}

// Единственная точка истины для UI шага: выбрано → карточка, нет → выбор.
function updateSelectedMusic() {
  const has = state.music.type !== 'none';
  $('music-choice').hidden = has;
  $('music-selected').hidden = !has;
  if (!has) {
    setMusicTab('none');
    return;
  }
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
    haptic.tap();
    setMusic({
      type: 'itunes',
      value: { name: track.name, artist: track.artist, url: track.url },
      name: track.name + (track.artist ? ' — ' + track.artist : ''),
      previewUrl: track.url,
      start: null,
      end: null,
    });
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
    ctx.fillStyle = inside ? '#A88FC9' : 'rgba(168,143,201,.28)';
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

/* ════ Шаг: гости — кнопка «добавить», 8 000 за каждого ════ */

function guestNames() {
  return state.guests.map((s) => s.trim()).filter(Boolean);
}

function renderGuests() {
  const box = $('guest-list');
  if (!box) return;
  box.innerHTML = '';
  state.guests.forEach((name, i) => {
    const input = h('input', { type: 'text', maxlength: 50, value: name, placeholder: t('guestPh'), autocomplete: 'off' });
    input.addEventListener('input', () => {
      state.guests[i] = input.value;
      updateGuestsTotal();
      saveDraft();
    });
    const rm = h('button', { type: 'button', class: 'iconbtn iconbtn--sm', 'aria-label': 'Remove' }, '✕');
    rm.addEventListener('click', () => {
      state.guests.splice(i, 1);
      haptic.tap();
      renderGuests();
      saveDraft();
    });
    box.appendChild(h('div', { class: 'guest-row' }, h('span', { class: 'guest-n' }, String(i + 1)), input, rm));
  });
  updateGuestsTotal();
}

function updateGuestsTotal() {
  const price = state.config?.guestPrice ?? 8000;
  const n = guestNames().length;
  $('guests-total-row').hidden = n === 0;
  $('guests-total').textContent = `${n} × ${money(price)} = ${money(n * price)}`;
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
    guestNames: guestNames(),
    contactTg: $('contact-tg').value.trim(),
    phone: $('phone').value.trim(),
    phone2: $('phone2').value.trim(),
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

  // Шаблон — с кнопкой «Изменить»: второй (и последний) шанс передумать.
  const tplLine = h('div', { class: 'rc-line' },
    h('span', {}, t('rcTplLine')),
    h('span', {}, `${tpl.name} · ${money(tpl.price)} `,
      h('button', { type: 'button', class: 'rc-change' }, t('changeTpl'))));
  tplLine.querySelector('.rc-change').addEventListener('click', () => showScreen('templates'));
  box.appendChild(tplLine);

  let total = tpl.price;
  const n = guestNames().length;
  if (n > 0) {
    const price = state.config?.guestPrice ?? 8000;
    total += n * price;
    line(t('rcGuestsLine'), `${n} × ${money(price)} = +${money(n * price)}`);
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
  if (id === 'template') {
    showScreen('templates');
    if (msg) toast(msg, 'err');
    return;
  }
  const idx = WIZARD.findIndex((s) => s.id === id);
  if (idx < 0) { if (msg) toast(msg, 'err'); return; }
  if (state.revealed < idx) { state.revealed = idx; renderBlocks(); updateProgress(); }
  if (msg) showBlockErr(idx, msg);
  scrollToBlock(blockEl(idx));
}

function markField(id) {
  const el = $(id);
  el.classList.add('err');
  setTimeout(() => el.classList.remove('err'), 1500);
  el.focus();
}

async function submitApplication() {
  // Контакты: три поля, достаточно любых ДВУХ заполненных.
  const filled = [
    $('contact-tg').value.trim().replace(/^@/, ''),
    $('phone').value.trim(),
    $('phone2').value.trim(),
  ].filter(Boolean).length;
  if (filled < 2) {
    showBlockErr(WIZARD.length - 1, t('eContacts'));
    markField('contact-tg');
    return;
  }
  clearBlockErr(WIZARD.length - 1);
  const btn = $('submit-btn');
  btn.disabled = true;
  $('submit-label').textContent = t('sending');
  try {
    const res = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg ? tg.initData : '', form: collectForm() }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      if (data.step && data.step !== 'review') jumpToStepId(data.step, data.error);
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
    $('submit-label').textContent = t('send');
  }
}

/* ════ Привязка событий ════ */

function wireEvents() {
  /* навигация */
  $('nav-brand').addEventListener('click', () => showScreen('templates'));
  $('nav-tpl').addEventListener('click', () => showScreen('templates'));
  $('nav-mine').addEventListener('click', () => showScreen('mine'));
  $('mine-create').addEventListener('click', () => showScreen('templates'));
  $('hsw-uz').addEventListener('click', () => setLang('uz'));
  $('hsw-ru').addEventListener('click', () => setLang('ru'));

  /* студия */
  $('studio-exit').addEventListener('click', () => { toast(t('draftSaved'), 'info', 1600); showScreen('templates'); });
  $('submit-btn').addEventListener('click', submitApplication);
  // Любое действие внутри формы → проверяем, не пора ли раскрыть следующий блок.
  const autoAdvance = debounce(maybeAdvance, 250);
  const steps = $('studio-steps');
  steps.addEventListener('input', autoAdvance);
  steps.addEventListener('change', autoAdvance);
  steps.addEventListener('click', autoAdvance);
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

  /* поля с автосохранением */
  ['groom', 'bride'].forEach((id) => $(id).addEventListener('input', saveDraft));
  ['address', 'contact-tg', 'phone', 'phone2'].forEach((id) => $(id).addEventListener('input', saveDraft));

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

  /* музыка: выбор режима */
  document.querySelectorAll('#music-tabs .chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic.tap();
      previewAudio.pause();
      setMusicTab(btn.dataset.mt);
    });
  });
  $('music-q-btn').addEventListener('click', () => loadTracks($('music-q').value.trim()));
  $('music-q').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      loadTracks($('music-q').value.trim());
    }
  });

  /* музыка: выбранное состояние */
  $('sel-change').addEventListener('click', () => {
    setMusic({ type: 'none', value: null, name: '', previewUrl: null, start: null, end: null });
    setMusicTab(lastMusicTab);
  });
  $('sel-remove').addEventListener('click', () => {
    haptic.tap();
    setMusic({ type: 'none', value: null, name: '', previewUrl: null, start: null, end: null });
  });

  /* своя музыка: ссылка */
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
        setMusic({ type: 'upload', value: data.file, name: '🎬 ' + url.slice(0, 50), previewUrl: '/uploads/' + data.file, start: null, end: null });
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
      setMusic({ type: 'youtube', value: url, name: 'YouTube · ' + yt[1], previewUrl: null, start: null, end: null });
      return;
    }
    if (social) {
      toast(t('extractUnavail'), 'err');
      return;
    }
    const playable = /\.(mp3|ogg|m4a|wav)(\?|$)/i.test(url);
    setMusic({ type: 'custom', value: url, name: url.slice(0, 60), previewUrl: playable ? url : null, start: null, end: null });
  });

  /* своя музыка: файл */
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
      setMusic({ type: 'upload', value: data.file, name: file.name, previewUrl: '/uploads/' + data.file, start: null, end: null });
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

  /* гости */
  $('guest-add').addEventListener('click', () => {
    haptic.tap();
    state.guests.push('');
    renderGuests();
    const inputs = $('guest-list').querySelectorAll('input');
    if (inputs.length) inputs[inputs.length - 1].focus();
    saveDraft();
  });
}

/* Чистый лист после отправленной заявки */
function resetWizard() {
  state.revealed = 0;
  state.dateIso = null;
  state.lat = null;
  state.lng = null;
  state.templateId = null;
  state.photos = [];
  state.music = { type: 'none', value: null, name: '', previewUrl: null, start: null, end: null };
  state.guests = [];
  for (const id of ['groom', 'bride', 'address', 'geo-search', 'contact-tg', 'phone', 'phone2', 'music-link']) $(id).value = '';
  $('time').value = '18:00';
  if (placemark && ymap) { ymap.geoObjects.remove(placemark); placemark = null; }
  updateSelectedMusic();
  renderPhotos();
  renderGuests();
  renderCalendar();
  updateDateLabel();
  renderBlocks();
  updateProgress();
}

/* ════ Старт ════ */

function initLangScreen() {
  const boot = () => {
    $('app').hidden = false;
    applyI18n();
    revealOnScroll('.rv');
    // Черновик с выбранным шаблоном — сразу в студию, к работе.
    showScreen(state.draftRestored && state.templateId ? 'studio' : 'templates');
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
$('gallery').appendChild(skeletons(4, 'skel--card'));
loadConfig().then(initLangScreen).catch(() => {
  initLangScreen();
  toast(t('eNet'), 'err');
});

/* ════ Живая атмосфера: пыль, лепестки, золотые листья, искры за контентом ════ */
(function ambientLayer() {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var box = document.createElement('div');
  box.className = 'app-amb';
  box.setAttribute('aria-hidden', 'true');
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  function spawn(cls, n, make) {
    for (var i = 0; i < n; i++) {
      var el = document.createElement('i');
      el.className = cls;
      make(el);
      box.appendChild(el);
    }
  }
  // золотая пыль — поднимается
  spawn('amb-dust', 16, function (el) {
    el.style.setProperty('--x', rnd(2, 98).toFixed(1) + '%');
    el.style.setProperty('--y', rnd(15, 95).toFixed(1) + '%');
    el.style.setProperty('--s', rnd(0.6, 1.8).toFixed(2));
    el.style.setProperty('--sw', rnd(-40, 40).toFixed(0) + 'px');
    el.style.setProperty('--t', rnd(9, 16).toFixed(1) + 's');
    el.style.setProperty('--d', rnd(0, 10).toFixed(1) + 's');
  });
  // лепестки — падают, покачиваясь
  spawn('amb-petal', 9, function (el) {
    el.style.setProperty('--x', rnd(2, 96).toFixed(1) + '%');
    el.style.setProperty('--s', rnd(0.7, 1.4).toFixed(2));
    el.style.setProperty('--sw', rnd(-70, 70).toFixed(0) + 'px');
    el.style.setProperty('--t', rnd(16, 30).toFixed(1) + 's');
    el.style.setProperty('--d', rnd(0, 24).toFixed(1) + 's');
  });
  // золотые листья
  spawn('amb-leaf', 6, function (el) {
    el.style.setProperty('--x', rnd(2, 96).toFixed(1) + '%');
    el.style.setProperty('--s', rnd(0.7, 1.4).toFixed(2));
    el.style.setProperty('--sw', rnd(-90, 90).toFixed(0) + 'px');
    el.style.setProperty('--t', rnd(18, 32).toFixed(1) + 's');
    el.style.setProperty('--d', rnd(0, 26).toFixed(1) + 's');
  });
  // мерцающие искры
  spawn('amb-spark', 12, function (el) {
    el.style.setProperty('--x', rnd(2, 98).toFixed(1) + '%');
    el.style.setProperty('--y', rnd(6, 92).toFixed(1) + '%');
    el.style.setProperty('--s', rnd(0.5, 1.4).toFixed(2));
    el.style.setProperty('--t', rnd(4, 9).toFixed(1) + 's');
    el.style.setProperty('--d', rnd(0, 8).toFixed(1) + 's');
  });
  document.body.appendChild(box);
})();
