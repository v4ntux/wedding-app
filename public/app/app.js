/* global ymaps, UI */
/* nvate studio — одна вертикальная нить. Кнопки «продолжить» нет: как только блок
   заполнен верно, следующий сам медленно проявляется и подъезжает к экрану.
   Секции: состояние · словарь · нить и док · блоки · демо · отправка · старт. */
'use strict';

const { $, h, debounce, toast, sheet, haptic, tg } = UI;

if (tg) { tg.ready(); tg.expand(); try { tg.setHeaderColor('#100b03'); } catch (_) { /* старый клиент */ } }

/* ════ Состояние ════ */

const state = {
  config: null,
  open: 0,              // последний раскрытый блок — он же активный шаг
  dateIso: null,
  time: '17:00',
  timeConfirmed: false,
  lat: null,
  lng: null,
  mapOn: false,
  templateId: null,
  photos: [],           // { name, url, uploading }
  music: null,          // { type, value, name, artist, playUrl }
  musicStart: 0,        // секунды: откуда играет отрывок
  musicEnd: null,       // секунды: где смолкает (null — до конца трека)
  guestsOn: false,
  guests: [],
  previewHtml: '',
  seenInvite: false,
  sending: false,
  submissionKey: null,   // ключ идемпотентности заявки, живёт вместе с черновиком
};

const DRAFT = 'nv_draft_v4';

const saveDraft = debounce(() => {
  try {
    localStorage.setItem(DRAFT, JSON.stringify({
      v: 5,
      groom: $('groom').value, bride: $('bride').value,
      dateIso: state.dateIso, time: state.time, timeConfirmed: state.timeConfirmed,
      lat: state.lat, lng: state.lng, mapOn: state.mapOn, address: $('address').value,
      templateId: state.templateId,
      photos: state.photos.filter((p) => p.name).map((p) => p.name),
      music: state.music, musicStart: state.musicStart, musicEnd: state.musicEnd,
      guestsOn: state.guestsOn, guests: state.guests,
      contactTg: $('contact-tg').value, phone: $('phone').value, phone2: $('phone2').value,
      open: state.open, seenInvite: state.seenInvite,
      submissionKey: state.submissionKey,
    }));
  } catch (_) { /* переполненное хранилище не критично */ }
}, 400);

function clearDraft() { try { localStorage.removeItem(DRAFT); } catch (_) { /* — */ } }

function restoreDraft() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch (_) { return false; }
  if (!d || ![4, 5].includes(d.v)) return false;
  if (!d.groom && !d.bride && !d.templateId) return false;
  $('groom').value = d.groom || '';
  $('bride').value = d.bride || '';
  $('address').value = d.address || '';
  $('contact-tg').value = d.contactTg || '';
  $('phone').value = d.phone || '';
  $('phone2').value = d.phone2 || '';
  state.dateIso = d.dateIso || null;
  state.time = /^(1[5-9]|2[0-2]):(00|15|30|45)$/.test(d.time) ? d.time : '17:00';
  state.timeConfirmed = Boolean(d.timeConfirmed);
  state.lat = Number.isFinite(d.lat) ? d.lat : null;
  state.lng = Number.isFinite(d.lng) ? d.lng : null;
  state.mapOn = d.v >= 5 ? Boolean(d.mapOn) : false;
  state.templateId = d.templateId || null;
  state.submissionKey = typeof d.submissionKey === 'string' ? d.submissionKey : null;
  state.photos = (d.photos || []).map((name) => ({ name, url: '/uploads/' + name, uploading: false }));
  state.music = d.music || null;
  state.musicStart = Number.isFinite(d.musicStart) ? d.musicStart : 0;
  state.musicEnd = Number.isFinite(d.musicEnd) ? d.musicEnd : null;
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
    timePrompt: 'Vaqt barabanini suring — tanlangan vaqt shu yerda paydo bo‘ladi.',
    eVenue: 'Qayerda', tVenue: 'To‘yxona', address: 'To‘yxona nomi',
    seekLbl: 'Xaritada joyni qidirish', seekPlace: 'Masalan: Mang‘it to‘yxona',
    mapHint: 'Nuqtani aniqlashtirish uchun xaritada bosing',
    mapHintFallback: 'Joyni yuqoridan qidiring va natijani tanlang — Yandex xarita shu nuqtani ko‘rsatadi.',
    linkLbl: 'Musiqa havolasi',
    mapSwTitle: 'Jonli xarita qo‘shish', mapSwOff: 'Shart emas', mapSwOn: 'Xarita yoqilgan',
    change: 'O‘zgartirish',
    guestPh: 'Ism yozing…',
    eMusic: 'Ovoz', tMusic: 'Musiqa', msTop: 'Mashhur', msMine: 'Mening musiqam',
    seekMusic: 'Qo‘shiq yoki ijrochi', musicSkip: 'Musiqasiz davom etish',
    add: 'Qo‘shish', uploadMusic: 'Fayl yuklash', lookDone: 'Ko‘rib chiqdim',
    linkHint: 'YouTube havolasi yoki to‘g‘ridan-to‘g‘ri mp3 havolasi.',
    linkPh: 'https://…',
    trimTitle: 'Qaysi parcha yangraydi', trimHint: 'boshlanish va tugashni suring',
    trimFromAria: 'Parcha boshlanishi', trimToAria: 'Parcha tugashi',
    trimStopAria: 'Eshitishni to‘xtatish',
    eTpl: 'Dizayn', tTpl: 'Taklifnoma uslubi',
    leadTpl: 'Tanlash uchun uslubga bosing. Burchakdagi ko‘zcha to‘liq namunani ochadi.',
    tplPhotos: (n) => `${n} ta surat`,
    ePhotos: 'Suratlar', tPhotos: 'Sizning suratlaringiz',
    eReady: 'Tayyor', tReady: 'Hammasi tayyor',
    leadReady: 'Taklifnomangiz yig‘ildi. Uni to‘liq ko‘rib chiqing.',
    seeInvite: 'Qayta ko‘rish',
    readyHint: 'Namuna o‘zi ochiladi. Oxirigacha suring — u sokin yopilib, studiyaga qaytaradi.',
    readyNext: 'Davom etish →',
    eGuests: 'Qo‘shimcha', tGuests: 'Ismli taklifnomalar',
    guestsSwTitle: 'Har bir mehmonga alohida havola',
    guestsSwOff: 'O‘chirilgan', guestsSwOn: 'Yoqilgan',
    personalPreview: 'Shaxsiy taklif', personalGuest: 'Hurmatli Aziz aka',
    personalTagline: 'Har bir mehmon uchun — shaxsiy taklifnoma.',
    guestAdd: 'Ism qo‘shish', guestsUnit: 'ta ism',
    wmTitle: 'Namuna himoyalangan',
    wmText: 'Ustidagi «nVate» to‘ri va nusxa olish cheklovi faqat namunada. To‘lovdan so‘ng to‘r olib tashlanadi va sizga toza havola beriladi.',
    total: 'Jami',
    eContact: 'Aloqa', tContact: 'Siz bilan qanday bog‘lanamiz',
    leadContact: 'To‘lovni tasdiqlash uchun kamida 2 ta maydonni to‘ldiring.',
    tgLbl: 'Telegram username', phoneLbl: 'Telefon raqam', phone2Lbl: 'Qo‘shimcha aloqa',
    contactRule: 'Username yoki raqam — ikkitasi yetarli.',
    mineTitle: 'Mening taklifnomalarim',
    mineAria: 'Mening taklifnomalarimni ochish', closeAria: 'Yopish', stepsAria: 'Studio bosqichlari',
    prevMonthAria: 'Oldingi oy', nextMonthAria: 'Keyingi oy', hoursAria: 'Soatlar', minutesAria: 'Daqiqalar',
    musicSearchAria: 'Musiqa qidirish', playAria: 'Eshitish', pauseAria: 'To‘xtatish',
    zoomInAria: 'Xaritani yaqinlashtirish', zoomOutAria: 'Xaritani uzoqlashtirish',
    photoUploadAria: 'Surat yuklash', photoRemoveAria: 'Suratni o‘chirish', previewAria: 'Taklifnoma namunasi',
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
    eVenue_: 'To‘yxona nomini yozing, xarita yoqilgan bo‘lsa nuqtani ham belgilang', eTpl_: 'Uslubni tanlang',
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
    timePrompt: 'Прокрутите барабан — выбранное время появится здесь.',
    eVenue: 'Где', tVenue: 'Место', address: 'Название тойхоны',
    seekLbl: 'Поиск места на карте', seekPlace: 'Например: тойхона в Мангите',
    mapHint: 'Нажмите на карту, чтобы уточнить точку',
    mapHintFallback: 'Найдите место выше и выберите результат — Яндекс Карты покажут эту точку.',
    linkLbl: 'Ссылка на музыку',
    mapSwTitle: 'Добавить живую карту', mapSwOff: 'Необязательно', mapSwOn: 'Карта включена',
    change: 'Изменить',
    guestPh: 'Впишите имя…',
    eMusic: 'Звук', tMusic: 'Музыка', msTop: 'Популярное', msMine: 'Моя музыка',
    seekMusic: 'Песня или исполнитель', musicSkip: 'Продолжить без музыки',
    add: 'Добавить', uploadMusic: 'Загрузить файл', lookDone: 'Посмотрел',
    linkHint: 'Ссылка на YouTube или прямая ссылка на mp3.',
    linkPh: 'https://…',
    trimTitle: 'Какой отрывок играет', trimHint: 'двигайте начало и конец',
    trimFromAria: 'Начало отрывка', trimToAria: 'Конец отрывка',
    trimStopAria: 'Остановить прослушивание',
    eTpl: 'Дизайн', tTpl: 'Стиль приглашения',
    leadTpl: 'Нажмите на стиль, чтобы выбрать. Глазок в углу открывает полный пример.',
    tplPhotos: (n) => `${n} фото`,
    ePhotos: 'Фото', tPhotos: 'Ваши фотографии',
    eReady: 'Готово', tReady: 'Всё готово',
    leadReady: 'Приглашение собрано. Посмотрите его целиком.',
    seeInvite: 'Посмотреть ещё раз',
    readyHint: 'Образец откроется сам. Долистайте до конца — он мягко закроется и вернёт вас в студию.',
    readyNext: 'Продолжить →',
    eGuests: 'Дополнительно', tGuests: 'Именные приглашения',
    guestsSwTitle: 'Персональная ссылка каждому гостю',
    guestsSwOff: 'Выключено', guestsSwOn: 'Включено',
    personalPreview: 'Личное приглашение', personalGuest: 'Дорогой Азиз',
    personalTagline: 'Каждому гостю — персональное приглашение.',
    guestAdd: 'Добавить имя', guestsUnit: 'имён',
    wmTitle: 'Образец защищён',
    wmText: 'Сетка «nVate» поверх и запрет копирования — только в образце. После оплаты сетка снимается, и вы получаете чистую ссылку.',
    total: 'Итого',
    eContact: 'Контакты', tContact: 'Как с вами связаться',
    leadContact: 'Для подтверждения оплаты заполните минимум 2 поля.',
    tgLbl: 'Telegram username', phoneLbl: 'Номер телефона', phone2Lbl: 'Запасной контакт',
    contactRule: 'Username или номер — достаточно двух.',
    mineTitle: 'Мои приглашения',
    mineAria: 'Открыть мои приглашения', closeAria: 'Закрыть', stepsAria: 'Этапы студии',
    prevMonthAria: 'Предыдущий месяц', nextMonthAria: 'Следующий месяц', hoursAria: 'Часы', minutesAria: 'Минуты',
    musicSearchAria: 'Поиск музыки', playAria: 'Прослушать', pauseAria: 'Пауза',
    zoomInAria: 'Приблизить карту', zoomOutAria: 'Отдалить карту',
    photoUploadAria: 'Загрузить фотографию', photoRemoveAria: 'Удалить фотографию', previewAria: 'Предпросмотр приглашения',
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
    eVenue_: 'Укажите название места; если карта включена — отметьте точку', eTpl_: 'Выберите стиль',
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
  $('btn-mine').setAttribute('aria-label', t('mineAria'));
  $('mine-close').setAttribute('aria-label', t('closeAria'));
  $('sheet-close').setAttribute('aria-label', t('closeAria'));
  $('dock').setAttribute('aria-label', t('stepsAria'));
  $('cal-prev').setAttribute('aria-label', t('prevMonthAria'));
  $('cal-next').setAttribute('aria-label', t('nextMonthAria'));
  $('hour-drum').setAttribute('aria-label', t('hoursAria'));
  $('min-drum').setAttribute('aria-label', t('minutesAria'));
  $('music-q').setAttribute('aria-label', t('musicSearchAria'));
  $('map-in').setAttribute('aria-label', t('zoomInAria'));
  $('map-out').setAttribute('aria-label', t('zoomOutAria'));
  $('photo-input').setAttribute('aria-label', t('photoUploadAria'));
  $('sheet-frame').setAttribute('title', t('previewAria'));
  $('sw-uz').classList.toggle('on', LANG === 'uz');
  $('sw-ru').classList.toggle('on', LANG === 'ru');
  document.querySelector('.langsw')?.classList.toggle('at-ru', LANG === 'ru');
  renderBeads();
  renderCalendar();
  buildClock();
  renderTemplates();
  renderPhotos();
  renderGuests();
  if (trimDuration) paintTrim();
  renderMapChoice();
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
  { id: 'location', auto: true, check: () => Boolean($('address').value.trim())
      && (!state.mapOn || (Number.isFinite(state.lat) && Number.isFinite(state.lng))) },
  { id: 'music', auto: true, check: () => true },
  { id: 'template', auto: true, check: () => Boolean(state.templateId) },
  { id: 'photos', auto: true, check: () => filledPhotos() >= requiredPhotos() },
  { id: 'ready', auto: false, check: () => state.seenInvite },
  { id: 'guests', auto: true, check: () => true },        // опциональный блок — после показа открывает контакты
  { id: 'contact', auto: false, check: () => contactsFilled() >= 2 },
];

