/* global ymaps, UI */
/* nvate studio — одна вертикальная нить. Кнопки «продолжить» нет: как только блок
   заполнен верно, следующий сам медленно проявляется и подъезжает к экрану.
   Секции: состояние · словарь · нить и док · блоки · демо · отправка · старт. */
'use strict';

const { $, h, debounce, toast, sheet, haptic, tg } = UI;

if (tg) { tg.ready(); tg.expand(); try { tg.setHeaderColor('#0b0a08'); } catch (_) { /* старый клиент */ } }

/* ════ Состояние ════ */

const state = {
  config: null,
  open: 0,              // последний раскрытый блок — он же активный шаг
  dateIso: null,
  time: '17:00',
  timeConfirmed: false,
  lat: null,
  lng: null,
  templateId: null,
  photos: [],           // { name, url, uploading }
  music: null,          // { type, value, name, artist, playUrl }
  guestsOn: false,
  guests: [],
  previewHtml: '',
  seenInvite: false,
  sending: false,
};

const DRAFT = 'nv_draft_v4';

const saveDraft = debounce(() => {
  try {
    localStorage.setItem(DRAFT, JSON.stringify({
      v: 4,
      groom: $('groom').value, bride: $('bride').value,
      dateIso: state.dateIso, time: state.time, timeConfirmed: state.timeConfirmed,
      lat: state.lat, lng: state.lng, address: $('address').value,
      templateId: state.templateId,
      photos: state.photos.filter((p) => p.name).map((p) => p.name),
      music: state.music, guestsOn: state.guestsOn, guests: state.guests,
      contactTg: $('contact-tg').value, phone: $('phone').value, phone2: $('phone2').value,
      open: state.open, seenInvite: state.seenInvite,
    }));
  } catch (_) { /* переполненное хранилище не критично */ }
}, 400);

function clearDraft() { try { localStorage.removeItem(DRAFT); } catch (_) { /* — */ } }

function restoreDraft() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch (_) { return false; }
  if (!d || d.v !== 4) return false;
  if (!d.groom && !d.bride && !d.templateId) return false;
  $('groom').value = d.groom || '';
  $('bride').value = d.bride || '';
  $('address').value = d.address || '';
  $('contact-tg').value = d.contactTg || '';
  $('phone').value = d.phone || '';
  $('phone2').value = d.phone2 || '';
  state.dateIso = d.dateIso || null;
  state.time = d.time || '17:00';
  state.timeConfirmed = Boolean(d.timeConfirmed);
  state.lat = Number.isFinite(d.lat) ? d.lat : null;
  state.lng = Number.isFinite(d.lng) ? d.lng : null;
  state.templateId = d.templateId || null;
  state.photos = (d.photos || []).map((name) => ({ name, url: '/uploads/' + name, uploading: false }));
  state.music = d.music || null;
  state.guestsOn = Boolean(d.guestsOn);
  state.guests = Array.isArray(d.guests) ? d.guests.slice(0, 100) : [];
  state.seenInvite = Boolean(d.seenInvite);
  state.open = Math.min(Number(d.open) || 0, STEPS.length - 1);
  return true;
}

/* ════ Словарь ════ */

