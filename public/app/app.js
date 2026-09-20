/* global UI, NvMap */
/* nvate studio — одна вертикальная нить. Кнопки «продолжить» нет: как только блок
   заполнен верно, следующий сам медленно проявляется и подъезжает к экрану.
   Секции: состояние · словарь · нить и док · блоки · демо · отправка · старт. */
'use strict';

const { $, h, debounce, toast, sheet, stageRest, haptic, tg } = UI;

if (tg) { tg.ready(); tg.expand(); try { tg.setHeaderColor('#100b03'); } catch (_) { /* старый клиент */ } }

/* Тег сборки из разметки. Всё, что студия догружает сама, идёт с ним же:
   у браузера тогда один адрес на версию, и держать файл можно вечно. */
const BUILD = document.querySelector('meta[name="nv-build"]')?.content || '';
const asset = (name) => (BUILD && BUILD !== '__V__' ? `${name}?v=${BUILD}` : name);

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
  music: null,          // выбранная песня: { provider, trackId, title, artist, cover, duration, startAt, volume }
  guestsOn: false,
  guests: [],
  promo: null,          // применённый промокод: { code, kind, value }
  readyUrl: null,       // ссылка, если платить было нечего и заявку подтвердили сразу
  previewHtml: '',
  seenInvite: false,
  sending: false,
  submitted: false,     // заявка ушла: студия под экраном «Готово» уже чужая
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
      music: state.music,
      guestsOn: state.guestsOn, guests: state.guests,
      promo: state.promo,
      phone: $('phone').value,
      open: state.open, seenInvite: state.seenInvite,
      submissionKey: state.submissionKey,
    }));
  } catch (_) { /* переполненное хранилище не критично */ }
  pingSession(state.open);
}, 400);

function clearDraft() {
  // Отложенное автосохранение отменяем первым: иначе оно вернёт черновик в
  // хранилище через мгновение после того, как мы его стёрли.
  saveDraft.cancel();
  try { localStorage.removeItem(DRAFT); } catch (_) { /* — */ }
  pingSession(null);
}

/* Отметка в статистике: кто открыл студию и на каком шаге стоит черновик.
   Шлём только при смене шага — автосохранение срабатывает на каждый ввод. */
let lastPing = 'init';
function pingSession(step) {
  const value = Number.isInteger(step) ? step : null;
  const mark = String(value);
  if (mark === lastPing) return;
  lastPing = mark;
  try {
    fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg ? tg.initData : '', step: value, lang: LANG }),
      keepalive: true,
    }).catch(() => { /* статистика не должна мешать студии */ });
  } catch (_) { /* — */ }
}

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
  // Черновики прошлых версий хранили песню иначе; iTunes-превью выбираются заново.
  state.music = NvMusicCore.migrateDraftMusic(d.music, d.musicStart);
  state.guestsOn = Boolean(d.guestsOn);
  state.guests = Array.isArray(d.guests) ? d.guests.slice(0, 100) : [];
  state.promo = validPromo(d.promo);
  state.seenInvite = Boolean(d.seenInvite);
  state.open = Math.min(Number(d.open) || 0, STEPS.length - 1);
  return true;
}

/* ════ Словарь ════ */

/* ── Слова студии ──
   Говорим с парой, а не с пользователем: короткими строками, без «образцов»,
   «барабанов» и «глазков». Каждый шаг — одна мысль: заголовок говорит, о чём
   он, подпись под ним — что сделать. Ключи одни на оба языка. */
