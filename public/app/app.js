/* global UI, NvMap */
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
  venueId: null,      // id тойхоны из каталога, если выбрали её
  venues: [],
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
      lat: state.lat, lng: state.lng, venueId: state.venueId, address: $('address').value,
      templateId: state.templateId,
      photos: state.photos.filter((p) => p.name).map((p) => p.name),
      music: state.music, musicStart: state.musicStart, musicEnd: state.musicEnd,
      guestsOn: state.guestsOn, guests: state.guests,
      phone: $('phone').value,
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
  $('phone').value = d.phone || '';
  state.dateIso = d.dateIso || null;
  state.time = /^(1[5-9]|2[0-2]):(00|15|30|45)$/.test(d.time) ? d.time : '17:00';
  state.timeConfirmed = Boolean(d.timeConfirmed);
  state.lat = Number.isFinite(d.lat) ? d.lat : null;
  state.lng = Number.isFinite(d.lng) ? d.lng : null;
  state.venueId = typeof d.venueId === 'string' ? d.venueId : null;
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
    leadVenue: 'To‘yxonani ro‘yxatdan tanlang. Sizniki yo‘q bo‘lsa — nomini o‘zingiz yozing.',
    seekLbl: 'To‘yxonani qidirish', seekPlace: 'Nomi yoki mo‘ljal',
    venueOwn: 'Mening joyim ro‘yxatda yo‘q',
    venueEmpty: 'Bunday joy ro‘yxatda yo‘q — nomini o‘zingiz yozing',
    venueSeats: (n) => `${n} o‘rin`,
    venueKind: { toyxona: 'To‘yxona', restoran: 'Restoran', kafe: 'Kafe', bog: 'Bog‘' },
    geoHead: 'Umumiy xaritadan topildi',
    mapPick: 'Joyni ko‘rsatish uchun xaritada bosing',
    mapHint: 'Nuqtani aniqlashtirish uchun xaritada bosing',
    linkLbl: 'Musiqa havolasi',
    change: 'O‘zgartirish',
    guestPh: 'Ism yozing…',
    eMusic: 'Ovoz', tMusic: 'Musiqa', msTop: 'Mashhur', msMine: 'Mening musiqam',
    seekMusic: 'Qo‘shiq yoki ijrochi', musicSkip: 'Musiqasiz davom etish',
    add: 'Qo‘shish', uploadMusic: 'Fayl yuklash', lookDone: 'Ko‘rib chiqdim',
    linkHint: 'YouTube havolasi yoki to‘g‘ridan-to‘g‘ri mp3 havolasi.',
    linkPh: 'https://…',
    trimTitle: 'Qayerdan boshlansin',
    trimSet: 'Shu yerdan boshlansin',
    trimListen: 'Tinglang va kerakli joyda tugmani bosing',
    trimFrom: (time) => `${time} dan oxirigacha yangraydi`,
    trimReset: 'Boshidan',
    trimTip: (time, uses) => `Ko‘pincha ${time} dan boshlashadi · ${uses} juft`,
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
    gHow1t: 'Ismlar ro‘yxati', gHow1: 'Mehmonlar ismini yozasiz — har biri alohida qatorga.',
    gHow2t: 'Har kimga o‘z havolasi', gHow2: 'Taklifnoma ochilganda mehmon o‘z ismini ko‘radi.',
    gHow3t: 'Havolalarni botdan olasiz', gHow3: 'To‘lovdan keyin tayyor havolalar ro‘yxati botga keladi.',
    guestAdd: 'Ism qo‘shish', guestsUnit: 'ta ism',
    wmTitle: 'Namuna himoyalangan',
    wmText: 'Ustidagi «nVate» to‘ri va nusxa olish cheklovi faqat namunada. To‘lovdan so‘ng to‘r olib tashlanadi va sizga toza havola beriladi.',
    total: 'Jami',
    eContact: 'Aloqa', tContact: 'Siz bilan qanday bog‘lanamiz',
    leadContact: 'Telegram’ingiz bizda bor. Faqat raqamingizni yozing.',
    phoneLbl: 'Telefon raqam',
    contactRule: 'To‘lovni tasdiqlash uchun shu raqamga qo‘ng‘iroq qilamiz.',
    mineTitle: 'Mening taklifnomalarim',
    mineAria: 'Mening taklifnomalarimni ochish', closeAria: 'Yopish', stepsAria: 'Studio bosqichlari',
    prevMonthAria: 'Oldingi oy', nextMonthAria: 'Keyingi oy', hoursAria: 'Soatlar', minutesAria: 'Daqiqalar',
    musicSearchAria: 'Musiqa qidirish', playAria: 'Eshitish', pauseAria: 'To‘xtatish',
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
    eVenue_: 'To‘yxonani tanlang yoki nomini yozing', eTpl_: 'Uslubni tanlang',
    ePhoto_: (n) => `Yana surat kerak: ${n} ta`,
    eGuest_: 'Bo‘sh ismlarni to‘ldiring yoki o‘chiring',
    eContact_: 'Telefon raqamingizni yozing',
    eNet: 'Aloqa yo‘q. Qayta urinib ko‘ring', eNoFound: 'Hech narsa topilmadi',
    eUpload: 'Fayl yuklanmadi. Yana urinib ko‘ring', eBig: 'Fayl juda katta',
    eTooMany: 'Juda ko‘p urinish. Bir necha daqiqadan so‘ng qayta urining',
    eFormat: 'Bu format qo‘llab-quvvatlanmaydi — JPG, PNG yoki HEIC yuboring',
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
    leadVenue: 'Выберите тойхону из списка. Вашей нет — впишите название сами.',
    seekLbl: 'Поиск тойхоны', seekPlace: 'Название или ориентир',
    venueOwn: 'Моего места нет в списке',
    venueEmpty: 'Такого места в списке нет — впишите название сами',
    venueSeats: (n) => `${n} мест`,
    venueKind: { toyxona: 'Тойхона', restoran: 'Ресторан', kafe: 'Кафе', bog: 'Сад' },
    geoHead: 'Найдено на общей карте',
    mapPick: 'Нажмите на карту, чтобы поставить точку',
    mapHint: 'Нажмите на карту, чтобы уточнить точку',
    linkLbl: 'Ссылка на музыку',
    change: 'Изменить',
    guestPh: 'Впишите имя…',
    eMusic: 'Звук', tMusic: 'Музыка', msTop: 'Популярное', msMine: 'Моя музыка',
    seekMusic: 'Песня или исполнитель', musicSkip: 'Продолжить без музыки',
    add: 'Добавить', uploadMusic: 'Загрузить файл', lookDone: 'Посмотрел',
    linkHint: 'Ссылка на YouTube или прямая ссылка на mp3.',
    linkPh: 'https://…',
    trimTitle: 'Откуда начинать',
    trimSet: 'Начать отсюда',
    trimListen: 'Слушайте и нажмите, когда музыка станет нужной',
    trimFrom: (time) => `Играет с ${time} и до конца`,
    trimReset: 'Сначала',
    trimTip: (time, uses) => `Чаще всего начинают с ${time} · ${uses} пар`,
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
    gHow1t: 'Список имён', gHow1: 'Вписываете гостей — каждого отдельной строкой.',
    gHow2t: 'Каждому своя ссылка', gHow2: 'Гость открывает приглашение и видит своё имя.',
    gHow3t: 'Ссылки придут в бот', gHow3: 'После оплаты бот пришлёт готовый список ссылок.',
    guestAdd: 'Добавить имя', guestsUnit: 'имён',
    wmTitle: 'Образец защищён',
    wmText: 'Сетка «nVate» поверх и запрет копирования — только в образце. После оплаты сетка снимается, и вы получаете чистую ссылку.',
    total: 'Итого',
    eContact: 'Контакты', tContact: 'Как с вами связаться',
    leadContact: 'Ваш Telegram у нас уже есть. Оставьте только номер.',
    phoneLbl: 'Номер телефона',
    contactRule: 'По этому номеру мы свяжемся, чтобы подтвердить оплату.',
    mineTitle: 'Мои приглашения',
    mineAria: 'Открыть мои приглашения', closeAria: 'Закрыть', stepsAria: 'Этапы студии',
    prevMonthAria: 'Предыдущий месяц', nextMonthAria: 'Следующий месяц', hoursAria: 'Часы', minutesAria: 'Минуты',
    musicSearchAria: 'Поиск музыки', playAria: 'Прослушать', pauseAria: 'Пауза',
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
    eVenue_: 'Выберите тойхону или впишите название', eTpl_: 'Выберите стиль',
    ePhoto_: (n) => `Добавьте ещё ${n} фото`,
    eGuest_: 'Заполните или удалите пустые имена',
    eContact_: 'Впишите номер телефона',
    eNet: 'Нет связи. Попробуйте ещё раз', eNoFound: 'Ничего не найдено',
    eUpload: 'Файл не загрузился. Попробуйте ещё раз', eBig: 'Файл слишком большой',
    eTooMany: 'Слишком много попыток. Повторите через несколько минут',
    eFormat: 'Формат не поддерживается — пришлите JPG, PNG или HEIC',
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
  $('geo-q').setAttribute('aria-label', t('seekLbl'));
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
  renderVenues($('geo-q').value);
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
  { id: 'location', auto: true, check: () => Boolean($('address').value.trim()) },
  // Музыку подбирают долго: слушают, отмечают начало, меняют трек. Камера
  // отсюда не уезжает — следующий блок просто появляется снизу и ждёт.
  { id: 'music', auto: true, quiet: true, check: () => true },
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