const blk = (i) => document.querySelector(`.blk[data-step="${STEPS[i].id}"]`);
const stepIdx = (id) => STEPS.findIndex((s) => s.id === id);

/* Fill → 2s wait → slow camera to the next block's top → whole card rises. */
let revealRun = 0;
let mainScrollRun = 0;
/* Заполнил поле → полсекунды на «подумать» → камера едет к следующему блоку,
   и блок поднимается одновременно с ней. Никаких пауз между этапами. */
const FLOW = Object.freeze({
  settle: 500,
  beforeScroll: 60,
  scrollMin: 900,
  scrollMax: 1600,
  pauseAfterScroll: 0,
  reveal: 520,
  rise: 96,
  topGap: 12,
});
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ════ Клавиатура ════
   В Telegram WebApp клавиатура уходит только вместе с фокусом: пока поле
   активно, она закрывает половину экрана, и следующий блок поднимается прямо
   под неё. Поэтому фокус снимается сам — по Enter, по тапу мимо поля и перед
   каждым переездом камеры. */

const TYPING = 'input:not([type="file"]):not([type="range"]):not([type="checkbox"]):not([type="radio"]),textarea';
const typingField = (el) => (el && typeof el.matches === 'function' && el.matches(TYPING) ? el : null);

/* Одного blur() мало. В Telegram WebApp — и особенно на iOS — панель ввода
   остаётся висеть, пока система считает поле местом для набора: фокус ушёл, а
   клавиатура закрывает половину экрана. Поэтому поле на мгновение становится
   readonly: набирать в нём уже нельзя, клавиатура уходит, и признак сразу
   снимается — следующий тап по полю снова печатает как обычно. */
function dismissField(field) {
  if (!field) return;
  const wasReadOnly = field.readOnly;
  try { field.readOnly = true; } catch (_) { /* поле без readonly — обойдёмся blur() */ }
  field.blur();
  if (wasReadOnly) return;
  setTimeout(() => { try { field.readOnly = false; } catch (_) { /* — */ } }, 120);
}

function dropKeyboard() {
  dismissField(typingField(document.activeElement));
}

/* Ждём кадр отрисовки, но не дольше 120 мс: в свёрнутой вкладке кадров нет,
   и без страховки поток студии остановился бы до возвращения пользователя. */
const nextFrame = () => new Promise((resolve) => {
  let done = false;
  const finish = () => { if (done) return; done = true; resolve(); };
  requestAnimationFrame(finish);
  setTimeout(finish, 120);
});

function easeOut(k) {
  return 1 - (1 - k) * (1 - k) * (1 - k);
}

/* Свёрнутая вкладка останавливает requestAnimationFrame: без страховки поток
   студии замер бы навсегда: блок так и остался бы невидимым. Поэтому у каждой
   анимации есть таймер, который дорисовывает последний кадр и отпускает поток. */
function playMotion(duration, draw) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      draw(1);
      resolve();
    };
    const t0 = performance.now();
    const tick = (now) => {
      if (done) return;
      const k = Math.min(1, (now - t0) / duration);
      draw(k);
      if (k < 1) requestAnimationFrame(tick);
      else finish();
    };
    const guard = setTimeout(finish, duration + 600);
    requestAnimationFrame(tick);
  });
}

function armBlock(el) {
  if (!el) return;
  el.classList.add('is-wait');
  el.classList.remove('is-live', 'is-rising');
  el.style.opacity = '0';
  el.style.transform = `translate3d(0, ${FLOW.rise}px, 0)`;
  el.style.pointerEvents = 'none';
  el.setAttribute('inert', '');
  el.setAttribute('aria-hidden', 'true');
}

function restBlock(el) {
  if (!el) return;
  el.classList.remove('is-wait', 'is-rising');
  el.style.opacity = '';
  el.style.transform = '';
  el.style.pointerEvents = '';
  el.removeAttribute('inert');
  el.removeAttribute('aria-hidden');
}

function headerOffset() {
  const bar = document.getElementById('topbar');
  if (!bar) return FLOW.topGap + 72;
  return Math.ceil(bar.getBoundingClientRect().bottom) + FLOW.topGap;
}

function slotTop(el) {
  const y = window.scrollY + el.getBoundingClientRect().top;
  return el.classList.contains('is-wait') || el.classList.contains('is-rising')
    ? y - FLOW.rise
    : y;
}

/* Девять ночей: фон меняет оттенок неба от блока к блоку, а золото остаётся
   золотом — меняется лишь его температура (шампань → янтарь → мёд). */