const I18N = {
  uz: {
    eNames: 'Ikkovingiz', tNames: 'Ismlaringiz',
    leadNames: 'Taklifnomada ismlaringiz xuddi shunday turadi.',
    phGroom: 'Kuyov', phBride: 'Kelin', groom: 'Kuyov ismi', bride: 'Kelin ismi',

    eDate: 'Kun', tDate: 'To‘y qachon',
    timeLbl: 'Boshlanish vaqti',
    timePrompt: 'Soat va daqiqani suring — vaqt shu yerda chiqadi.',

    eVenue: 'Joy', tVenue: 'Qayerda kutamiz',
    address: 'To‘yxona nomi',
    leadVenue: 'To‘yxonani ro‘yxatdan tanlang. Sizniki yo‘q bo‘lsa — nomini o‘zingiz yozing.',
    seekLbl: 'To‘yxonani qidirish', seekPlace: 'Nomi yoki mo‘ljal',
    venueOwn: 'Mening joyim ro‘yxatda yo‘q',
    venueEmpty: 'Bunday joy topilmadi — nomini o‘zingiz yozing',
    venueSeats: (n) => `${n} o‘rin`,
    venueKind: { toyxona: 'To‘yxona', restoran: 'Restoran', kafe: 'Kafe', bog: 'Bog‘' },
    geoHead: 'Umumiy xaritadan topildi',
    mapPick: 'Bu joy ro‘yxatda yo‘q — taklifnomada xaritasiz, faqat nomi bilan chiqadi.',
    mapHint: 'Nuqtani aniqlashtirish uchun xaritaga bosing',
    change: 'O‘zgartirish',

    eMusic: 'Musiqa', tMusic: 'Sizning qo‘shig‘ingiz',

    eTpl: 'Dizayn', tTpl: 'Uslubni tanlang',
    leadTpl: 'Tanlash uchun kartaga bosing. Burchakdagi belgi taklifnomani to‘liq ochadi.',
    tplPhotos: (n) => `${n} ta surat`,

    ePhotos: 'Suratlar', tPhotos: 'Sizning suratlaringiz',
    photoNeed: (n) => `Bu uslubga <b>${n} ta</b> surat kerak`,
    photoOf: (i, n) => `${i} / ${n}`,

    eReady: 'Tayyor', tReady: 'Mana nima chiqdi',
    leadReady: 'Taklifnoma yig‘ildi. Mehmonlar ko‘radigan holida qarang.',
    seeInvite: 'Yana ko‘rish',
    readyHint: 'Taklifnoma o‘zi ochiladi. Oxirigacha suring — studiyaga qaytasiz.',
    readyNext: 'Davom etish →',
    wmTitle: 'Bu hali namuna',
    wmText: 'Ustida «nVate» to‘ri turibdi va matnni nusxalab bo‘lmaydi. To‘lovdan keyin to‘r yo‘qoladi, havola toza bo‘ladi.',

    eGuests: 'Mehmonlar', tGuests: 'Ismli taklifnomalar',
    guestsSwTitle: 'Har bir mehmonga alohida havola',
    guestsSwOff: 'O‘chirilgan', guestsSwOn: 'Yoqilgan',
    gHow1t: 'Ismlar ro‘yxati', gHow1: 'Mehmonlarni yozasiz — har birini alohida qatorga.',
    gHow2t: 'Har kimga o‘z havolasi', gHow2: 'Mehmon taklifnomani ochadi va birinchi qatorda o‘z ismini ko‘radi.',
    gHow3t: 'Havolalar botga keladi', gHow3: 'To‘lovdan keyin tayyor havolalar ro‘yxati botga tushadi.',
    guestPh: 'Ismni yozing…', guestAdd: 'Ism qo‘shish', guestsUnit: 'ta ism',

    eContact: 'To‘lov', tContact: 'Oxirgi qadam',
    leadContact: 'Telegram’ingiz bizda bor. Faqat raqamingizni qoldiring.',
    phoneLbl: 'Telefon raqam',
    contactRule: 'To‘lovni tasdiqlash uchun shu raqamga qo‘ng‘iroq qilamiz.',
    total: 'Jami', sum: 'so‘m',
    promoApply: 'Qo‘llash', promoPh: 'Promokod',
    promoBill: 'Promokod', promoDrop: 'Promokodni olib tashlash',
    promoOk: 'Promokod qo‘llandi', promoBad: 'Bunday promokod yo‘q yoki muddati tugagan',
    promoLate: 'Promokod endi ishlamayapti — uni olib tashlang',
    pay: 'To‘lash va havola olish', sending: 'Yuborilmoqda',

    doneTitle: 'Arizangiz bizda', doneNew: 'Yangi taklifnoma',
    doneFreeTitle: 'Taklifnomangiz tayyor',
    doneFreeText: 'To‘lov kerak emas — havola sizniki. U botga ham keldi, mehmon ismlari bilan birga.',
    doneOpen: 'Taklifnomani ochish', doneCopy: 'Nusxalash',
    doneText: 'To‘lovni tasdiqlaymiz va toza havola botga keladi. Odatda bu 10 daqiqagacha vaqt oladi.',
    mineTitle: 'Mening taklifnomalarim',

    gateTitle: 'Studiya Telegram’da ochiladi',
    gateText: 'Taklifnoma botimizda yig‘iladi: suratlar shu yerda yuklanadi, qo‘shiq tanlanadi va tayyor havola ham o‘sha yerga keladi.',
    gateOpen: 'Telegram’da ochish',
    gateScan: 'Yoki telefon kamerasini shu kodga to‘g‘rilang',
    gateWhy: 'Bu bepul: bot xuddi shu studiyani ochadi.',

    add: 'Qo‘shish', lookDone: 'Ko‘rib chiqdim', nextCue: 'Keyingi bosqich',
    nextUp: 'Keyingi bosqich ochildi',
    demo: 'Ko‘rish', live: 'Jonli namuna', popular: 'Ko‘p tanlangan',
    take: 'Tanlash', taken: 'Tanlandi', tplPlate: 'Taklifnoma',
    copied: 'Nusxa olindi',

    mineAria: 'Mening taklifnomalarimni ochish', closeAria: 'Yopish', stepsAria: 'Studio bosqichlari',
    prevMonthAria: 'Oldingi oy', nextMonthAria: 'Keyingi oy', hoursAria: 'Soatlar', minutesAria: 'Daqiqalar',
    photoUploadAria: 'Surat yuklash', photoRemoveAria: 'Suratni o‘chirish', previewAria: 'Taklifnoma namunasi',

    beads: ['Ismlar', 'Sana', 'Joy', 'Musiqa', 'Dizayn', 'Suratlar', 'Tayyor', 'Mehmonlar', 'To‘lov'],
    months: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
    dow: ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'],

    eNames_: 'Ikkala ismni ham yozing',
    eDate_: 'Taqvimdan kunni tanlang',
    eVenue_: 'To‘yxonani tanlang yoki nomini yozing',
    eTpl_: 'Uslubni tanlang',
    ePhoto_: (n) => `Yana ${n} ta surat kerak`,
    eGuest_: 'Bo‘sh qatorlarni to‘ldiring yoki o‘chiring',
    eContact_: 'Telefon raqamingizni yozing',
    eNet: 'Aloqa yo‘q. Qayta urinib ko‘ring', eNoFound: 'Hech narsa topilmadi',
    eUpload: 'Surat yuklanmadi. Qayta urinib ko‘ring', eBig: 'Fayl juda katta',
    eTooMany: 'Juda ko‘p urinish. Bir necha daqiqadan keyin urinib ko‘ring',
    eFormat: 'Bu format o‘qilmadi — JPG, PNG yoki HEIC yuboring',
    eLink: 'Havola tanilmadi',
    noGeo: 'Joylashuv aniqlanmadi',
  },
  ru: {
    eNames: 'Двое', tNames: 'Ваши имена',
    leadNames: 'Так они и будут стоять на приглашении.',
    phGroom: 'Жених', phBride: 'Невеста', groom: 'Имя жениха', bride: 'Имя невесты',

    eDate: 'День', tDate: 'Когда свадьба',
    timeLbl: 'Время начала',
    timePrompt: 'Прокрутите часы и минуты — время появится здесь.',

    eVenue: 'Место', tVenue: 'Где встречаемся',
    address: 'Название тойхоны',
    leadVenue: 'Выберите тойхону из списка. Если вашей нет — впишите название сами.',
    seekLbl: 'Поиск тойхоны', seekPlace: 'Название или ориентир',
    venueOwn: 'Моего места нет в списке',
    venueEmpty: 'Такого места не нашлось — впишите название сами',
    venueSeats: (n) => `${n} мест`,
    venueKind: { toyxona: 'Тойхона', restoran: 'Ресторан', kafe: 'Кафе', bog: 'Сад' },
    geoHead: 'Найдено на общей карте',
    mapPick: 'Этого места нет в списке — в приглашении будет только название, без карты.',
    mapHint: 'Нажмите на карту, чтобы уточнить точку',
    change: 'Изменить',

    eMusic: 'Музыка', tMusic: 'Ваша песня',

    eTpl: 'Дизайн', tTpl: 'Выберите стиль',
    leadTpl: 'Нажмите на карточку, чтобы выбрать. Значок в углу открывает приглашение целиком.',
    tplPhotos: (n) => `${n} фото`,

    ePhotos: 'Фото', tPhotos: 'Ваши фотографии',
    photoNeed: (n) => `Этому стилю нужно <b>${n} фото</b>`,
    photoOf: (i, n) => `${i} / ${n}`,

    eReady: 'Готово', tReady: 'Вот что получилось',
    leadReady: 'Приглашение собрано. Посмотрите его так, как увидят гости.',
    seeInvite: 'Посмотреть ещё раз',
    readyHint: 'Приглашение откроется само. Долистайте до конца — и вернётесь в студию.',
    readyNext: 'Продолжить →',
    wmTitle: 'Это пока образец',
    wmText: 'Поверх лежит сетка «nVate», и текст нельзя скопировать. После оплаты сетка исчезнет, а ссылка станет чистой.',

    eGuests: 'Гости', tGuests: 'Именные приглашения',
    guestsSwTitle: 'Персональная ссылка каждому гостю',
    guestsSwOff: 'Выключено', guestsSwOn: 'Включено',
    gHow1t: 'Список имён', gHow1: 'Вписываете гостей — каждого отдельной строкой.',
    gHow2t: 'Каждому своя ссылка', gHow2: 'Гость откроет приглашение и первой строкой увидит своё имя.',
    gHow3t: 'Ссылки придут в бот', gHow3: 'После оплаты бот пришлёт готовый список ссылок.',
    guestPh: 'Впишите имя…', guestAdd: 'Добавить имя', guestsUnit: 'имён',

    eContact: 'Оплата', tContact: 'Последний шаг',
    leadContact: 'Ваш Telegram у нас уже есть. Оставьте только номер.',
    phoneLbl: 'Номер телефона',
    contactRule: 'Позвоним по нему, чтобы подтвердить оплату.',
    total: 'Итого', sum: 'сум',
    promoApply: 'Применить', promoPh: 'Промокод',
    promoBill: 'Промокод', promoDrop: 'Снять промокод',
    promoOk: 'Промокод применён', promoBad: 'Такого промокода нет или он больше не действует',
    promoLate: 'Промокод больше не действует — снимите его',
    pay: 'Оплатить и получить ссылку', sending: 'Отправляем',

    doneTitle: 'Заявка у нас', doneNew: 'Новое приглашение',
    doneFreeTitle: 'Приглашение готово',
    doneFreeText: 'Платить нечего — ссылка уже ваша. Она пришла и в бот, вместе с именными ссылками гостей.',
    doneOpen: 'Открыть приглашение', doneCopy: 'Скопировать',
    doneText: 'Подтвердим оплату — и чистая ссылка придёт в бот. Обычно это занимает до 10 минут.',
    mineTitle: 'Мои приглашения',

    gateTitle: 'Студия открывается в Telegram',
    gateText: 'Приглашение собирается в нашем боте: там загружаются фото, выбирается песня и туда же придёт готовая ссылка.',
    gateOpen: 'Открыть в Telegram',
    gateScan: 'Или наведите камеру телефона на код',
    gateWhy: 'Это бесплатно: бот откроет ту же самую студию.',

    add: 'Добавить', lookDone: 'Посмотрел', nextCue: 'Следующий шаг',
    nextUp: 'Следующий шаг открыт',
    demo: 'Открыть', live: 'Живой пример', popular: 'Чаще выбирают',
    take: 'Выбрать', taken: 'Выбрано', tplPlate: 'Приглашение',
    copied: 'Скопировано',

    mineAria: 'Открыть мои приглашения', closeAria: 'Закрыть', stepsAria: 'Этапы студии',
    prevMonthAria: 'Предыдущий месяц', nextMonthAria: 'Следующий месяц', hoursAria: 'Часы', minutesAria: 'Минуты',
    photoUploadAria: 'Загрузить фотографию', photoRemoveAria: 'Удалить фотографию', previewAria: 'Предпросмотр приглашения',

    beads: ['Имена', 'Дата', 'Место', 'Музыка', 'Дизайн', 'Фото', 'Готово', 'Гости', 'Оплата'],
    months: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
    dow: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],

    eNames_: 'Впишите оба имени',
    eDate_: 'Выберите день в календаре',
    eVenue_: 'Выберите тойхону или впишите название',
    eTpl_: 'Выберите стиль',
    ePhoto_: (n) => `Добавьте ещё ${n} фото`,
    eGuest_: 'Заполните или удалите пустые строки',
    eContact_: 'Впишите номер телефона',
    eNet: 'Нет связи. Попробуйте ещё раз', eNoFound: 'Ничего не нашлось',
    eUpload: 'Фото не загрузилось. Попробуйте ещё раз', eBig: 'Файл слишком большой',
    eTooMany: 'Слишком много попыток. Повторите через несколько минут',
    eFormat: 'Такой формат не читается — пришлите JPG, PNG или HEIC',
    eLink: 'Ссылка не распознана',
    noGeo: 'Не удалось определить место',
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
  $('groom').placeholder = t('phGroom');
  $('bride').placeholder = t('phBride');
  $('groom').setAttribute('aria-label', t('groom'));
  $('bride').setAttribute('aria-label', t('bride'));
  $('geo-q').placeholder = t('seekPlace');
  $('done-title').textContent = t(state.readyUrl ? 'doneFreeTitle' : 'doneTitle');
  $('done-text').textContent = t(state.readyUrl ? 'doneFreeText' : 'doneText');
  $('promo-code').placeholder = t('promoPh');
  $('promo-code').setAttribute('aria-label', t('promoPh'));
  $('promo-drop').setAttribute('aria-label', t('promoDrop'));
  $('geo-q').setAttribute('aria-label', t('seekLbl'));
  $('next-cue-label').textContent = t('nextCue');
  $('submit-label').textContent = t('pay');
  $('btn-mine').setAttribute('aria-label', t('mineAria'));
  $('mine-close').setAttribute('aria-label', t('closeAria'));
  $('sheet-close').setAttribute('aria-label', t('closeAria'));
  $('dock').setAttribute('aria-label', t('stepsAria'));
  $('cal-prev').setAttribute('aria-label', t('prevMonthAria'));
  $('cal-next').setAttribute('aria-label', t('nextMonthAria'));
  $('hour-drum').setAttribute('aria-label', t('hoursAria'));
  $('min-drum').setAttribute('aria-label', t('minutesAria'));
  $('photo-input').setAttribute('aria-label', t('photoUploadAria'));
  $('sheet-frame').setAttribute('title', t('previewAria'));
  $('sw-uz').classList.toggle('on', LANG === 'uz');
  $('sw-ru').classList.toggle('on', LANG === 'ru');
  document.querySelector('.langsw')?.classList.toggle('at-ru', LANG === 'ru');
  paintPlate();
  renderBeads();
  renderCalendar();
  buildClock();
  renderTemplates();
  renderPhotos();
  renderGuests();
  Music?.render();
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
  quietReveal: 1200,
});
/* Пара печатает — не торопим. Три секунды тишины после последней буквы, и
   только тогда клавиатура уходит, а камера едет дальше. */
