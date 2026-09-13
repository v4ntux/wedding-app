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
  // Треки iTunes были тридцатисекундными превью — такой черновик выбирает песню заново.
  if (state.music?.type === 'itunes') { state.music = null; state.musicStart = 0; }
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
    mapPick: 'Bu joy ro‘yxatda yo‘q — taklifnomada xaritasiz, nomi bilan chiqadi.',
    mapHint: 'Nuqtani aniqlashtirish uchun xaritada bosing',
    linkLbl: 'Musiqa havolasi',
    change: 'O‘zgartirish',
    guestPh: 'Ism yozing…',
    eMusic: 'Ovoz', tMusic: 'Musiqa', msTop: 'Kutubxona', msMine: 'Mening musiqam',
    seekMusic: 'Qo‘shiq yoki ijrochi nomi', musicSkip: 'Musiqasiz davom etish',
    add: 'Qo‘shish', uploadMusic: 'Fayl yuklash', lookDone: 'Ko‘rib chiqdim',
    libEmptyTitle: 'Qo‘shiq nomini yozing',
    libEmptyText: 'Istalgan qo‘shiqni topamiz — u to‘liq yangraydi, boshlanishini esa o‘zingiz tanlaysiz.',
    libHead: 'nvate kutubxonasi', ytHead: 'YouTube’dan',
    ytSearching: 'YouTube’dan qidirilmoqda…', ytNone: 'YouTube’da hech narsa topilmadi',
    songLoading: 'Yuklanmoqda…',
    ytNote: (time) => `YouTube pleeri orqali ${time} dan yangraydi — to‘lqinni ko‘rsatib bo‘lmaydi.`,
    ytBlocked: 'Muallif bu videoni boshqa saytlarda qo‘yishni taqiqlagan — boshqasini tanlang',
    nextCue: 'Keyingi bosqich',
    libEmptyGo: 'Mening musiqam →',
    botDropTitle: 'Qo‘shiqni botga yuboring',
    botDropText: 'Istalgan Telegram kanalidan qo‘shiqni botga forward qiling — bir necha soniyada u shu yerda to‘liq holda paydo bo‘ladi.',
    botOpen: 'Botni ochish',
    mineFresh: (name) => `«${name}» botdan keldi`,
    linkHint: 'YouTube havolasi yoki to‘g‘ridan-to‘g‘ri mp3 havolasi.',
    linkHintX: 'YouTube, Instagram yoki TikTok havolasi — qo‘shiqni to‘liq olamiz, boshlanishini o‘zingiz tanlaysiz.',
    linkPh: 'https://…',
    extracting: 'Havoladan qo‘shiq olinmoqda…',
    eExtract: 'Havoladan qo‘shiqni olib bo‘lmadi',
    trimTitle: 'Qayerdan boshlansin',
    trimFrom: (time) => `${time} dan oxirigacha yangraydi`,
    tapeHint: 'Tasmani suring: igna ostidagi joydan mehmonlar eshitadi',
    tapeLoading: 'Qo‘shiq to‘lqini chizilmoqda…',
    tapeListening: 'Tinglanmoqda',
    tapePreview: 'Mehmonlar shunday eshitadi…',
    chipTop: 'Top tanlov',
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
    mapPick: 'Этого места нет в каталоге — в приглашении будет название, без карты.',
    mapHint: 'Нажмите на карту, чтобы уточнить точку',
    linkLbl: 'Ссылка на музыку',
    change: 'Изменить',
    guestPh: 'Впишите имя…',
    eMusic: 'Звук', tMusic: 'Музыка', msTop: 'Библиотека', msMine: 'Моя музыка',
    seekMusic: 'Песня или исполнитель', musicSkip: 'Продолжить без музыки',
    add: 'Добавить', uploadMusic: 'Загрузить файл', lookDone: 'Посмотрел',
    libEmptyTitle: 'Впишите название песни',
    libEmptyText: 'Найдём любую песню — она прозвучит целиком, а начало выберете сами.',
    libHead: 'Библиотека nvate', ytHead: 'С YouTube',
    ytSearching: 'Ищем на YouTube…', ytNone: 'На YouTube ничего не нашлось',
    songLoading: 'Загружаем…',
    ytNote: (time) => `Играет через плеер YouTube с ${time} — волну показать нельзя.`,
    ytBlocked: 'Автор запретил показывать это видео на других сайтах — выберите другое',
    nextCue: 'Следующий шаг',
    libEmptyGo: 'Моя музыка →',
    botDropTitle: 'Пришлите песню боту',
    botDropText: 'Перешлите трек боту из любого Telegram-канала — через пару секунд он появится здесь целиком.',
    botOpen: 'Открыть бота',
    mineFresh: (name) => `«${name}» пришла из бота`,
    linkHint: 'Ссылка на YouTube или прямая ссылка на mp3.',
    linkHintX: 'Ссылка на YouTube, Instagram или TikTok — возьмём песню целиком, начало выберете сами.',
    linkPh: 'https://…',
    extracting: 'Достаём песню из ссылки…',
    eExtract: 'Не получилось достать песню из ссылки',
    trimTitle: 'Откуда начинать',
    trimFrom: (time) => `Играет с ${time} и до конца`,
    tapeHint: 'Тяните ленту: что под иглой — с того и услышат гости',
    tapeLoading: 'Рисуем волну песни…',
    tapeListening: 'Слушаем',
    tapePreview: 'Так услышат гости…',
    chipTop: 'Топ выбор',
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
  $('link-hint').textContent = t(state.config?.downloadEnabled ? 'linkHintX' : 'linkHint');
  paintMusicNote();
  $('next-cue-label').textContent = t('nextCue');
  $('bot-open').hidden = !state.config?.botUrl;
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
  renderLibrary();
  renderMyTracks();
  if (tape.duration) paintTape();
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
  makeRoom(el);
  const y = slotTop(el) - headerOffset();
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
    setScene(i);
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
    unlock(i + 1, { quiet: step.quiet === true });
  }, Math.max(FLOW.settle, Number(delay) || 0));
}