const I18N = {
  uz: {
    eNames: 'Kim uylanmoqda', tNames: 'Ismlaringiz',
    phGroom: 'Kuyov', phBride: 'Kelin', groom: 'Kuyov ismi', bride: 'Kelin ismi',
    eDate: 'Qachon', tDate: 'To‘y sanasi', timeLbl: 'Boshlanish vaqti',
    timePrompt: 'Vaqtni tanlang — 17:00 mos bo‘lsa ham barabanga bir marta teging.',
    eVenue: 'Qayerda', tVenue: 'To‘yxona', address: 'Manzil nomi', find: 'Qidirish',
    seekLbl: 'Joyni qidirish', seekPlace: 'Masalan: Hilton Tashkent',
    mapHint: 'To‘yxona turgan joyni xaritada bosing', linkLbl: 'Musiqa havolasi',
    change: 'O‘zgartirish',
    guestPh: 'Ism yozing…',
    guestsTip: 'Maslahat: jonli murojaat qilgandek yozing — <b>Aziz aka</b>, <b>Malika opa</b>, <b>Dilnoza singlim</b>. Taklifnomada bu juda iliq chiqadi.',
    eMusic: 'Ovoz', tMusic: 'Musiqa', msTop: 'Mashhur', msMine: 'Mening musiqam',
    seekMusic: 'Qo‘shiq yoki ijrochi', musicSkip: 'Musiqasiz davom etish',
    add: 'Qo‘shish', uploadMusic: 'Fayl yuklash', lookDone: 'Ko‘rib chiqdim',
    linkHint: 'YouTube havolasi yoki to‘g‘ridan-to‘g‘ri mp3 havolasi.',
    linkPh: 'https://…',
    eTpl: 'Dizayn', tTpl: 'Taklifnoma uslubi',
    leadTpl: 'Yon tomonga suring. «Demo» — ko‘rish, «Tanlash» — shu uslubda davom etamiz.',
    ePhotos: 'Suratlar', tPhotos: 'Sizning suratlaringiz',
    eReady: 'Tayyor', tReady: 'Hammasi tayyor',
    leadReady: 'Taklifnomangiz yig‘ildi. Uni to‘liq ko‘rib chiqing.',
    seeInvite: 'Qayta ko‘rish',
    readyHint: 'Namuna o‘zi ochiladi. Oxirigacha suring — u sokin yopilib, studiyaga qaytaradi.',
    eGuests: 'Qo‘shimcha', tGuests: 'Ismli taklifnomalar',
    guestsSwTitle: 'Har bir mehmonga alohida havola',
    guestsSwOff: 'O‘chirilgan', guestsSwOn: 'Yoqilgan',
    guestsHow1: 'Taklifnoma ochilganda mehmon <b>o‘z ismini</b> ko‘radi: «Hurmatli Aziz, sizni to‘yimizga taklif qilamiz».',
    guestsHow2: 'Har bir mehmon uchun alohida havola tayyorlanadi: <code>nvate.uz/ali-zebo/aziz</code> — uni to‘g‘ridan-to‘g‘ri yuborasiz.',
    guestsHow3: 'Narxi: har bir ism uchun <b>10 000 so‘m</b>. Nechta bo‘lsa ham qo‘shaverasiz — umumiy summa pastda ko‘rinadi.',
    personalPreview: 'Shaxsiy taklif', personalGuest: 'Hurmatli Aziz aka',
    personalCaption: 'Bitta dizayn — har bir mehmon uchun ismi yozilgan alohida taklifnoma.',
    guestAdd: 'Ism qo‘shish', guestsUnit: 'ta ism',
    wmTitle: 'Namuna himoyalangan',
    wmText: 'Ustidagi «nVate» to‘ri va nusxa olish cheklovi faqat namunada. To‘lovdan so‘ng to‘r olib tashlanadi va sizga toza havola beriladi.',
    total: 'Jami',
    eContact: 'Aloqa', tContact: 'Siz bilan qanday bog‘lanamiz',
    leadContact: 'To‘lovni tasdiqlash uchun kamida 2 ta maydonni to‘ldiring.',
    tgLbl: 'Telegram username', phoneLbl: 'Telefon raqam', phone2Lbl: 'Qo‘shimcha aloqa',
    contactRule: 'Username yoki raqam — ikkitasi yetarli.',
    mineTitle: 'Mening taklifnomalarim',
    doneTitle: 'Qabul qilindi', doneNew: 'Yangi taklifnoma',
    doneText: 'To‘lov tasdiqlangach, botga toza havolangiz keladi. Odatda bu 10 daqiqagacha vaqt oladi.',
    beads: ['Ismlar', 'Sana', 'Joy', 'Musiqa', 'Dizayn', 'Suratlar', 'Tayyor', 'Mehmonlar', 'Aloqa'],
    pay: 'To‘lash va havola olish', sending: 'Yuborilmoqda',
    months: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
    dow: ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'],
    demo: 'Ochib ko‘rish', live: 'Jonli namuna', popular: 'Mashhur', take: 'Tanlash', taken: 'Tanlandi',
    photoNeed: (n) => `Bu uslub uchun <b>${n} ta</b> surat kerak`,
    photoOf: (i, n) => `${i} / ${n}`,
    sum: 'so‘m',
    eNames_: 'Ikkala ismni ham yozing', eDate_: 'Taqvimdan sanani tanlang',
    eVenue_: 'Xaritada joyni belgilang', eTpl_: 'Uslubni tanlang',
    ePhoto_: (n) => `Yana surat kerak: ${n} ta`,
    eGuest_: 'Bo‘sh ismlarni to‘ldiring yoki o‘chiring',
    eContact_: 'Kamida 2 ta aloqa maydonini to‘ldiring',
    eNet: 'Aloqa yo‘q. Qayta urinib ko‘ring', eNoFound: 'Hech narsa topilmadi',
    eUpload: 'Fayl yuklanmadi', eBig: 'Fayl juda katta (16 МБ gacha)',
    eLink: 'Havola tanilmadi',
    noGeo: 'Joylashuv aniqlanmadi', copied: 'Nusxa olindi',
    nextUp: 'Keyingi bosqich ochildi',
    tplPlate: 'Taklifnoma', myTrack: 'Mening trekim',
  },
  ru: {
    eNames: 'Кто женится', tNames: 'Ваши имена',
    phGroom: 'Жених', phBride: 'Невеста', groom: 'Имя жениха', bride: 'Имя невесты',
    eDate: 'Когда', tDate: 'Дата свадьбы', timeLbl: 'Время начала',
    timePrompt: 'Выберите время — даже если вам подходит 17:00, коснитесь барабана.',
    eVenue: 'Где', tVenue: 'Место', address: 'Название места', find: 'Найти',
    seekLbl: 'Поиск места', seekPlace: 'Например: Hilton Tashkent',
    mapHint: 'Нажмите на карту там, где будет торжество', linkLbl: 'Ссылка на музыку',
    change: 'Изменить',
    guestPh: 'Впишите имя…',
    guestsTip: 'Совет: пишите так, как обратитесь вживую — <b>Азиз ака</b>, <b>Малика опа</b>, <b>Дилноза синглим</b>. В приглашении это читается очень тепло.',
    eMusic: 'Звук', tMusic: 'Музыка', msTop: 'Популярное', msMine: 'Моя музыка',
    seekMusic: 'Песня или исполнитель', musicSkip: 'Продолжить без музыки',
    add: 'Добавить', uploadMusic: 'Загрузить файл', lookDone: 'Посмотрел',
    linkHint: 'Ссылка на YouTube или прямая ссылка на mp3.',
    linkPh: 'https://…',
    eTpl: 'Дизайн', tTpl: 'Стиль приглашения',
    leadTpl: 'Листайте вбок. «Демо» — посмотреть, «Выбрать» — продолжаем в этом стиле.',
    ePhotos: 'Фото', tPhotos: 'Ваши фотографии',
    eReady: 'Готово', tReady: 'Всё готово',
    leadReady: 'Приглашение собрано. Посмотрите его целиком.',
    seeInvite: 'Посмотреть ещё раз',
    readyHint: 'Образец откроется сам. Долистайте до конца — он мягко закроется и вернёт вас в студию.',
    eGuests: 'Дополнительно', tGuests: 'Именные приглашения',
    guestsSwTitle: 'Персональная ссылка каждому гостю',
    guestsSwOff: 'Выключено', guestsSwOn: 'Включено',
    guestsHow1: 'Открывая приглашение, гость видит <b>своё имя</b>: «Дорогой Азиз, приглашаем вас на нашу свадьбу».',
    guestsHow2: 'Для каждого гостя готовится отдельная ссылка: <code>nvate.uz/ali-zebo/aziz</code> — её вы отправляете лично.',
    guestsHow3: 'Цена: <b>10 000 сум</b> за каждое имя. Добавляйте сколько нужно — сумма пересчитывается ниже.',
    personalPreview: 'Личное приглашение', personalGuest: 'Дорогой Азиз',
    personalCaption: 'Один дизайн превращается в отдельное именное приглашение для каждого гостя.',
    guestAdd: 'Добавить имя', guestsUnit: 'имён',
    wmTitle: 'Образец защищён',
    wmText: 'Сетка «nVate» поверх и запрет копирования — только в образце. После оплаты сетка снимается, и вы получаете чистую ссылку.',
    total: 'Итого',
    eContact: 'Контакты', tContact: 'Как с вами связаться',
    leadContact: 'Для подтверждения оплаты заполните минимум 2 поля.',
    tgLbl: 'Telegram username', phoneLbl: 'Номер телефона', phone2Lbl: 'Запасной контакт',
    contactRule: 'Username или номер — достаточно двух.',
    mineTitle: 'Мои приглашения',
    doneTitle: 'Заявка принята', doneNew: 'Новое приглашение',
    doneText: 'После подтверждения оплаты чистая ссылка придёт в бот. Обычно это занимает до 10 минут.',
    beads: ['Имена', 'Дата', 'Место', 'Музыка', 'Дизайн', 'Фото', 'Готово', 'Гости', 'Контакты'],
    pay: 'Оплатить и получить ссылку', sending: 'Отправляем',
    months: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
    dow: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    demo: 'Открыть', live: 'Живой пример', popular: 'Популярно', take: 'Выбрать', taken: 'Выбрано',
    photoNeed: (n) => `Для этого стиля нужно <b>${n} фото</b>`,
    photoOf: (i, n) => `${i} / ${n}`,
    sum: 'сум',
    eNames_: 'Впишите оба имени', eDate_: 'Выберите дату в календаре',
    eVenue_: 'Отметьте место на карте', eTpl_: 'Выберите стиль',
    ePhoto_: (n) => `Добавьте ещё ${n} фото`,
    eGuest_: 'Заполните или удалите пустые имена',
    eContact_: 'Заполните минимум 2 поля контактов',
    eNet: 'Нет связи. Попробуйте ещё раз', eNoFound: 'Ничего не найдено',
    eUpload: 'Файл не загрузился', eBig: 'Файл слишком большой (до 16 МБ)',
    eLink: 'Ссылка не распознана',
    noGeo: 'Не удалось определить геопозицию', copied: 'Скопировано',
    nextUp: 'Следующий шаг открыт',
    tplPlate: 'Приглашение', myTrack: 'Мой трек',
  },
};

/* Every new studio visit starts with an explicit language choice. */
let LANG = null;
const t = (k, ...a) => {
  const v = I18N[LANG || 'uz'][k];
  return typeof v === 'function' ? v(...a) : v;
};
const money = (n) => `${Number(n || 0).toLocaleString('ru-RU')} ${t('sum')}`;

function applyI18n() {
  document.documentElement.lang = LANG;
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const v = t(el.dataset.i18n);
    if (typeof v !== 'string') continue;
    if (v.includes('<')) el.innerHTML = v; else el.textContent = v;
  }
  $('geo-q').placeholder = t('seekPlace');
  $('music-q').placeholder = t('seekMusic');
  $('music-link').placeholder = t('linkPh');
  $('submit-label').textContent = t('pay');
  $('sw-uz').classList.toggle('on', LANG === 'uz');
  $('sw-ru').classList.toggle('on', LANG === 'ru');
  renderBeads();
  renderCalendar();
  buildClock();
  renderTemplates();
  renderPhotos();
  renderGuests();
  renderReady();
}

function setLang(lang) {
  LANG = lang;
  localStorage.setItem('nv_lang', lang);
  applyI18n();
}