const SCENES = [
  // 01 Имена — полночь и тёплый свет
  { rgb: '236,201,132', theme: '#05040a', bg: 'radial-gradient(120% 78% at 50% -12%,rgba(255,231,168,.3),transparent 58%),radial-gradient(80% 60% at 12% 82%,rgba(58,44,96,.34),transparent 72%),linear-gradient(178deg,#0a0812 0%,#070610 46%,#030205 100%)' },
  // 02 Дата — сапфировая ночь
  { rgb: '228,196,141', theme: '#04060f', bg: 'radial-gradient(115% 74% at 68% -10%,rgba(255,226,170,.26),transparent 56%),radial-gradient(86% 64% at 6% 74%,rgba(28,58,116,.4),transparent 72%),linear-gradient(172deg,#060b18 0%,#050813 50%,#020306 100%)' },
  // 03 Место — изумрудная ночь
  { rgb: '223,196,133', theme: '#040a09', bg: 'radial-gradient(118% 76% at 28% -12%,rgba(255,233,178,.25),transparent 56%),radial-gradient(84% 62% at 92% 74%,rgba(20,74,66,.38),transparent 72%),linear-gradient(176deg,#04110f 0%,#040c0b 50%,#020504 100%)' },
  // 04 Музыка — аметистовая ночь
  { rgb: '232,192,152', theme: '#08050f', bg: 'radial-gradient(116% 74% at 76% -8%,rgba(255,224,186,.26),transparent 55%),radial-gradient(82% 62% at 8% 78%,rgba(74,38,104,.38),transparent 71%),linear-gradient(174deg,#0d0818 0%,#080512 50%,#030206 100%)' },
  // 05 Шаблон — шампанское золото (витрина)
  { rgb: '247,216,152', theme: '#0a0703', bg: 'radial-gradient(120% 82% at 50% -14%,rgba(255,226,150,.4),transparent 56%),radial-gradient(78% 58% at 92% 78%,rgba(120,72,18,.34),transparent 70%),linear-gradient(170deg,#130d04 0%,#0a0703 52%,#030202 100%)' },
  // 06 Фотографии — тёплый графит
  { rgb: '226,197,150', theme: '#070605', bg: 'radial-gradient(114% 72% at 36% -10%,rgba(255,236,196,.24),transparent 56%),radial-gradient(80% 60% at 96% 72%,rgba(66,54,42,.4),transparent 72%),linear-gradient(175deg,#0e0c09 0%,#080706 52%,#030302 100%)' },
  // 07 Готово — кульминация, золотой рассвет над ночью
  { rgb: '252,222,157', theme: '#0b0702', bg: 'radial-gradient(124% 86% at 50% -16%,rgba(255,222,138,.5),transparent 54%),radial-gradient(76% 58% at 6% 80%,rgba(138,80,14,.32),transparent 70%),linear-gradient(168deg,#160e03 0%,#0b0702 54%,#020201 100%)' },
  // 08 Гости — тёплая роза
  { rgb: '238,197,157', theme: '#0a0407', bg: 'radial-gradient(116% 76% at 62% -10%,rgba(255,226,190,.28),transparent 56%),radial-gradient(80% 60% at 10% 76%,rgba(104,32,58,.36),transparent 71%),linear-gradient(174deg,#140710 0%,#0b040a 52%,#030203 100%)' },
  // 09 Контакты — королевский синий, финальная нота
  { rgb: '244,212,150', theme: '#03060e', bg: 'radial-gradient(120% 80% at 44% -12%,rgba(255,229,166,.3),transparent 56%),radial-gradient(84% 62% at 94% 76%,rgba(24,52,110,.42),transparent 72%),linear-gradient(172deg,#050a17 0%,#040711 52%,#020204 100%)' },
];
let sceneIndex = -1;

function setScene(i = state.open, instant = false) {
  const index = Math.max(0, Math.min(SCENES.length - 1, Number(i) || 0));
  if (index === sceneIndex && !instant) return;
  const scene = SCENES[index];
  const root = document.documentElement;
  const a = $('scene-a');
  const b = $('scene-b');
  const active = document.querySelector('.scene-wash.is-on') || a;
  const next = instant ? active : (active === a ? b : a);
  next.style.background = scene.bg;
  next.classList.toggle('is-instant', instant);
  next.classList.add('is-on');
  if (next !== active) active.classList.remove('is-on');
  const [red, green, blue] = scene.rgb.split(',').map(Number);
  if (instant) root.classList.add('scene-instant');
  root.style.setProperty('--scene-r', String(red));
  root.style.setProperty('--scene-g', String(green));
  root.style.setProperty('--scene-b', String(blue));
  requestAnimationFrame(() => {
    next.classList.remove('is-instant');
    root.classList.remove('scene-instant');
  });
  window.Sky?.setTone(red, green, blue);
  sceneIndex = index;
  document.body.dataset.scene = String(index);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', scene.theme);
  try { tg?.setHeaderColor(scene.theme); } catch (_) { /* outside Telegram */ }
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
  // Sine has a lower peak speed than smootherstep and never snaps in the middle.
  return .5 - Math.cos(Math.PI * k) / 2;
}

function cancelMainScroll() {
  mainScrollRun += 1;
}

function softScrollTo(top, duration = FLOW.scrollMax) {
  const run = ++mainScrollRun;
  const from = window.scrollY;
  const delta = top - from;
  if (Math.abs(delta) < 8) return Promise.resolve(true);
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      if (ok) window.scrollTo(0, top);
      resolve(ok);
    };
    const startedAt = performance.now();
    const frame = (now) => {
      if (done) return;
      if (run !== mainScrollRun) { finish(false); return; }
      const k = Math.min(1, (now - startedAt) / duration);
      window.scrollTo(0, from + delta * easeInOut(k));
      if (k < 1) requestAnimationFrame(frame); else finish(true);
    };
    // Та же страховка, что и в playMotion: свёрнутая вкладка не должна
    // подвешивать переход к следующему блоку.
    const guard = setTimeout(() => finish(run === mainScrollRun), duration + 600);
    requestAnimationFrame(frame);
  });
}

function scrollToBlock(i) {
  const el = blk(i);
  if (!el) return;
  dropKeyboard();
  const y = el.getBoundingClientRect().top + window.scrollY - 72;
  setScene(i);
  const distance = Math.abs(y - window.scrollY);
  const duration = Math.min(FLOW.scrollMax, Math.max(FLOW.scrollMin, 900 + distance * .9));
  softScrollTo(Math.max(0, y), duration);
}

function renderBlocks(waitIdx = -1) {
  STEPS.forEach((s, i) => {
    const el = blk(i);
    const waiting = i === waitIdx;
    if (waiting) armBlock(el);
    else {
      el.classList.remove('is-wait', 'is-rising');
      if (i !== waitIdx) {
        el.style.opacity = '';
        el.style.transform = '';
        el.style.pointerEvents = '';
      }
    }
    el.hidden = i > state.open;
    el.toggleAttribute('inert', i > state.open || waiting);
    if (i > state.open || waiting) el.setAttribute('aria-hidden', 'true');
    else el.removeAttribute('aria-hidden');
    el.classList.toggle('is-done', i < state.open);
    el.classList.toggle('is-live', i === state.open && !waiting);
  });
  renderBeads();
}

async function cameraTo(i) {
  const el = blk(i);
  if (!el) return;
  const dest = Math.max(0, slotTop(el) - headerOffset());
  const maxTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const y = Math.min(maxTop, dest);
  const distance = Math.abs(y - window.scrollY);
  if (distance <= 8) return;
  const duration = Math.min(FLOW.scrollMax, Math.max(FLOW.scrollMin, 900 + distance * .9));
  await softScrollTo(y, duration);
}

async function riseBlock(el) {
  if (!el) return;
  el.style.opacity = '0';
  el.style.transform = `translate3d(0, ${FLOW.rise}px, 0)`;
  el.style.pointerEvents = 'none';
  el.style.willChange = 'opacity, transform';
  el.classList.add('is-rising', 'is-live');
  el.classList.remove('is-wait');
  await playMotion(FLOW.reveal, (k) => {
    const riseK = easeOut(k);
    const fadeK = k < .14 ? 0 : easeOut((k - .14) / .86);
    el.style.opacity = String(fadeK);
    el.style.transform = `translate3d(0, ${(1 - riseK) * FLOW.rise}px, 0)`;
  });
  el.style.willChange = '';
  restBlock(el);
  el.classList.add('is-live');
}

function unlock(i) {
  if (i >= STEPS.length || i <= state.open) return;
  dropKeyboard();
  const run = ++revealRun;
  state.open = i;
  renderBlocks(i);
  prepareStep(i);
  saveDraft();
  (async () => {
    await wait(FLOW.beforeScroll);
    if (run !== revealRun) return;
    await nextFrame();
    if (run !== revealRun) return;
    setScene(i);
    haptic.ok();
    pulseLiveBead();
    // Камера и подъём блока идут одновременно: пара видит движение сразу,
    // а не ждёт, пока страница доедет.
    const camera = cameraTo(i);
    await riseBlock(blk(i));
    await camera;
    if (run === revealRun && state.open === i) activateStep(i);
  })();
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
  if (id === 'location') renderMapChoice();
  if (id === 'music') loadTracks();
  // Обложки собираются из имён и даты — к этому шагу они уже введены.
  if (id === 'template') renderTemplates();
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
    requestAnimationFrame(() => {
      const motion = $('personal-motion');
      if (!motion || !motion.offsetWidth) return;
      personalMotionVisible = true;
      motion.classList.add('is-visible');
      layoutPersonalMotion();
      startPersonalMotion();
    });
    autoAdvance(11800);
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
    const left = Math.max(0, live.offsetLeft - (box.clientWidth - live.offsetWidth) / 2);
    box.scrollTo({ left, behavior: 'smooth' });
  }
}

function pulseLiveBead() {
  const live = document.querySelector('.bead.live');
  if (!live) return;
  live.classList.remove('is-pulse');
  void live.offsetWidth;
  live.classList.add('is-pulse');
}

/* ════ 01 · Имена ════ */

