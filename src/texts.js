/* ── Тексты бота ──
   Всё, что бот отправляет сообщением, лежит здесь и правится из админки:
   раздел «Тексты» показывает заводское значение, а сохранённая правка живёт в
   settings под ключом `texts`. Пустое поле возвращает заводской текст.

   {переменные} подставляются при отправке — их список у каждого текста свой,
   админка показывает его подсказкой. Неизвестная переменная остаётся как есть,
   поэтому опечатка в фигурных скобках ничего не ломает. */
import { getSetting, setSetting } from './db.js';

export const TEXT_GROUPS = [
  { id: 'start', ru: 'Старт и приветствие', uz: 'Boshlanish' },
  { id: 'help', ru: 'FAQ и поддержка', uz: 'FAQ va yordam' },
  { id: 'music', ru: 'Музыка', uz: 'Musiqa' },
  { id: 'order', ru: 'Заявка и готовое приглашение', uz: 'Ariza va tayyor taklifnoma' },
  { id: 'share', ru: 'Приглашение, которое уходит гостю', uz: 'Mehmonga ketadigan taklifnoma' },
];

const def = (group, ru, uz, vars, value) => ({ group, label: { ru, uz }, vars, value });

export const TEXT_DEFS = {
  langPrompt: def('start', 'Выбор языка', 'Til tanlash', [],
    '🇺🇿 Tilni tanlang · 🇷🇺 Выберите язык'),

  'welcome.uz': def('start', 'Приветствие (UZ)', 'Salomlashuv (UZ)', [],
    '✨ <b>nvate</b> — onlayn taklifnomalar\n\n'
    + 'Bu bot orqali siz:\n'
    + '• To‘y uchun chiroyli onlayn taklifnoma yaratasiz\n'
    + '• Sana, manzil (jonli xarita), musiqa va suratlar qo‘shasiz\n'
    + '• Har bir mehmonga alohida nomli havola olasiz\n\n'
    + 'Boshlash uchun quyidagi tugmani bosing 👇'),

  'welcome.ru': def('start', 'Приветствие (RU)', 'Salomlashuv (RU)', [],
    '✨ <b>nvate</b> — онлайн приглашения\n\n'
    + 'С помощью этого бота вы:\n'
    + '• Создадите красивое онлайн-приглашение на свадьбу\n'
    + '• Добавите дату, локацию (живая карта), музыку и фото\n'
    + '• Получите личную ссылку для каждого гостя\n\n'
    + 'Нажмите кнопку ниже, чтобы начать 👇'),

  'faq.uz': def('help', 'FAQ (UZ)', 'FAQ (UZ)', ['price', 'guestPrice', 'photos'],
    '<b>❔ Ko‘p so‘raladigan savollar</b>\n\n'
    + '💰 <b>Narx:</b> shablonga qarab {price}. Nomli havola — har bir mehmon uchun {guestPrice}.\n'
    + '🔗 <b>Havola:</b> to‘lovdan so‘ng shaxsiy havola beriladi va o‘chirilmaydi.\n'
    + '🎵 <b>Musiqa:</b> qo‘shiqni shu botga yuboring yoki kutubxonadan tanlang — to‘liq yangraydi.\n'
    + '📷 <b>Suratlar:</b> 1–{photos} ta.\n'
    + '⏱ <b>Vaqt:</b> to‘ldirish ~5 daqiqa.'),

  'faq.ru': def('help', 'FAQ (RU)', 'FAQ (RU)', ['price', 'guestPrice', 'photos'],
    '<b>❔ Частые вопросы</b>\n\n'
    + '💰 <b>Цена:</b> {price} в зависимости от шаблона. Именная ссылка — {guestPrice} за гостя.\n'
    + '🔗 <b>Ссылка:</b> выдаётся после оплаты и не удаляется.\n'
    + '🎵 <b>Музыка:</b> пришлите песню этому боту или выберите из библиотеки — звучит целиком.\n'
    + '📷 <b>Фото:</b> 1–{photos} шт.\n'
    + '⏱ <b>Время:</b> заполнение ~5 минут.'),

  'support.uz': def('help', 'Поддержка (UZ)', 'Yordam (UZ)', [],
    '💬 <b>Yordam</b>\n\nSavolingizni shu yerga yozing — tez orada javob beramiz.'),

  'support.ru': def('help', 'Поддержка (RU)', 'Yordam (RU)', [],
    '💬 <b>Поддержка</b>\n\nНапишите ваш вопрос сюда — ответим в ближайшее время.'),

  musicWait: def('music', 'Достаём музыку', 'Musiqa ajratilmoqda', [],
    '⏳ Musiqa ajratilmoqda…\n⏳ Достаём музыку…'),

  musicDone: def('music', 'Песня сохранена', 'Qo‘shiq saqlandi', ['title', 'artist'],
    '🎵 <b>{title}</b>{artist}\n\n'
    + '✅ Studiyada: <i>Musiqa → Mening musiqam</i>\n'
    + '✅ В студии: <i>Музыка → Моя музыка</i>'),

  musicBig: def('music', 'Файл больше 20 МБ', 'Fayl 20 MB dan katta', [],
    '⚠️ Fayl 20 MB dan katta — Telegram bunday fayllarni botlarga bermaydi.\n'
    + '⚠️ Файл больше 20 МБ — Telegram не отдаёт такие ботам.'),

  'cancelled.uz': def('order', 'Заявка отклонена (UZ)', 'Ariza rad etildi (UZ)', [],
    'Afsuski, arizangiz rad etildi. Aniqlik uchun yordam xizmatiga yozing.'),

  'cancelled.ru': def('order', 'Заявка отклонена (RU)', 'Ariza rad etildi (RU)', [],
    'К сожалению, ваша заявка отклонена. Свяжитесь с поддержкой для уточнения.'),

  'paidCard.uz': def('order', 'Карточка с QR (UZ)', 'QR kartochka (UZ)', ['couple', 'when', 'where'],
    '🎉 <b>Tabriklaymiz! Taklifnomangiz tayyor</b>\n\n💍 <b>{couple}</b>\n{when}{where}\n\n'
    + '📲 QR-kodni telefon kamerasida skanerlang — taklifnoma darhol ochiladi.\n'
    + '🖨 Kartochkani chop etib, stollarga yoki konvertlarga qo‘yish mumkin.'),

  'paidCard.ru': def('order', 'Карточка с QR (RU)', 'QR kartochka (RU)', ['couple', 'when', 'where'],
    '🎉 <b>Поздравляем! Ваше приглашение готово</b>\n\n💍 <b>{couple}</b>\n{when}{where}\n\n'
    + '📲 Наведите камеру телефона на QR-код — приглашение откроется сразу.\n'
    + '🖨 Карточку можно распечатать и поставить на столы или вложить в конверты.'),

  'mainLink.uz': def('order', 'Общая ссылка (UZ)', 'Umumiy havola (UZ)', ['link'],
    '🔗 <b>Umumiy havola</b> — barcha mehmonlar uchun\n{link}\n\n'
    + '👇 «Ulashish» tugmasi bilan taklifnomani do‘stlar, qarindoshlar va guruhlarga yuboring — xohlagancha marta.'),

  'mainLink.ru': def('order', 'Общая ссылка (RU)', 'Umumiy havola (RU)', ['link'],
    '🔗 <b>Общая ссылка</b> — для всех гостей\n{link}\n\n'
    + '👇 Кнопкой «Поделиться» отправьте приглашение друзьям, родным и в группы — сколько угодно раз.'),

  'guestsIntro.uz': def('order', 'Именные приглашения: вступление (UZ)', 'Ismli taklifnomalar (UZ)', ['count'],
    '👥 <b>Ismli taklifnomalar</b> — {count} ta\n'
    + 'Har bir mehmon taklifnomani ochganda o‘z ismini ko‘radi.\n\n'
    + '☝️ «Yuborish» tugmasi bir martalik: taklifnoma yuborilishi bilan u yo‘qoladi.'),

  'guestsIntro.ru': def('order', 'Именные приглашения: вступление (RU)', 'Ismli taklifnomalar (RU)', ['count'],
    '👥 <b>Именные приглашения</b> — {count}\n'
    + 'Каждый гость увидит в приглашении своё имя.\n\n'
    + '☝️ Кнопка «Отправить» одноразовая: как только приглашение ушло, она исчезает.'),

  guestCard: def('order', 'Карточка гостя', 'Mehmon kartochkasi', ['name', 'link'],
    '👤 <b>{name}</b>\n🔗 {link}'),

  'guestSent.uz': def('order', 'Отметка «отправлено» (UZ)', '«Yuborildi» belgisi (UZ)', [],
    '✅ <b>Yuborildi</b>'),

  'guestSent.ru': def('order', 'Отметка «отправлено» (RU)', '«Yuborildi» belgisi (RU)', [],
    '✅ <b>Отправлено</b>'),

  'invite.uz': def('share', 'Приглашение для всех (UZ)', 'Umumiy taklifnoma (UZ)', ['couple', 'when', 'where', 'link'],
    '💌 <b>Taklifnoma</b>\n\n💍 <b>{couple}</b>\nSizni to‘yimizga taklif qilamiz!\n\n{when}{where}\n\n🔗 {link}'),

  'invite.ru': def('share', 'Приглашение для всех (RU)', 'Umumiy taklifnoma (RU)', ['couple', 'when', 'where', 'link'],
    '💌 <b>Приглашение на свадьбу</b>\n\n💍 <b>{couple}</b>\nПриглашаем вас разделить с нами этот день!\n\n{when}{where}\n\n🔗 {link}'),

  'inviteGuest.uz': def('share', 'Именное приглашение (UZ)', 'Ismli taklifnoma (UZ)', ['name', 'couple', 'when', 'where', 'link'],
    '💌 <b>Hurmatli {name}!</b>\n\n💍 <b>{couple}</b> sizni to‘yiga taklif qiladi.\n\n{when}{where}\n\n🔗 {link}'),

  'inviteGuest.ru': def('share', 'Именное приглашение (RU)', 'Ismli taklifnoma (RU)', ['name', 'couple', 'when', 'where', 'link'],
    '💌 <b>{name}, здравствуйте!</b>\n\n💍 <b>{couple}</b> приглашают вас на свадьбу.\n\n{when}{where}\n\n🔗 {link}'),
};