const TYPING_PAUSE = 3000;
/* Именные приглашения держим на экране пять секунд: пара успевает прочитать и
   решить. Тронула переключатель или печатает имена — отсчёт начинается заново,
   камера не уезжает посреди слова. */
const GUESTS_HOLD = 5000;
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

/* Свет у студии один: золото не меняется от шага к шагу. Тот же тон читают
   небо (sky.js) и волна катушки (music-start.js) через --scene-r/g/b, поэтому
   он живёт в CSS-переменных, а не в фоне отдельного слоя. */
const SCENE = { rgb: '214,173,104', theme: '#090807' };
let scenePainted = false;

function setScene() {
  if (scenePainted) return;
  scenePainted = true;
  const root = document.documentElement;
  const [red, green, blue] = SCENE.rgb.split(',').map(Number);
  root.style.setProperty('--scene-r', String(red));
  root.style.setProperty('--scene-g', String(green));
  root.style.setProperty('--scene-b', String(blue));
  window.Sky?.setTone(red, green, blue);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', SCENE.theme);
  try { tg?.setHeaderColor(SCENE.theme); } catch (_) { /* outside Telegram */ }
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
  makeRoom(el);
  const y = slotTop(el) - headerOffset();
  setScene();
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

/* Последнему открытому блоку ниже может не хватить страницы — камера не довезла
   бы его до места. Хвост студии вытягивается ровно настолько, чтобы верх блока
   доехал до своей линии: под шапку или до середины экрана. */
function makeRoom(el, line = headerOffset()) {
  const tail = document.querySelector('.studio-tail');
  if (!tail || !el) return;
  const need = window.innerHeight - line - el.offsetHeight - 24;
  tail.style.minHeight = need > 0 ? `${Math.ceil(need)}px` : '';
}

/* ── Тихий переход ──
   Камера остаётся там, где пара её оставила: музыку выбирают долго, и
   утаскивать экран из-под пальца нельзя. Следующий блок ждёт внизу и медленно
   поднимается, когда пара сама до него долистает, — появление видно, а не
   случается где-то за краем. Пока он ниже экрана, над доком проявляется
   подсказка «Следующий шаг». */
function showCue(onTap) {
  const cue = $('next-cue');
  if (!cue) return;
  clearTimeout(showCue.hideTimer);
  cue.onclick = () => { haptic.tap(); onTap(); };
  cue.hidden = false;
  void cue.offsetWidth;   // фиксируем скрытое состояние, чтобы проявление было переходом
  cue.classList.add('is-in');
}

function hideCue() {
  const cue = $('next-cue');
  if (!cue || cue.hidden) return;
  cue.classList.remove('is-in');
  cue.onclick = null;
  clearTimeout(showCue.hideTimer);
  showCue.hideTimer = setTimeout(() => { if (!cue.classList.contains('is-in')) cue.hidden = true; }, 1100);
}

function revealWhenSeen(i, run) {
  const el = blk(i);
  if (!el) return;
  let done = false;
  let observer = null;
  const seen = () => el.getBoundingClientRect().top < window.innerHeight - 60;
  const onScroll = () => { if (seen()) reveal(); };
  async function reveal() {
    if (done) return;
    done = true;
    observer?.disconnect();
    window.removeEventListener('scroll', onScroll);
    hideCue();
    if (run !== revealRun || state.open !== i) return;
    setScene();
    haptic.ok();
    pulseLiveBead();
    await riseBlock(el, FLOW.quietReveal);
    if (run === revealRun && state.open === i) activateStep(i);
  }
  if (seen()) { reveal(); return; }
  showCue(() => scrollToBlock(i));
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) reveal();
    }, { rootMargin: '0px 0px -60px 0px' });
    observer.observe(el);
  } else {
    window.addEventListener('scroll', onScroll, { passive: true });
  }
}