function prepareStep(i) {
  const id = STEPS[i].id;
  if (id === 'location') renderMapChoice();
  if (id === 'music') { loadLibrary(); loadMyTracks(); syncMinePoll(); if (tape.duration) mountTape(); }
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

function ensureMap() {
  if (venueMap || !window.NvMap || !$('map')) return;
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
   Звук целиком. Музыкальные API отдают только тридцатисекундные превью, поэтому
   полные песни берутся из трёх мест: поиск по YouTube (узбекская музыка живёт
   там; играет официальный плеер, с начала ролика), полка nvate и песни,
   присланные боту или загруженные файлом — у них начало выбирается на ленте. */

const player = new Audio();
player.preload = 'auto';
let playingUrl = null;        // какой трек из списка сейчас звучит
let activeTrackUrl = null;    // строка, у которой показана кнопка «Выбрать»
let library = [];
let libraryState = 'idle';    // idle | loading | ready | error
let mineTracks = [];
let mineSeen = null;          // id личных треков, которые пара уже видела
let minePoll = 0;
let ytResults = [];
let ytState = 'idle';         // idle | loading | ready | error
let ytQuery = '';
let ytSeq = 0;
let songBusy = null;          // id песни из поиска, которую сервер сейчас скачивает

const clockText = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function sameUrl(a, b) {
  if (!a || !b) return false;
  try { return new URL(a, location.href).href === new URL(b, location.href).href; } catch (_) { return a === b; }
}

const YT_RE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/;
const youtubeIdOf = (url) => String(url ?? '').match(YT_RE)?.[1] ?? null;

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

/* ── Списки: полка nvate, YouTube и «Моя музыка» ── */

function trackRow(track, { fresh = false } = {}) {
  const chosen = state.music?.type === 'upload' && state.music.value === track.file;
  const previewing = activeTrackUrl === track.url;
  const playing = playingUrl === track.url;
  const meta = [track.artist, track.duration ? clockText(track.duration) : ''].filter(Boolean).join(' · ');
  const play = h('button', { type: 'button', class: `trk-play${playing ? ' playing' : ''}`, 'aria-label': playing ? t('pauseAria') : t('playAria') },
    svgIcon(playing ? 'pause' : 'play'));
  const pick = h('button', { type: 'button', class: 'trk-pick', hidden: !previewing }, chosen ? t('taken') : t('take'));
  const row = h('div', { class: `trk${chosen ? ' chosen' : ''}${previewing ? ' previewing' : ''}${fresh ? ' trk--fresh' : ''}`, dataset: { url: track.url } },
    play,
    h('div', { class: 'trk-info' }, h('b', {}, track.title), h('span', {}, meta)),
    track.uses > 1 ? h('span', { class: 'trk-hot' }, `×${track.uses}`) : null,
    pick);
  play.addEventListener('click', (event) => { event.stopPropagation(); togglePlay(track); });
  row.addEventListener('click', (event) => {
    if (event.target.closest('.trk-pick')) return;
    togglePlay(track);
  });
  pick.addEventListener('click', () => chooseTrack(track));
  return row;
}

/* Песня из поиска — тот же ряд, что и на полке. Тап берёт её целиком. */
function songRow(video) {
  const busy = songBusy === video.id;
  const chosen = state.music?.youtubeId === video.id
    || (state.music?.type === 'youtube' && youtubeIdOf(state.music.value) === video.id);
  const meta = [video.artist, video.duration ? clockText(video.duration) : ''].filter(Boolean).join(' · ');
  const row = h('button', { type: 'button', class: `trk trk--song${busy ? ' is-busy' : ''}${chosen ? ' chosen' : ''}`, 'aria-busy': busy ? 'true' : null },
    h('span', { class: 'trk-cover' }, h('img', { src: video.thumb, alt: '', loading: 'lazy', decoding: 'async' })),
    h('span', { class: 'trk-info' }, h('b', {}, video.title), h('span', {}, meta)),
    h('span', { class: 'trk-pick' }, busy ? t('songLoading') : chosen ? t('taken') : t('take')));
  row.addEventListener('click', () => pickSong(video));
  return row;
}

/* Сервер скачивает песню, строка тем временем дышит золотом. Готово — список
   сворачивается и открывается лента. Не скачалась — играет плеер YouTube. */
async function pickSong(video) {
  if (songBusy) return;
  haptic.tap();
  hushStudio();
  if (!state.config?.downloadEnabled) { await importYoutube(video.url); return; }
  wakeTapeSound();
  songBusy = video.id;
  renderLibrary();
  const track = await fetchSong(video.url);
  songBusy = null;
  if (track) { chooseTrack(track); return; }
  if (!(await importYoutube(video.url))) renderLibrary();
}

function renderLibrary() {
  const box = $('track-scroll');
  if (!box) return;
  box.innerHTML = '';
  const q = ($('music-q').value || '').trim();
  const needle = q.toLowerCase();
  const shelf = needle ? library.filter((track) => `${track.title} ${track.artist}`.toLowerCase().includes(needle)) : library;

  if (!q && libraryState === 'loading' && !library.length) {
    for (let i = 0; i < 3; i++) {
      box.appendChild(h('div', { class: 'trk' }, h('div', { class: 'trk-play' }), h('div', { class: 'trk-info' }, h('b', {}, '···'))));
    }
    return;
  }

  if (shelf.length) {
    if (q) box.appendChild(h('p', { class: 'lib-head' }, t('libHead')));
    shelf.forEach((track) => box.appendChild(trackRow(track)));
  }

  if (q.length >= 2) {
    box.appendChild(h('p', { class: 'lib-head' }, t('ytHead')));
    if (ytState === 'loading') box.appendChild(h('p', { class: 'lib-wait' }, t('ytSearching')));
    else if (ytState === 'error') box.appendChild(h('p', { class: 'lib-wait' }, t('eNet')));
    else if (!ytResults.length) box.appendChild(h('p', { class: 'lib-wait' }, t('ytNone')));
    else ytResults.forEach((video) => box.appendChild(songRow(video)));
    return;
  }

  if (!shelf.length) {
    const go = h('button', { type: 'button', class: 'linkbtn' }, t('libEmptyGo'));
    go.addEventListener('click', () => { haptic.tap(); switchMusicTab(1); });
    box.appendChild(h('div', { class: 'empty empty--lib' },
      h('b', {}, t('libEmptyTitle')), h('span', {}, t('libEmptyText')), go));
  }
}

async function loadLibrary() {
  if (libraryState === 'loading' || libraryState === 'ready') return;
  libraryState = 'loading';
  renderLibrary();
  try {
    const response = await fetch('/api/music');
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error('library');
    library = Array.isArray(data.tracks) ? data.tracks : [];
    libraryState = 'ready';
  } catch (_) {
    libraryState = 'error';
  }
  renderLibrary();
}

const searchYoutubeSoon = debounce(async () => {
  const q = $('music-q').value.trim();
  if (q.length < 2 || (q === ytQuery && ytState === 'ready')) return;
  const seq = ++ytSeq;
  ytQuery = q;
  ytState = 'loading';
  renderLibrary();
  try {
    const response = await fetch(`/api/music/youtube/search?q=${encodeURIComponent(q)}`);
    const data = await response.json();
    if (seq !== ytSeq) return;
    if (!response.ok || !data.ok) throw new Error('search');
    ytResults = Array.isArray(data.results) ? data.results : [];
    ytState = 'ready';
  } catch (_) {
    if (seq !== ytSeq) return;
    ytResults = [];
    ytState = 'error';
  }
  renderLibrary();
}, 650);

/* Один поиск на всё: полка фильтруется сразу, YouTube — когда пара перестала печатать. */
function onMusicQuery() {
  const q = $('music-q').value.trim();
  if (q.length < 2) {
    ytSeq += 1;
    ytQuery = '';
    ytResults = [];
    ytState = 'idle';
  } else if (q !== ytQuery) {
    ytState = 'loading';
  }
  renderLibrary();
  searchYoutubeSoon();
}

function renderMyTracks(fresh = new Set()) {
  const box = $('mine-tracks');
  if (!box) return;
  box.innerHTML = '';
  box.hidden = !mineTracks.length;
  mineTracks.forEach((track) => box.appendChild(trackRow(track, { fresh: fresh.has(track.id) })));
}

function rememberMine(track) {
  mineTracks = [track, ...mineTracks.filter((item) => item.id !== track.id)];
  mineSeen?.add(track.id);
  renderMyTracks();
}

/* Песня, пересланная боту, появляется здесь сама: пока открыта «Моя музыка»,
   студия переспрашивает сервер раз в несколько секунд. */
async function loadMyTracks({ announce = false } = {}) {
  try {
    const response = await fetch('/api/music/mine', { headers: { 'x-init-data': tg ? tg.initData : '' } });
    if (!response.ok) return;
    const data = await response.json();
    const tracks = Array.isArray(data.tracks) ? data.tracks : [];
    const fresh = new Set(mineSeen ? tracks.filter((track) => !mineSeen.has(track.id)).map((track) => track.id) : []);
    const changed = !mineSeen || fresh.size > 0 || tracks.length !== mineTracks.length;
    mineSeen = new Set(tracks.map((track) => track.id));
    mineTracks = tracks;
    if (changed) renderMyTracks(fresh);
    if (announce && fresh.size) {
      const first = tracks.find((track) => fresh.has(track.id));
      toast(t('mineFresh', first.title), 'ok');
    }
  } catch (_) { /* сеть моргнула — спросим на следующем круге */ }
}

const myTracksOnScreen = () => !document.hidden
  && !$('ms-mine').hidden
  && !$('music-pick').hidden
  && !blk(stepIdx('music')).hidden;

function syncMinePoll() {
  const want = myTracksOnScreen();
  if (want && !minePoll) {
    minePoll = setInterval(() => {
      if (!myTracksOnScreen()) { syncMinePoll(); return; }
      loadMyTracks({ announce: true });
    }, 4000);
  }
  if (!want && minePoll) {
    clearInterval(minePoll);
    minePoll = 0;
  }
}

function switchMusicTab(index) {
  document.querySelectorAll('.seg').forEach((seg, i) => seg.classList.toggle('is-on', i === index));
  document.querySelector('.segs')?.classList.toggle('at-1', index === 1);
  $('ms-top').hidden = index !== 0;
  $('ms-mine').hidden = index !== 1;
  if (index === 1) loadMyTracks({ announce: true });
  syncMinePoll();
}

function openBot() {
  const url = state.config?.botUrl;
  if (!url) return;
  haptic.tap();
  try {
    if (tg?.openTelegramLink) { tg.openTelegramLink(url); return; }
  } catch (_) { /* старый клиент — откроем вкладкой */ }
  window.open(url, '_blank', 'noopener');
}

function togglePlay(track) {
  const url = track.url;
  haptic.tap();
  pauseTape();
  activeTrackUrl = url;
  if (playingUrl === url) {
    player.pause();
    playingUrl = null;
    refreshPlayUI();
    return;
  }
  player.src = url;
  playingUrl = url;
  refreshPlayUI();
  player.play().catch(() => {
    if (playingUrl !== url) return;
    playingUrl = null;
    refreshPlayUI();
    toast(t('eNet'), 'err');
  });
}

function refreshPlayUI() {
  for (const row of document.querySelectorAll('#track-scroll .trk, #mine-tracks .trk')) {
    const button = row.querySelector('.trk-play');
    if (!button || !row.dataset.url) continue;
    const now = row.dataset.url === playingUrl;
    const previewing = row.dataset.url === activeTrackUrl;
    button.classList.toggle('playing', now);
    button.setAttribute('aria-label', now ? t('pauseAria') : t('playAria'));
    row.classList.toggle('previewing', previewing);
    button.replaceChildren(svgIcon(now ? 'pause' : 'play'));
    const pick = row.querySelector('.trk-pick');
    if (pick) pick.hidden = !previewing;
  }
}

/* Музыка звучит только там, где на неё смотрят: открылся образец приглашения —
   студия замолкает, чтобы не играть поверх. */
function hushStudio() {
  pauseTape();
  if (!player.paused) player.pause();
  if (playingUrl) { playingUrl = null; refreshPlayUI(); }
}

function chooseTrack(track) {
  setMusic({
    type: 'upload',
    value: track.file,
    name: track.title,
    artist: track.artist || '',
    playUrl: track.url,
    duration: track.duration || null,
    youtubeId: track.youtubeId || null,
  });
}

function chooseYoutube(video) {
  setMusic({
    type: 'youtube',
    value: video.url,
    name: video.title || 'YouTube',
    artist: video.artist ? `YouTube · ${video.artist}` : 'YouTube',
    playUrl: null,
  });
}

/* Выбрал трек — прослушивание останавливается, список сворачивается в карточку.
   Под файлом раскрывается лента: игла сама встаёт на «Топ выбор», и это место
   звучит пять секунд. У плеера YouTube ленты нет — честная подпись, откуда он играет. */
function setMusic(music) {
  state.music = music;
  state.musicStart = 0;
  state.musicEnd = null;
  state.previewHtml = '';
  haptic.ok();
  player.pause();
  playingUrl = null;
  activeTrackUrl = null;
  $('picked-name').textContent = music.name;
  $('picked-artist').textContent = music.artist || '';
  $('music-pick').hidden = true;
  $('music-picked').hidden = false;
  paintMusicNote();
  renderLibrary();
  syncMinePoll();
  openTrim({ fresh: true });
  saveDraft();
  autoAdvance(620);
}

function paintMusicNote() {
  const note = $('music-note');
  note.hidden = state.music?.type !== 'youtube';
  if (!note.hidden) note.textContent = t('ytNote', clockText(state.musicStart || 0));
}

function reopenMusic() {
  haptic.tap();
  closeTrim();
  $('music-picked').hidden = true;
  $('music-note').hidden = true;
  $('music-pick').hidden = false;
  renderLibrary();
  renderMyTracks();
  syncMinePoll();
}

const LINKABLE = /^https:\/\/([\w-]+\.)*(instagram\.com|tiktok\.com)\//i;

/* Ссылка из «Моей музыки». Сервер с yt-dlp превращает YouTube, Instagram и TikTok
   в файл с волной и выбором начала; без него YouTube играет своим плеером, а
   прямой mp3 — как есть. */
async function addMusicLink() {
  const input = $('music-link');
  const button = $('music-link-go');
  if (button.disabled) return;
  const url = input.value.trim();
  if (!/^https?:\/\/\S+$/.test(url)) { toast(t('eLink'), 'err'); return; }
  const youtube = Boolean(youtubeIdOf(url));
  const download = Boolean(state.config?.downloadEnabled) && (youtube || LINKABLE.test(url));
  if (!download && !youtube) {
    if (!/\.(mp3|m4a|ogg|wav)(\?|$)/i.test(url)) { toast(t('eLink'), 'err'); return; }
    input.value = '';
    setMusic({ type: 'custom', value: url, name: t('myTrack'), artist: url.replace(/^https?:\/\//, '').slice(0, 40), playUrl: url });
    return;
  }
  button.disabled = true;
  button.classList.add('btn--wait');
  try {
    let track = null;
    if (download) {
      wakeTapeSound();
      toast(t('extracting'), 'info', 2600);
      track = await fetchSong(url);
    }
    if (track) {
      input.value = '';
      if (!track.youtubeId) rememberMine(track);
      chooseTrack(track);
    } else if (youtube) {
      if (await importYoutube(url)) input.value = '';
    } else {
      toast(t('eExtract'), 'err');
    }
  } finally {
    button.disabled = false;
    button.classList.remove('btn--wait');
  }
}

async function fetchSong(url) {
  try {
    const response = await fetch('/api/music/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-init-data': tg ? tg.initData : '' },
      body: JSON.stringify({ url }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 429) toast(t('eTooMany'), 'err');
    return response.ok && data.ok && data.track ? data.track : null;
  } catch (_) {
    return null;
  }
}

/* Плеер YouTube годится, только если автор разрешил встраивание. */
async function importYoutube(url) {
  try {
    const response = await fetch(`/api/music/youtube/info?url=${encodeURIComponent(url)}`);
    const data = await response.json().catch(() => ({}));
    if (response.status === 422) { toast(t('ytBlocked'), 'err'); return false; }
    if (response.status === 400) { toast(t('eLink'), 'err'); return false; }
    // YouTube не ответил — ссылка всё равно рабочая, берём её как есть.
    chooseYoutube(response.ok && data.ok ? data.video : { url, title: 'YouTube', artist: '' });
    return true;
  } catch (_) {
    toast(t('eNet'), 'err');
    return false;
  }
}

async function uploadMusicFile(file) {
  if (file.size > 20 * 1024 * 1024) { toast(t('eBig'), 'err'); return; }
  const button = $('music-upload');
  button.disabled = true;
  button.classList.add('btn--wait');
  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'x-init-data': tg ? tg.initData : '', 'x-file-name': encodeURIComponent(file.name.slice(0, 160)) },
      body: file,
    });
    const data = await response.json();
    if (!response.ok || !data.ok || data.kind !== 'audio') throw new Error('bad');
    const track = data.track || { id: -Date.now(), file: data.file, url: `/uploads/${data.file}`, title: file.name.slice(0, 60), artist: '', duration: null };
    rememberMine(track);
    chooseTrack(track);
  } catch (_) {
    toast(t('eUpload'), 'err');
  } finally {
    button.disabled = false;
    button.classList.remove('btn--wait');
  }
}

/* ════ 04b · Лента: откуда играть ════

   Волна трека лежит лентой под неподвижной золотой иглой. Ленту тянут пальцем,
   как отрывок в сторис: что оказалось под иглой — с того гости и услышат.
   Отпущенная лента звучит с этого места пять секунд и плавно затихает — ровно
   столько, чтобы узнать место, и не дольше, чтобы не мешать думать. Подсказка
   под лентой одна — «Топ выбор»: откуда трек запускают другие пары, пока их
   мало — самый переслушиваемый момент на YouTube, а если и его нет — конец
   тихого вступления. Свежевыбранная песня сама встаёт на неё. Конца у отрывка
   нет: в приглашении песня играет до последней секунды и мягко возвращается
   к отметке. */

const TAPE = Object.freeze({
  px: 10,         // пикселей на секунду: секунда — ширина пальца на ленте
  bar: .5,        // один штрих волны — полсекунды
  height: 96,
  wave: 66,
  rate: 20,       // точек громкости на секунду
  needle: .3,     // игла на трети ширины: впереди видно, что будет звучать
  preview: 5000,  // сколько звучит выбранное место
  fade: 2400,     // и как долго затихает
});

const tape = {
  token: 0, src: null, url: null, duration: 0, peaks: null, energy: null,
  px: TAPE.px, needle: 0, width: 0, viewWidth: 0,
  playing: false, previewing: false, touching: false, touched: false, scrubbed: false, gliding: false, glide: 0,
  expect: null, lastMark: -1, raf: 0, playToken: 0, primed: false, fadeTimer: 0, volTimer: 0,
  marks: { top: null },
};

const maxStart = () => Math.max(0, Math.floor(tape.duration - 1));
const clampStart = (sec) => Math.max(0, Math.min(maxStart(), Math.round(Number(sec) || 0)));

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

/* ── Волна ──
   Файл скачивается один раз: из тех же байтов собирается и волна, и источник
   для плеера (blob), поэтому прослушивание не тянет трек второй раз. */

const waveCache = new Map();

function rememberWave(url, wave) {
  waveCache.set(url, wave);
  while (waveCache.size > 3) {
    const [oldUrl, old] = waveCache.entries().next().value;
    waveCache.delete(oldUrl);
    if (old.src.startsWith('blob:') && old.src !== tape.src) URL.revokeObjectURL(old.src);
  }
}

async function loadWave(url) {
  if (waveCache.has(url)) return waveCache.get(url);
  let wave = null;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('fetch');
    const bytes = await response.arrayBuffer();
    // Blob копирует байты сразу, а декодер свой буфер забирает насовсем.
    const blob = new Blob([bytes], { type: response.headers.get('content-type') || 'audio/mpeg' });
    const measured = await decodeWave(bytes);
    wave = { src: URL.createObjectURL(blob), duration: measured.duration, peaks: measured.peaks, energy: measured.energy };
  } catch (_) {
    // Чужой сервер не пустил или декодер не справился: лента будет без рисунка,
    // но выбирать начало на слух это не мешает.
    const duration = await audioDuration(url);
    if (duration >= 4) wave = { src: url, duration, peaks: null, energy: null };
  }
  if (wave) rememberWave(url, wave);
  return wave;
}