/* ════ Шаги ════
   auto: блок сам открывает следующий, как только заполнен верно. */

const STEPS = [
  { id: 'names', auto: true, check: () => $('groom').value.trim() && $('bride').value.trim() },
  { id: 'datetime', auto: true, check: () => Boolean(state.dateIso) && state.timeConfirmed },
  { id: 'location', auto: true, check: () => Number.isFinite(state.lat) && Number.isFinite(state.lng) },
  { id: 'music', auto: true, check: () => true },
  { id: 'template', auto: true, check: () => Boolean(state.templateId) },
  { id: 'photos', auto: true, check: () => filledPhotos() >= requiredPhotos() },
  { id: 'ready', auto: false, check: () => state.seenInvite },
  { id: 'guests', auto: true, check: () => true },        // опциональный блок — после показа открывает контакты
  { id: 'contact', auto: false, check: () => contactsFilled() >= 2 },
];

const blk = (i) => document.querySelector(`.blk[data-step="${STEPS[i].id}"]`);
const stepIdx = (id) => STEPS.findIndex((s) => s.id === id);

/* Вся студия живёт на одной постоянной сцене «Шёлковая нить»: фон не меняется.
   Между этапами движутся только камера и следующая цельная карточка. */
let revealRun = 0;
const FLOW = Object.freeze({
  settle: 670,
  beforeScroll: 430,
  scroll: 1100,
  afterScroll: 335,
  reveal: 1250,
});
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function setScene() {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0b0a08');
  try { tg?.setHeaderColor('#0b0a08'); } catch (_) { /* outside Telegram */ }
}

function showErr(i, msg) {
  const el = blk(i)?.querySelector('.blk-err');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  haptic.err();
}
function clearErr(i) { const el = blk(i)?.querySelector('.blk-err'); if (el) el.hidden = true; }

function easeInOut(k) {
  return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}

function softScrollTo(top, duration = FLOW.scroll) {
  const from = window.scrollY;
  const delta = top - from;
  if (Math.abs(delta) < 8) return Promise.resolve();
  return new Promise((resolve) => {
    const startedAt = performance.now();
    const frame = (now) => {
      const k = Math.min(1, (now - startedAt) / duration);
      window.scrollTo(0, from + delta * easeInOut(k));
      if (k < 1) requestAnimationFrame(frame); else resolve();
    };
    requestAnimationFrame(frame);
  });
}

function softScrollRailTo(card, duration = 1055) {
  const rail = $('tpl-rail');
  if (!rail || !card) return Promise.resolve();
  const from = rail.scrollLeft;
  const target = Math.max(0, Math.min(rail.scrollWidth - rail.clientWidth,
    card.offsetLeft - (rail.clientWidth - card.offsetWidth) / 2));
  const delta = target - from;
  if (Math.abs(delta) < 3) {
    rail.scrollLeft = target;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const startedAt = performance.now();
    const frame = (now) => {
      const k = Math.min(1, (now - startedAt) / duration);
      rail.scrollLeft = from + delta * easeInOut(k);
      if (k < 1) requestAnimationFrame(frame); else resolve();
    };
    requestAnimationFrame(frame);
  });
}

function scrollToBlock(i) {
  const el = blk(i);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - 72;
  setScene(i);
  softScrollTo(Math.max(0, y), 1055);
}

function renderBlocks(armIdx = -1) {
  STEPS.forEach((s, i) => {
    const el = blk(i);
    el.hidden = i > state.open;
    el.classList.toggle('is-done', i < state.open);
    el.classList.toggle('is-live', i === state.open);
    if (i !== armIdx) el.classList.remove('is-armed', 'is-new');
    else el.classList.add('is-armed');       // держим блок в «до»-состоянии
  });
  renderBeads();
}

function unlock(i) {
  if (i >= STEPS.length || i <= state.open) return;
  const run = ++revealRun;
  state.open = i;
  renderBlocks(i);
  prepareStep(i);
  saveDraft();
  // Камера сначала медленно подводит верх нового блока в кадр. Только после
  // остановки начинается reveal — последовательность читается как смена сцены.
  (async () => {
    await wait(FLOW.beforeScroll);
    if (run !== revealRun) return;
    await nudgeTo(i);
    await wait(FLOW.afterScroll);
    if (run !== revealRun) return;
    setScene(i);
    haptic.ok();
    armReveal(i);
    await wait(FLOW.reveal);
    if (run === revealRun && state.open === i) activateStep(i);
  })();
}

/* Автоскролл — только короткий намёк. Он показывает начало нового блока,
   а дальше пользователь сам решает, насколько далеко листать страницу. */
async function nudgeTo(i) {
  const el = blk(i);
  if (!el) return;
  const armedOffset = el.classList.contains('is-armed') ? 112 : 0;
  const blockTop = window.scrollY + el.getBoundingClientRect().top - armedOffset;
  const revealLine = window.scrollY + window.innerHeight * .7;
  const fullDistance = Math.max(0, blockTop - revealLine);
  if (fullDistance > 8) {
    const maxNudge = window.innerWidth < 700 ? 180 : 220;
    const travel = Math.min(maxNudge, Math.max(84, fullDistance * .42));
    const duration = Math.min(FLOW.scroll, 420 + travel * 3.4);
    await softScrollTo(window.scrollY + travel, duration);
  }
}

function armReveal(i) {
  const el = blk(i);
  if (!el) return;
  if (!el.classList.contains('is-armed')) return;
  el.classList.remove('is-armed');
  void el.offsetWidth;
  el.classList.add('is-new');
}

let advTimer = null;
let autoPreviewTimer = null;

/* Автопереход: следим за активным блоком, кнопки «продолжить» нет. */
function autoAdvance(delay = FLOW.settle) {
  clearTimeout(advTimer);
  const i = state.open;
  const step = STEPS[i];
  if (!step || !step.auto || i >= STEPS.length - 1) return;
  if (!step.check()) return;
  advTimer = setTimeout(() => {
    if (i !== state.open || !step.check()) return;
    clearErr(i);
    unlock(i + 1);
  }, Math.max(FLOW.settle, Number(delay) || 0));
}

function prepareStep(i) {
  const id = STEPS[i].id;
  if (id === 'location') ensureMap();
  if (id === 'music') loadTracks();
  if (id === 'photos') renderPhotos();
  if (id === 'ready') { renderReady(); loadPreview(); }
  if (id === 'guests') renderGuests();
  if (id === 'contact') updateBill();
}

function activateStep(i) {
  const id = STEPS[i].id;
  if (id === 'ready') {
    clearTimeout(autoPreviewTimer);
    if (!state.seenInvite) {
      autoPreviewTimer = setTimeout(() => {
        if (state.open === i && !state.seenInvite && $('sheet').hidden) openInvite({ auto: true });
      }, 1250);
    }
  }
  if (id === 'guests') {
    // Блок опциональный: даём время увидеть motion-пример, затем спокойно
    // раскрываем контакты ниже. Гости при этом остаются редактируемыми.
    setTimeout(() => {
      if (state.open === i) autoAdvance(0);
    }, 2200);
  }
}

function onEnterStep(i) {
  prepareStep(i);
  activateStep(i);
}

/* ════ Док: бусины на нити ════ */

function renderBeads() {
  const box = $('beads');
  box.innerHTML = '';
  const labels = I18N[LANG || 'uz'].beads;
  STEPS.forEach((s, i) => {
    const cls = i < state.open ? 'done' : i === state.open ? 'live' : 'lock';
    const b = h('button', { type: 'button', class: `bead ${cls}`, 'aria-label': labels[i] },
      h('i', {}), h('span', {}, labels[i]));
    if (i <= state.open) b.addEventListener('click', () => { haptic.tap(); scrollToBlock(i); });
    box.appendChild(b);
  });
  const live = box.querySelector('.bead.live');
  if (live) {
    box.style.setProperty('--fill', `${live.offsetLeft + live.offsetWidth / 2 - 10}px`);
    live.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }
}