const SETTING = 'texts';

// Правки админа. Значение — { [key]: 'текст' }; пустая строка = заводской текст.
function overrides() {
  const saved = getSetting(SETTING);
  return saved && typeof saved === 'object' ? saved : {};
}

export function textValue(key) {
  const custom = overrides()[key];
  if (typeof custom === 'string' && custom.trim()) return custom;
  return TEXT_DEFS[key]?.value ?? '';
}

/* text('mainLink.ru', { link }) — готовая строка. Значения подставляются как
   есть: HTML в них экранирует вызывающая сторона, как и раньше. */
export function text(key, vars = {}) {
  return textValue(key).replace(/\{(\w+)\}/g, (whole, name) =>
    (Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name] ?? '') : whole));
}

// Текст на языке пары: 'ru' → ключ .ru, всё остальное → .uz.
export const textLang = (key, lang, vars) => text(`${key}.${lang === 'ru' ? 'ru' : 'uz'}`, vars);

// Всё для админки: группы, заводские значения и текущие правки.
export function textsSnapshot() {
  const custom = overrides();
  return {
    groups: TEXT_GROUPS,
    items: Object.entries(TEXT_DEFS).map(([key, entry]) => ({
      key,
      group: entry.group,
      label: entry.label,
      vars: entry.vars,
      defaultValue: entry.value,
      value: typeof custom[key] === 'string' ? custom[key] : '',
    })),
  };
}

const MAX_TEXT = 4000;

export async function updateTexts(patch) {
  if (!patch || typeof patch !== 'object') throw new Error('Пустой запрос');
  const next = { ...overrides() };
  for (const [key, raw] of Object.entries(patch)) {
    if (!(key in TEXT_DEFS)) continue;
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value) { delete next[key]; continue; }
    if (value.length > MAX_TEXT) throw new Error(`Текст «${key}» длиннее ${MAX_TEXT} символов`);
    next[key] = value;
  }
  await setSetting(SETTING, next);
  return textsSnapshot();
}