function decodeWave(bytes) {
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Offline) return Promise.reject(new Error('no-audio-context'));
  // 8 кГц хватает глазу с запасом и в десять раз легче для слабого телефона.
  let context;
  try { context = new Offline(1, 1, 8000); } catch (_) { context = new Offline(1, 1, 44100); }
  return new Promise((resolve, reject) => {
    const done = (buffer) => {
      try { resolve(measureWave(buffer)); } catch (error) { reject(error); }
    };
    const pending = context.decodeAudioData(bytes, done, reject);
    if (pending && typeof pending.then === 'function') pending.catch(reject);
  });
}

function measureWave(buffer) {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  const step = Math.max(1, Math.floor(buffer.sampleRate / TAPE.rate));
  const count = Math.ceil(buffer.length / step);
  const peaks = new Float32Array(count);
  const energy = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const from = i * step;
    const to = Math.min(buffer.length, from + step);
    let peak = 0;
    let sum = 0;
    let n = 0;
    for (let s = from; s < to; s += 2) {
      let v = 0;
      for (const data of channels) v += Math.abs(data[s]);
      v /= channels.length;
      if (v > peak) peak = v;
      sum += v * v;
      n += 1;
    }
    peaks[i] = peak;
    energy[i] = Math.sqrt(sum / Math.max(1, n));
  }
  // Записи сведены по-разному громко. Нормируем по 95-му перцентилю: тихая
  // запись не выглядит пустой, громкая — сплошной стеной.
  const sorted = Array.from(peaks).sort((a, b) => a - b);
  const ceiling = sorted[Math.floor(sorted.length * .95)] || 1;
  for (let i = 0; i < count; i++) peaks[i] = Math.min(1, Math.pow(peaks[i] / ceiling, .85));
  return { duration: buffer.duration, peaks, energy };
}