/* ════ 01 · Имена ════ */

function paintPlate() {
  const g = $('groom').value.trim();
  const b = $('bride').value.trim();
  $('cp-groom').textContent = g || t('phGroom');
  $('cp-bride').textContent = b || t('phBride');
  $('cp-groom').classList.toggle('plate-name--empty', !g);
  $('cp-bride').classList.toggle('plate-name--empty', !b);
  const plate = document.querySelector('.plate');
  if (g && b && !plate.dataset.lit) {
    plate.dataset.lit = '1';
    plate.classList.add('lit');
    setTimeout(() => plate.classList.remove('lit'), 770);
  }
  if (!g || !b) delete plate.dataset.lit;
}

function markFilled(input) {
  input.closest('.field')?.classList.toggle('filled', Boolean(input.value.trim()));
}

/* ════ 02 · Дата и барабан времени ════ */

const today = new Date();
let calView = new Date(today.getFullYear(), today.getMonth(), 1);

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function renderCalendar() {
  const dow = $('cal-dow');
  dow.innerHTML = '';
  for (const d of t('dow')) dow.appendChild(h('span', {}, d));

  $('cal-title').textContent = `${t('months')[calView.getMonth()]} ${calView.getFullYear()}`;
  const grid = $('cal-grid');
  grid.innerHTML = '';

  const first = new Date(calView.getFullYear(), calView.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;               // неделя с понедельника
  const days = new Date(calView.getFullYear(), calView.getMonth() + 1, 0).getDate();
  const floor = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  for (let i = 0; i < lead; i++) grid.appendChild(h('div', { class: 'cal-cell pad' }));

  for (let d = 1; d <= days; d++) {
    const date = new Date(calView.getFullYear(), calView.getMonth(), d);
    const key = iso(date);
    const past = date < floor;
    const wknd = date.getDay() === 0 || date.getDay() === 6;
    const cell = h('button', {
      type: 'button',
      class: `cal-cell${past ? ' off' : ''}${wknd && !past ? ' wknd' : ''}${key === iso(today) ? ' today' : ''}${key === state.dateIso ? ' sel' : ''}`,
    }, String(d));
    if (key === state.dateIso) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'cal-ring');
      svg.setAttribute('viewBox', '0 0 44 44');
      svg.innerHTML = '<circle cx="22" cy="22" r="20"/>';
      cell.appendChild(svg);
    }
    if (!past) {
      cell.addEventListener('click', () => {
        state.dateIso = key;
        state.timeConfirmed = false;
        $('time-prompt').hidden = false;
        blk(stepIdx('datetime'))?.classList.add('needs-time');
        haptic.tap();
        renderCalendar();
        readDate();
        clearErr(1);
        saveDraft();
      });
    }
    grid.appendChild(cell);
  }
  readDate();
}

function readDate() {
  if (!state.dateIso) { $('date-read').textContent = ''; return; }
  const [y, m, d] = state.dateIso.split('-').map(Number);
  $('date-read').textContent = `${d} ${t('months')[m - 1]} ${y} · ${state.time}`;
}