/* Автоскролл везёт новый блок только до середины экрана: его верх встаёт
   посередине, а конец пройденного блока остаётся на виду. Блок уже выше
   середины — камера стоит, назад она не едет. Прыжок по доку (scrollToBlock)
   по-прежнему ставит блок под шапку. */
async function cameraTo(i) {
  const el = blk(i);
  if (!el) return;
  const line = Math.round(window.innerHeight / 2);
  makeRoom(el, line);
  const dest = Math.max(0, slotTop(el) - line);
  const maxTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const y = Math.min(maxTop, dest);
  const distance = y - window.scrollY;
  if (distance <= 8) return;
  const duration = Math.min(FLOW.scrollMax, Math.max(FLOW.scrollMin, 900 + distance * .9));
  await softScrollTo(y, duration);
}

async function riseBlock(el, duration = FLOW.reveal) {
  if (!el) return;
  el.style.opacity = '0';
  el.style.transform = `translate3d(0, ${FLOW.rise}px, 0)`;
  el.style.pointerEvents = 'none';
  el.style.willChange = 'opacity, transform';
  el.classList.add('is-rising', 'is-live');
  el.classList.remove('is-wait');
  await playMotion(duration, (k) => {
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
  hideCue();
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
    // Тихий переход камеру не трогает: блок поднимется, когда до него долистают.
    if (quiet) { revealWhenSeen(i, run); return; }
    setScene();
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
    unlock(i + 1, { quiet: step.quiet === true });
  }, Math.max(FLOW.settle, Number(delay) || 0));
}