/* Где кончается тихое вступление: первая секунда, когда звук держится выше
   трети громкой части песни. Вступление короче двух секунд не в счёт. */
function findQuietIntro(energy, duration) {
  const r = TAPE.rate;
  if (!energy || energy.length < r * 20) return null;
  const n = energy.length;
  const sorted = Array.from(energy).sort((a, b) => a - b);
  const loud = sorted[Math.floor(n * .9)];
  if (!loud) return null;
  for (let i = 0; i < n - r; i += r / 4) {
    let sum = 0;
    for (let k = i; k < i + r; k++) sum += energy[k];
    if (sum / r > loud * .32) {
      const sec = Math.floor(i / r);
      return sec >= 2 && sec < duration * .4 ? sec : null;
    }
  }
  return null;
}

/* ── Рисунок ── */

function sceneRgb() {
  const style = getComputedStyle(document.documentElement);
  const rgb = ['--scene-r', '--scene-g', '--scene-b'].map((key) => Math.round(Number(style.getPropertyValue(key))));
  return rgb.every(Number.isFinite) && rgb.some(Boolean) ? rgb : [236, 201, 132];
}

function layoutTape() {
  const view = $('tape-view');
  const width = view.clientWidth;
  if (!width || !tape.duration) return false;
  // Длинный трек сжимаем, чтобы холст не упёрся в пределы браузера.
  tape.px = tape.duration > 600 ? Math.max(4, 6000 / tape.duration) : TAPE.px;
  tape.viewWidth = width;
  tape.needle = Math.round(width * TAPE.needle);
  tape.width = Math.ceil(tape.duration * tape.px);
  $('tape-strip').style.width = `${tape.needle + tape.width + (width - tape.needle)}px`;
  for (const id of ['tape-base', 'tape-lit']) $(id).style.left = `${tape.needle}px`;
  $('music-trim').style.setProperty('--needle', `${tape.needle}px`);
  return true;
}