function paintPlate() {
  const g = $('groom').value.trim();
  const b = $('bride').value.trim();
  bumpPlateName($('cp-groom'), g || t('phGroom'), !g);
  bumpPlateName($('cp-bride'), b || t('phBride'), !b);
  const plate = document.querySelector('.plate');
  if (g && b && !plate.dataset.lit) {
    plate.dataset.lit = '1';
    plate.classList.add('lit');
    setTimeout(() => plate.classList.remove('lit'), 770);
  }
  if (!g || !b) delete plate.dataset.lit;
}

function bumpPlateName(el, text, empty) {
  if (!el) return;
  const same = el.textContent === text;
  el.classList.toggle('plate-name--empty', empty);
  if (same) return;
  el.textContent = text;
  el.classList.remove('is-bump');
  void el.offsetWidth;
  el.classList.add('is-bump');
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
        paintClock();
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
  $('date-read').textContent = `${d} ${t('months')[m - 1]} ${y}${state.timeConfirmed ? ` · ${state.time}` : ''}`;
}

const HOURS = Array.from({ length: 8 }, (_, i) => String(i + 15).padStart(2, '0'));
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
  const clock = document.querySelector('.clock');
  const visible = Boolean(state.dateIso) && state.timeConfirmed;
  const [hh, mm] = state.time.split(':');
  $('clock-h').textContent = visible ? hh : '';
  $('clock-m').textContent = visible ? mm : '';
  clock?.classList.toggle('is-empty', !visible);
  clock?.setAttribute('aria-label', visible ? state.time : t('timePrompt'));
}

function bump(id) {
  const el = $(id);
  el.classList.remove('tick');
  void el.offsetWidth;
  el.classList.add('tick');
}

/* ════ 03 · Локация ════ */

const MANGIT_CENTER = [42.116169, 60.0625143];
let ymap = null;
let mark = null;
let mapAsked = false;
let mapFallback = null;

function renderMapChoice() {
  const toggle = $('map-toggle');
  const tools = $('map-tools');
  if (!toggle || !tools) return;
  toggle.setAttribute('aria-checked', String(state.mapOn));
  $('map-sw-sub').textContent = state.mapOn ? t('mapSwOn') : t('mapSwOff');
  tools.hidden = !state.mapOn;
  if (state.mapOn) {
    if (mapFallback) document.querySelector('.map-hint').textContent = t('mapHintFallback');
    ensureMap();
    requestAnimationFrame(() => ymap?.container?.fitToViewport?.());
  } else {
    $('geo-list').hidden = true;
  }
}

function toggleMap() {
  state.mapOn = !state.mapOn;
  haptic.tap();
  renderMapChoice();
  clearErr(stepIdx('location'));
  saveDraft();
  if (!state.mapOn) autoAdvance(760);
}

function ensureMap() {
  if (ymap) {
    requestAnimationFrame(() => ymap.container.fitToViewport());
    return;
  }
  if (mapAsked) return;
  mapAsked = true;
  const key = state.config?.yandexMapsKey || '';
  if (!key) {
    renderYandexWidget();
    return;
  }
  const script = document.createElement('script');
  const lang = 'ru_RU';
  script.src = `https://api-maps.yandex.ru/2.1/?lang=${lang}${key ? `&apikey=${encodeURIComponent(key)}` : ''}`;
  script.async = true;
  script.onload = () => {
    if (!window.ymaps) { mapAsked = false; toast(t('eNet'), 'err'); return; }
    window.ymaps.ready(initMap);
  };
  script.onerror = () => { mapAsked = false; toast(t('eNet'), 'err'); };
  document.head.appendChild(script);
}

function renderYandexWidget(lat = state.lat, lng = state.lng, zoom = Number.isFinite(state.lat) ? 16 : 13) {
  const point = Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : MANGIT_CENTER;
  const map = $('map');
  map.innerHTML = '';
  const marker = Number.isFinite(lat) && Number.isFinite(lng) ? `&pt=${lng},${lat},pm2rdm` : '';
  const frame = document.createElement('iframe');
  frame.className = 'yandex-widget';
  frame.title = t('seekLbl');
  frame.loading = 'lazy';
  frame.referrerPolicy = 'no-referrer-when-downgrade';
  frame.src = `https://yandex.ru/map-widget/v1/?ll=${point[1]}%2C${point[0]}&z=${zoom}&l=map${marker}`;
  map.appendChild(frame);
  mapFallback = frame;
  document.querySelector('.map-hint').textContent = t('mapHintFallback');
  $('map-in').parentElement.hidden = true;
}

