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
    + 'Bu yerda siz:\n'
    + '• To‘y taklifnomangizni o‘zingiz yig‘asiz\n'
    + '• Sana, to‘yxona, musiqa va suratlar qo‘shasiz\n'
    + '• Har bir mehmonga ismli havola olasiz\n\n'
    + 'To‘ldirish 5 daqiqa. Boshlaymizmi? 👇'),

  'welcome.ru': def('start', 'Приветствие (RU)', 'Salomlashuv (RU)', [],
    '✨ <b>nvate</b> — онлайн-приглашения\n\n'
    + 'Здесь вы:\n'
    + '• Соберёте приглашение на свадьбу сами\n'
    + '• Добавите дату, тойхону, музыку и фотографии\n'
    + '• Получите именную ссылку для каждого гостя\n\n'
    + 'Заполнить — минут пять. Начнём? 👇'),

  'faq.uz': def('help', 'FAQ (UZ)', 'FAQ (UZ)', ['price', 'guestPrice', 'photos'],
    '<b>❔ Ko‘p so‘raladigan savollar</b>\n\n'
    + '💰 <b>Narx</b> — uslubga qarab {price}. Ismli havola — mehmon boshiga {guestPrice}.\n'
    + '🔗 <b>Havola</b> to‘lovdan keyin beriladi va hech qachon o‘chmaydi.\n'
    + '🎵 <b>Musiqa</b> — qo‘shiqni shu botga yuboring yoki studiyada qidiring. Taklifnomada to‘liq yangraydi.\n'
    + '📷 <b>Suratlar</b> — 1 tadan {photos} tagacha.\n'
    + '⏱ <b>Vaqt</b> — to‘ldirishga 5 daqiqa yetadi.'),

  'faq.ru': def('help', 'FAQ (RU)', 'FAQ (RU)', ['price', 'guestPrice', 'photos'],
    '<b>❔ Частые вопросы</b>\n\n'
    + '💰 <b>Цена</b> — {price} в зависимости от стиля. Именная ссылка — {guestPrice} за гостя.\n'
    + '🔗 <b>Ссылка</b> выдаётся после оплаты и остаётся навсегда.\n'
    + '🎵 <b>Музыка</b> — пришлите песню этому боту или найдите её в студии. В приглашении играет целиком.\n'
    + '📷 <b>Фото</b> — от 1 до {photos}.\n'
    + '⏱ <b>Время</b> — на всё хватает пяти минут.'),

  'support.uz': def('help', 'Поддержка (UZ)', 'Yordam (UZ)', [],
    '💬 <b>Yordam</b>\n\nSavolingizni shu yerga yozing — javob beramiz.'),

  'support.ru': def('help', 'Поддержка (RU)', 'Yordam (RU)', [],
    '💬 <b>Поддержка</b>\n\nНапишите вопрос сюда — ответим.'),

  'refLink.uz': def('start', 'Своя ссылка «позвать друзей» (UZ)', 'Do‘stlarni chaqirish havolasi (UZ)', ['link'],
    '🤝 <b>Do‘stlaringizni chaqiring</b>\n\n'
    + 'Mana sizning havolangiz: {link}\n\n'
    + 'Uni to‘y guruhiga tashlang. Havola orqali kelgan har bir juftlik bizda siznikidek belgilanadi.'),

  'refLink.ru': def('start', 'Своя ссылка «позвать друзей» (RU)', 'Do‘stlarni chaqirish havolasi (RU)', ['link'],
    '🤝 <b>Позовите друзей</b>\n\n'
    + 'Вот ваша ссылка: {link}\n\n'
    + 'Киньте её в свадебный чат. Каждая пара, пришедшая по ней, отметится у нас как ваша.'),

  musicWait: def('music', 'Достаём музыку', 'Musiqa ajratilmoqda', [],
    '⏳ Musiqa ajratilmoqda…\n⏳ Достаём музыку…'),

  musicDone: def('music', 'Песня сохранена', 'Qo‘shiq saqlandi', ['title', 'artist'],
    '🎵 <b>{title}</b>{artist}\n\n'
    + '✅ Studiyada turibdi: <i>Musiqa → Mening musiqam</i>\n'
    + '✅ Уже в студии: <i>Музыка → Моя музыка</i>'),

  musicBig: def('music', 'Файл больше 20 МБ', 'Fayl 20 MB dan katta', [],
    '⚠️ Fayl 20 MB dan katta — Telegram bunday fayllarni botlarga bermaydi. Havolasini yuboring.\n'
    + '⚠️ Файл больше 20 МБ — Telegram не отдаёт такие ботам. Пришлите ссылку на него.'),

  'cancelled.uz': def('order', 'Заявка отклонена (UZ)', 'Ariza rad etildi (UZ)', [],
    'Arizangiz rad etildi. Sababini bilish uchun yordam xizmatiga yozing — birga hal qilamiz.'),

  'cancelled.ru': def('order', 'Заявка отклонена (RU)', 'Ariza rad etildi (RU)', [],
    'Заявка отклонена. Напишите в поддержку — разберёмся вместе.'),

  'paidCard.uz': def('order', 'Карточка с QR (UZ)', 'QR kartochka (UZ)', ['couple', 'when', 'where'],
    '🎉 <b>Taklifnomangiz tayyor!</b>\n\n💍 <b>{couple}</b>\n{when}{where}\n\n'
    + '📲 QR-kodga telefon kamerasini to‘g‘rilang — taklifnoma darhol ochiladi.\n'
    + '🖨 Kartochkani chop etib, stollarga qo‘ying yoki konvertga soling.'),

  'paidCard.ru': def('order', 'Карточка с QR (RU)', 'QR kartochka (RU)', ['couple', 'when', 'where'],
    '🎉 <b>Ваше приглашение готово!</b>\n\n💍 <b>{couple}</b>\n{when}{where}\n\n'
    + '📲 Наведите камеру на QR-код — приглашение откроется сразу.\n'
    + '🖨 Карточку можно распечатать: на столы или в конверты.'),

  'mainLink.uz': def('order', 'Общая ссылка (UZ)', 'Umumiy havola (UZ)', ['link'],
    '🔗 <b>Umumiy havola</b> — hamma uchun bitta\n{link}\n\n'
    + '👇 «Ulashish» tugmasi chat tanlashni ochadi. Xohlagancha marta yuboring — havola o‘chmaydi.'),

  'mainLink.ru': def('order', 'Общая ссылка (RU)', 'Umumiy havola (RU)', ['link'],
    '🔗 <b>Общая ссылка</b> — одна на всех\n{link}\n\n'
    + '👇 «Поделиться» открывает выбор чата. Отправляйте сколько угодно раз — ссылка не пропадёт.'),

  'guestsIntro.uz': def('order', 'Именные приглашения: вступление (UZ)', 'Ismli taklifnomalar (UZ)', ['count'],
    '👥 <b>Ismli taklifnomalar</b> — {count} ta\n'
    + 'Har bir mehmon taklifnomani ochganda birinchi qatorda o‘z ismini ko‘radi.\n\n'
    + '☝️ Har bir ism ostidagi tugma chat tanlashni darhol ochadi — bir bosish, bir mehmon.'),

  'guestsIntro.ru': def('order', 'Именные приглашения: вступление (RU)', 'Ismli taklifnomalar (RU)', ['count'],
    '👥 <b>Именные приглашения</b> — {count}\n'
    + 'Каждый гость первой строкой увидит своё имя.\n\n'
    + '☝️ Кнопка под именем сразу открывает выбор чата — одно нажатие на гостя.'),

  guestCard: def('order', 'Карточка гостя', 'Mehmon kartochkasi', ['name', 'link'],
    '👤 <b>{name}</b>\n🔗 {link}'),

  'guestSent.uz': def('order', 'Отметка «отправлено» (UZ)', '«Yuborildi» belgisi (UZ)', [],
    '✅ <b>Yuborildi</b>'),

  'guestSent.ru': def('order', 'Отметка «отправлено» (RU)', '«Yuborildi» belgisi (RU)', [],
    '✅ <b>Отправлено</b>'),

  'invite.uz': def('share', 'Приглашение для всех (UZ)', 'Umumiy taklifnoma (UZ)', ['couple', 'when', 'where', 'link'],
    '💌 <b>Taklifnoma</b>\n\n💍 <b>{couple}</b>\nEng baxtli kunimizda yonimizda bo‘ling!\n\n{when}{where}\n\n🔗 {link}'),

  'invite.ru': def('share', 'Приглашение для всех (RU)', 'Umumiy taklifnoma (RU)', ['couple', 'when', 'where', 'link'],
    '💌 <b>Приглашение на свадьбу</b>\n\n💍 <b>{couple}</b>\nБудьте рядом в наш самый счастливый день!\n\n{when}{where}\n\n🔗 {link}'),

  'inviteGuest.uz': def('share', 'Именное приглашение (UZ)', 'Ismli taklifnoma (UZ)', ['name', 'couple', 'when', 'where', 'link'],
    '💌 <b>Hurmatli {name}!</b>\n\n💍 <b>{couple}</b> sizni to‘yiga taklif qiladi.\nSizni ko‘rsak, xursand bo‘lamiz.\n\n{when}{where}\n\n🔗 {link}'),

  'inviteGuest.ru': def('share', 'Именное приглашение (RU)', 'Ismli taklifnoma (RU)', ['name', 'couple', 'when', 'where', 'link'],
    '💌 <b>{name}, здравствуйте!</b>\n\n💍 <b>{couple}</b> приглашают вас на свадьбу.\nБудем рады видеть вас рядом.\n\n{when}{where}\n\n🔗 {link}'),
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