function drawTape() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = tape.width;
  const height = TAPE.height;
  const mid = TAPE.wave / 2 + 6;
  const pitch = tape.px * TAPE.bar;
  const barW = Math.max(1.6, pitch * .56);
  const bars = Math.ceil(tape.duration / TAPE.bar);
  const heights = new Float32Array(bars);
  for (let i = 0; i < bars; i++) {
    if (!tape.peaks) { heights[i] = .24; continue; }   // рисунка нет — ровная лента честнее выдуманной
    const from = Math.floor(i * TAPE.bar * TAPE.rate);
    const to = Math.min(tape.peaks.length, Math.floor((i + 1) * TAPE.bar * TAPE.rate));
    let v = 0;
    for (let k = from; k < to; k++) if (tape.peaks[k] > v) v = tape.peaks[k];
    heights[i] = v;
  }
  const [r, g, b] = sceneRgb();

  const paint = (canvas, fill, withRuler) => {
    canvas.width = Math.ceil(w * dpr);
    canvas.height = Math.ceil(height * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, height);
    ctx.fillStyle = fill(ctx);
    ctx.beginPath();
    for (let i = 0; i < bars; i++) {
      const bh = Math.max(2, heights[i] * (TAPE.wave - 4));
      const x = i * pitch + (pitch - barW) / 2;
      if (ctx.roundRect) ctx.roundRect(x, mid - bh / 2, barW, bh, barW / 2);
      else ctx.rect(x, mid - bh / 2, barW, bh);
    }
    ctx.fill();
    if (withRuler) drawRuler(ctx, r, g, b);
  };

  paint($('tape-base'), () => 'rgba(247, 241, 231, .3)', true);
  paint($('tape-lit'), (ctx) => {
    const gradient = ctx.createLinearGradient(0, mid - TAPE.wave / 2, 0, mid + TAPE.wave / 2);
    gradient.addColorStop(0, `rgb(${Math.min(255, r + 40)}, ${Math.min(255, g + 44)}, ${Math.min(255, b + 70)})`);
    gradient.addColorStop(.5, '#fff6e2');
    gradient.addColorStop(1, `rgb(${r}, ${g}, ${b})`);
    return gradient;
  }, false);
}