function initMap() {
  if (ymap || !window.ymaps) return;
  mapFallback = null;
  $('map').innerHTML = '';
  document.querySelector('.map-hint').textContent = t('mapHint');
  $('map-in').parentElement.hidden = false;
  const c = Number.isFinite(state.lat) ? [state.lat, state.lng] : MANGIT_CENTER;
  ymap = new ymaps.Map('map', {
    center: c,
    zoom: Number.isFinite(state.lat) ? 16 : 13,
    controls: [],
  }, {
    suppressMapOpenBlock: true,
    yandexMapDisablePoiInteractivity: true,
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
  requestAnimationFrame(() => ymap?.container?.fitToViewport?.());
}

function setPoint(lat, lng) {
  state.lat = lat; state.lng = lng;
  clearErr(2);
  saveDraft();
  if (!ymap) {
    if (mapFallback) renderYandexWidget(lat, lng, 16);
    return;
  }
  if (mark) { mark.geometry.setCoordinates([lat, lng]); return; }
  mark = new ymaps.Placemark([lat, lng], {}, {
    preset: 'islands#circleIcon',
    iconColor: '#d7a83f',
    draggable: true,
  });
  ymap.geoObjects.add(mark);
  mark.events.add('dragend', () => {
    const [dlat, dlng] = mark.geometry.getCoordinates();
    state.lat = dlat; state.lng = dlng;
    saveDraft();
    reverseName(dlat, dlng);
    autoAdvance(720);
  });
}

const reverseName = debounce(async (lat, lng) => {
  if ($('address').dataset.manual === '1') return;
  try {
    const response = await fetch(`/api/geo/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&lang=${LANG}`);
    const result = await response.json();
    const name = result.name || result.address;
    if (name && !$('address').value.trim()) {
      $('address').value = String(name).slice(0, 140);
      markFilled($('address'));
      saveDraft();
      autoAdvance(760);
    }
  } catch (_) { /* геокодер может молчать — адрес необязателен */ }
}, 700);

function flyTo(lat, lng, zoom = 17) {
  setPoint(lat, lng);
  if (ymap) ymap.setCenter([lat, lng], zoom, { duration: 1200, timingFunction: 'ease-in-out' });
}

let geoSeq = 0;

function geoLocalScore(place) {
  const text = `${place.name || ''} ${place.desc || ''}`.toLowerCase();
  const named = /mang|mańǵ|amud|ámiwd/.test(text) ? 1000 : /qaraqal|karakal/.test(text) ? 350 : 0;
  const distance = Math.hypot((place.lat - MANGIT_CENTER[0]) * 111, (place.lng - MANGIT_CENTER[1]) * 82);
  return named - distance;
}

async function seekPlace() {
  const q = $('geo-q').value.trim();
  if (q.length < 2) { $('geo-list').hidden = true; return; }
  const seq = ++geoSeq;
  $('geo-spin').hidden = false;
  try {
    const response = await fetch(`/api/geo?q=${encodeURIComponent(q)}&lang=${LANG}`).then((r) => r.json());
    if (seq !== geoSeq) return;
    const seen = new Set();
    const merged = [...(response.results || [])]
      .filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng))
      .filter((place) => {
        const key = `${place.lat.toFixed(5)},${place.lng.toFixed(5)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => geoLocalScore(b) - geoLocalScore(a))
      .slice(0, 8);
    showGeo(merged);
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
let activeTrackUrl = null;
let tracksLoaded = false;
let lastList = [];

function svgIcon(kind) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const paths = kind === 'pause'
    ? ['M8 6v12', 'M16 6v12']
    : kind === 'close'
      ? ['M6 6l12 12', 'M18 6L6 18']
      : kind === 'add'
        ? ['M12 5v14', 'M5 12h14']
    : kind === 'check'
      ? ['M5 12l4 4 10-10']
      : kind === 'eye'
        ? ['M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0']
      : kind === 'image'
        ? ['M4 5h16v14H4z', 'M7 15l4-4 3 3 2-2 3 3', 'M8 9h.01']
        : ['M8 5l11 7-11 7z'];
  paths.forEach((d) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  });
  return svg;
}

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
    const previewing = activeTrackUrl === track.url;
    const play = h('button', { type: 'button', class: `trk-play${playingUrl === track.url ? ' playing' : ''}`, 'aria-label': playingUrl === track.url ? t('pauseAria') : t('playAria') },
      svgIcon(playingUrl === track.url ? 'pause' : 'play'));
    const pick = h('button', { type: 'button', class: 'trk-pick', hidden: !previewing }, chosen ? t('taken') : t('take'));
    const row = h('div', { class: `trk${chosen ? ' chosen' : ''}${previewing ? ' previewing' : ''}`, dataset: { url: track.url } },
      play,
      h('div', { class: 'trk-info' }, h('b', {}, track.name), h('span', {}, track.artist || '')),
      track.uses ? h('span', { class: 'trk-hot' }, `×${track.uses}`) : null,
      pick);
    play.addEventListener('click', (event) => { event.stopPropagation(); togglePlay(track); });
    row.addEventListener('click', (event) => {
      if (event.target.closest('.trk-pick')) return;
      togglePlay(track);
    });
    pick.addEventListener('click', () => setMusic({
      type: 'itunes',
      value: { name: track.name, artist: track.artist || '', url: track.url },
      name: track.name, artist: track.artist || '', playUrl: track.url,
    }));
    box.appendChild(row);
  });
}

function togglePlay(track) {
  const url = track.url;
  haptic.tap();
  activeTrackUrl = url;
  refreshPlayUI();
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
    const previewing = row.dataset.url === activeTrackUrl;
    b.classList.toggle('playing', now);
    b.setAttribute('aria-label', now ? t('pauseAria') : t('playAria'));
    row.classList.toggle('previewing', previewing);
    b.replaceChildren(svgIcon(now ? 'pause' : 'play'));
    const pick = row.querySelector('.trk-pick');
    if (pick) pick.hidden = !previewing;
  }
}

/* Выбрал трек — прослушивание останавливается, каталог сворачивается.
   Бесконечный список больше не нужно пролистывать, чтобы идти дальше. */
function setMusic(music) {
  state.music = music;
  state.musicStart = 0;
  state.musicEnd = null;
  haptic.ok();
  player.pause();
  playingUrl = null;
  activeTrackUrl = null;
  $('picked-name').textContent = music.name;
  $('picked-artist').textContent = music.artist || '';
  $('music-pick').hidden = true;
  $('music-picked').hidden = false;
  openTrim();
  saveDraft();
  // Пока пара подбирает отрывок, следующий блок ждёт: каждое движение ручки
  // отодвигает переход (см. holdMusicStep).
  autoAdvance(trimmable() ? 4200 : 430);
}

function reopenMusic() {
  haptic.tap();
  closeTrim();
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

/* ════ 04b · Отрывок: где начать и где закончить ════
   Ни одного поля ввода: две ручки на волне и секунды под ними. Отпустил
   ручку — оттуда и заиграло, пять секунд на проверку. Дальше музыка гаснет
   сама или раньше — по прозрачной кнопке поверх волны. */

const PREVIEW_MS = 5000;
const MIN_SPAN = 3;          // отрывок короче трёх секунд не имеет смысла
const WAVE_BARS = 96;

let trimPeaks = null;        // реальные пики трека, если файл удалось разобрать
let trimDuration = 0;
let trimDrag = null;         // 'a' | 'b' — какую ручку ведём
let previewTimer = null;
let trimToken = 0;           // отменяет ответы по уже неактуальному треку

const clockText = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const trimEnd = () => (Number.isFinite(state.musicEnd) ? state.musicEnd : trimDuration);
const trimmable = () => Boolean(state.music?.playUrl);

/* Длительность берём у самого <audio>: декодировать файл для этого не нужно. */
function audioDuration(url) {
  return new Promise((resolve) => {
    const probe = new Audio();
    probe.preload = 'metadata';
    const done = (value) => {
      probe.onloadedmetadata = null;
      probe.onerror = null;
      clearTimeout(guard);
      resolve(value);
    };
    const guard = setTimeout(() => done(0), 7000);
    probe.onloadedmetadata = () => done(Number(probe.duration));
    probe.onerror = () => done(0);
    probe.src = url;
  });
}

/* Пики строим сами из файла. Чужой домен без CORS разобрать не даст — тогда
   волны не будет вовсе: вместо неё рисуем линейку секунд, а не выдуманную
   картинку чужого трека. */
async function loadPeaks(url) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  let ctx = null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const raw = await res.arrayBuffer();
    if (raw.byteLength > 12 * 1024 * 1024) return null;   // на телефоне это уже дорого
    ctx = new Ctx();
    const decoded = await ctx.decodeAudioData(raw);
    const data = decoded.getChannelData(0);
    const per = Math.floor(data.length / WAVE_BARS) || 1;
    const peaks = new Float32Array(WAVE_BARS);
    let loudest = 0;
    for (let i = 0; i < WAVE_BARS; i += 1) {
      const from = i * per;
      let power = 0;
      let taken = 0;
      // Каждый 32-й отсчёт: на глаз разницы нет, а работы в 32 раза меньше.
      for (let j = 0; j < per; j += 32) {
        const v = data[from + j] || 0;
        power += v * v;
        taken += 1;
      }
      peaks[i] = taken ? Math.sqrt(power / taken) : 0;
      if (peaks[i] > loudest) loudest = peaks[i];
    }
    if (!loudest) return null;
    for (let i = 0; i < WAVE_BARS; i += 1) peaks[i] = Math.min(1, peaks[i] / loudest);
    return peaks;
  } catch (_) {
    return null;
  } finally {
    try { await ctx?.close(); } catch (_) { /* — */ }
  }
}

function drawTrim() {
  const canvas = $('trim-canvas');
  if (!canvas?.getContext) return;
  const w = canvas.clientWidth;
  const hgt = canvas.clientHeight;
  if (!w || !hgt) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(hgt * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, hgt);

  const from = state.musicStart || 0;
  const to = trimEnd();
  const mid = hgt / 2;
  const lit = 'rgba(241,221,176,.9)';
  const dim = 'rgba(241,221,176,.2)';

  if (trimPeaks) {
    const step = w / trimPeaks.length;
    const bar = Math.max(1.5, step - 1.6);
    for (let i = 0; i < trimPeaks.length; i += 1) {
      const at = ((i + .5) / trimPeaks.length) * trimDuration;
      const tall = Math.max(2, trimPeaks[i] * (hgt - 6));
      ctx.fillStyle = at >= from && at <= to ? lit : dim;
      ctx.fillRect(i * step + (step - bar) / 2, mid - tall / 2, bar, tall);
    }
    return;
  }

  // Линейка: тонкие штрихи по секундам, высокие — каждые пять.
  const seconds = Math.max(1, Math.round(trimDuration));
  const step = w / seconds;
  for (let s = 0; s <= seconds; s += 1) {
    const five = s % 5 === 0;
    const tall = five ? hgt * .52 : hgt * .24;
    ctx.fillStyle = s >= from && s <= to ? lit : dim;
    ctx.fillRect(Math.min(w - 1.4, s * step), mid - tall / 2, 1.4, tall);
  }
}

function paintGrip(grip, sec, label) {
  grip.setAttribute('aria-valuemin', '0');
  grip.setAttribute('aria-valuemax', String(Math.round(trimDuration)));
  grip.setAttribute('aria-valuenow', String(Math.round(sec)));
  grip.setAttribute('aria-valuetext', clockText(sec));
  grip.setAttribute('aria-label', label);
}

function paintTrim() {
  if (!trimDuration) return;
  const from = Math.max(0, Math.min(state.musicStart || 0, trimDuration - MIN_SPAN));
  const to = Math.max(from + MIN_SPAN, Math.min(trimEnd(), trimDuration));
  state.musicStart = from;
  state.musicEnd = to;
  const left = (from / trimDuration) * 100;
  const right = (to / trimDuration) * 100;

  $('trim-window').style.left = `${left}%`;
  $('trim-window').style.right = `${100 - right}%`;
  $('trim-shade-a').style.width = `${left}%`;
  $('trim-shade-b').style.width = `${100 - right}%`;
  $('trim-a').style.left = `${left}%`;
  $('trim-b').style.left = `${right}%`;
  $('trim-from').textContent = clockText(from);
  $('trim-to').textContent = clockText(to);
  $('trim-len').textContent = clockText(to - from);
  paintGrip($('trim-a'), from, t('trimFromAria'));
  paintGrip($('trim-b'), to, t('trimToAria'));
  drawTrim();
}

/* Показываем отрывок только там, где его слышно: у ссылки на YouTube нет ни
   волны, ни длительности, и гадать мы не будем. */
async function openTrim() {
  const box = $('music-trim');
  if (!box) return;
  const token = ++trimToken;
  stopPreview();
  trimPeaks = null;
  trimDuration = 0;
  const url = state.music?.playUrl;
  if (!url) { box.hidden = true; return; }

  box.hidden = false;
  box.classList.add('is-loading');
  const duration = await audioDuration(url);
  if (token !== trimToken) return;
  if (!Number.isFinite(duration) || duration < MIN_SPAN + 1) {
    box.hidden = true;
    box.classList.remove('is-loading');
    return;
  }

  trimDuration = duration;
  if (!Number.isFinite(state.musicStart)) state.musicStart = 0;
  if (!Number.isFinite(state.musicEnd)) state.musicEnd = Math.round(duration);
  box.classList.remove('is-loading');
  paintTrim();

  const peaks = await loadPeaks(url);
  if (token !== trimToken) return;
  trimPeaks = peaks;
  drawTrim();
}

function closeTrim() {
  trimToken += 1;
  stopPreview();
  trimPeaks = null;
  trimDuration = 0;
  const box = $('music-trim');
  if (box) { box.hidden = true; box.classList.remove('is-loading'); }
}

function secAt(clientX) {
  const rect = $('trim-wave').getBoundingClientRect();
  if (!rect.width) return 0;
  const k = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  return k * trimDuration;
}

function moveGrip(sec) {
  if (trimDrag === 'a') state.musicStart = Math.min(Math.max(0, sec), trimEnd() - MIN_SPAN);
  else state.musicEnd = Math.max(Math.min(trimDuration, sec), (state.musicStart || 0) + MIN_SPAN);
  paintTrim();
}

/* Прослушивание: играем ровно выбранный отрывок и не дольше пяти секунд.
   Тянули конец — слушаем подход к обрыву, чтобы слышно было, где музыка смолкнет. */
function previewGrip(which) {
  if (which === 'a') previewFrom(state.musicStart || 0);
  else previewFrom(Math.max(state.musicStart || 0, trimEnd() - PREVIEW_MS / 1000));
}

function onPreviewTick() {
  if (player.currentTime >= trimEnd()) stopPreview();
}

function previewFrom(sec) {
  const url = state.music?.playUrl;
  if (!url) return;
  clearTimeout(previewTimer);
  player.removeEventListener('timeupdate', onPreviewTick);
  playingUrl = null;
  activeTrackUrl = null;
  refreshPlayUI();

  const go = () => {
    try { player.currentTime = Math.max(0, sec); } catch (_) { /* поток ещё не готов */ }
    player.play().then(() => {
      player.addEventListener('timeupdate', onPreviewTick);
      previewTimer = setTimeout(stopPreview, PREVIEW_MS);
      showTrimStop(true);
    }).catch(() => { showTrimStop(false); });
  };

  if (player.src.includes(url) && player.readyState >= 1) { go(); return; }
  player.src = url;
  player.addEventListener('loadedmetadata', go, { once: true });
}

function stopPreview() {
  clearTimeout(previewTimer);
  previewTimer = null;
  player.removeEventListener('timeupdate', onPreviewTick);
  if (!player.paused) player.pause();
  showTrimStop(false);
}

/* Кнопка живёт ровно столько, сколько играет музыка: кольцо показывает,
   сколько осталось до того, как она смолкнет сама. */
function showTrimStop(on) {
  const btn = $('trim-stop');
  if (!btn) return;
  btn.setAttribute('aria-label', t('trimStopAria'));
  btn.hidden = !on;
  btn.classList.remove('is-counting');
  if (!on) return;
  void btn.offsetWidth;
  btn.classList.add('is-counting');
}

/* Настраивают отрывок — переход к следующему блоку ждёт. */
function holdMusicStep() {
  if (state.open === stepIdx('music')) autoAdvance(4200);
}

function commitTrim(which) {
  trimDrag = null;
  state.musicStart = Math.round(state.musicStart || 0);
  state.musicEnd = Math.round(trimEnd());
  paintTrim();
  saveDraft();
  previewGrip(which);
  holdMusicStep();
}

function wireTrim() {
  ['trim-a', 'trim-b'].forEach((id) => {
    const grip = $(id);
    const which = id === 'trim-a' ? 'a' : 'b';

    grip.addEventListener('pointerdown', (event) => {
      if (!trimDuration) return;
      event.preventDefault();
      trimDrag = which;
      grip.classList.add('is-drag');
      grip.setPointerCapture?.(event.pointerId);
      stopPreview();
    });
    grip.addEventListener('pointermove', (event) => {
      if (trimDrag !== which) return;
      moveGrip(secAt(event.clientX));
    });

    const release = () => {
      if (trimDrag !== which) return;
      grip.classList.remove('is-drag');
      haptic.tap();
      commitTrim(which);
    };
    grip.addEventListener('pointerup', release);
    grip.addEventListener('pointercancel', release);

    grip.addEventListener('keydown', (event) => {
      if (!trimDuration) return;
      const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
      if (!step) return;
      event.preventDefault();
      trimDrag = which;
      moveGrip((which === 'a' ? state.musicStart || 0 : trimEnd()) + step);
      commitTrim(which);
    });
  });

  // Тап по волне подтягивает ближнюю ручку — не нужно ловить её пальцем.
  $('trim-wave').addEventListener('pointerdown', (event) => {
    if (!trimDuration || event.target.closest('.trim-grip, .trim-stop')) return;
    const sec = secAt(event.clientX);
    const which = Math.abs(sec - (state.musicStart || 0)) <= Math.abs(sec - trimEnd()) ? 'a' : 'b';
    trimDrag = which;
    moveGrip(sec);
    commitTrim(which);
  });

  $('trim-stop').addEventListener('click', () => { haptic.tap(); stopPreview(); });

  window.addEventListener('resize', debounce(() => { if (trimDuration) drawTrim(); }, 200), { passive: true });
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
/* Кнопка открытия конверта в чужом документе: у новых тем это
   [data-envelope-trigger], у старых оплаченных ссылок — #env. */
function openEnvelopeIn(doc) {
  if (!doc) return;
  const trigger = doc.querySelector('[data-envelope-trigger]') || doc.getElementById('env');
  trigger?.click();
}

/* Пример дизайна открывается отдельной страницей /demo/<id> — ровно тем же
   адресом, что получит гость. Внутри Telegram ссылку открывает клиент,
   в обычном браузере (platform === 'unknown') нужна вкладка. */
function openDemo(tpl) {
  haptic.tap();
  const q = new URLSearchParams({
    groom: $('groom').value.trim(), bride: $('bride').value.trim(), lang: LANG,
    address: $('address').value.trim(), map: state.mapOn ? '1' : '0',
    lat: Number.isFinite(state.lat) ? String(state.lat) : '',
    lng: Number.isFinite(state.lng) ? String(state.lng) : '',
  });
  const url = `${location.origin}/demo/${tpl.id}?${q}`;
  const inTelegram = Boolean(tg?.platform && tg.platform !== 'unknown');
  if (inTelegram && typeof tg.openLink === 'function') {
    try { tg.openLink(url); return; } catch (_) { /* падаем во вкладку */ }
  }
  window.open(url, '_blank', 'noopener');
}

/* Витрина дизайнов — галерея: все восемь обложек лежат на странице по две в
   ряд. Карусель здесь не работала: чтобы дойти до последнего стиля, нужно было
   восемь раз пролистать вслепую, а сравнить два дизайна между собой нельзя
   вовсе. Теперь выбор виден целиком и делается одним тапом.
   Каждая карточка выглядит как сама тема: её бумага, чернила и золото. Живых
   превью в витрине нет — восемь работающих приглашений не тянет ни один
   телефон, полный пример открывается отдельной страницей по глазку. */
function templateCover(tpl) {
  const cover = tpl.cover || {};
  const groom = $('groom').value.trim() || (LANG === 'ru' ? 'Жених' : 'Kuyov');
  const bride = $('bride').value.trim() || (LANG === 'ru' ? 'Невеста' : 'Kelin');
  const initials = `${[...groom][0] ?? ''} · ${[...bride][0] ?? ''}`;
  const date = state.dateIso
    ? (() => { const [y, m, d] = state.dateIso.split('-'); return `${d}.${m}.${y}`; })()
    : '00.00.0000';

  const art = h('span', { class: 'tplc-cover' },
    h('span', { class: 'tplc-mono' }, initials),
    h('span', { class: 'tplc-names' }, groom, h('i', {}, '&'), bride),
    h('span', { class: 'tplc-date' }, date),
    h('span', { class: 'tplc-seal' }));
  art.style.setProperty('--c-paper', cover.paper || '#0d0c09');
  art.style.setProperty('--c-ink', cover.ink || '#f7f1e7');
  art.style.setProperty('--c-accent', cover.accent || '#c8aa6a');
  art.style.setProperty('--c-env', cover.envelope || '#5b4630');
  return art;
}

function renderTemplates() {
  const grid = $('tpl-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const pops = state.config?.populars || {};
  const list = rankedTemplates();
  const bestPopularity = Math.max(0, ...list.map((tpl) => Number(pops[tpl.id]) || 0));

  list.forEach((tpl) => {
    const chosen = tpl.id === state.templateId;
    const isPopular = bestPopularity > 0 && Number(pops[tpl.id] || 0) === bestPopularity;

    const pick = h('button', {
      type: 'button',
      class: 'tplc-pick',
      'aria-label': `${t('take')}: ${tpl.name}`,
      'aria-pressed': chosen ? 'true' : 'false',
    },
      templateCover(tpl),
      h('span', { class: 'tplc-check' }, svgIcon('check')),
      h('span', { class: 'tplc-meta' },
        h('b', {}, tpl.name),
        h('i', {}, money(tpl.price)),
        h('em', {}, t('tplPhotos', tpl.minPhotos))));
    pick.addEventListener('click', () => takeTpl(tpl));

    // Глазок — отдельная кнопка: посмотреть пример, ничего не выбирая.
    const eye = h('button', { type: 'button', class: 'tplc-eye', 'aria-label': `${t('demo')}: ${tpl.name}` },
      svgIcon('eye'));
    eye.addEventListener('click', () => openDemo(tpl));

    grid.appendChild(h('article', { class: `tplc${chosen ? ' chosen' : ''}`, dataset: { id: tpl.id } },
      pick,
      eye,
      isPopular ? h('span', { class: 'tplc-flag' }, t('popular')) : null));
  });
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
  document.querySelectorAll('.tplc').forEach((card) => {
    const isChosen = card.dataset.id === tpl.id;
    card.classList.toggle('chosen', isChosen);
    card.querySelector('.tplc-pick')?.setAttribute('aria-pressed', isChosen ? 'true' : 'false');
  });
  renderPhotos();
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
        h('button', { type: 'button', class: 'ph-del', 'aria-label': t('photoRemoveAria') }, svgIcon('close')));
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
        h('span', {}, svgIcon('add')),
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
  $('ready-next').hidden = !state.seenInvite || state.open > stepIdx('ready');
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
    setTimeout(() => openEnvelopeIn(d), auto ? 250 : 325);
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
  if (state.open === stepIdx('ready')) unlock(stepIdx('guests'));
  else if (firstCompletion) renderReady();
}

/* ════ 08 · Гости ════ */

const guestPrice = () => state.config?.guestPrice ?? 10000;
const cleanGuests = () => (state.guestsOn ? state.guests.map((g) => g.trim()).filter(Boolean) : []);
let serviceMotionReady = false;
let personalPhase = 0;
let personalMotionRun = 0;
let personalMotionVisible = false;
let personalMotionTimers = [];

const PM_DEMOS = {
  uz: [
    { prefix: 'Hurmatli', name: 'Aziz aka', slug: 'Aziz' },
    { prefix: 'Hurmatli', name: 'Dilnoza opa', slug: 'Dilnoza' },
    { prefix: 'Hurmatli', name: 'Farxod uka', slug: 'Farxod' },
  ],
  ru: [
    { prefix: 'Дорогой', name: 'Aziz aka', slug: 'Aziz' },
    { prefix: 'Дорогая', name: 'Dilnoza opa', slug: 'Dilnoza' },
    { prefix: 'Дорогой', name: 'Farxod uka', slug: 'Farxod' },
  ],
};

function schedulePersonalMotion(callback, delay, run = personalMotionRun) {
  const timer = setTimeout(() => {
    personalMotionTimers = personalMotionTimers.filter((item) => item !== timer);
    if (run === personalMotionRun) callback();
  }, delay);
  personalMotionTimers.push(timer);
  return timer;
}

function stopPersonalMotion() {
  personalMotionRun += 1;
  personalMotionTimers.forEach(clearTimeout);
  personalMotionTimers = [];
  document.querySelectorAll('.pm-traveler').forEach((dot) => dot.classList.remove('is-traveling'));
}

function renderPersonalChars(element, value) {
  if (!element) return;
  element.classList.remove('is-deleting');
  element.replaceChildren(...Array.from(value).map((char, index) => {
    const letter = document.createElement('span');
    letter.className = 'pm-char';
    letter.style.setProperty('--pm-i', index);
    letter.textContent = char;
    return letter;
  }));
  element.style.setProperty('--pm-count', value.length);
}

function setPersonalInvitation(index, animate = false, run = personalMotionRun) {
  const demos = PM_DEMOS[LANG || 'uz'];
  const demo = demos[index % demos.length];
  const prefix = $('pm-prefix');
  const name = $('pm-name');
  const link = $('pm-link');
  if (!prefix || !name || !link) return;

  personalPhase = index % demos.length;
  const commit = () => {
    prefix.textContent = demo.prefix;
    renderPersonalChars(name, demo.name);
    renderPersonalChars(link, `nVate.uz/~~~/${demo.slug}`);
    if (animate && prefix.animate) {
      prefix.animate([
        { opacity: 0, filter: 'blur(4px)', transform: 'translateY(4px)' },
        { opacity: 1, filter: 'blur(0)', transform: 'translateY(0)' },
      ], { duration: 460, easing: 'cubic-bezier(.32, 0, .18, 1)', fill: 'both' });
    }
  };

  if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    commit();
    return;
  }

  name.classList.add('is-deleting');
  link.classList.add('is-deleting');
  if (prefix.animate) {
    prefix.animate([
      { opacity: 1, filter: 'blur(0)', transform: 'translateY(0)' },
      { opacity: 0, filter: 'blur(4px)', transform: 'translateY(-4px)' },
    ], { duration: 330, easing: 'cubic-bezier(.55, 0, .78, .39)', fill: 'both' });
  }
  schedulePersonalMotion(commit, 650, run);
}

function pointAt(element, edge, rootRect) {
  const rect = element.getBoundingClientRect();
  const point = { x: rect.left - rootRect.left + rect.width / 2, y: rect.top - rootRect.top + rect.height / 2 };
  if (edge === 'left') point.x = rect.left - rootRect.left;
  if (edge === 'right') point.x = rect.right - rootRect.left;
  if (edge === 'top') point.y = rect.top - rootRect.top;
  if (edge === 'bottom') point.y = rect.bottom - rootRect.top;
  return point;
}

function personalCurve(from, to, vertical) {
  const f = (value) => Math.round(value * 10) / 10;
  if (vertical) {
    const bend = from.y + (to.y - from.y) * .52;
    return `M${f(from.x)} ${f(from.y)}C${f(from.x)} ${f(bend)} ${f(to.x)} ${f(bend)} ${f(to.x)} ${f(to.y)}`;
  }
  const bend = from.x + (to.x - from.x) * .52;
  return `M${f(from.x)} ${f(from.y)}C${f(bend)} ${f(from.y)} ${f(bend)} ${f(to.y)} ${f(to.x)} ${f(to.y)}`;
}

function layoutPersonalMotion() {
  const motion = $('personal-motion');
  const svg = $('pm-wires');
  const origin = $('pm-origin');
  const card = $('pm-card');
  if (!motion || !svg || !origin || !card || !motion.offsetWidth) return;

  const rootRect = motion.getBoundingClientRect();
  const vertical = motion.clientWidth < 620;
  svg.setAttribute('viewBox', `0 0 ${rootRect.width} ${rootRect.height}`);

  const originPoint = pointAt(origin, vertical ? 'bottom' : 'right', rootRect);
  const cardIn = pointAt(card, vertical ? 'top' : 'left', rootRect);
  const cardOut = pointAt(card, vertical ? 'bottom' : 'right', rootRect);
  $('pm-path-in').setAttribute('d', personalCurve(originPoint, cardIn, vertical));

  for (let index = 0; index < 3; index += 1) {
    const person = $(`pm-person-${index}`);
    const destination = pointAt(person, vertical ? 'top' : 'left', rootRect);
    $('pm-path-' + index).setAttribute('d', personalCurve(cardOut, destination, vertical));
  }
}

function travelPersonalPath(path, dot, duration, run = personalMotionRun, onDone) {
  if (!path || !dot || run !== personalMotionRun) return;
  if (!path.getAttribute('d')) layoutPersonalMotion();
  if (!path.getAttribute('d')) return;
  const length = path.getTotalLength();
  const started = performance.now();
  dot.classList.add('is-traveling');

  const frame = (now) => {
    if (run !== personalMotionRun) {
      dot.classList.remove('is-traveling');
      return;
    }
    const elapsed = Math.min(1, (now - started) / duration);
    const eased = 1 - Math.pow(1 - elapsed, 3.1);
    const point = path.getPointAtLength(length * eased);
    dot.setAttribute('cx', point.x);
    dot.setAttribute('cy', point.y);
    if (elapsed < 1) requestAnimationFrame(frame);
    else {
      dot.classList.remove('is-traveling');
      onDone?.();
    }
  };
  requestAnimationFrame(frame);
}

function pulsePersonalElement(element, duration = 850, run = personalMotionRun) {
  if (!element) return;
  element.classList.remove('is-pulsing', 'is-arriving');
  void element.offsetWidth;
  element.classList.add(element.classList.contains('pm-person') ? 'is-arriving' : 'is-pulsing');
  schedulePersonalMotion(() => element.classList.remove('is-pulsing', 'is-arriving'), duration, run);
}

function drawPersonalPath(key, duration, run = personalMotionRun, onDone) {
  const path = $(`pm-path-${key}`);
  const dot = $(`pm-light-${key}`);
  if (!path || !dot) return;
  path.classList.remove('is-complete', 'is-drawing');
  path.style.setProperty('--pm-draw', `${duration}ms`);
  void path.getBoundingClientRect();
  path.classList.add('is-drawing');
  travelPersonalPath(path, dot, duration, run);
  schedulePersonalMotion(() => {
    path.classList.remove('is-drawing');
    path.classList.add('is-complete');
    onDone?.();
  }, duration, run);
}

function connectPersonalGuest(index, run = personalMotionRun) {
  drawPersonalPath(String(index), 820, run, () => {
    document.querySelectorAll('.pm-person').forEach((person) => person.classList.remove('is-current'));
    const person = $(`pm-person-${index}`);
    person?.classList.add('is-connected', 'is-current');
    pulsePersonalElement(person, 850, run);
  });
}

function paintPersonalMotion() {
  setPersonalInvitation(personalPhase, false);
  requestAnimationFrame(layoutPersonalMotion);
}

function startPersonalMotion() {
  const motion = $('personal-motion');
  if (!motion || !personalMotionVisible || document.hidden) return;
  stopPersonalMotion();
  const run = personalMotionRun;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const paths = ['in', '0', '1', '2'].map((key) => $(`pm-path-${key}`)).filter(Boolean);
  const people = [0, 1, 2].map((index) => $(`pm-person-${index}`)).filter(Boolean);

  motion.dataset.scene = 'intro';
  motion.classList.remove('is-brand-visible', 'is-card-visible', 'is-final', 'is-resetting');
  paths.forEach((path) => path.classList.remove('is-drawing', 'is-complete'));
  people.forEach((person) => person.classList.remove('is-connected', 'is-current', 'is-arriving'));
  setPersonalInvitation(0, false, run);
  layoutPersonalMotion();

  schedulePersonalMotion(() => {
    motion.dataset.scene = 'brand';
    motion.classList.add('is-brand-visible');
  }, 280, run);

  schedulePersonalMotion(() => drawPersonalPath('in', 900, run, () => {
    motion.dataset.scene = 'invitation';
    motion.classList.add('is-card-visible');
    pulsePersonalElement($('pm-card'), 760, run);
  }), 950, run);

  schedulePersonalMotion(() => connectPersonalGuest(0, run), 2700, run);
  schedulePersonalMotion(() => setPersonalInvitation(1, true, run), 3850, run);
  schedulePersonalMotion(() => connectPersonalGuest(1, run), 5450, run);
  schedulePersonalMotion(() => setPersonalInvitation(2, true, run), 6550, run);
  schedulePersonalMotion(() => connectPersonalGuest(2, run), 8150, run);

  schedulePersonalMotion(() => {
    motion.dataset.scene = 'final';
    motion.classList.add('is-final');
    people.forEach((person) => person.classList.remove('is-current'));
  }, 9400, run);

  if (!reducedMotion) {
    schedulePersonalMotion(() => {
      pulsePersonalElement($('pm-origin'), 800, run);
      travelPersonalPath($('pm-path-in'), $('pm-light-in'), 720, run, () => {
        [0, 1, 2].forEach((index) => {
          travelPersonalPath($(`pm-path-${index}`), $(`pm-light-${index}`), 820, run, () => {
            pulsePersonalElement($(`pm-person-${index}`), 850, run);
          });
        });
      });
    }, 9800, run);

    schedulePersonalMotion(() => motion.classList.add('is-resetting'), 12100, run);
    schedulePersonalMotion(startPersonalMotion, 12850, run);
  }
}

function setupServiceMotions() {
  if (serviceMotionReady) return;
  serviceMotionReady = true;
  const targets = [$('personal-motion')].filter(Boolean);
  const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(layoutPersonalMotion) : null;
  targets.forEach((target) => resizeObserver?.observe(target));
  window.addEventListener('resize', layoutPersonalMotion, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopPersonalMotion();
    else if (personalMotionVisible) startPersonalMotion();
  });
  const setPersonalVisibility = (visible) => {
    const motion = $('personal-motion');
    if (!motion) return;
    const changed = visible !== personalMotionVisible;
    personalMotionVisible = visible;
    motion.classList.toggle('is-visible', visible);
    if (!changed) return;
    if (visible) {
      layoutPersonalMotion();
      startPersonalMotion();
    } else stopPersonalMotion();
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => setPersonalVisibility(entry.isIntersecting));
    }, { threshold: .24 });
    targets.forEach((target) => observer.observe(target));
    return;
  }

  let visibilityFrame = 0;
  const checkPersonalVisibility = () => {
    visibilityFrame = 0;
    const motion = $('personal-motion');
    if (!motion || !motion.offsetWidth) {
      setPersonalVisibility(false);
      return;
    }
    const rect = motion.getBoundingClientRect();
    const visible = rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
    setPersonalVisibility(visible);
  };
  const queuePersonalVisibilityCheck = () => {
    if (!visibilityFrame) visibilityFrame = requestAnimationFrame(checkPersonalVisibility);
  };
  window.addEventListener('scroll', queuePersonalVisibilityCheck, { passive: true });
  window.addEventListener('resize', queuePersonalVisibilityCheck, { passive: true });
  queuePersonalVisibilityCheck();
}

/* Кнопки «добавить» нет: в конце списка всегда ждёт пустое поле.
   Начал печатать — снизу сразу появляется следующее. Пустые не считаются. */
function renderGuests(focusIdx = -1) {
  const sw = $('guests-toggle');
  sw.setAttribute('aria-checked', String(state.guestsOn));
  $('personal-motion')?.classList.toggle('is-on', state.guestsOn);
  $('guests-sw-sub').textContent = state.guestsOn ? t('guestsSwOn') : t('guestsSwOff');
  $('guests-body').hidden = !state.guestsOn;
  paintPersonalMotion();

  if (state.guests.length === 0 || state.guests[state.guests.length - 1].trim()) state.guests.push('');

  const list = $('guest-list');
  list.innerHTML = '';
  const max = state.config?.maxGuests ?? 100;

  state.guests.forEach((name, i) => {
    const blank = !name.trim();
    const input = h('input', {
      id: `guest-${i}`, type: 'text', maxlength: '50', value: name,
      enterkeyhint: 'done',
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

/* Идемпотентность отправки: один черновик — один ключ. Повторный тап по
   «Оплатить» (или отправка после разрыва связи) не создаст вторую заявку. */
function submissionKey() {
  if (state.submissionKey) return state.submissionKey;
  let key = '';
  try {
    key = crypto.randomUUID();
  } catch (_) {
    key = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
  state.submissionKey = key;
  saveDraft();
  return key;
}

function collectForm() {
  return {
    submissionKey: submissionKey(),
    lang: LANG,
    groomName: $('groom').value.trim(),
    brideName: $('bride').value.trim(),
    weddingDate: state.dateIso,
    weddingTime: state.time,
    mapEnabled: state.mapOn,
    lat: state.mapOn ? state.lat : null,
    lng: state.mapOn ? state.lng : null,
    address: $('address').value.trim(),
    photos: state.photos.filter((p) => p.name).slice(0, requiredPhotos()).map((p) => p.name),
    musicType: state.music?.type ?? 'none',
    musicValue: state.music?.value ?? null,
    musicStart: trimmable() ? state.musicStart ?? null : null,
    musicEnd: trimmable() ? state.musicEnd ?? null : null,
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
    state.submissionKey = null;   // следующая заявка получит собственный ключ
    haptic.ok();
    sparks();
    window.Sky?.flare(5);
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
        h('h3', {}, `${a.groom} & ${a.bride}`),
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

/* Одно правило на все поля студии: набрал — клавиатура ушла.
   По кнопкам фокус снимаем уже после клика: закрытие клавиатуры двигает
   вёрстку, и тап, снятый раньше, не дошёл бы до кнопки. */
function wireKeyboard() {
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing) return;
    const field = typingField(event.target);
    if (!field) return;
    event.preventDefault();
    dismissField(field);
  });

  document.addEventListener('pointerdown', (event) => {
    const active = typingField(document.activeElement);
    if (!active || event.target === active) return;
    if (event.target.closest?.('button,a,label,input,textarea,select,[role="switch"]')) return;
    dismissField(active);
  }, { passive: true });

  document.addEventListener('click', (event) => {
    const active = typingField(document.activeElement);
    if (!active || event.target === active) return;
    if (event.target.closest?.('input,textarea,select')) return;
    dismissField(active);
  });

  /* Пара начала листать студию — значит с полем закончили. Ловим именно
     протяжку пальцем: короткий тап по полю не должен гасить клавиатуру. */
  let swipeFrom = null;
  document.addEventListener('touchstart', (event) => {
    swipeFrom = event.touches.length === 1 ? event.touches[0].clientY : null;
  }, { passive: true });

  document.addEventListener('touchmove', (event) => {
    if (swipeFrom === null) return;
    const active = typingField(document.activeElement);
    if (!active) return;
    if (Math.abs(event.touches[0].clientY - swipeFrom) < 26) return;
    swipeFrom = null;
    dismissField(active);
  }, { passive: true });

  document.addEventListener('touchend', () => { swipeFrom = null; }, { passive: true });
}

function wire() {
  wireKeyboard();
  wireTrim();
  window.addEventListener('wheel', cancelMainScroll, { passive: true });
  window.addEventListener('touchstart', cancelMainScroll, { passive: true });
  window.addEventListener('pointerdown', cancelMainScroll, { passive: true });
  window.addEventListener('keydown', cancelMainScroll);
  $('lang-uz').addEventListener('click', () => bootLang('uz'));
  $('lang-ru').addEventListener('click', () => bootLang('ru'));
  $('sw-uz').addEventListener('click', () => setLang('uz'));
  $('sw-ru').addEventListener('click', () => setLang('ru'));
  $('brand').addEventListener('click', () => softScrollTo(0, 3200));

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
  $('map-toggle').addEventListener('click', toggleMap);
  $('map-in').addEventListener('click', () => {
    if (ymap) ymap.setZoom(Math.min(19, ymap.getZoom() + 1), { duration: 900 });
  });
  $('map-out').addEventListener('click', () => {
    if (ymap) ymap.setZoom(Math.max(0, ymap.getZoom() - 1), { duration: 900 });
  });
  $('address').addEventListener('input', () => {
    $('address').dataset.manual = '1';
    markFilled($('address'));
    clearErr(stepIdx('location'));
    saveDraft();
    autoAdvance(760);
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
    state.musicStart = 0;
    state.musicEnd = null;
    player.pause();
    playingUrl = null;
    activeTrackUrl = null;
    closeTrim();
    $('music-picked').hidden = true;
    haptic.tap();
    saveDraft();
    if (state.open === stepIdx('music')) autoAdvance(720);
  });

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
  $('ready-next').addEventListener('click', () => { haptic.tap(); unlock(stepIdx('guests')); });
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
  document.body.classList.add('studio-entering');
  const first = document.querySelector('.blk[data-step="names"]');
  if (first) armBlock(first);
  $('lang-screen').classList.add('out');
  setTimeout(() => { $('lang-screen').style.display = 'none'; }, 1400);
  $('app').hidden = false;
  start();
}

let started = false;
async function start() {
  if (started) return;
  started = true;
  await loadConfig();
  const restored = restoreDraft();
  const testingTemplates = location.hostname === 'localhost' && new URLSearchParams(location.search).has('__template_test');
  // Возврат к черновику: продолжаем с того места, где пара остановилась, но не
  // дальше первого незаполненного шага — иначе можно попасть на «оплату»
  // с пустой датой, если черновик пришёл из старой версии.
  let resume = 0;
  if (restored) {
    let reachable = 0;
    while (reachable < STEPS.length - 1 && STEPS[reachable].check()) reachable += 1;
    resume = Math.max(0, Math.min(state.open, reachable));
  }
  state.open = testingTemplates ? stepIdx('template') : resume;
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
    openTrim();
  }
  const resuming = !testingTemplates && state.open > 0;
  renderBlocks(testingTemplates || resuming ? -1 : 0);
  renderMapChoice();
  setupServiceMotions();
  updateBill();
  if (testingTemplates || resuming) {
    // Всё пройденное уже на экране: не проигрываем вход заново, просто
    // подводим камеру к активному блоку.
    prepareStep(state.open);
    await cameraTo(state.open);
    document.body.classList.remove('studio-entering');
    activateStep(state.open);
    return;
  }
  await nextFrame();
  await nextFrame();
  pulseLiveBead();
  await riseBlock(blk(0));
  document.body.classList.remove('studio-entering');
  activateStep(0);
}

wire();