function unlock(i, { quiet = false } = {}) {
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
    // а не ждёт, пока страница доедет. Тихий переход камеру не трогает:
    // блок вырастает снизу, а страница остаётся там, где её оставили.
    const camera = quiet ? Promise.resolve() : cameraTo(i);
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
    unlock(i + 1, { quiet: step.quiet === true });
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
  if (id === 'datetime') startDrift(); else stopDrift();
  if (id === 'ready') {
    clearTimeout(autoPreviewTimer);
    if (!state.seenInvite) {
      autoPreviewTimer = setTimeout(() => {
        if (state.open === i && !state.seenInvite && $('sheet').hidden) openInvite({ auto: true });
      }, 1250);
    }
  }
  if (id === 'guests') autoAdvance(2600);
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

/* Барабан выглядит как обычная строка цифр, и пары его просто не замечали:
   ждали, что время где-то введётся. Поэтому, пока время не выбрано, барабан
   медленно едет сам — как бегущая строка. Движение объясняет устройство
   лучше любой подписи. Первое касание останавливает показ насовсем. */
const driftStops = [];

function stopDrift() {
  while (driftStops.length) driftStops.pop()();
}

function driftDrum(track) {
  let raf = 0;
  let last = 0;
  let dir = 1;
  let live = false;

  const halt = () => {
    live = false;
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const frame = (now) => {
    if (!live) return;
    if (state.timeConfirmed) { halt(); return; }
    const step = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    const limit = track.scrollWidth - track.clientWidth;
    if (limit <= 1) { raf = requestAnimationFrame(frame); return; }
    // 24 пикселя в секунду: видно, что едет, и цифры успеваешь прочитать.
    track.scrollLeft += dir * step * 24;
    if (track.scrollLeft >= limit - .5) dir = -1;
    if (track.scrollLeft <= .5) dir = 1;
    raf = requestAnimationFrame(frame);
  };

  for (const event of ['pointerdown', 'wheel', 'keydown', 'touchstart']) {
    track.addEventListener(event, stopDrift, { passive: true });
  }

  return {
    start() { if (live || state.timeConfirmed) return; live = true; last = 0; raf = requestAnimationFrame(frame); },
    halt,
  };
}

/* Показ заводим, только когда блок с датой на экране: крутить барабан в
   свёрнутом блоке — зря жечь батарею. */
function startDrift() {
  if (state.timeConfirmed) return;
  stopDrift();
  for (const track of document.querySelectorAll('.hdrum-track')) {
    const drift = driftDrum(track);
    driftStops.push(drift.halt);
    setTimeout(drift.start, 700);
  }
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
    stopDrift();
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

/* ════ 03 · Локация ════
   Ни Яндекс, ни Google не знают тойхоны Мангита: искать их на общей карте
   бесполезно. Справочник мы ведём сами, и карта здесь тоже своя (map.js) —
   чужой виджет приносил линейку, компас и «моё местоположение», которые паре
   не нужны ни разу, а убрать их из чужого iframe нельзя. Сначала поиск —
   название тойхоны знают наизусть; карта под ним показывает все места сразу. */

const MANGIT_CENTER = [42.116169, 60.0625143];
let venueMap = null;

const cityCenter = () => {
  const city = state.config?.city;
  return Number.isFinite(city?.lat) ? [city.lat, city.lng] : MANGIT_CENTER;
};
const cityZoom = () => Number(state.config?.city?.zoom) || 14;
const venues = () => state.venues || [];
const chosenVenue = () => venues().find((v) => v.id === state.venueId) || null;
const manualOpen = () => !$('venue-manual').hidden;
const placed = () => Number.isFinite(state.lat) && Number.isFinite(state.lng);

/* ── Каталог ── */

function venueSubtitle(venue) {
  const parts = [t('venueKind')[venue.kind] || t('venueKind').toyxona];
  if (venue.seats) parts.push(t('venueSeats', venue.seats));
  if (venue.address) parts.push(venue.address);
  return parts.join(' · ');
}

function venueCard(venue) {
  const card = h('button', { type: 'button', class: 'venue', dataset: { id: venue.id } },
    h('span', { class: 'venue-mark' }, [...venue.name][0] || '·'),
    h('span', { class: 'venue-copy' },
      h('b', {}, venue.name),
      h('span', {}, venueSubtitle(venue))));
  card.addEventListener('click', () => pickVenue(venue));
  return card;
}

function renderVenues(query = '') {
  const box = $('venue-list');
  if (!box) return;
  const q = query.trim().toLowerCase();
  const list = venues().filter((venue) => !q
    || venue.name.toLowerCase().includes(q)
    || venue.address.toLowerCase().includes(q));
  box.innerHTML = '';
  if (!venues().length) { box.hidden = true; return; }
  box.hidden = false;
  if (!list.length) {
    box.appendChild(h('p', { class: 'venue-empty' }, t('venueEmpty')));
  } else {
    list.slice(0, 40).forEach((venue) => box.appendChild(venueCard(venue)));
  }
  // Карта показывает ровно то, что осталось в списке после поиска.
  paintVenueMarks(list);
}

async function loadVenues() {
  try {
    const response = await fetch('/api/venues');
    const data = await response.json();
    state.venues = Array.isArray(data.venues) ? data.venues : [];
  } catch (_) {
    state.venues = [];
  }
  renderVenues($('geo-q')?.value || '');
  if (venues().length && !placed()) venueMap?.fit(venues());
  // Каталог приезжает уже после первой отрисовки блока. Пока пара ничего не
  // выбрала, возвращаем шаг в то состояние, которое отвечает пришедшему
  // списку: есть места — показываем их, пусто — сразу даём вписать своё.
  if (state.venueId || $('address').value.trim()) { renderVenueChoice(); return; }
  if (venues().length) {
    $('venue-manual').hidden = true;
    $('venue-chosen').hidden = true;
    $('venue-pick').hidden = false;
    $('venue-body').hidden = false;
    paintMapNote();
  } else {
    openManual({ quiet: true });
  }
}

function pickVenue(venue) {
  haptic.ok();
  state.venueId = venue.id;
  $('address').value = venue.name;
  $('address').dataset.manual = '1';
  markFilled($('address'));
  $('geo-list').hidden = true;
  setPoint(venue.lat, venue.lng);
  venueMap?.setView(venue.lat, venue.lng, 17);
  renderVenueChoice();
  clearErr(stepIdx('location'));
  saveDraft();
  autoAdvance(640);
}

/* Место вне каталога: название пальцем, точка — тапом по карте. */
function openManual({ quiet = false } = {}) {
  state.venueId = null;
  $('venue-pick').hidden = true;
  $('venue-body').hidden = true;
  $('venue-chosen').hidden = true;
  $('venue-manual').hidden = false;
  paintVenueMarks([]);
  paintMapNote();
  if (!quiet) {
    haptic.tap();
    requestAnimationFrame(() => $('address').focus({ preventScroll: true }));
  }
}

function reopenVenues() {
  haptic.tap();
  state.venueId = null;
  state.lat = NaN;
  state.lng = NaN;
  $('address').value = '';
  $('address').dataset.manual = '';
  markFilled($('address'));
  $('geo-q').value = '';
  $('geo-list').hidden = true;
  $('venue-chosen').hidden = true;
  $('venue-manual').hidden = true;
  $('venue-pick').hidden = false;
  $('venue-body').hidden = false;
  venueMap?.clearMark();
  renderVenues();
  if (venues().length) venueMap?.fit(venues());
  else venueMap?.setView(cityCenter()[0], cityCenter()[1], cityZoom());
  paintMapNote();
  saveDraft();
}

/* Три состояния блока: выбираем из каталога, выбрали, вписываем своё. */
function renderVenueChoice() {
  const venue = chosenVenue();
  if (venue) {
    $('venue-pick').hidden = true;
    $('venue-body').hidden = true;
    $('venue-manual').hidden = true;
    $('venue-chosen').hidden = false;
    $('venue-name').textContent = venue.name;
    $('venue-meta').textContent = venueSubtitle(venue);
  } else {
    $('venue-chosen').hidden = true;
    if ($('address').value.trim() || !venues().length) {
      $('venue-pick').hidden = true;
      $('venue-body').hidden = true;
      $('venue-manual').hidden = false;
    }
  }
  paintMapNote();
}

/* Режим карты и подсказка следуют за состоянием блока: ткнуть пальцем можно
   только тогда, когда место вписывают руками — у тойхоны из каталога точка
   уже есть, и случайно сбить её тапом нельзя. */
function paintMapNote() {
  const note = $('map-note');
  if (!note) return;
  const manual = manualOpen();
  venueMap?.setPick(manual);
  if (manual && !placed()) { note.textContent = t('mapPick'); note.hidden = false; return; }
  note.hidden = true;
}

/* ── Карта ── */

function renderMapChoice() {
  ensureMap();
  venueMap?.invalidate();
  renderVenueChoice();
}

function ensureMap() {
  if (venueMap || !window.NvMap || !$('map')) return;
  const [lat, lng] = cityCenter();
  venueMap = NvMap.create($('map'), {
    lat: placed() ? state.lat : lat,
    lng: placed() ? state.lng : lng,
    zoom: placed() ? 17 : cityZoom(),
    tiles: state.config?.mapTiles,
    pick: manualOpen(),
    onPin: (pin) => {
      const venue = venues().find((v) => v.id === pin.id);
      if (venue) pickVenue(venue);
    },
    // Тап по карте ставит точку — но только когда место вписывают руками:
    // у выбранной из каталога тойхоны координата уже есть.
    onPick: ({ lat: plat, lng: plng }) => {
      if (!manualOpen()) return;
      haptic.tap();
      setPoint(plat, plng);
      reverseName(plat, plng);
      autoAdvance(720);
    },
  });
  paintVenueMarks();
  if (placed()) venueMap.setMark(state.lat, state.lng);
}

/* Все тойхоны каталога на карте сразу: тап по метке выбирает место. */
function paintVenueMarks(list = venues()) {
  venueMap?.setPins(list.map((venue) => ({
    id: venue.id,
    lat: venue.lat,
    lng: venue.lng,
    label: venue.name,
    active: venue.id === state.venueId,
  })));
}

function setPoint(lat, lng) {
  state.lat = lat;
  state.lng = lng;
  clearErr(stepIdx('location'));
  saveDraft();
  venueMap?.setMark(lat, lng);
  paintMapNote();
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

/* ── Поиск по общей карте: запасной путь для мест вне каталога ── */

let geoSeq = 0;

function geoLocalScore(place) {
  const text = `${place.name || ''} ${place.desc || ''}`.toLowerCase();
  const named = /mang|mańǵ|amud|ámiwd/.test(text) ? 1000 : /qaraqal|karakal/.test(text) ? 350 : 0;
  const centre = cityCenter();
  const distance = Math.hypot((place.lat - centre[0]) * 111, (place.lng - centre[1]) * 82);
  return named - distance;
}

async function seekPlace() {
  const q = $('geo-q').value.trim();
  renderVenues(q);
  if (q.length < 3) { $('geo-list').hidden = true; return; }
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
      .slice(0, 5);
    showGeo(merged);
  } catch (_) {
    if (seq === geoSeq) $('geo-list').hidden = true;
  } finally {
    if (seq === geoSeq) $('geo-spin').hidden = true;
  }
}

const seekPlaceSoon = debounce(seekPlace, 500);

function showGeo(list) {
  const box = $('geo-list');
  box.innerHTML = '';
  if (!list.length) { box.hidden = true; return; }
  box.appendChild(h('p', { class: 'geo-head' }, t('geoHead')));
  list.forEach((place) => {
    const item = h('button', { type: 'button', class: 'geo-item' },
      h('b', {}, place.name || place.desc), place.desc ? h('span', {}, place.desc) : null);
    item.addEventListener('click', () => {
      haptic.tap();
      state.venueId = null;
      $('address').value = (place.name || place.desc || '').slice(0, 140);
      $('address').dataset.manual = '1';
      markFilled($('address'));
      box.hidden = true;
      $('venue-pick').hidden = true;
      $('venue-body').hidden = true;
      $('venue-chosen').hidden = true;
      $('venue-manual').hidden = false;
      paintMapNote();
      setPoint(place.lat, place.lng);
      venueMap?.setView(place.lat, place.lng, 17);
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
  autoAdvance(620);
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

/* ════ 04b · Откуда играть ════

   Прошлая версия просила прицелиться иглой в двухпиксельную полоску — на
   телефоне это спорт, а не выбор. Здесь всё наоборот: пара слушает трек и
   нажимает «Начать отсюда» в тот момент, когда музыка стала правильной. Ухо
   решает, палец только подтверждает.

   Полоса под кнопкой — и ход воспроизведения, и перемотка: тап переносит
   иглу, куда показали. Конца у отрывка нет: дальше трек идёт до конца. */

let trimDuration = 0;
let trimPlaying = false;
let trimAt = 0;               // где сейчас звучит, секунды
let trimSeek = false;         // палец ведёт по полосе
let trimToken = 0;            // отменяет ответы по уже неактуальному треку

const clockText = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const trimmable = () => Boolean(state.music?.playUrl);
const trimStart = () => Math.max(0, Math.min(state.musicStart || 0, Math.max(0, trimDuration - 1)));

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

/* ── Отрисовка ── */

function paintTrim() {
  if (!trimDuration) return;
  const start = trimStart();
  state.musicStart = start;
  state.musicEnd = null;                       // играем до конца трека

  const pct = (sec) => `${Math.max(0, Math.min(100, (sec / trimDuration) * 100))}%`;
  $('trim-from').textContent = clockText(start);
  $('trim-clock').textContent = clockText(trimAt);
  $('trim-flag').style.left = pct(start);
  $('trim-head').style.left = pct(trimAt);
  $('trim-done').style.width = pct(trimAt);
  $('trim-kept').style.left = pct(start);

  const line = $('trim-line');
  line.setAttribute('aria-valuemin', '0');
  line.setAttribute('aria-valuemax', String(Math.round(trimDuration)));
  line.setAttribute('aria-valuenow', String(Math.round(trimAt)));
  line.setAttribute('aria-valuetext', clockText(trimAt));

  $('music-trim').classList.toggle('is-playing', trimPlaying);
  $('music-trim').classList.toggle('is-set', start > 0);
  $('trim-state').textContent = start > 0
    ? t('trimFrom', clockText(start))
    : t('trimListen');
  $('trim-play').setAttribute('aria-label', trimPlaying ? t('pauseAria') : t('playAria'));
  $('trim-reset').hidden = start <= 0;
}

/* Показываем дорожку только там, где её слышно: у ссылки на YouTube нет ни
   длительности, ни звука, и гадать мы не будем. */
async function openTrim() {
  const box = $('music-trim');
  if (!box) return;
  const token = ++trimToken;
  stopTrim();
  trimDuration = 0;
  trimAt = 0;
  hideCutTip();
  const url = state.music?.playUrl;
  if (!url) { box.hidden = true; return; }

  box.hidden = false;
  box.classList.add('is-loading');
  const duration = await audioDuration(url);
  if (token !== trimToken) return;
  if (!Number.isFinite(duration) || duration < 4) {
    box.hidden = true;
    box.classList.remove('is-loading');
    return;
  }

  trimDuration = duration;
  if (!Number.isFinite(state.musicStart)) state.musicStart = 0;
  state.musicEnd = null;
  trimAt = trimStart();
  box.classList.remove('is-loading');
  paintTrim();
  loadCutTip(token);
}

function closeTrim() {
  trimToken += 1;
  stopTrim();
  trimDuration = 0;
  trimAt = 0;
  hideCutTip();
  const box = $('music-trim');
  if (box) { box.hidden = true; box.classList.remove('is-loading', 'is-playing', 'is-set'); }
}

/* ── Звук ── */

function onTrimTime() {
  if (trimSeek) return;
  trimAt = player.currentTime;
  paintTrim();
}

function onTrimEnd() {
  trimPlaying = false;
  trimAt = trimStart();
  paintTrim();
}

function playTrim(from = trimAt) {
  const url = state.music?.playUrl;
  if (!url) return;
  playingUrl = null;
  activeTrackUrl = null;
  refreshPlayUI();

  const go = () => {
    try { player.currentTime = Math.max(0, Math.min(from, trimDuration - .2)); } catch (_) { /* поток ещё не готов */ }
    player.play().then(() => {
      trimPlaying = true;
      paintTrim();
    }).catch(() => { trimPlaying = false; paintTrim(); });
  };

  player.addEventListener('timeupdate', onTrimTime);
  player.addEventListener('ended', onTrimEnd);
  if (player.src.includes(url) && player.readyState >= 1) { go(); return; }
  player.src = url;
  player.addEventListener('loadedmetadata', go, { once: true });
}

function stopTrim() {
  player.removeEventListener('timeupdate', onTrimTime);
  player.removeEventListener('ended', onTrimEnd);
  if (!player.paused) player.pause();
  trimPlaying = false;
  if (trimDuration) paintTrim();
}

function toggleTrimPlay() {
  haptic.tap();
  if (trimPlaying) { stopTrim(); return; }
  playTrim(trimAt >= trimDuration - .3 ? trimStart() : trimAt);
}

/* Главное действие: то, что сейчас звучит, и становится началом. */
function markStart(sec = trimAt) {
  state.musicStart = Math.max(0, Math.round(Math.min(sec, trimDuration - 1)));
  haptic.ok();
  paintTrim();
  saveDraft();
}

function resetStart() {
  haptic.tap();
  state.musicStart = 0;
  trimAt = 0;
  paintTrim();
  saveDraft();
  if (trimPlaying) playTrim(0);
}

/* ── Перемотка по полосе ── */

function secAt(clientX) {
  const rect = $('trim-line').getBoundingClientRect();
  if (!rect.width) return 0;
  const k = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  return k * trimDuration;
}

/* ── Подсказка: откуда этот трек запускают другие пары ── */

function hideCutTip() {
  const tip = $('trim-tip');
  if (tip) { tip.hidden = true; tip.onclick = null; }
}

async function loadCutTip(token) {
  const tip = $('trim-tip');
  const music = state.music;
  if (!tip || !music || music.type === 'upload') return;
  const query = new URLSearchParams({ type: music.type });
  if (music.type === 'itunes') {
    query.set('name', music.value?.name ?? '');
    query.set('artist', music.value?.artist ?? '');
    query.set('url', music.value?.url ?? '');
  } else {
    query.set('url', String(music.value ?? ''));
  }
  let cut = null;
  try {
    const response = await fetch(`/api/music/cut?${query}`);
    cut = (await response.json()).cut;
  } catch (_) { return; }
  if (token !== trimToken || !cut || !Number.isFinite(cut.start)) return;
  if (cut.start >= trimDuration - 1) return;

  tip.textContent = t('trimTip', clockText(cut.start), cut.uses);
  tip.hidden = false;
  tip.onclick = () => {
    markStart(cut.start);
    trimAt = cut.start;
    playTrim(cut.start);
  };
}

function wireTrim() {
  $('trim-play').addEventListener('click', toggleTrimPlay);
  $('trim-set').addEventListener('click', () => markStart());
  $('trim-reset').addEventListener('click', resetStart);

  const line = $('trim-line');

  const moveTo = (clientX) => {
    trimAt = secAt(clientX);
    paintTrim();
  };

  line.addEventListener('pointerdown', (event) => {
    if (!trimDuration) return;
    event.preventDefault();
    trimSeek = true;
    line.setPointerCapture?.(event.pointerId);
    line.classList.add('is-seeking');
    moveTo(event.clientX);
  });
  line.addEventListener('pointermove', (event) => {
    if (!trimSeek) return;
    moveTo(event.clientX);
  });
  const release = () => {
    if (!trimSeek) return;
    trimSeek = false;
    line.classList.remove('is-seeking');
    haptic.tap();
    // Отпустили — оттуда и звучит: слышно ровно то место, куда показали.
    playTrim(trimAt);
  };
  line.addEventListener('pointerup', release);
  line.addEventListener('pointercancel', release);

  line.addEventListener('keydown', (event) => {
    if (!trimDuration) return;
    const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    if (step) {
      event.preventDefault();
      trimAt = Math.max(0, Math.min(trimDuration, trimAt + step));
      paintTrim();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      markStart();
    }
  });
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
    address: $('address').value.trim(), map: placed() ? '1' : '0',
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

/* Телефон отдаёт фото так, как ему удобно: iPhone — HEIC, который сервер не
   понимает, Android — кадр на 20 мегапикселей, который не долетает по мобильной
   сети. Поэтому перед отправкой мы сами перекладываем снимок в JPEG нужного
   размера. Браузер уже умеет декодировать всё, что снял его же телефон, —
   декодируем и пересобираем. Не вышло — отправляем оригинал как есть. */
const PHOTO_EDGE = 2000;
const PHOTO_QUALITY = .86;

async function shrinkPhoto(file) {
  if (!('createImageBitmap' in window) || file.type === 'image/gif') return file;
  let bitmap = null;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, PHOTO_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    // Уже JPEG нужного размера — второй прогон только съест качество.
    if (scale === 1 && file.type === 'image/jpeg' && file.size <= 4 * 1024 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', PHOTO_QUALITY));
    return blob && blob.size ? blob : file;
  } catch (_) {
    return file;
  } finally {
    bitmap?.close?.();
  }
}

/* Что именно не получилось — важно: «файл не загрузился» на упёршемся лимите
   отправляет пару жать кнопку снова и снова. */
function uploadError(status, payload) {
  if (status === 429) return t('eTooMany');
  if (status === 401) return payload?.error || t('eUpload');
  if (status === 400) return t('eFormat');
  return t('eUpload');
}

async function sendPhoto(body) {
  const response = await fetch('/api/upload', {
    method: 'POST', headers: { 'x-init-data': tg ? tg.initData : '' }, body,
  });
  let payload = null;
  try { payload = await response.json(); } catch (_) { /* пустой ответ шлюза */ }
  if (!response.ok || !payload?.ok || payload.kind !== 'image') {
    const error = new Error('upload-failed');
    error.text = uploadError(response.status, payload);
    error.retriable = !response.ok && response.status !== 400 && response.status !== 429;
    throw error;
  }
  return payload;
}

async function uploadPhotos(files) {
  const max = requiredPhotos();
  for (const file of files) {
    if (state.photos.length >= max) break;
    if (file.size > 40 * 1024 * 1024) { toast(t('eBig'), 'err'); continue; }
    const preview = URL.createObjectURL(file);
    const slot = { name: null, url: preview, uploading: true };
    state.photos.push(slot);
    renderPhotos();
    try {
      const body = await shrinkPhoto(file);
      if (body.size > 16 * 1024 * 1024) throw Object.assign(new Error('big'), { text: t('eBig') });
      let payload;
      try {
        payload = await sendPhoto(body);
      } catch (error) {
        // Обрыв мобильной сети — обычное дело: молча пробуем второй раз.
        if (!error.retriable) throw error;
        payload = await sendPhoto(body);
      }
      slot.name = payload.file;
      slot.uploading = false;
    } catch (error) {
      state.photos = state.photos.filter((p) => p !== slot);
      URL.revokeObjectURL(preview);
      toast(error?.text || t('eUpload'), 'err');
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
/* Кнопки «добавить» нет: в конце списка всегда ждёт пустое поле.
   Начал печатать — снизу сразу появляется следующее. Пустые не считаются. */
function renderGuests(focusIdx = -1) {
  const sw = $('guests-toggle');
  sw.setAttribute('aria-checked', String(state.guestsOn));
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

// Телефон — единственное, чего бот о паре не знает.
function contactsFilled() {
  return /\d{7}/.test($('phone').value.replace(/\D/g, ''));
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
    mapEnabled: placed(),
    lat: placed() ? state.lat : null,
    lng: placed() ? state.lng : null,
    address: $('address').value.trim(),
    photos: state.photos.filter((p) => p.name).slice(0, requiredPhotos()).map((p) => p.name),
    musicType: state.music?.type ?? 'none',
    musicValue: state.music?.value ?? null,
    musicStart: trimmable() ? state.musicStart ?? null : null,
    musicEnd: null,
    templateId: state.templateId,
    guestNames: cleanGuests(),
    phone: $('phone').value.trim(),
  };
}

async function submit() {
  if (state.sending) return;
  if (!contactsFilled()) { showErr(8, t('eContact_')); return; }
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
  $('venue-own').addEventListener('click', () => openManual());
  $('venue-change').addEventListener('click', reopenVenues);
  $('address').addEventListener('input', () => {
    state.venueId = null;
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

  $('phone').addEventListener('input', () => { markFilled($('phone')); clearErr(8); saveDraft(); });
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
  for (const id of ['groom', 'bride', 'address', 'phone']) markFilled($(id));
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
  loadVenues();
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