function drawRuler(ctx, r, g, b) {
  const y = TAPE.wave + 14;
  const every = tape.duration > 360 ? 30 : 15;
  ctx.font = '500 10px "Golos Text", sans-serif';
  ctx.textBaseline = 'top';
  for (let s = 0; s <= tape.duration; s += 5) {
    const x = s * tape.px;
    const major = s % every === 0;
    ctx.fillStyle = major ? 'rgba(247, 241, 231, .42)' : 'rgba(247, 241, 231, .2)';
    ctx.fillRect(x, y, 1, major ? 7 : 3);
    if (major) {
      ctx.fillStyle = 'rgba(247, 241, 231, .5)';
      ctx.fillText(clockText(s), x + 4, y + 2);
    }
  }
  // Ромбик над линейкой — туда ведёт «Топ выбор».
  const sec = tape.marks.top;
  if (sec === null || sec === undefined) return;
  const x = sec * tape.px;
  ctx.fillStyle = `rgb(${Math.min(255, r + 30)}, ${Math.min(255, g + 30)}, ${Math.min(255, b + 50)})`;
  ctx.beginPath();
  ctx.moveTo(x, y - 7);
  ctx.lineTo(x + 3.5, y - 3.5);
  ctx.lineTo(x, y);
  ctx.lineTo(x - 3.5, y - 3.5);
  ctx.closePath();
  ctx.fill();
}

/* Звучащий отрезок подсвечен золотом: от отметки и до того, что играет сейчас. */
function paintSweep(at) {
  const lit = $('tape-lit');
  if (!lit || !tape.width) return;
  const from = (state.musicStart || 0) * tape.px;
  const to = Math.max(from, Math.min(tape.width, at * tape.px));
  lit.style.clipPath = `inset(0 ${Math.max(0, tape.width - to)}px 0 ${from}px)`;
  $('tape-head').style.transform = `translate3d(${tape.needle + to}px, 0, 0)`;
}

function paintTapeTime(sec) {
  const s = Math.max(0, Math.round(sec));
  const text = clockText(s);
  const read = $('tape-at');
  if (read.textContent !== text) read.textContent = text;
  const view = $('tape-view');
  view.setAttribute('aria-valuenow', String(s));
  view.setAttribute('aria-valuetext', text);
}

function paintTape() {
  const box = $('music-trim');
  if (!box || !tape.duration) return;
  const start = state.musicStart || 0;
  if (!tape.scrubbed && !tape.gliding) paintTapeTime(start);
  $('tape-total').textContent = `/ ${clockText(tape.duration)}`;
  $('tape-view').setAttribute('aria-valuemax', String(maxStart()));
  $('tape-view').setAttribute('aria-label', t('trimTitle'));
  box.classList.toggle('is-playing', tape.playing);
  box.classList.toggle('is-set', start > 0);
  $('trim-play').setAttribute('aria-label', tape.playing ? t('pauseAria') : t('playAria'));
  $('trim-state').textContent = tape.playing
    ? (tape.previewing ? t('tapePreview') : t('tapeListening'))
    : start > 0 ? t('trimFrom', clockText(start)) : t('tapeHint');
  paintChips();
}

function paintChips() {
  const box = $('tape-chips');
  if (!box) return;
  const top = tape.marks.top;
  const show = top !== null && top !== undefined && Math.abs(top - (state.musicStart || 0)) > 1;
  const key = `${LANG}/${show ? top : '-'}`;
  if (box.dataset.key === key) return;
  box.dataset.key = key;
  box.innerHTML = '';
  box.hidden = !show;
  if (!show) return;
  const chip = h('button', { type: 'button', class: 'tape-chip' }, h('span', {}, t('chipTop')), h('b', {}, clockText(top)));
  chip.addEventListener('click', () => { haptic.tap(); tape.touched = true; primeTape(); glideTo(top, { play: true }); });
  box.appendChild(chip);
}

/* ── Звук ──
   Лента играет своим элементом через узел громкости Web Audio: на iPhone
   свойство volume у <audio> только для чтения, и плавно погасить песню можно
   лишь так. Чужой сервер без CORS отдал бы в Web Audio тишину, поэтому такие
   ссылки играют обычным элементом и затихают громкостью, где это умеют. */

const tapeSound = { ctx: null, gain: null, routed: null, plain: null };

function tapeStopped(event) {
  if (!tape.playing || event.currentTarget !== currentTapeElement()) return;
  tape.playing = false;
  tape.previewing = false;
  clearTimeout(tape.fadeTimer);
  stopSweep();
  paintTape();
}

function newTapeElement() {
  const el = new Audio();
  el.preload = 'auto';
  el.addEventListener('ended', tapeStopped);
  el.addEventListener('pause', tapeStopped);
  return el;
}

function currentTapeElement() {
  return tape.src?.startsWith('blob:') ? tapeSound.routed : tapeSound.plain;
}

function tapeElement() {
  if (!tape.src?.startsWith('blob:')) {
    if (!tapeSound.plain) tapeSound.plain = newTapeElement();
    return tapeSound.plain;
  }
  return routedTapeElement();
}

/* Песню выбрали касанием, а зазвучит она через несколько секунд — после
   скачивания и волны. iOS даёт звук только из касания, поэтому звук ленты
   заводим сразу, пока касание ещё «наше». */
function wakeTapeSound() {
  routedTapeElement();
  tapeSound.ctx?.resume?.().catch(() => {});
}

function routedTapeElement() {
  if (!tapeSound.routed) {
    tapeSound.routed = newTapeElement();
    const Ctx = window.AudioContext || window.webkitAudioContext;
    try {
      tapeSound.ctx = new Ctx();
      const source = tapeSound.ctx.createMediaElementSource(tapeSound.routed);
      tapeSound.gain = tapeSound.ctx.createGain();
      source.connect(tapeSound.gain).connect(tapeSound.ctx.destination);
    } catch (_) {
      tapeSound.ctx = null;
      tapeSound.gain = null;   // без Web Audio — пауза вместо затухания
    }
  }
  return tapeSound.routed;
}

function setTapeLevel(value, ms = 0) {
  const el = tapeElement();
  clearInterval(tape.volTimer);
  if (tapeSound.gain && el === tapeSound.routed) {
    const param = tapeSound.gain.gain;
    const now = tapeSound.ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(Math.max(.0001, param.value), now);
    if (ms) param.exponentialRampToValueAtTime(Math.max(.0001, value), now + ms / 1000);
    else param.setValueAtTime(value, now);
    return;
  }
  if (!ms) { try { el.volume = value; } catch (_) { /* iOS */ } return; }
  const from = el.volume;
  const t0 = performance.now();
  tape.volTimer = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    try { el.volume = from + (value - from) * (1 - (1 - k) ** 2); } catch (_) { /* iOS */ }
    if (k >= 1) clearInterval(tape.volTimer);
  }, 40);
}

/* iOS разрешает звук только из касания: касание ленты, подсказки или кнопки
   заводит плеер беззвучно — дальше лента может звучать сама. */