function prepareStep(i) {
  const id = STEPS[i].id;
  if (id === 'location') renderMapChoice();
  if (id === 'music') Music?.render();
  // Обложки собираются из имён и даты — к этому шагу они уже введены.
  if (id === 'template') renderTemplates();
  if (id === 'photos') renderPhotos();
  if (id === 'ready') { renderReady(); loadPreview(); }
  if (id === 'guests') renderGuests();
  if (id === 'contact') updateBill();
}

/* ── Каскад ──
   Карточки списка приходят по очереди, а не пачкой. Класс живёт ровно столько,
   сколько идёт анимация: перерисовка по тапу (выбрал стиль, удалил фото) её не
   повторяет, потому что каскад запускают только открытие шага и смена месяца. */
const cascadeTimers = new WeakMap();
function cascade(box) {
  if (!box || !box.children.length || calmMotion()) return;
  clearTimeout(cascadeTimers.get(box));
  box.classList.remove('cascade');
  void box.offsetWidth;
  box.classList.add('cascade');
  cascadeTimers.set(box, setTimeout(() => box.classList.remove('cascade'), 1200));
}

/* «Меньше движения» — но отладочный переключатель html[data-motion="full"]
   возвращает его там, где браузер репортит reduce жёстко (стенды, автотесты). */