const HOURS = Array.from({ length: 11 }, (_, i) => String(i + 13).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

/* Барабан крутится по горизонтали: страница листается вертикально, поэтому
   случайно сбить время прокруткой невозможно. Тап по цифре тоже работает. */
function buildClock() {
  buildDrum($('hour-drum'), HOURS, 0, 'clock-h');
  buildDrum($('min-drum'), MINUTES, 1, 'clock-m');
  paintClock();
  $('time-prompt').hidden = !state.dateIso || state.timeConfirmed;
  blk(stepIdx('datetime'))?.classList.toggle('needs-time', Boolean(state.dateIso) && !state.timeConfirmed);
}

function buildDrum(track, values, part, readoutId) {
  track.innerHTML = '';
  let userTouched = false;

  const commit = (v) => {
    if (!userTouched || !state.dateIso) return;
    const parts = state.time.split(':');
    const changed = parts[part] !== v;
    parts[part] = v;
    state.time = parts.join(':');
    state.timeConfirmed = true;
    $('time-prompt').hidden = true;
    blk(stepIdx('datetime'))?.classList.remove('needs-time');
    if (changed) bump(readoutId);
    paintClock();
    readDate();
    clearErr(1);
    saveDraft();
    autoAdvance(720);
  };

  for (const v of values) {
    const cell = h('div', { class: 'hdrum-num', dataset: { v } }, v);
    cell.addEventListener('click', () => {
      userTouched = true;
      const left = cell.offsetLeft - (track.clientWidth - cell.offsetWidth) / 2;
      track.scrollTo({ left, behavior: 'smooth' });
      setTimeout(() => commit(v), 360);
    });
    track.appendChild(cell);
  }

  const indexNow = () => {
    const center = track.scrollLeft + track.clientWidth / 2;
    let near = 0;
    let distance = Infinity;
    [...track.children].forEach((cell, i) => {
      const next = Math.abs(cell.offsetLeft + cell.offsetWidth / 2 - center);
      if (next < distance) { distance = next; near = i; }
    });
    return near;
  };

  const centerAt = (index) => {
    const cell = track.children[index];
    if (!cell) return;
    track.scrollLeft = cell.offsetLeft - (track.clientWidth - cell.offsetWidth) / 2;
  };

  const settle = debounce(() => {
    const v = values[indexNow()];
    if (!userTouched) return;
    haptic.tap();
    commit(v);
  }, 130);

  track.addEventListener('pointerdown', () => { userTouched = true; }, { passive: true });
  track.addEventListener('wheel', () => { userTouched = true; }, { passive: true });
  track.addEventListener('scroll', () => { paintDrum(track, indexNow()); settle(); }, { passive: true });

  // стартовая позиция без анимации, до первой отрисовки
  const start = Math.max(0, values.indexOf(state.time.split(':')[part]));
  requestAnimationFrame(() => {
    centerAt(start);
    paintDrum(track, start);
  });
  centerAt(start);
  paintDrum(track, start);
}

function paintDrum(track, idx) {
  [...track.children].forEach((el, i) => {
    el.classList.toggle('on', i === idx);
    el.classList.toggle('near', Math.abs(i - idx) === 1);
  });
}

function paintClock() {
  const [hh, mm] = state.time.split(':');
  $('clock-h').textContent = hh;
  $('clock-m').textContent = mm;
}

function bump(id) {
  const el = $(id);
  el.classList.remove('tick');
  void el.offsetWidth;
  el.classList.add('tick');
}

/* ════ 03 · Локация ════ */

const UZ_CENTER = [41.311, 69.2797];
let ymap = null;
let mark = null;
let mapAsked = false;

function ensureMap() {
  if (mapAsked) return;
  mapAsked = true;
  const key = state.config?.yandexMapsKey;
  const s = document.createElement('script');
  s.src = `https://api-maps.yandex.ru/2.1/?lang=${LANG === 'ru' ? 'ru_RU' : 'uz_UZ'}${key ? `&apikey=${encodeURIComponent(key)}` : ''}`;
  s.onload = () => ymaps.ready(initMap);
  s.onerror = () => toast(t('eNet'), 'err');
  document.head.appendChild(s);
}

function initMap() {
  const c = Number.isFinite(state.lat) ? [state.lat, state.lng] : UZ_CENTER;
  ymap = new ymaps.Map('map', { center: c, zoom: Number.isFinite(state.lat) ? 16 : 11, controls: [] }, {
    suppressMapOpenBlock: true, yandexMapDisablePoiInteractivity: true,
  });
  ymap.behaviors.disable('dblClickZoom');

  // Точку ставит тап по карте: центр экрана ничего не выбирает сам.
  ymap.events.add('click', (e) => {
    const [lat, lng] = e.get('coords');
    haptic.tap();
    setPoint(lat, lng);
    reverseName(lat, lng);
    autoAdvance(720);
  });
  if (Number.isFinite(state.lat)) setPoint(state.lat, state.lng);
}

function setPoint(lat, lng) {
  state.lat = lat; state.lng = lng;
  clearErr(2);
  saveDraft();
  if (!ymap) return;
  if (mark) { mark.geometry.setCoordinates([lat, lng]); return; }
  mark = new ymaps.Placemark([lat, lng], {}, {
    preset: 'islands#circleIcon', iconColor: '#B9985A', draggable: true,
  });
  mark.events.add('dragend', () => {
    const [dlat, dlng] = mark.geometry.getCoordinates();
    state.lat = dlat; state.lng = dlng;
    saveDraft();
    reverseName(dlat, dlng);
    autoAdvance(720);
  });
  ymap.geoObjects.add(mark);
}

const reverseName = debounce(async (lat, lng) => {
  if ($('address').dataset.manual === '1' || !window.ymaps) return;
  try {
    const res = await ymaps.geocode([lat, lng], { results: 1 });
    const o = res.geoObjects.get(0);
    if (!o) return;
    const name = o.properties.get('name') || o.getAddressLine();
    if (name && !$('address').value.trim()) {
      $('address').value = String(name).slice(0, 140);
      markFilled($('address'));
      saveDraft();
    }
  } catch (_) { /* геокодер может молчать — адрес необязателен */ }
}, 700);

function flyTo(lat, lng, zoom = 17) {
  setPoint(lat, lng);
  if (ymap) ymap.setCenter([lat, lng], zoom, { duration: 240 });
}

let geoSeq = 0;

async function seekPlace() {
  const q = $('geo-q').value.trim();
  if (q.length < 2) { $('geo-list').hidden = true; return; }
  const seq = ++geoSeq;
  $('geo-spin').hidden = false;
  try {
    const r = await fetch(`/api/geo?q=${encodeURIComponent(q)}&lang=${LANG}`);
    const j = await r.json();
    if (seq !== geoSeq) return;
    showGeo(j.results || []);
  } catch (_) {
    if (seq === geoSeq) toast(t('eNet'), 'err');
  } finally {
    if (seq === geoSeq) $('geo-spin').hidden = true;
  }
}

const seekPlaceSoon = debounce(seekPlace, 500);

function showGeo(list) {
  const box = $('geo-list');
  box.innerHTML = '';
  if (!list.length) {
    box.appendChild(h('p', { class: 'geo-empty' }, t('eNoFound')));
    box.hidden = false;
    return;
  }
  list.forEach((r, i) => {
    const item = h('button', { type: 'button', class: 'geo-item' },
      h('b', {}, r.name || r.desc), r.desc ? h('span', {}, r.desc) : null);
    item.addEventListener('click', () => {
      haptic.tap();
      flyTo(r.lat, r.lng);
      $('address').value = (r.name || r.desc || '').slice(0, 140);
      $('address').dataset.manual = '1';
      markFilled($('address'));
      box.hidden = true;
      saveDraft();
      autoAdvance(530);
    });
    box.appendChild(item);
  });
  box.hidden = false;
}


/* ════ 04 · Музыка ════ */

const player = new Audio();
let playingUrl = null;
let tracksLoaded = false;
let lastList = [];

async function loadTracks(q) {
  if (!q && tracksLoaded) return;
  const box = $('track-scroll');
  box.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    box.appendChild(h('div', { class: 'trk' }, h('div', { class: 'trk-play' }), h('div', { class: 'trk-info' }, h('b', {}, '···'))));
  }
  try {
    const r = await fetch(`/api/music${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    const j = await r.json();
    const top = !q ? (state.config?.topTracks || []) : [];
    const seen = new Set(top.map((x) => x.url));
    renderTracks([...top, ...(j.tracks || []).filter((x) => !seen.has(x.url))]);
    if (!q) tracksLoaded = true;
  } catch (_) {
    box.innerHTML = '';
    box.appendChild(h('p', { class: 'empty' }, t('eNet')));
  }
}

function renderTracks(list) {
  lastList = list;
  const box = $('track-scroll');
  box.innerHTML = '';
  if (!list.length) { box.appendChild(h('p', { class: 'empty' }, '—')); return; }
  list.forEach((track, i) => {
    const chosen = state.music?.playUrl === track.url;
    const play = h('button', { type: 'button', class: `trk-play${playingUrl === track.url ? ' playing' : ''}`, 'aria-label': 'Play' },
      playingUrl === track.url ? '❚❚' : '▶');
    const pick = h('button', { type: 'button', class: 'trk-pick' }, chosen ? t('taken') : t('take'));
    const row = h('div', { class: `trk${chosen ? ' chosen' : ''}`, dataset: { url: track.url } },
      play,
      h('div', { class: 'trk-info' }, h('b', {}, track.name), h('span', {}, track.artist || '')),
      track.uses ? h('span', { class: 'trk-hot' }, `×${track.uses}`) : null,
      pick);
    play.addEventListener('click', () => togglePlay(track.url));
    pick.addEventListener('click', () => setMusic({
      type: 'itunes',
      value: { name: track.name, artist: track.artist || '', url: track.url },
      name: track.name, artist: track.artist || '', playUrl: track.url,
    }));
    box.appendChild(row);
  });
}

function togglePlay(url) {
  haptic.tap();
  if (playingUrl === url) { player.pause(); playingUrl = null; refreshPlayUI(); return; }
  player.src = url;
  player.currentTime = 0;
  player.play().then(() => { playingUrl = url; refreshPlayUI(); }).catch(() => toast(t('eNet'), 'err'));
}
player.addEventListener('ended', () => { playingUrl = null; refreshPlayUI(); });

function refreshPlayUI() {
  for (const row of document.querySelectorAll('#track-scroll .trk')) {
    const b = row.querySelector('.trk-play');
    if (!b) continue;
    const now = row.dataset.url === playingUrl;
    b.classList.toggle('playing', now);
    b.textContent = now ? '❚❚' : '▶';
  }
}

/* Выбрал трек — прослушивание останавливается, каталог сворачивается.
   Бесконечный список больше не нужно пролистывать, чтобы идти дальше. */
function setMusic(music) {
  state.music = music;
  haptic.ok();
  player.pause();
  playingUrl = null;
  $('picked-name').textContent = music.name;
  $('picked-artist').textContent = music.artist || '';
  $('music-pick').hidden = true;
  $('music-picked').hidden = false;
  saveDraft();
  autoAdvance(430);
}

function reopenMusic() {
  haptic.tap();
  $('music-picked').hidden = true;
  $('music-pick').hidden = false;
  renderTracks(lastList);
}

const YT_RE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/;

function addMusicLink() {
  const url = $('music-link').value.trim();
  if (!/^https?:\/\/\S+$/.test(url)) { toast(t('eLink'), 'err'); return; }
  const yt = YT_RE.test(url);
  const direct = /\.(mp3|m4a|ogg|wav)(\?|$)/i.test(url);
  if (!yt && !direct) { toast(t('eLink'), 'err'); return; }
  setMusic({
    type: yt ? 'youtube' : 'custom',
    value: url,
    name: yt ? 'YouTube' : t('myTrack'),
    artist: url.replace(/^https?:\/\//, '').slice(0, 40),
    playUrl: direct ? url : null,
  });
}

async function uploadMusicFile(file) {
  if (file.size > 16 * 1024 * 1024) { toast(t('eBig'), 'err'); return; }
  try {
    const r = await fetch('/api/upload', {
      method: 'POST', headers: { 'x-init-data': tg ? tg.initData : '' }, body: file,
    });
    const j = await r.json();
    if (!r.ok || !j.ok || j.kind !== 'audio') throw new Error('bad');
    setMusic({
      type: 'upload', value: j.file,
      name: file.name.slice(0, 60), artist: t('myTrack'),
      playUrl: `/uploads/${j.file}`,
    });
  } catch (_) {
    toast(t('eUpload'), 'err');
  }
}

/* ════ 05 · Шаблоны ════ */

const templates = () => state.config?.templates || [];
const rankedTemplates = () => {
  const pops = state.config?.populars || {};
  return [...templates()].sort((a, b) => (Number(pops[b.id]) || 0) - (Number(pops[a.id]) || 0) || (a.order || 0) - (b.order || 0));
};
const selectedTpl = () => templates().find((x) => x.id === state.templateId) || null;
const requiredPhotos = () => Math.max(1, selectedTpl()?.minPhotos ?? 1);
const filledPhotos = () => state.photos.filter((p) => p.name).length;

function renderTemplates() {
  const rail = $('tpl-rail');
  if (!rail) return;
  rail.innerHTML = '';
  const pops = state.config?.populars || {};
  const ordered = rankedTemplates();
  const bestPopularity = Math.max(0, ...ordered.map((tpl) => Number(pops[tpl.id]) || 0));
  for (const tpl of ordered) {
    const colors = tpl.colors?.length ? tpl.colors : ['#191713', '#C8AA6A', '#65776E'];
    const bands = h('div', { class: 'tpl-bands' });
    bands.style.background =
      `linear-gradient(160deg, ${colors[0]} 0%, ${colors[1] || colors[0]} 52%, ${colors[2] || colors[1] || colors[0]} 100%)`;

    const demoQuery = new URLSearchParams({ groom: $('groom').value.trim(), bride: $('bride').value.trim(), lang: LANG, card: '1' });
    const live = h('iframe', {
      class: 'tpl-live', src: `/demo/${tpl.id}?${demoQuery}`, title: `${tpl.name} ${t('live')}`,
      loading: 'lazy', tabindex: '-1', 'aria-hidden': 'true',
    });
    const isPopular = bestPopularity > 0 && (Number(pops[tpl.id]) || 0) === bestPopularity;
    const card = h('div', { class: `tpl${tpl.id === state.templateId ? ' chosen' : ''}`, dataset: { id: tpl.id } },
      h('div', { class: 'tpl-art' },
        bands,
        live,
        h('div', { class: 'tpl-veil' }),
        h('span', { class: 'tpl-live-badge' }, t('live')),
        isPopular ? h('span', { class: 'tpl-popular' }, t('popular')) : null,
        h('div', { class: 'tpl-meta' },
          h('h4', {}, tpl.name),
          h('p', {}, money(tpl.price)),
          h('span', { class: 'tpl-need' },
            `${tpl.minPhotos} 📷${pops[tpl.id] ? ` · ×${pops[tpl.id]}` : ''}`))),
      h('div', { class: 'tpl-acts' },
        h('button', { type: 'button', class: 'tpl-demo' }, t('demo')),
        h('button', { type: 'button', class: 'tpl-take' }, tpl.id === state.templateId ? t('taken') : t('take'))));

    card.addEventListener('click', (event) => {
      if (event.target.closest('.tpl-demo')) { openDemo(tpl); return; }
      takeTpl(tpl);
    });
    rail.appendChild(card);
  }
  renderDots();
}

function renderDots() {
  const box = $('tpl-dots');
  box.innerHTML = '';
  rankedTemplates().forEach((tpl) => box.appendChild(h('i', { class: tpl.id === state.templateId ? 'on' : '' })));
}

function openDemo(tpl) {
  haptic.tap();
  const q = new URLSearchParams({ groom: $('groom').value.trim(), bride: $('bride').value.trim(), lang: LANG });
  $('sheet-title').textContent = tpl.name;
  sheet.open({ src: `/demo/${tpl.id}?${q}`, actionLabel: t('take'), onAction: () => takeTpl(tpl) });
}

function takeTpl(tpl) {
  state.templateId = tpl.id;
  const need = Math.max(1, tpl.minPhotos || 1);
  if (state.photos.length > need) state.photos = state.photos.slice(0, need);
  haptic.ok();
  clearErr(4);
  state.previewHtml = '';
  state.seenInvite = false;
  saveDraft();
  document.querySelectorAll('.tpl').forEach((card) => {
    const chosen = card.dataset.id === tpl.id;
    card.classList.toggle('chosen', chosen);
    const button = card.querySelector('.tpl-take');
    if (button) button.textContent = chosen ? t('taken') : t('take');
  });
  renderDots();
  renderPhotos();
  softScrollRailTo(document.querySelector(`.tpl[data-id="${tpl.id}"]`));
  autoAdvance(720);
}

/* ════ 06 · Фото: ровно столько, сколько просит шаблон ════ */

function renderPhotos() {
  const grid = $('photo-grid');
  if (!grid) return;
  const need = requiredPhotos();
  const tpl = selectedTpl();
  $('photo-lead').innerHTML = t('photoNeed', need) + (tpl ? ` · ${tpl.name}` : '');

  grid.innerHTML = '';
  const slots = need;
  grid.dataset.count = String(slots);

  for (let i = 0; i < slots; i++) {
    const p = state.photos[i];
    if (p) {
      const cell = h('div', { class: 'ph' },
        p.url ? h('img', { src: p.url, alt: '' }) : null,
        p.uploading ? h('div', { class: 'ph-wait' }, h('i', {})) : null,
        h('button', { type: 'button', class: 'ph-del', 'aria-label': 'Remove' }, '✕'));
      cell.querySelector('.ph-del').addEventListener('click', () => {
        state.photos.splice(i, 1);
        haptic.tap();
        state.previewHtml = '';
        renderPhotos();
        saveDraft();
      });
      grid.appendChild(cell);
    } else {
      const required = i < need;
      const add = h('button', { type: 'button', class: `ph ph-add${required ? ' need' : ''}` },
        h('span', {}, '+'),
        h('em', {}, t('photoOf', i + 1, need)));
      add.addEventListener('click', () => $('photo-input').click());
      grid.appendChild(add);
    }
  }
}

async function uploadPhotos(files) {
  const max = requiredPhotos();
  for (const file of files) {
    if (state.photos.length >= max) break;
    if (file.size > 16 * 1024 * 1024) { toast(t('eBig'), 'err'); continue; }
    const slot = { name: null, url: URL.createObjectURL(file), uploading: true };
    state.photos.push(slot);
    renderPhotos();
    try {
      const r = await fetch('/api/upload', {
        method: 'POST', headers: { 'x-init-data': tg ? tg.initData : '' }, body: file,
      });
      const j = await r.json();
      if (!r.ok || !j.ok || j.kind !== 'image') throw new Error('bad');
      slot.name = j.file;
      slot.uploading = false;
    } catch (_) {
      state.photos = state.photos.filter((p) => p !== slot);
      toast(t('eUpload'), 'err');
    }
    renderPhotos();
    saveDraft();
  }
  state.previewHtml = '';
  const left = requiredPhotos() - filledPhotos();
  if (left > 0) showErr(5, t('ePhoto_', left));
  else { clearErr(5); autoAdvance(385); }
}

/* ════ 07 · Всё готово → полное демо ════ */

function renderReady() {
  const couple = `${$('groom').value.trim()} & ${$('bride').value.trim()}`;
  $('ready-couple').textContent = couple;
  const tpl = selectedTpl();
  const parts = [];
  if (state.dateIso) {
    const [y, m, d] = state.dateIso.split('-').map(Number);
    parts.push(`${d} ${t('months')[m - 1]} ${y} · ${state.time}`);
  }
  if (tpl) parts.push(tpl.name);
  $('ready-meta').textContent = parts.join('  ·  ');
}

async function loadPreview() {
  if (state.previewHtml) return true;
  try {
    const r = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg ? tg.initData : '', form: collectForm() }),
    });
    const j = await r.json();
    if (!r.ok || !j.ok) {
      if (j.step) jumpTo(j.step, j.error); else toast(j.error || t('eNet'), 'err');
      return false;
    }
    state.previewHtml = j.html;
    return true;
  } catch (_) {
    toast(t('eNet'), 'err');
    return false;
  }
}

let previewOpening = false;
let closingInvite = false;

async function openInvite({ auto = false } = {}) {
  if (previewOpening || !$('sheet').hidden) return;
  previewOpening = true;
  const btn = $('ready-open');
  btn.classList.add('btn--wait');
  const ok = await loadPreview();
  btn.classList.remove('btn--wait');
  previewOpening = false;
  if (!ok) return;

  $('sheet-title').textContent = t('tReady');
  sheet.open({ srcdoc: state.previewHtml });

  // Полное приглашение само раскрывает конверт. Долистал до конца — сначала
  // мягко гасим сцену, затем возвращаемся в Studio к следующему блоку.
  const frame = $('sheet-frame');
  frame.onload = () => {
    const w = frame.contentWindow;
    const d = frame.contentDocument;
    if (!w || !d) return;
    setTimeout(() => d.getElementById('env')?.click(), auto ? 250 : 325);
    const onScroll = () => {
      const el = d.scrollingElement || d.documentElement;
      if (el.scrollTop + w.innerHeight >= el.scrollHeight - 60) {
        w.removeEventListener('scroll', onScroll);
        finishInvite();
      }
    };
    w.addEventListener('scroll', onScroll, { passive: true });
  };
}

async function finishInvite() {
  if (closingInvite) return;
  closingInvite = true;
  const firstCompletion = !state.seenInvite;
  state.seenInvite = true;
  saveDraft();
  $('sheet').classList.add('finishing');
  await new Promise((resolve) => setTimeout(resolve, 700));
  await sheet.close({ gentle: true });
  closingInvite = false;
  if (firstCompletion && state.open === stepIdx('ready')) unlock(stepIdx('guests'));
}

/* ════ 08 · Гости ════ */

const guestPrice = () => state.config?.guestPrice ?? 10000;
const cleanGuests = () => (state.guestsOn ? state.guests.map((g) => g.trim()).filter(Boolean) : []);

/* Кнопки «добавить» нет: в конце списка всегда ждёт пустое поле.
   Начал печатать — снизу сразу появляется следующее. Пустые не считаются. */
function renderGuests(focusIdx = -1) {
  const sw = $('guests-toggle');
  sw.setAttribute('aria-checked', String(state.guestsOn));
  $('personal-motion')?.classList.toggle('is-on', state.guestsOn);
  $('guests-sw-sub').textContent = state.guestsOn ? t('guestsSwOn') : t('guestsSwOff');
  $('guests-body').hidden = !state.guestsOn;

  if (state.guests.length === 0 || state.guests[state.guests.length - 1].trim()) state.guests.push('');

  const list = $('guest-list');
  list.innerHTML = '';
  const max = state.config?.maxGuests ?? 100;

  state.guests.forEach((name, i) => {
    const blank = !name.trim();
    const input = h('input', {
      id: `guest-${i}`, type: 'text', maxlength: '50', value: name,
      'aria-label': `${t('guestPh')} ${i + 1}`,
      placeholder: i === state.guests.length - 1 ? t('guestPh') : '—',
    });
    input.addEventListener('input', () => {
      const wasBlank = !state.guests[i].trim();
      state.guests[i] = input.value;
      clearErr(7);
      updateTally();
      updateBill();
      saveDraft();
      // первое слово в последнем поле — открываем следующее, не теряя фокуса
      if (wasBlank && input.value.trim() && i === state.guests.length - 1 && state.guests.length < max) {
        const caret = input.selectionStart ?? input.value.length;
        state.guests.push('');
        renderGuests();
        const resumed = list.children[i]?.querySelector('input');
        resumed?.focus({ preventScroll: true });
        resumed?.setSelectionRange(caret, caret);
        return;
      }
      row.classList.toggle('gst--blank', !input.value.trim());
    });
    input.addEventListener('blur', () => {
      // убираем опустевшие поля из середины списка
      if (input.value.trim() || i === state.guests.length - 1) return;
      state.guests.splice(i, 1);
      renderGuests();
      updateBill();
      saveDraft();
    });
    const row = h('div', { class: `gst${blank ? ' gst--blank' : ''}` },
      h('span', { class: 'gst-n' }, blank ? '·' : String(i + 1)),
      input);
    list.appendChild(row);
  });

  if (focusIdx >= 0) list.children[focusIdx]?.querySelector('input')?.focus();
  updateTally();
}

function updateTally() {
  const n = cleanGuests().length;
  $('guest-n').textContent = String(n);
  $('guest-sum').textContent = money(n * guestPrice());
}

/* ════ 09 · Счёт, контакты, отправка ════ */

function updateBill() {
  const tpl = selectedTpl();
  const box = $('bill-lines');
  box.innerHTML = '';
  const line = (k, v) => box.appendChild(h('div', { class: 'bill-line' }, h('span', {}, k), h('span', {}, v)));

  line(t('tNames'), `${$('groom').value.trim()} & ${$('bride').value.trim()}`);
  if (state.dateIso) {
    const [y, m, d] = state.dateIso.split('-').map(Number);
    line(t('tDate'), `${d} ${t('months')[m - 1]} ${y} · ${state.time}`);
  }
  if ($('address').value.trim()) line(t('tVenue'), $('address').value.trim());
  if (state.music) line(t('tMusic'), state.music.name.slice(0, 32));
  if (tpl) line(t('tTpl'), `${tpl.name} · ${money(tpl.price)}`);

  let total = tpl ? tpl.price : 0;
  const n = cleanGuests().length;
  if (n) {
    total += n * guestPrice();
    line(t('tGuests'), `${n} × ${money(guestPrice())}`);
  }
  $('bill-total').textContent = money(total);
}

function jumpTo(stepId, msg) {
  const map = { review: 'contact' };
  const i = stepIdx(map[stepId] || stepId);
  if (i < 0) { if (msg) toast(msg, 'err'); return; }
  if (msg) showErr(i, msg);
  scrollToBlock(i);
}

function contactsFilled() {
  return [$('contact-tg').value.trim().replace(/^@/, ''), $('phone').value.trim(), $('phone2').value.trim()]
    .filter(Boolean).length;
}

function collectForm() {
  return {
    lang: LANG,
    groomName: $('groom').value.trim(),
    brideName: $('bride').value.trim(),
    weddingDate: state.dateIso,
    weddingTime: state.time,
    lat: state.lat,
    lng: state.lng,
    address: $('address').value.trim(),
    photos: state.photos.filter((p) => p.name).slice(0, requiredPhotos()).map((p) => p.name),
    musicType: state.music?.type ?? 'none',
    musicValue: state.music?.value ?? null,
    musicStart: null,
    musicEnd: null,
    templateId: state.templateId,
    guestNames: cleanGuests(),
    contactTg: $('contact-tg').value.trim(),
    phone: $('phone').value.trim(),
    phone2: $('phone2').value.trim(),
  };
}

async function submit() {
  if (state.sending) return;
  if (contactsFilled() < 2) { showErr(8, t('eContact_')); return; }
  clearErr(8);
  state.sending = true;
  const btn = $('submit');
  btn.classList.add('btn--wait');
  btn.disabled = true;
  try {
    const r = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg ? tg.initData : '', form: collectForm() }),
    });
    const j = await r.json();
    if (!r.ok || !j.ok) {
      if (j.step) jumpTo(j.step, j.error); else toast(j.error || t('eNet'), 'err');
      return;
    }
    clearDraft();
    haptic.ok();
    sparks();
    $('done').hidden = false;
    try { tg?.BackButton?.hide(); } catch (_) { /* — */ }
  } catch (_) {
    toast(t('eNet'), 'err');
  } finally {
    state.sending = false;
    btn.classList.remove('btn--wait');
    btn.disabled = false;
  }
}

function sparks() {
  fill($('sparks'), 'spark', 20, 5, 5);
}

function fill(root, cls, n, base, spread) {
  if (!root) return;
  root.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const el = h('i', { class: cls });
    el.style.setProperty('--x', `${Math.random() * 100}%`);
    el.style.setProperty('--d', `${(Math.random() * spread).toFixed(2)}s`);
    el.style.setProperty('--t', `${(base + Math.random() * spread).toFixed(2)}s`);
    el.style.setProperty('--s', (0.6 + Math.random() * 0.9).toFixed(2));
    root.appendChild(el);
  }
}

/* ════ Мои приглашения ════ */

async function loadMine() {
  const box = $('mine-list');
  box.innerHTML = '';
  box.appendChild(h('p', { class: 'empty' }, '···'));
  try {
    const r = await fetch('/api/my', { headers: { 'x-init-data': tg ? tg.initData : '' } });
    const j = await r.json();
    box.innerHTML = '';
    if (!j.ok || !j.apps.length) { box.appendChild(h('p', { class: 'empty' }, '—')); return; }
    for (const a of j.apps) {
      const card = h('div', { class: 'inv' },
        h('h4', {}, `${a.groom} & ${a.bride}`),
        h('p', { class: 'inv-meta' }, `${a.date} · ${a.time} · ${money(a.total)}`),
        h('span', { class: `inv-tag ${a.status}` }, a.status),
        a.url ? h('div', { class: 'inv-link' }, a.url) : null);
      if (a.url) {
        card.querySelector('.inv-link').addEventListener('click', () => {
          navigator.clipboard?.writeText(a.url);
          toast(t('copied'), 'ok');
        });
      }
      box.appendChild(card);
    }
  } catch (_) {
    box.innerHTML = '';
    box.appendChild(h('p', { class: 'empty' }, t('eNet')));
  }
}

/* ════ События ════ */

function wire() {
  $('lang-uz').addEventListener('click', () => bootLang('uz'));
  $('lang-ru').addEventListener('click', () => bootLang('ru'));
  $('sw-uz').addEventListener('click', () => setLang('uz'));
  $('sw-ru').addEventListener('click', () => setLang('ru'));
  $('brand').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  $('btn-mine').addEventListener('click', () => { $('mine').hidden = false; loadMine(); });
  $('mine-close').addEventListener('click', () => { $('mine').hidden = true; });

  for (const id of ['groom', 'bride']) {
    $(id).addEventListener('input', () => {
      paintPlate();
      markFilled($(id));
      clearErr(0);
      saveDraft();
      autoAdvance(720);
    });
  }

  $('cal-prev').addEventListener('click', () => { calView.setMonth(calView.getMonth() - 1); haptic.tap(); renderCalendar(); });
  $('cal-next').addEventListener('click', () => { calView.setMonth(calView.getMonth() + 1); haptic.tap(); renderCalendar(); });

  $('geo-q').addEventListener('input', seekPlaceSoon);
  $('geo-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); seekPlace(); } });
  $('map-in').addEventListener('click', () => ymap?.setZoom(ymap.getZoom() + 1, { duration: 105 }));
  $('map-out').addEventListener('click', () => ymap?.setZoom(ymap.getZoom() - 1, { duration: 105 }));
  $('address').addEventListener('input', () => {
    $('address').dataset.manual = '1';
    markFilled($('address'));
    saveDraft();
  });

  document.querySelectorAll('.seg').forEach((b, i) => {
    b.addEventListener('click', () => {
      haptic.tap();
      document.querySelectorAll('.seg').forEach((x) => x.classList.toggle('is-on', x === b));
      document.querySelector('.segs').classList.toggle('at-1', i === 1);
      $('ms-top').hidden = i !== 0;
      $('ms-mine').hidden = i !== 1;
    });
  });
  $('music-q').addEventListener('input', debounce((e) => loadTracks(e.target.value.trim()), 450));
  $('music-link-go').addEventListener('click', addMusicLink);
  $('music-link').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addMusicLink(); } });
  $('music-upload').addEventListener('click', () => $('music-file').click());
  $('music-file').addEventListener('change', (e) => {
    if (e.target.files[0]) uploadMusicFile(e.target.files[0]);
    e.target.value = '';
  });
  $('music-change').addEventListener('click', reopenMusic);
  $('music-skip').addEventListener('click', () => {
    state.music = null;
    player.pause();
    playingUrl = null;
    $('music-picked').hidden = true;
    haptic.tap();
    saveDraft();
    if (state.open === stepIdx('music')) autoAdvance(720);
  });

  $('tpl-rail').addEventListener('scroll', debounce(() => {
    const rail = $('tpl-rail');
    const mid = rail.scrollLeft + rail.clientWidth / 2;
    const cards = [...rail.children];
    if (!cards.length) return;
    let near = 0;
    cards.forEach((c, i) => {
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
      const best = Math.abs(cards[near].offsetLeft + cards[near].offsetWidth / 2 - mid);
      if (d < best) near = i;
    });
    [...$('tpl-dots').children].forEach((d, i) => d.classList.toggle('on', i === near));
  }, 90));

  $('photo-input').addEventListener('change', (e) => {
    uploadPhotos([...e.target.files]);
    e.target.value = '';
  });

  $('ready-open').addEventListener('click', () => openInvite());

  $('guests-toggle').addEventListener('click', () => {
    state.guestsOn = !state.guestsOn;
    if (state.guestsOn && !state.guests.length) state.guests = [''];
    haptic.tap();
    renderGuests();
    updateBill();
    saveDraft();
  });

  for (const id of ['contact-tg', 'phone', 'phone2']) {
    $(id).addEventListener('input', () => { markFilled($(id)); clearErr(8); saveDraft(); });
  }
  $('submit').addEventListener('click', submit);

  $('sheet-close').addEventListener('click', () => sheet.close());
  $('done-mine').addEventListener('click', () => { $('done').hidden = true; $('mine').hidden = false; loadMine(); });
  $('done-new').addEventListener('click', () => location.reload());

  // Свет сцены медленно едет вниз вместе со скроллом.
  if (tg) {
    tg.BackButton?.onClick(() => {
      if (!$('sheet').hidden) { sheet.close(); return; }
      if (!$('mine').hidden) { $('mine').hidden = true; return; }
      tg.close();
    });
  }
}

/* ════ Старт ════ */

async function loadConfig() {
  try {
    const r = await fetch('/api/config');
    state.config = await r.json();
  } catch (_) {
    state.config = { templates: [], guestPrice: 10000, maxGuests: 100, maxPhotos: 6, topTracks: [], populars: {} };
  }
}

function bootLang(lang) {
  setLang(lang);
  $('lang-screen').classList.add('out');
  setTimeout(() => { $('lang-screen').style.display = 'none'; }, 910);
  $('app').hidden = false;
  start();
}

let started = false;
async function start() {
  if (started) return;
  started = true;
  await loadConfig();
  restoreDraft();
  state.open = 0;
  if (state.templateId && state.photos.length > requiredPhotos()) state.photos = state.photos.slice(0, requiredPhotos());
  setScene(state.open, true);
  applyI18n();
  paintPlate();
  for (const id of ['groom', 'bride', 'address', 'contact-tg', 'phone', 'phone2']) markFilled($(id));
  if (state.music) {
    $('picked-name').textContent = state.music.name;
    $('picked-artist').textContent = state.music.artist || '';
    $('music-pick').hidden = true;
    $('music-picked').hidden = false;
  }
  renderBlocks();
  updateBill();
  for (let i = 0; i <= state.open; i++) onEnterStep(i);
}

wire();