function primeTape() {
  if (!tape.src) return;
  const el = tapeElement();
  if (tapeSound.ctx?.state === 'suspended') tapeSound.ctx.resume().catch(() => {});
  if (tape.primed) return;
  if (!sameUrl(el.src, tape.src)) el.src = tape.src;
  const token = tape.playToken;
  el.muted = true;
  const undo = (ok) => {
    if (ok) tape.primed = true;
    if (token === tape.playToken) el.pause();
    el.muted = false;
  };
  const pending = el.play();
  if (pending?.then) pending.then(() => undo(true), () => undo(false)); else undo(true);
}

function playTape(from = state.musicStart || 0, { preview = false } = {}) {
  if (!tape.src) return;
  const token = ++tape.playToken;
  clearTimeout(tape.fadeTimer);
  if (playingUrl || !player.paused) { player.pause(); playingUrl = null; activeTrackUrl = null; refreshPlayUI(); }
  const el = tapeElement();
  const go = () => {
    if (token !== tape.playToken) return;
    try { el.currentTime = Math.max(0, Math.min(from, tape.duration - .25)); } catch (_) { /* поток ещё не готов */ }
    setTapeLevel(1);
    el.muted = false;
    el.play().then(() => {
      if (token !== tape.playToken) return;
      tape.playing = true;
      tape.previewing = preview;
      $('music-trim').classList.remove('is-fading');
      if (preview) tape.fadeTimer = setTimeout(() => fadeTape(token), TAPE.preview);
      sweep();
      paintTape();
    }).catch(() => {
      if (token !== tape.playToken) return;
      tape.playing = false;
      tape.previewing = false;
      paintTape();
    });
  };
  if (!sameUrl(el.src, tape.src)) {
    el.src = tape.src;
    el.addEventListener('loadedmetadata', go, { once: true });
    return;
  }
  if (el.readyState >= 1) go(); else el.addEventListener('loadedmetadata', go, { once: true });
}

/* Пять секунд прозвучали — песня медленно уходит в тишину и замолкает. */
function fadeTape(token) {
  if (token !== tape.playToken || !tape.playing) return;
  $('music-trim').classList.add('is-fading');
  setTapeLevel(0, TAPE.fade);
  tape.fadeTimer = setTimeout(() => {
    if (token === tape.playToken) pauseTape();
  }, TAPE.fade + 80);
}

function stopSweep() {
  cancelAnimationFrame(tape.raf);
  tape.raf = 0;
  paintSweep(state.musicStart || 0);
  $('music-trim')?.classList.remove('is-fading');
}

function pauseTape() {
  tape.playToken += 1;
  clearTimeout(tape.fadeTimer);
  const was = tape.playing;
  tape.playing = false;
  tape.previewing = false;
  const el = tape.src ? currentTapeElement() : null;
  if (el && !el.paused) el.pause();
  if (el) setTapeLevel(1);
  stopSweep();
  if (was) paintTape();
}

function sweep() {
  cancelAnimationFrame(tape.raf);
  const el = currentTapeElement();
  const frame = () => {
    if (!tape.playing || !el) return;
    paintSweep(el.currentTime);
    tape.raf = requestAnimationFrame(frame);
  };
  tape.raf = requestAnimationFrame(frame);
}

function toggleTapePlay() {
  haptic.tap();
  primeTape();
  if (tape.playing) pauseTape(); else playTape(state.musicStart || 0);
}

/* ── Отметка ── */

function commitStart(sec) {
  const next = clampStart(sec);
  if (next !== state.musicStart) {
    state.musicStart = next;
    state.previewHtml = '';
    saveDraft();
  }
  state.musicEnd = null;
  paintTape();
}

function glideTo(sec, { play = false } = {}) {
  const view = $('tape-view');
  if (!tape.duration || !view) return;
  const target = clampStart(sec);
  const from = view.scrollLeft;
  const to = target * tape.px;
  const run = ++tape.glide;
  let finished = false;
  if (play) pauseTape();
  commitStart(target);
  const done = () => {
    if (finished || run !== tape.glide) return;
    finished = true;
    tape.gliding = false;
    tape.expect = Math.round(to);
    view.scrollLeft = to;
    paintTapeTime(target);
    paintSweep(target);
    if (play) playTape(target, { preview: true });
  };
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduced || Math.abs(to - from) < 2) { done(); return; }
  tape.gliding = true;
  const ms = Math.min(900, 380 + Math.abs(to - from) * .3);
  const t0 = performance.now();
  const step = (now) => {
    if (finished || run !== tape.glide) return;
    const k = Math.min(1, (now - t0) / ms);
    const x = from + (to - from) * easeInOut(k);
    view.scrollLeft = x;
    paintTapeTime(x / tape.px);
    if (k < 1) requestAnimationFrame(step); else done();
  };
  requestAnimationFrame(step);
  setTimeout(done, ms + 500);   // свёрнутая вкладка без кадров не должна подвесить ленту
}

/* Лента двинулась от пальца: звук молчит, крупные цифры бегут вместе с ней,
   каждые пять секунд — лёгкий щелчок. Отпустили — отметка встаёт на целую
   секунду, и это место звучит пять секунд. */
function onTapeScroll() {
  if (!tape.duration) return;
  const view = $('tape-view');
  if (tape.expect !== null) {
    const ours = Math.abs(view.scrollLeft - tape.expect) <= 1;
    tape.expect = null;
    if (ours) return;
  }
  if (tape.gliding) return;
  if (tape.playing) pauseTape();
  const sec = Math.min(maxStart(), view.scrollLeft / tape.px);
  tape.scrubbed = true;
  paintTapeTime(sec);
  paintSweep(sec);
  const mark = Math.floor(sec / 5);
  if (mark !== tape.lastMark) { tape.lastMark = mark; haptic.tap(); }
  $('music-trim').classList.add('is-scrubbing');
  settleTapeSoon();
}

function settleTape() {
  if (tape.touching || tape.gliding || !tape.scrubbed || !tape.duration) return;
  tape.scrubbed = false;
  $('music-trim').classList.remove('is-scrubbing');
  const view = $('tape-view');
  const sec = clampStart(view.scrollLeft / tape.px);
  commitStart(sec);
  tape.expect = Math.round(sec * tape.px);
  view.scrollLeft = tape.expect;
  paintSweep(sec);
  playTape(sec, { preview: true });
}

const settleTapeSoon = debounce(settleTape, 180);

/* ── Открытие ── */

function mountTape() {
  if (!tape.duration || !layoutTape()) return;   // блок ещё без ширины — ResizeObserver дорисует
  drawTape();
  tape.expect = Math.round((state.musicStart || 0) * tape.px);
  $('tape-view').scrollLeft = tape.expect;
  paintSweep(state.musicStart || 0);
  paintTape();
}