const calmMotion = () => document.documentElement.dataset.motion !== 'full'
  && Boolean(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

/* Сумма не перескакивает, а добегает: видно, что именно её изменило.
   Кадры может придержать кто угодно — свёрнутая вкладка, экономия батареи,
   переход в фон. Поэтому итог дописывает таймер: сколько бы кадров ни выпало,
   в счёте останется настоящая сумма, а не число на полпути. */
const MONEY_RUN = 620;
function countMoney(el, target) {
  const from = Number(el.dataset.v || 0);
  el.dataset.v = String(target);
  clearTimeout(countMoney.settle);
  countMoney.run = (countMoney.run || 0) + 1;
  const run = countMoney.run;
  if (from === target || calmMotion()) { el.textContent = money(target); return; }
  const land = () => { if (countMoney.run === run) el.textContent = money(target); };
  const t0 = performance.now();
  const step = (now) => {
    if (countMoney.run !== run) return;
    const k = Math.min(1, (now - t0) / MONEY_RUN);
    const eased = 1 - Math.pow(1 - k, 3);
    el.textContent = money(Math.round(from + (target - from) * eased));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  countMoney.settle = setTimeout(land, MONEY_RUN + 80);
}

function activateStep(i) {
  const id = STEPS[i].id;
  if (id === 'datetime') startDrift(); else stopDrift();
  // Шаг открылся — его карточки приходят по очереди.
  if (id === 'location') cascade($('venue-list'));
  if (id === 'template') cascade($('tpl-grid'));
  if (id === 'photos') cascade($('photo-grid'));
  if (id === 'ready') {
    clearTimeout(autoPreviewTimer);
    if (!state.seenInvite) {
      autoPreviewTimer = setTimeout(() => {
        if (state.open === i && !state.seenInvite && $('sheet').hidden) openInvite({ auto: true });
      }, 1250);
    }
  }
  if (id === 'guests') autoAdvance(GUESTS_HOLD);
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

/* Плашка — это и есть поля ввода: пара печатает там же, где видит, как имена
   встанут на приглашении. Здесь остаётся только свет: когда вписаны оба имени,
   плашка коротко загорается золотом. */
function paintPlate() {
  const g = $('groom').value.trim();
  const b = $('bride').value.trim();
  const plate = document.querySelector('.plate');
  if (!plate) return;
  plate.classList.toggle('is-typed', Boolean(g || b));
  if (g && b && !plate.dataset.lit) {
    plate.dataset.lit = '1';
    plate.classList.remove('lit');
    void plate.offsetWidth;
    plate.classList.add('lit');
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

/* Плитка — только название: список читается как витрина. Вид, места и
   ориентир показывает карточка уже выбранного места. */
function venueCard(venue) {
  const card = h('button', {
    type: 'button',
    class: `venue${venue.id === state.venueId ? ' chosen' : ''}`,
    dataset: { id: venue.id },
    'aria-label': `${venue.name} · ${venueSubtitle(venue)}`,
  }, h('b', { class: 'venue-name' }, venue.name));
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
  if (!placed()) fitVenues();
  // Каталог приезжает уже после первой отрисовки блока. Пока пара ничего не
  // выбрала, возвращаем шаг в то состояние, которое отвечает пришедшему
  // списку: есть места — показываем их, пусто — сразу даём вписать своё.
  if (state.venueId || $('address').value.trim()) { renderVenueChoice(); return; }
  if (venues().length) {
    $('venue-manual').hidden = true;
    $('venue-chosen').hidden = true;
    $('venue-pick').hidden = false;
    $('venue-body').hidden = false;
    $('venue-own').hidden = false;
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
  paintVenueMarks();
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
  $('venue-own').hidden = true;
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
  $('venue-own').hidden = false;
  venueMap?.clearMark();
  renderVenues();
  fitVenues();
  paintMapNote();
  saveDraft();
}

/* Три состояния блока: выбираем из каталога, выбрали, вписываем своё. */
function renderVenueChoice() {
  const venue = chosenVenue();
  if (venue) {
    $('venue-pick').hidden = true;
    $('venue-body').hidden = true;
    $('venue-own').hidden = true;
    $('venue-manual').hidden = true;
    $('venue-chosen').hidden = false;
    $('venue-name').textContent = venue.name;
    $('venue-meta').textContent = venueSubtitle(venue);
  } else {
    $('venue-chosen').hidden = true;
    if ($('address').value.trim() || !venues().length) {
      $('venue-pick').hidden = true;
      $('venue-body').hidden = true;
      $('venue-own').hidden = true;
      $('venue-manual').hidden = false;
    }
  }
  paintMapNote();
}

/* Место вне каталога попадает в приглашение одним названием: карту без
   точки не нарисовать, и об этом честно говорим прямо над картой. */
function paintMapNote() {
  const note = $('map-note');
  if (!note) return;
  if (manualOpen() && !placed()) { note.textContent = t('mapPick'); note.hidden = false; return; }
  note.hidden = true;
}

/* ── Карта ── */

function renderMapChoice() {
  ensureMap();
  venueMap?.invalidate();
  if (mapFitPending && !placed()) fitVenues();
  renderVenueChoice();
}

/* Карта вмещает все тойхоны, но не отдаляется дальше города: пара должна
   узнать Мангит, а не искать его на карте Средней Азии. Пока блок скрыт, у
   карты нет размера — впишем, когда блок откроется. */
let mapFitPending = false;

function fitVenues() {
  const list = venues();
  if (!venueMap) { mapFitPending = list.length > 0; return; }
  if (!list.length) {
    const [lat, lng] = cityCenter();
    venueMap.jumpTo(lat, lng, cityZoom());
    mapFitPending = false;
    return;
  }
  mapFitPending = !venueMap.fit(list, .3, cityZoom() - 1);
}

/* Карта — это отдельные map.js и map.css, вместе под двадцать пять килобайт.
   На первом экране студии её ещё никто не увидит: пара только вводит имена.
   Поэтому файлы приезжают в свободную минуту браузера, а если пара вернулась
   к черновику прямо на шаге «Локация» — сразу же. */
let mapAssets = null;
function loadMapAssets(urgent) {
  if (mapAssets) return mapAssets;
  mapAssets = new Promise((done, fail) => {
    const pull = () => {
      /* Ждём и стили: иначе скрипт успеет построить тайлы раньше правил и
         карта мелькнёт россыпью неуложенных картинок. */
      const paint = new Promise((ready) => {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = asset('map.css');
        css.onload = ready;
        css.onerror = ready;
        document.head.appendChild(css);
      });
      const code = new Promise((ready, broke) => {
        const js = document.createElement('script');
        js.src = asset('map.js');
        js.onload = ready;
        js.onerror = () => broke(new Error('map assets'));
        document.head.appendChild(js);
      });
      Promise.all([paint, code]).then(() => done(), fail);
    };
    if (urgent) pull();
    else if (window.requestIdleCallback) requestIdleCallback(pull, { timeout: 2500 });
    else setTimeout(pull, 900);
  });
  return mapAssets;
}

function ensureMap() {
  if (venueMap || !$('map')) return;
  if (!window.NvMap) {
    const open = !blk(stepIdx('location'))?.hidden;
    loadMapAssets(open).then(() => {
      ensureMap();
      venueMap?.invalidate();
      if (mapFitPending && !placed()) fitVenues();
    }, () => { /* без карты шаг работает поиском и списком тойхон */ });
    return;
  }
  const [lat, lng] = cityCenter();
  venueMap = NvMap.create($('map'), {
    lat: placed() ? state.lat : lat,
    lng: placed() ? state.lng : lng,
    zoom: placed() ? 17 : cityZoom(),
    tiles: state.config?.mapTiles,
    tone: 'light',
    // Кликабельны только метки тойхон. Пустая карта пальца не ловит: точку
    // случайным тапом не сбить, и уйти с карты, кроме как в место, некуда.
    onPin: (pin) => {
      const venue = venues().find((v) => v.id === pin.id);
      if (venue) pickVenue(venue);
    },
  });
  paintVenueMarks();
  if (placed() && !state.venueId) venueMap.setMark(state.lat, state.lng);
}

/* Все тойхоны каталога на карте сразу: тап по метке выбирает место. */
function paintVenueMarks(list = venues()) {
  venueMap?.setPins(list.map((venue) => ({
    id: venue.id,
    lat: venue.lat,
    lng: venue.lng,
    label: venue.name,
    active: venue.id === state.venueId,
    here: venue.id === state.venueId,
  })));
}

function setPoint(lat, lng) {
  state.lat = lat;
  state.lng = lng;
  clearErr(stepIdx('location'));
  saveDraft();
  // У тойхоны из каталога светится сама её метка — второй кружок поверх не нужен.
  if (state.venueId) venueMap?.clearMark(); else venueMap?.setMark(lat, lng);
  paintMapNote();
}

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
      $('venue-own').hidden = true;
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


/* ════ 04 · Музыка ════
   Библиотека, единый плеер и выбор начала живут в music.js (NvMusic), состояние
   шага — в music-core.js. Здесь только стыковка со студией: что положить в
   черновик и когда открыть следующий шаг. */

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
const Music = window.NvMusic ? window.NvMusic.mount({
  root: $('music-card'),
  lang: () => LANG || 'uz',
  config: () => state.config?.music || null,
  botUrl: () => state.config?.botUrl || null,
  initData: () => (tg ? tg.initData : ''),
  selection: () => state.music,
  /* Кнопки «сохранить» нет: выбранная песня и её начало ложатся в черновик
     сами, как только пара их поменяла. Следующий шаг открывает сама пара. */
  onChange(selection) {
    state.music = selection;
    state.previewHtml = '';
    clearErr(stepIdx('music'));
    saveDraft();
    updateBill();
  },
  /* «Tanlash»: следующий блок открывается сразу. Переход тихий — камера не едет,
     пара остаётся выбирать начало, а новый блок поднимется, когда до него долистают. */
  onPick() {
    const i = stepIdx('music');
    if (state.open === i) unlock(i + 1, { quiet: STEPS[i].quiet === true });
  },
  onSave(selection) {
    state.music = selection;
    state.previewHtml = '';
    clearErr(stepIdx('music'));
    saveDraft();
    updateBill();
    if (state.open === stepIdx('music')) autoAdvance(620);
  },
  onSkip() {
    state.music = null;
    state.previewHtml = '';
    clearErr(stepIdx('music'));
    Music?.setSelection(null);
    saveDraft();
    updateBill();
    if (state.open === stepIdx('music')) autoAdvance(720);
  },
}) : null;

/* Музыка звучит только там, где на неё смотрят: открылся образец приглашения —
   студия замолкает, чтобы не играть поверх. */
function hushStudio() {
  Music?.hush();
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
  hushStudio();
  const q = new URLSearchParams({
    groom: $('groom').value.trim(), bride: $('bride').value.trim(), lang: LANG,
    address: $('address').value.trim(), map: placed() ? '1' : '0',
    lat: Number.isFinite(state.lat) ? String(state.lat) : '',
    lng: Number.isFinite(state.lng) ? String(state.lng) : '',
    venue: state.venueId || '',
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
  hushStudio();
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
      if (state.open === stepIdx('guests')) autoAdvance(GUESTS_HOLD);
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
  const line = (k, v, cls) => box.appendChild(h('div', { class: `bill-line${cls ? ' ' + cls : ''}` }, h('span', {}, k), h('span', {}, v)));

  line(t('tNames'), `${$('groom').value.trim()} & ${$('bride').value.trim()}`);
  if (state.dateIso) {
    const [y, m, d] = state.dateIso.split('-').map(Number);
    line(t('tDate'), `${d} ${t('months')[m - 1]} ${y} · ${state.time}`);
  }
  if ($('address').value.trim()) line(t('tVenue'), $('address').value.trim());
  if (state.music) line(t('tMusic'), state.music.title.slice(0, 32));
  if (tpl) line(t('tTpl'), `${tpl.name} · ${money(tpl.price)}`);

  let total = tpl ? tpl.price : 0;
  const n = cleanGuests().length;
  if (n) {
    total += n * guestPrice();
    line(t('tGuests'), `${n} × ${money(guestPrice())}`);
  }
  // Скидка идёт последней строкой: видно, из чего она посчиталась.
  const off = promoDiscount(total);
  if (off) line(t('promoBill'), `${state.promo.code} · −${money(off)}`, 'bill-line--promo');
  renderPromo();
  countMoney($('bill-total'), total - off);
}

/* ── Промокод ──
   Код несёт правило, а не сумму: студия считает скидку так же, как сервер, и
   для пары итог не меняется после отправки. Последнее слово всё равно за
   сервером — он пересчитывает цену сам. */

function validPromo(value) {
  if (!value || typeof value !== 'object') return null;
  const code = String(value.code ?? '').toUpperCase();
  const amount = value.kind === 'amount';
  const num = Number(value.value);
  if (!/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(code) || !Number.isFinite(num) || num <= 0) return null;
  if (!amount && num > 100) return null;
  return { code, kind: amount ? 'amount' : 'percent', value: Math.round(num) };
}

function promoDiscount(total) {
  const promo = state.promo;
  if (!promo || !(total > 0)) return 0;
  const raw = promo.kind === 'amount' ? promo.value : Math.round((total * promo.value) / 100);
  return raw > 0 ? Math.min(total, raw) : 0;
}

function promoLabel(promo) {
  return promo.kind === 'amount' ? `−${money(promo.value)}` : `−${promo.value}%`;
}

function renderPromo() {
  const promo = state.promo;
  $('promo-field').hidden = Boolean(promo);
  $('promo-chip').hidden = !promo;
  if (!promo) return;
  $('promo-chip-code').textContent = promo.code;
  $('promo-chip-off').textContent = promoLabel(promo);
}

function promoSays(text, kind) {
  const box = $('promo-msg');
  box.textContent = text || '';
  box.className = `promo-msg${kind ? ' promo-msg--' + kind : ''}`;
  box.hidden = !text;
}

async function applyPromo() {
  const field = $('promo-code');
  const code = field.value.trim().toUpperCase();
  if (!code) { field.focus(); return; }
  const button = $('promo-apply');
  button.disabled = true;
  promoSays('');
  try {
    const r = await fetch('/api/promo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-init-data': tg ? tg.initData : '' },
      body: JSON.stringify({ code }),
    });
    const j = await r.json().catch(() => null);
    const promo = j?.ok ? validPromo(j.promo) : null;
    if (!promo) {
      haptic.err();
      promoSays(r.status === 429 ? t('eTooMany') : t('promoBad'), 'err');
      return;
    }
    state.promo = promo;
    field.value = '';
    haptic.ok();
    promoSays(t('promoOk'), 'ok');
    clearErr(stepIdx('contact'));
    saveDraft();
    updateBill();
  } catch (_) {
    promoSays(t('eNet'), 'err');
  } finally {
    button.disabled = false;
  }
}

function dropPromo() {
  state.promo = null;
  promoSays('');
  haptic.tap();
  saveDraft();
  updateBill();
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
    venueId: state.venueId || null,
    photos: state.photos.filter((p) => p.name).slice(0, requiredPhotos()).map((p) => p.name),
    music: state.music,
    templateId: state.templateId,
    guestNames: cleanGuests(),
    promoCode: state.promo?.code ?? null,
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
    state.submitted = true;
    state.submissionKey = null;   // следующая заявка получит собственный ключ
    // Платить было нечего: сервер подтвердил заявку сам и вернул готовую ссылку.
    state.readyUrl = typeof j.url === 'string' ? j.url : null;
    showDone();
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

/* Финал. Обычная заявка ждёт подтверждения оплаты, у бесплатной ссылка уже
   готова — показываем её прямо здесь, рядом с той, что ушла в бот. */
function showDone() {
  const url = state.readyUrl;
  $('done-title').textContent = t(url ? 'doneFreeTitle' : 'doneTitle');
  $('done-text').textContent = t(url ? 'doneFreeText' : 'doneText');
  $('done-link').hidden = !url;
  $('done-open').hidden = !url;
  /* Золото на экране одно: главная кнопка — «открыть приглашение», список
     заявок рядом с ней отходит на второй план. */
  $('done-mine').classList.toggle('btn--gold', !url);
  $('done-mine').classList.toggle('btn--ghost', Boolean(url));
  if (!url) return;
  // Адрес читается как адрес: без «https://» и без хвостового слеша.
  $('done-url').textContent = url.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  $('done-open').href = url;
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

/* Заявка ушла, но студия под экраном «Готово» осталась заполненной прошлой
   парой. Из «Моих приглашений» возвращаемся к чистому листу: иначе первое же
   касание вернёт черновик в хранилище, а кнопка оплаты уйдёт дублем. */
function closeMine() {
  if (state.submitted) { location.reload(); return; }
  $('mine').hidden = true;
}

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
    // Enter на имени жениха ведёт к невесте: плашка — одно поле из двух строк.
    if (field.id === 'groom' && !$('bride').value.trim()) { $('bride').focus(); return; }
    dismissField(field);
    // Enter — пара сама сказала «готово»: трёхсекундной паузы не ждём.
    if (field.id === 'groom' || field.id === 'bride') { if (state.open === 0) autoAdvance(FLOW.settle); }
    if (field.id === 'address' && state.open === stepIdx('location')) autoAdvance(FLOW.settle);
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

  /* Пара замолчала на три секунды — клавиатура уходит сама, в любом поле студии.
     У имён и адреса за те же три секунды камера ещё и едет дальше (autoAdvance). */
  let typingTimer = 0;
  document.addEventListener('input', (event) => {
    const field = typingField(event.target);
    if (!field) return;
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      if (document.activeElement === field) dismissField(field);
    }, TYPING_PAUSE);
  });
}

function wire() {
  wireKeyboard();
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
  $('mine-close').addEventListener('click', closeMine);

  for (const id of ['groom', 'bride']) {
    $(id).addEventListener('input', () => {
      paintPlate();
      markFilled($(id));
      clearErr(0);
      saveDraft();
      // Правка имён на поздних шагах не должна открывать следующий блок.
      if (state.open === 0) autoAdvance(TYPING_PAUSE);
    });
  }

  $('cal-prev').addEventListener('click', () => { calView.setMonth(calView.getMonth() - 1); haptic.tap(); renderCalendar(); cascade($('cal-grid')); });
  $('cal-next').addEventListener('click', () => { calView.setMonth(calView.getMonth() + 1); haptic.tap(); renderCalendar(); cascade($('cal-grid')); });

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
    if (state.open === stepIdx('location')) autoAdvance(TYPING_PAUSE);
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
    if (state.guestsOn) cascade($('guest-list'));
    updateBill();
    saveDraft();
    if (state.open === stepIdx('guests')) autoAdvance(GUESTS_HOLD);
  });

  $('phone').addEventListener('input', () => { markFilled($('phone')); clearErr(8); saveDraft(); });

  // Промокод вводят с клавиатуры телефона: заглавные буквы ставим сами.
  $('promo-code').addEventListener('input', (e) => {
    const start = e.target.selectionStart;
    e.target.value = e.target.value.toUpperCase();
    e.target.setSelectionRange(start, start);
    promoSays('');
  });
  $('promo-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyPromo(); } });
  $('promo-apply').addEventListener('click', applyPromo);
  $('promo-drop').addEventListener('click', dropPromo);

  $('submit').addEventListener('click', submit);

  $('sheet-close').addEventListener('click', () => sheet.close());
  $('ready-next').addEventListener('click', () => { haptic.tap(); unlock(stepIdx('guests')); });
  $('done-link').addEventListener('click', () => {
    if (!state.readyUrl) return;
    navigator.clipboard?.writeText(state.readyUrl);
    haptic.ok();
    toast(t('copied'), 'ok');
  });
  /* Внутри Telegram ссылку открывает сам клиент: новая вкладка там уводит
     пару из приложения, а вернуться обратно к экрану «Готово» некуда. */
  $('done-open').addEventListener('click', (e) => {
    if (!state.readyUrl || !tg?.openLink) return;
    e.preventDefault();
    try { tg.openLink(state.readyUrl); } catch (_) { window.open(state.readyUrl, '_blank', 'noopener'); }
  });
  $('done-mine').addEventListener('click', () => { $('done').hidden = true; $('mine').hidden = false; loadMine(); });
  $('done-new').addEventListener('click', () => location.reload());

  // Свет сцены медленно едет вниз вместе со скроллом.
  if (tg) {
    tg.BackButton?.onClick(() => {
      if (Music?.isOpen()) { Music.close(); return; }
      if (!$('sheet').hidden) { sheet.close(); return; }
      if (!$('mine').hidden) { closeMine(); return; }
      tg.close();
    });
  }
}

/* ════ Старт ════ */

/* Настройки студии спрашиваем сразу, не дожидаясь выбора языка: пока пара
   читает две кнопки на первом экране, ответ уже лежит готовым, и студия
   открывается без паузы на сеть. */
let configPending = null;
function fetchConfig() {
  if (!configPending) {
    configPending = fetch('/api/config')
      .then((r) => r.json())
      .catch(() => ({ templates: [], guestPrice: 10000, maxGuests: 100, maxPhotos: 6, topTracks: [], populars: {} }));
  }
  return configPending;
}

async function loadConfig() {
  state.config = await fetchConfig();
}

/* Подпись студии приходит от Telegram. В обычном браузере её нет: загрузка
   фото, предпросмотр и отправка заявки упираются в 401, поэтому заполнять
   форму здесь было бы впустую. Такой вход ведём в бот — там открывается эта
   же студия, уже с подписью. */
async function gateNeeded() {
  if (tg?.initData) return false;
  return (await fetchConfig())?.requiresTelegram !== false;
}

async function openGate() {
  state.config = await fetchConfig();
  const bot = state.config?.botUrl;
  if (bot) {
    const link = $('gate-open');
    link.href = `${bot}?start=site`;
    link.hidden = false;
    /* С телефона ведёт кнопка — она открывает клиент. С компьютера удобнее
       снять код телефоном: студия всё равно про фото из галереи. Показывать
       ли код, решает ширина в стилях — иначе поворот экрана оставил бы с
       решением, принятым один раз при входе. */
    $('gate-qr').hidden = false;
  }
  $('gate').hidden = false;
}

async function bootLang(lang) {
  setLang(lang);
  const gated = await gateNeeded();
  // Сцена оживает раньше, чем экран языка начнёт таять: пара видит её уже в движении.
  stageRest(false);
  $('lang-screen').classList.add('out');
  setTimeout(() => { $('lang-screen').style.display = 'none'; }, 1400);
  if (gated) return openGate();
  document.body.classList.add('studio-entering');
  const first = document.querySelector('.blk[data-step="names"]');
  if (first) armBlock(first);
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
  pingSession(restored ? state.open : null);
  if (state.templateId && state.photos.length > requiredPhotos()) state.photos = state.photos.slice(0, requiredPhotos());
  setScene();
  applyI18n();
  paintPlate();
  for (const id of ['groom', 'bride', 'address', 'phone']) markFilled($(id));
  Music?.setSelection(state.music);
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
fetchConfig();