async function openTrim({ fresh = false } = {}) {
  const box = $('music-trim');
  if (!box) return;
  const token = ++tape.token;
  pauseTape();
  Object.assign(tape, {
    src: null, url: null, duration: 0, peaks: null, energy: null, width: 0, primed: false, scrubbed: false, touched: false,
    marks: { top: null },
  });
  $('tape-chips').dataset.key = '';
  $('tape-chips').innerHTML = '';
  const top = fetchTopStart(state.music);
  const url = state.music?.playUrl;
  // У плеера YouTube нет звука для волны: ленты нет, но играет он с «Топ выбора».
  if (!url) {
    box.hidden = true;
    const cut = fresh && state.music?.type === 'youtube' ? await top : null;
    if (token !== tape.token || !cut) return;
    state.musicStart = cut.start;
    saveDraft();
    paintMusicNote();
    return;
  }

  box.hidden = false;
  box.classList.add('is-loading');
  box.classList.remove('is-set', 'is-playing', 'is-fading', 'is-scrubbing');
  $('trim-state').textContent = t('tapeLoading');
  $('tape-at').textContent = clockText(state.musicStart || 0);
  $('tape-total').textContent = '';
  for (const id of ['tape-base', 'tape-lit']) { $(id).width = 0; $(id).style.width = '0px'; }

  const wave = await loadWave(url);
  if (token !== tape.token) return;
  box.classList.remove('is-loading');
  if (!wave) { box.hidden = true; return; }
  Object.assign(tape, { src: wave.src, url, duration: wave.duration, peaks: wave.peaks, energy: wave.energy });
  state.musicStart = clampStart(state.musicStart);
  mountTape();

  const cut = await Promise.race([top, wait(2500).then(() => null)]);
  if (token !== tape.token) return;
  tape.marks.top = cut && cut.start < tape.duration - 1 ? cut.start : findQuietIntro(wave.energy, wave.duration);
  if (tape.width) drawTape();
  paintTape();
  if (!fresh || tape.touched) return;
  if (tape.marks.top !== null) glideTo(tape.marks.top, { play: true });
  else playTape(0, { preview: true });
}

/* «Топ выбор» с сервера: где этот трек запускают пары, а пока пар мало — самый
   переслушиваемый момент песни на YouTube. */
async function fetchTopStart(music) {
  if (!music) return null;
  try {
    const query = new URLSearchParams({ type: music.type, url: String(music.value ?? '') });
    const cut = (await (await fetch(`/api/music/cut?${query}`)).json()).cut;
    return cut && Number.isFinite(cut.start) ? cut : null;
  } catch (_) {
    return null;
  }
}

function closeTrim() {
  tape.token += 1;
  pauseTape();
  tape.duration = 0;
  tape.src = null;
  const box = $('music-trim');
  if (box) { box.hidden = true; box.classList.remove('is-loading', 'is-playing', 'is-set', 'is-fading', 'is-scrubbing'); }
}

function wireTape() {
  const view = $('tape-view');
  $('trim-play').addEventListener('click', toggleTapePlay);
  view.addEventListener('scroll', onTapeScroll, { passive: true });

  const grab = () => {
    tape.touching = true;
    tape.touched = true;
    tape.expect = null;
    tape.glide += 1;
    tape.gliding = false;
    primeTape();
  };
  const release = () => {
    if (!tape.touching) return;
    tape.touching = false;
    primeTape();                // на iOS разрешение на звук даёт именно отпускание пальца
    settleTapeSoon();
  };
  view.addEventListener('touchstart', grab, { passive: true });
  view.addEventListener('touchend', release, { passive: true });
  view.addEventListener('touchcancel', release, { passive: true });

  // Мышью ленту тоже тянут — рукой, а не колесом.
  view.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !tape.duration) return;
    grab();
    const x0 = event.clientX;
    const s0 = view.scrollLeft;
    view.setPointerCapture?.(event.pointerId);
    view.classList.add('is-grabbing');
    const move = (e) => { view.scrollLeft = s0 - (e.clientX - x0); };
    const up = () => {
      view.removeEventListener('pointermove', move);
      view.removeEventListener('pointerup', up);
      view.removeEventListener('pointercancel', up);
      view.classList.remove('is-grabbing');
      release();
    };
    view.addEventListener('pointermove', move);
    view.addEventListener('pointerup', up);
    view.addEventListener('pointercancel', up);
  });

  view.addEventListener('keydown', (event) => {
    if (!tape.duration) return;
    tape.touched = true;
    const step = event.shiftKey ? 5 : 1;
    const moves = { ArrowLeft: -step, ArrowRight: step, PageUp: -15, PageDown: 15 };
    if (event.key in moves) {
      event.preventDefault();
      primeTape();
      glideTo((state.musicStart || 0) + moves[event.key], { play: true });
    } else if (event.key === 'Home') {
      event.preventDefault();
      primeTape();
      glideTo(0, { play: true });
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      toggleTapePlay();
    }
  });

  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      if (tape.duration && view.clientWidth && Math.abs(view.clientWidth - tape.viewWidth) > 1) mountTape();
    }).observe(view);
  } else {
    window.addEventListener('resize', debounce(() => { if (tape.duration) mountTape(); }, 200));
  }

  player.addEventListener('ended', () => {
    if (playingUrl) { playingUrl = null; refreshPlayUI(); }
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
    venueId: state.venueId || null,
    photos: state.photos.filter((p) => p.name).slice(0, requiredPhotos()).map((p) => p.name),
    musicType: state.music?.type ?? 'none',
    musicValue: state.music?.value ?? null,
    musicStart: state.music ? state.musicStart ?? null : null,
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
  wireTape();
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
      // Правка имён на поздних шагах не должна открывать следующий блок.
      if (state.open === 0) autoAdvance(TYPING_PAUSE);
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
    if (state.open === stepIdx('location')) autoAdvance(TYPING_PAUSE);
  });

  document.querySelectorAll('.seg').forEach((b, i) => {
    b.addEventListener('click', () => { haptic.tap(); switchMusicTab(i); });
  });
  $('music-q').addEventListener('input', onMusicQuery);
  $('bot-open').addEventListener('click', openBot);
  // Пара вернулась из чата с ботом — сразу спрашиваем, что она прислала.
  const backFromBot = () => { if (myTracksOnScreen()) loadMyTracks({ announce: true }); syncMinePoll(); };
  document.addEventListener('visibilitychange', backFromBot);
  try { tg?.onEvent?.('activated', backFromBot); } catch (_) { /* старый клиент */ }
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
    state.previewHtml = '';
    player.pause();
    playingUrl = null;
    activeTrackUrl = null;
    closeTrim();
    $('music-picked').hidden = true;
    $('music-note').hidden = true;
    renderLibrary();
    renderMyTracks();
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
    paintMusicNote();
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
