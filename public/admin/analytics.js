/* ── Вкладка «Показатели» ──
   Всё, что админ хочет знать о деле за выбранный период: сколько пришло
   людей, сколько дошло до заявки и до оплаты, откуда пришли, что выбирают,
   когда заказывают и как быстро мы подтверждаем.

   Данные даёт /api/admin/analytics (src/analytics.js): период — дни по
   Ташкенту, группировка — час/день/неделя/месяц. Цвет у графиков один —
   золото: серия всегда одна, а разрезы идут таблицами и числами. Тексты,
   пришедшие из базы (имена, коды, метки), попадают в разметку только через
   esc() или textContent. */

const I18N = {
  uz: {
    presets: { today: 'Bugun', yesterday: 'Kecha', '7d': '7 kun', '30d': '30 kun', month: 'Shu oy', lastmonth: 'O‘tgan oy', '90d': '90 kun', year: 'Shu yil', all: 'Hammasi', custom: 'Oraliq…' },
    groups: { hour: 'Soat', day: 'Kun', week: 'Hafta', month: 'Oy' },
    groupBy: 'Guruhlash', show: 'Ko‘rsatish', from: 'dan', to: 'gacha',
    vsPrev: (a, b) => `o‘tgan davr bilan: ${a} — ${b}`, noPrev: 'solishtirish uchun o‘tgan davr yo‘q',
    since: (at, by) => `Statistika ${at} dan hisoblanmoqda${by ? ` (${by} nolga tushirgan)` : ''}. Arizalar va to‘lovlar joyida — faqat hisob yangidan boshlangan.`,
    restore: 'Butun tarixni qaytarish',
    now: 'Hozir', nowWaiting: 'tasdiq kutmoqda', nowUnlinked: 'sayt arizasi Telegram’siz', nowStuck: 'qoralama yarim yo‘lda', toOrders: 'Arizalarga →',
    k: {
      revenue: 'Tushum', orders: 'Arizalar', paid: 'To‘lovlar', avgCheck: 'O‘rtacha chek',
      conversion: 'Ariza → to‘lov', visitors: 'Tashrif buyurganlar', newPeople: 'Yangi odamlar', visitToOrder: 'Tashrif → ariza',
      cancelled: 'Rad etilgan', waiting: 'Hali kutmoqda', discount: 'Chegirma berildi', guestLinks: 'Nomli havolalar',
      confirmMinutes: 'Tasdiqlash tezligi', webOrders: 'Saytdan arizalar',
    },
    kHint: { conversion: 'davr arizalaridan to‘langani', revenue: 'to‘lov sanasi bo‘yicha', confirmMinutes: 'mediana, arizadan to‘lovgacha', paid: 'tasdiqlangan to‘lovlar' },
    fresh: 'yangi', min: 'daq', hour: 'soat', days: 'kun',
    hDyn: 'Dinamika', metrics: { orders: 'Arizalar', paid: 'To‘lovlar', revenue: 'Tushum', visitors: 'Tashriflar', newPeople: 'Yangi odamlar', opens: 'Studiya ochildi', web: 'Saytdan' },
    table: 'Jadval', chart: 'Grafik', csv: 'CSV', period: 'Davr', total: 'Jami', best: 'eng yaxshi',
    hFunnel: 'Voronka', funnelOpen: 'Studiyani ochdi', funnelOrder: 'Ariza qoldirdi', funnelPaid: 'To‘ladi',
    funnelNote: 'Qadam — juftlik studiyada ochgan eng oxirgi blok. Voronka yangi versiyadan boshlab yig‘iladi: undan oldingi tashriflarda qadamlar yo‘q.',
    ofTop: 'boshidan', ofPrev: 'oldingidan',
    hChannels: 'Telegram va sayt', tg: 'Telegram bot', web: 'Sayt nvate.uz/app',
    chPeople: 'Yangi odamlar', chOpens: 'Studiyani ochgan', chOrders: 'Arizalar', chPaid: 'To‘lovlar', chRevenue: 'Tushum', chConv: 'Ariza → to‘lov',
    chLinked: 'Telegram’ni ulagan', chLinkedNote: 'saytdagi arizalardan havolani botga olganlar',
    hSources: 'Qayerdan kelishmoqda', hTemplates: 'Shablonlar', hPromos: 'Promokodlar', hLangs: 'Tillar',
    cols: { source: 'Manba', people: 'Odam', orders: 'Ariza', paid: 'To‘lov', revenue: 'Tushum', conversion: 'Konv.', reach: 'Odam → ariza', discount: 'Chegirma', name: 'Shablon', code: 'Kod', lang: 'Til', share: 'Ulush', key: 'Davr', visitors: 'Tashrif', newPeople: 'Yangi', opens: 'Studiya', cancelled: 'Rad', web: 'Sayt', avg: 'O‘rt. chek', count: 'Soni', median: 'Mediana', invited: 'Olib kelgan', ordered: 'Ariza', who: 'Kim' },
    srcNote: 'Bot havolasiga ?start=BELGI yoki sayt manziliga ?s=BELGI qo‘shing — belgi shu yerda chiqadi. Sayt uchun Instagram, Google va boshqalar havola qilgan sayt bo‘yicha o‘zi aniqlanadi.',
    sources: { direct: 'O‘zi kelgan', site: 'Sayt → bot', qr: 'Saytdagi QR', ref: 'Juftlik taklifi', ig: 'Instagram', tg: 'Telegram', google: 'Google', fb: 'Facebook', tiktok: 'TikTok', yt: 'YouTube', yandex: 'Yandex' },
    mark: 'belgi',
    hHeat: 'Qachon buyurtma berishadi', heatNote: 'Arizalar hafta kuni va soat bo‘yicha (Toshkent vaqti).', less: 'kam', more: 'ko‘p',
    dow: ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'],
    hWeddings: 'To‘ylar qaysi oyda', leadDays: 'Ariza to‘ydan o‘rtacha', before: 'oldin',
    hGuests: 'Nomli havolalar', gPremium: 'Nomli havolali buyurtmalar', gShare: 'to‘lovlar ulushi', gLinks: 'Havolalar yaratildi', gSent: 'Botdan yuborildi', gAvg: 'Bir buyurtmada o‘rtacha', gRevenue: 'Ulardan tushum',
    hMusic: 'Musiqa', musicTypes: { youtube: 'YouTube', upload: 'O‘z qo‘shig‘i', none: 'Musiqasiz', nvate: 'nVate kutubxonasi', audius: 'Audius', other: 'Boshqa' },
    topSongs: 'Ko‘p tanlangan qo‘shiqlar', noSongs: 'Bu davrda qo‘shiq tanlanmagan',
    hAdmins: 'Kim tasdiqladi', auto: 'Avtomatik (to‘lovsiz)',
    hRefs: 'Kim kimni olib keldi', refNote: 'Juftlik o‘z havolasini botdan /invite buyrug‘i bilan oladi.',
    hDrafts: 'Qoralamalar qayerda to‘xtagan', draftsNote: 'Hozirgi holat, davrga bog‘liq emas: ariza qoldirmagan odamlarning oxirgi qadami.',
    hFeed: 'So‘nggi voqealar', feedOrder: 'yangi ariza', feedPaid: 'to‘landi', viaWeb: 'sayt', viaTg: 'bot',
    hDanger: 'Statistikani nolga tushirish',
    dangerNote: 'Hisob shu daqiqadan yangidan boshlanadi. Hech narsa o‘chmaydi: arizalar, to‘lovlar va odamlar joyida qoladi, butun tarixni bir tugma bilan qaytarish mumkin.',
    reset: 'Nolga tushirish', resetAsk: 'Statistika shu daqiqadan boshlab hisoblansinmi? Ma’lumotlar o‘chmaydi.',
    empty: 'Bu davrda ma’lumot yo‘q', loading: 'Yuklanmoqda…', error: 'Ko‘rsatkichlarni yuklab bo‘lmadi',
    months: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
    sum: 'so‘m', mln: 'mln', k1: 'ming',
  },
  ru: {
    presets: { today: 'Сегодня', yesterday: 'Вчера', '7d': '7 дней', '30d': '30 дней', month: 'Этот месяц', lastmonth: 'Прошлый месяц', '90d': '90 дней', year: 'Этот год', all: 'Всё время', custom: 'Период…' },
    groups: { hour: 'Часы', day: 'Дни', week: 'Недели', month: 'Месяцы' },
    groupBy: 'Группировка', show: 'Показать', from: 'с', to: 'по',
    vsPrev: (a, b) => `сравнение с ${a} — ${b}`, noPrev: 'прошлого периода для сравнения нет',
    since: (at, by) => `Статистика считается с ${at}${by ? ` (обнулил ${by})` : ''}. Заявки и оплаты на месте — заново начат только счёт.`,
    restore: 'Вернуть всю историю',
    now: 'Сейчас', nowWaiting: 'ждут подтверждения', nowUnlinked: 'заявок с сайта без Telegram', nowStuck: 'черновиков на полпути', toOrders: 'К заявкам →',
    k: {
      revenue: 'Выручка', orders: 'Заявки', paid: 'Оплаты', avgCheck: 'Средний чек',
      conversion: 'Заявка → оплата', visitors: 'Посетители', newPeople: 'Новые люди', visitToOrder: 'Визит → заявка',
      cancelled: 'Отклонено', waiting: 'Ещё ждут', discount: 'Отдано скидкой', guestLinks: 'Именных ссылок',
      confirmMinutes: 'Скорость подтверждения', webOrders: 'Заявок с сайта',
    },
    kHint: { conversion: 'из заявок периода оплачено', revenue: 'по дате оплаты', confirmMinutes: 'медиана, от заявки до оплаты', paid: 'подтверждённые оплаты' },
    fresh: 'новое', min: 'мин', hour: 'ч', days: 'дн.',
    hDyn: 'Динамика', metrics: { orders: 'Заявки', paid: 'Оплаты', revenue: 'Выручка', visitors: 'Посетители', newPeople: 'Новые люди', opens: 'Открыли студию', web: 'С сайта' },
    table: 'Таблица', chart: 'График', csv: 'CSV', period: 'Период', total: 'Итого', best: 'лучший',
    hFunnel: 'Воронка', funnelOpen: 'Открыли студию', funnelOrder: 'Оставили заявку', funnelPaid: 'Оплатили',
    funnelNote: 'Шаг — последний блок студии, до которого дошла пара. Воронка копится с этой версии: у визитов раньше шагов нет.',
    ofTop: 'от начала', ofPrev: 'от прошлого',
    hChannels: 'Telegram и сайт', tg: 'Telegram-бот', web: 'Сайт nvate.uz/app',
    chPeople: 'Новые люди', chOpens: 'Открыли студию', chOrders: 'Заявки', chPaid: 'Оплаты', chRevenue: 'Выручка', chConv: 'Заявка → оплата',
    chLinked: 'Подключили Telegram', chLinkedNote: 'из заявок с сайта забрали ссылку в бот',
    hSources: 'Откуда приходят', hTemplates: 'Шаблоны', hPromos: 'Промокоды', hLangs: 'Языки',
    cols: { source: 'Источник', people: 'Люди', orders: 'Заявки', paid: 'Оплаты', revenue: 'Выручка', conversion: 'Конв.', reach: 'Люди → заявка', discount: 'Скидка', name: 'Шаблон', code: 'Код', lang: 'Язык', share: 'Доля', key: 'Период', visitors: 'Визиты', newPeople: 'Новые', opens: 'Студия', cancelled: 'Откл.', web: 'Сайт', avg: 'Ср. чек', count: 'Кол-во', median: 'Медиана', invited: 'Привёл', ordered: 'Заявки', who: 'Кто' },
    srcNote: 'Добавьте к ссылке на бота ?start=МЕТКА или к адресу сайта ?s=МЕТКА — метка появится здесь. На сайте Instagram, Google и другие определяются сами — по сайту, с которого пришли.',
    sources: { direct: 'Пришли сами', site: 'Сайт → бот', qr: 'QR с сайта', ref: 'По приглашению пары', ig: 'Instagram', tg: 'Telegram', google: 'Google', fb: 'Facebook', tiktok: 'TikTok', yt: 'YouTube', yandex: 'Яндекс' },
    mark: 'метка',
    hHeat: 'Когда заказывают', heatNote: 'Заявки по дням недели и часам (время Ташкента).', less: 'меньше', more: 'больше',
    dow: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    hWeddings: 'На какие месяцы свадьбы', leadDays: 'Заявка в среднем за', before: 'до свадьбы',
    hGuests: 'Именные ссылки', gPremium: 'Заказов с именными', gShare: 'доля оплат', gLinks: 'Создано ссылок', gSent: 'Отправлено из бота', gAvg: 'В среднем на заказ', gRevenue: 'Выручка с них',
    hMusic: 'Музыка', musicTypes: { youtube: 'YouTube', upload: 'Своя песня', none: 'Без музыки', nvate: 'Библиотека nVate', audius: 'Audius', other: 'Другое' },
    topSongs: 'Чаще выбирают', noSongs: 'В этом периоде песен не выбирали',
    hAdmins: 'Кто подтверждал', auto: 'Автоматически (без оплаты)',
    hRefs: 'Кто кого привёл', refNote: 'Свою ссылку пара берёт в боте командой /invite.',
    hDrafts: 'Где застревают черновики', draftsNote: 'Текущее состояние, от периода не зависит: последний шаг тех, кто так и не оставил заявку.',
    hFeed: 'Последние события', feedOrder: 'новая заявка', feedPaid: 'оплачено', viaWeb: 'сайт', viaTg: 'бот',
    hDanger: 'Обнулить статистику',
    dangerNote: 'Счёт начнётся заново с этой минуты. Ничего не удаляется: заявки, оплаты и люди остаются на месте, а всю историю можно вернуть одной кнопкой.',
    reset: 'Обнулить', resetAsk: 'Считать статистику с этой минуты? Данные не удаляются.',
    empty: 'За этот период данных нет', loading: 'Загружаем…', error: 'Не удалось загрузить показатели',
    months: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
    sum: 'сум', mln: 'млн', k1: 'тыс',
  },
};

const DAY = 86400000;
const TZ = 5 * 3600000;
const localDay = (ms) => new Date(ms + TZ).toISOString().slice(0, 10);
const addDays = (day, n) => localDay(Date.parse(`${day}T00:00:00Z`) - TZ + n * DAY + 1);
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* приватное окно */ } },
};

/* Период из пресета — дни по Ташкенту, включительно. */
function presetRange(preset, today) {
  const [y, m] = today.split('-').map(Number);
  const first = (yy, mm) => `${yy}-${String(mm).padStart(2, '0')}-01`;
  switch (preset) {
    case 'today': return { from: today, to: today };
    case 'yesterday': { const d = addDays(today, -1); return { from: d, to: d }; }
    case '7d': return { from: addDays(today, -6), to: today };
    case '30d': return { from: addDays(today, -29), to: today };
    case '90d': return { from: addDays(today, -89), to: today };
    case 'month': return { from: first(y, m), to: today };
    case 'lastmonth': {
      const pm = m === 1 ? 12 : m - 1;
      const py = m === 1 ? y - 1 : y;
      return { from: first(py, pm), to: addDays(first(y, m), -1) };
    }
    case 'year': return { from: `${y}-01-01`, to: today };
    default: return { from: null, to: today };
  }
}

export function createAnalytics({ esc, lang, initData, onOrders }) {
  const w = (key) => I18N[lang()][key];
  const k = (key) => I18N[lang()].k[key] ?? key;
  let range = store.get('nv_an_range', { preset: '30d', group: 'auto', from: null, to: null });
  let metric = store.get('nv_an_metric', 'orders');
  let view = 'chart';
  const sorts = store.get('nv_an_sorts', {});
  let data = null;
  let loading = false;
  let failed = false;
  let tips = [];

  /* ── Числа ── */
  const fmt = (n) => Number(n || 0).toLocaleString('ru-RU');
  const money = (n) => `${fmt(n)} ${w('sum')}`;
  function compact(n) {
    const v = Number(n || 0);
    if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace('.0', '')} ${w('mln')}`;
    if (Math.abs(v) >= 1e4) return `${Math.round(v / 1e3)} ${w('k1')}`;
    return fmt(v);
  }
  const minutes = (m) => {
    if (m === null || m === undefined) return '—';
    if (m < 90) return `${Math.round(m)} ${w('min')}`;
    if (m < 48 * 60) return `${(m / 60).toFixed(1).replace('.0', '')} ${w('hour')}`;
    return `${Math.round(m / 1440)} ${w('days')}`;
  };
  const METRIC_MONEY = new Set(['revenue']);
  const metricFmt = (key, v) => (METRIC_MONEY.has(key) ? money(v) : fmt(v));

  /* ── Даты ── */
  function dayLabel(day, long = false) {
    const [y, m, d] = day.split('-').map(Number);
    return long ? `${d} ${w('months')[m - 1]} ${y}` : `${d} ${w('months')[m - 1]}`;
  }
  function bucketLabel(key, group, long = false) {
    if (group === 'hour') {
      const [day, hh] = key.split(' ');
      return long ? `${dayLabel(day, true)}, ${hh}:00` : `${hh}:00`;
    }
    if (group === 'month') {
      const [y, m] = key.split('-').map(Number);
      return long ? `${w('months')[m - 1]} ${y}` : `${w('months')[m - 1]}${m === 1 ? ` ${String(y).slice(2)}` : ''}`;
    }
    if (group === 'week') {
      const end = addDays(key, 6);
      return long ? `${dayLabel(key)} — ${dayLabel(end, true)}` : dayLabel(key);
    }
    return dayLabel(key, long);
  }
  const rangeText = (from, to) => (from === to ? dayLabel(from, true) : `${dayLabel(from, from.slice(0, 4) !== to.slice(0, 4))} — ${dayLabel(to, true)}`);

  /* ── Загрузка ── */
  function query() {
    const today = localDay(Date.now());
    const r = range.preset === 'custom' ? { from: range.from, to: range.to } : presetRange(range.preset, today);
    const q = new URLSearchParams({ group: range.group || 'auto' });
    if (r.from) q.set('from', r.from);
    if (r.to) q.set('to', r.to);
    return q;
  }

  /* Перезагрузка держит прежний кадр (полупрозрачным), а ответ устаревшего
     запроса — если период успели сменить — просто выбрасывается. */
  let seq = 0;
  let attempted = false;
  async function load(repaint) {
    const mine = ++seq;
    attempted = true;
    loading = true;
    failed = false;
    repaint();
    try {
      const res = await fetch(`/api/admin/analytics?${query()}`, { headers: { 'X-Init-Data': initData() } });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'error');
      if (mine === seq) data = json;
    } catch (_) {
      if (mine === seq) failed = true;
    } finally {
      if (mine === seq) { loading = false; repaint(); }
    }
  }
  // Первый заход на вкладку: грузим один раз, ошибку не долбим повтором.
  const ensure = (repaint) => { if (!attempted) load(repaint); };

  /* ── Всплывающая подсказка: одна на вкладку, текст — только textContent ── */
  function tip(lines) {
    tips.push(lines);
    return `data-tip="${tips.length - 1}"`;
  }
  function showTip(el) {
    const box = document.getElementById('an-tip');
    const lines = tips[Number(el.dataset.tip)];
    if (!box || !lines) return;
    box.replaceChildren(...lines.map(([value, label], i) => {
      const row = document.createElement('div');
      row.className = i ? 'an-tip-row' : 'an-tip-head';
      const b = document.createElement('b');
      b.textContent = value;
      row.append(b);
      if (label) { const s = document.createElement('span'); s.textContent = label; row.append(s); }
      return row;
    }));
    box.hidden = false;
    const r = el.getBoundingClientRect();
    const bw = box.offsetWidth;
    const bh = box.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const left = Math.max(8, Math.min(vw - bw - 8, r.left + r.width / 2 - bw / 2));
    const top = r.top - bh - 10 > 8 ? r.top - bh - 10 : r.bottom + 10;
    box.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }
  function hideTip() { const box = document.getElementById('an-tip'); if (box) box.hidden = true; }

  /* ── Кусочки ── */
  function delta(key, cur, invert = false) {
    const prev = data.previous?.kpi?.[key];
    if (prev === undefined || prev === null || cur === null || cur === undefined) return '';
    if (prev === 0 && cur === 0) return '';
    if (prev === 0) return `<span class="an-d an-d--up">▲ ${esc(w('fresh'))}</span>`;
    const change = Math.round(((cur - prev) / Math.abs(prev)) * 100);
    if (change === 0) return '<span class="an-d">= 0%</span>';
    const good = invert ? change < 0 : change > 0;
    return `<span class="an-d ${good ? 'an-d--good' : 'an-d--bad'}">${change > 0 ? '▲' : '▼'} ${Math.abs(change)}%</span>`;
  }

  function tile(key, value, { hint = null, invert = false, raw = null, hero = false } = {}) {
    const title = hint ?? I18N[lang()].kHint[key] ?? '';
    return `<div class="an-kpi${hero ? ' an-kpi--hero' : ''}">
      <div class="an-kpi-l">${esc(k(key))}</div>
      <div class="an-kpi-v">${esc(value)}</div>
      <div class="an-kpi-f">${delta(key, raw, invert)}${title ? `<span class="an-kpi-h">${esc(title)}</span>` : ''}</div>
    </div>`;
  }

  function card(title, body, { id = '', tools = '', note = '' } = {}) {
    return `<section class="an-card"${id ? ` id="${id}"` : ''}>
      <header class="an-card-h"><h2>${esc(title)}</h2>${tools}</header>
      ${body}${note ? `<p class="an-note">${esc(note)}</p>` : ''}
    </section>`;
  }

  // Ось Y: 0 и два «круглых» деления.
  function niceMax(max) {
    if (max <= 0) return 1;
    const pow = 10 ** Math.floor(Math.log10(max));
    const step = [1, 2, 2.5, 5, 10].find((s) => s * pow * 2 >= max) * pow;
    return step * 2;
  }

  /* Столбики: одна серия, золото. Столбик ≤ 24px, скругление 4px сверху,
     зазор 2px; цель наведения — вся колонка. Подпись — только у максимума. */
  // Сверху — выбранная метрика, под чертой — остальное за ту же корзину.
  const seriesLines = (b, key, group, v) => [[metricFmt(key, v), w('metrics')[key]], [bucketLabel(b.key, group, true), ''],
    ...['orders', 'paid', 'revenue', 'visitors'].filter((m) => m !== key).map((m) => [metricFmt(m, b[m]), w('metrics')[m]])];

  function columns(series, key, group, { height = 190, lines = seriesLines } = {}) {
    const values = series.map((b) => Number(b[key]) || 0);
    const top = niceMax(Math.max(...values, 0));
    const maxAt = values.indexOf(Math.max(...values));
    const every = Math.max(1, Math.ceil(series.length / 7));
    let h = `<div class="an-cols" style="--h:${height}px">
      <div class="an-grid">${[1, 0.5, 0].map((f) => `<div class="an-gl" style="bottom:${f * 100}%"><span>${esc(METRIC_MONEY.has(key) ? compact(top * f) : fmt(top * f))}</span></div>`).join('')}</div>
      <div class="an-cols-in">`;
    series.forEach((b, i) => {
      const v = values[i];
      const label = i % every === 0 ? `<i class="an-x">${esc(bucketLabel(b.key, group))}</i>` : '';
      const peak = v > 0 && i === maxAt ? `<em class="an-peak">${esc(METRIC_MONEY.has(key) ? compact(v) : fmt(v))}</em>` : '';
      h += `<button type="button" class="an-col" ${tip(lines(b, key, group, v))} aria-label="${esc(`${bucketLabel(b.key, group, true)}: ${metricFmt(key, v)}`)}">
        <span class="an-bar" style="height:${((v / top) * 100).toFixed(2)}%">${peak}</span>${label}</button>`;
    });
    return `${h}</div></div>`;
  }

  // Горизонтальная полоса в строке таблицы — тоже одна серия.
  const meter = (v, max) => `<span class="an-m"><i style="width:${max > 0 ? Math.max(1.5, (v / max) * 100).toFixed(1) : 0}%"></i></span>`;

  /* Таблица с сортировкой по заголовку. rows — объекты, cols — [key, title, format, align]. */
  function sortable(id, rows, cols, { initial, bar } = {}) {
    if (!rows.length) return `<div class="an-empty">${esc(w('empty'))}</div>`;
    const sort = sorts[id] ?? initial;
    const col = cols.find((c) => c[0] === sort?.key) ?? cols[1];
    const dir = sort?.dir ?? 'desc';
    const sorted = [...rows].sort((a, b) => {
      const x = a[col[0]];
      const y = b[col[0]];
      const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''));
      return dir === 'asc' ? cmp : -cmp;
    });
    const barKey = bar ?? col[0];
    const barMax = Math.max(0, ...rows.map((r) => Number(r[barKey]) || 0));
    let h = `<div class="an-tw"><table class="an-t"><thead><tr>`;
    for (const [key, title, , align] of cols) {
      const on = key === col[0];
      h += `<th class="${align === 'r' ? 'r' : ''}${on ? ' on' : ''}"><button type="button" data-an-sort="${esc(id)}:${esc(key)}">${esc(title)}${on ? `<b>${dir === 'asc' ? '↑' : '↓'}</b>` : ''}</button></th>`;
    }
    h += '</tr></thead><tbody>';
    for (const row of sorted) {
      h += '<tr>';
      cols.forEach(([key, , format, align], i) => {
        const text = format ? format(row[key], row) : row[key];
        const extra = i === 0 && typeof barMax === 'number' && barMax > 0 ? meter(Number(row[barKey]) || 0, barMax) : '';
        h += `<td class="${align === 'r' ? 'r' : ''}">${i === 0 ? `<span class="an-c0">${esc(text)}</span>${extra}` : esc(text)}</td>`;
      });
      h += '</tr>';
    }
    return `${h}</tbody></table></div>`;
  }

  const csvButton = (id) => `<button type="button" class="an-tool" data-an-csv="${esc(id)}">${esc(w('csv'))}</button>`;
  const sourceName = (mark) => w('sources')[mark] ?? `${w('mark')}: ${mark}`;

  /* ── Разделы ── */
  function filters() {
    const presets = w('presets');
    let h = '<div class="an-filters"><div class="an-chips" role="group">';
    for (const key of Object.keys(presets)) {
      h += `<button type="button" data-an-preset="${key}" class="${range.preset === key ? 'on' : ''}">${esc(presets[key])}</button>`;
    }
    h += '</div>';
    if (range.preset === 'custom') {
      const today = localDay(Date.now());
      h += `<div class="an-custom">
        <label>${esc(w('from'))} <input type="date" id="an-from" max="${today}" value="${esc(range.from ?? addDays(today, -29))}"></label>
        <label>${esc(w('to'))} <input type="date" id="an-to" max="${today}" value="${esc(range.to ?? today)}"></label>
        <button type="button" class="an-tool an-tool--on" data-an-apply>${esc(w('show'))}</button>
      </div>`;
    }
    const current = data?.range?.group;
    h += `<div class="an-seg" role="group" aria-label="${esc(w('groupBy'))}"><span>${esc(w('groupBy'))}</span>`;
    for (const [key, title] of Object.entries(w('groups'))) {
      const allowed = key !== 'hour' || (data?.range?.days ?? 99) <= 3;
      h += `<button type="button" data-an-group="${key}" class="${current === key ? 'on' : ''}"${allowed ? '' : ' disabled'}>${esc(title)}</button>`;
    }
    h += '</div>';
    if (data) {
      const r = data.range;
      const prev = data.previous;
      h += `<p class="an-range"><b>${esc(rangeText(r.from, r.to))}</b>${r.bounded
        ? ` · ${esc(prev ? w('vsPrev')(dayLabel(prev.from), dayLabel(prev.to, true)) : w('noPrev'))}` : ''}</p>`;
    }
    return `${h}</div>`;
  }

  function sinceBanner() {
    if (!data?.since) return '';
    const at = data.since.at;
    const local = new Date(Date.parse(`${at.replace(' ', 'T')}Z`) + TZ).toISOString();
    const text = `${dayLabel(local.slice(0, 10), true)}, ${local.slice(11, 16)}`;
    return `<div class="an-since"><p>${esc(w('since')(text, data.since.by))}</p>
      <button type="button" class="an-tool" data-an-restore>${esc(w('restore'))}</button></div>`;
  }

  function nowStrip() {
    const n = data.now;
    const parts = [];
    if (n.waiting) parts.push(`<b>${fmt(n.waiting)}</b> ${esc(w('nowWaiting'))}`);
    if (n.unlinked) parts.push(`<b>${fmt(n.unlinked)}</b> ${esc(w('nowUnlinked'))}`);
    if (n.stuck) parts.push(`<b>${fmt(n.stuck)}</b> ${esc(w('nowStuck'))}`);
    if (!parts.length) return '';
    return `<div class="an-now"><span class="an-now-l">${esc(w('now'))}</span><p>${parts.join('<i>·</i>')}</p>
      ${n.waiting ? `<button type="button" class="an-tool" data-an-orders>${esc(w('toOrders'))}</button>` : ''}</div>`;
  }

  function kpiGrid() {
    const K = data.kpi;
    let h = '<div class="an-kpis">';
    h += tile('revenue', money(K.revenue), { raw: K.revenue, hero: true });
    h += tile('orders', fmt(K.orders), { raw: K.orders });
    h += tile('paid', fmt(K.paid), { raw: K.paid });
    h += tile('avgCheck', money(K.avgCheck), { raw: K.avgCheck });
    h += tile('conversion', `${K.conversion}%`, { raw: K.conversion });
    h += tile('visitors', fmt(K.visitors), { raw: K.visitors });
    h += tile('newPeople', fmt(K.newPeople), { raw: K.newPeople });
    h += tile('visitToOrder', `${K.visitToOrder}%`, { raw: K.visitToOrder });
    h += '</div><div class="an-kpis an-kpis--sub">';
    h += tile('webOrders', fmt(K.webOrders), { raw: K.webOrders });
    h += tile('waiting', fmt(K.waiting), { raw: K.waiting, invert: true });
    h += tile('cancelled', fmt(K.cancelled), { raw: K.cancelled, invert: true });
    h += tile('discount', money(K.discount), { raw: K.discount, invert: true });
    h += tile('guestLinks', fmt(K.guestLinks), { raw: K.guestLinks });
    h += tile('confirmMinutes', minutes(K.confirmMinutes), { raw: K.confirmMinutes, invert: true });
    return `${h}</div>`;
  }

  function dynamics() {
    const g = data.range.group;
    const s = data.series;
    let tabs = '<div class="an-metrics" role="tablist">';
    for (const [key, title] of Object.entries(w('metrics'))) {
      tabs += `<button type="button" role="tab" data-an-metric="${key}" class="${metric === key ? 'on' : ''}" aria-selected="${metric === key}">${esc(title)}</button>`;
    }
    tabs += '</div>';
    const tools = `<div class="an-tools">
      <button type="button" class="an-tool${view === 'chart' ? ' an-tool--on' : ''}" data-an-view="chart">${esc(w('chart'))}</button>
      <button type="button" class="an-tool${view === 'table' ? ' an-tool--on' : ''}" data-an-view="table">${esc(w('table'))}</button>
      ${csvButton('series')}</div>`;
    const total = s.reduce((sum, b) => sum + (Number(b[metric]) || 0), 0);
    const best = s.reduce((a, b) => ((Number(b[metric]) || 0) > (Number(a?.[metric]) || 0) ? b : a), null);
    const summary = `<p class="an-sum"><span>${esc(w('total'))}: <b>${esc(metricFmt(metric, total))}</b></span>${best && Number(best[metric]) > 0
      ? `<span>${esc(w('best'))}: <b>${esc(bucketLabel(best.key, g, true))}</b> · ${esc(metricFmt(metric, best[metric]))}</span>` : ''}</p>`;
    const C = w('cols');
    const body = view === 'table'
      ? sortable('series', s.map((b) => ({ ...b, label: bucketLabel(b.key, g, true), avg: b.paid ? Math.round(b.revenue / b.paid) : 0 })), [
        ['key', C.key, (v, r) => r.label], ['visitors', C.visitors, fmt, 'r'], ['newPeople', C.newPeople, fmt, 'r'],
        ['opens', C.opens, fmt, 'r'], ['orders', C.orders, fmt, 'r'], ['web', C.web, fmt, 'r'], ['paid', C.paid, fmt, 'r'],
        ['revenue', C.revenue, money, 'r'], ['avg', C.avg, money, 'r'], ['cancelled', C.cancelled, fmt, 'r'],
      ], { initial: { key: 'key', dir: 'asc' }, bar: metric })
      : columns(s, metric, g);
    return card(w('hDyn'), tabs + summary + body, { tools });
  }

  function funnel() {
    const f = data.funnel;
    const names = STEP_LABELS[lang()];
    const rows = [[w('funnelOpen'), f.steps[0]], ...f.steps.slice(1).map((v, i) => [`${i + 2}. ${names[i + 1]}`, v]),
      [w('funnelOrder'), f.orders], [w('funnelPaid'), f.paid]];
    const top = Math.max(1, rows[0][1], ...rows.map((r) => r[1]));
    let h = '<div class="an-funnel">';
    rows.forEach(([label, v], i) => {
      const prev = i ? rows[i - 1][1] : null;
      const ofTop = rows[0][1] ? Math.min(100, Math.round((v / rows[0][1]) * 100)) : 0;
      const ofPrev = prev ? Math.min(100, Math.round((v / prev) * 100)) : null;
      h += `<div class="an-fr${i >= rows.length - 2 ? ' an-fr--end' : ''}" ${tip([[fmt(v), label], [`${ofTop}%`, w('ofTop')], ...(ofPrev !== null ? [[`${ofPrev}%`, w('ofPrev')]] : [])])} tabindex="0">
        <span class="an-fl">${esc(label)}</span>
        <span class="an-fb"><i style="width:${((v / top) * 100).toFixed(1)}%"></i></span>
        <span class="an-fv">${esc(fmt(v))}<small>${i ? `${ofTop}%` : ''}</small></span>
      </div>`;
    });
    return card(w('hFunnel'), `${h}</div>`, { note: w('funnelNote') });
  }

  function channels() {
    const [tg, web] = ['tg', 'web'].map((id) => data.channels.find((c) => c.id === id));
    const row = (label, a, b) => `<div class="an-ch-r"><span>${esc(label)}</span><b>${esc(a)}</b><b>${esc(b)}</b></div>`;
    let h = `<div class="an-ch"><div class="an-ch-r an-ch-h"><span></span><b>${esc(w('tg'))}</b><b>${esc(w('web'))}</b></div>`;
    h += row(w('chPeople'), fmt(tg.people), fmt(web.people));
    h += row(w('chOpens'), fmt(tg.opens), fmt(web.opens));
    h += row(w('chOrders'), fmt(tg.orders), fmt(web.orders));
    h += row(w('chPaid'), fmt(tg.paid), fmt(web.paid));
    h += row(w('chRevenue'), money(tg.revenue), money(web.revenue));
    h += row(w('chConv'), `${tg.conversion}%`, `${web.conversion}%`);
    h += row(w('chLinked'), '—', web.orders ? `${fmt(web.linked)} / ${fmt(web.orders)}` : '—');
    return card(w('hChannels'), `${h}</div>`, { note: w('chLinkedNote') });
  }

  function tables() {
    const C = w('cols');
    const pctf = (v) => (v === null || v === undefined ? '—' : `${v}%`);
    const totalOrders = Math.max(1, data.kpi.orders);
    let h = card(w('hSources'), sortable('sources', data.sources.map((r) => ({ ...r, name: sourceName(r.source) })), [
      ['name', C.source], ['people', C.people, fmt, 'r'], ['orders', C.orders, fmt, 'r'], ['paid', C.paid, fmt, 'r'],
      ['revenue', C.revenue, money, 'r'], ['reach', C.reach, pctf, 'r'], ['conversion', C.conversion, pctf, 'r'],
    ], { initial: { key: 'revenue', dir: 'desc' } }), { tools: csvButton('sources'), note: w('srcNote') });
    h += card(w('hTemplates'), sortable('templates', data.templates.map((r) => ({ ...r, share: Math.round((r.orders / totalOrders) * 100) })), [
      ['name', C.name], ['orders', C.orders, fmt, 'r'], ['share', C.share, pctf, 'r'], ['paid', C.paid, fmt, 'r'],
      ['revenue', C.revenue, money, 'r'], ['conversion', C.conversion, pctf, 'r'],
    ], { initial: { key: 'orders', dir: 'desc' } }), { tools: csvButton('templates') });
    h += card(w('hPromos'), sortable('promos', data.promos, [
      ['code', C.code], ['orders', C.orders, fmt, 'r'], ['paid', C.paid, fmt, 'r'], ['discount', C.discount, money, 'r'],
      ['revenue', C.revenue, money, 'r'], ['conversion', C.conversion, pctf, 'r'],
    ], { initial: { key: 'orders', dir: 'desc' } }), { tools: csvButton('promos') });
    return h;
  }

  /* Тепловая карта: один тон, пять ступеней прозрачности золота. */
  function heat() {
    const grid = data.heat;
    const max = Math.max(0, ...grid.flat());
    const level = (v) => (v <= 0 || max <= 0 ? 0 : Math.max(1, Math.ceil((v / max) * 5)));
    const dow = w('dow');
    let h = '<div class="an-heat"><div class="an-heat-g">';
    h += '<span></span>';
    for (let hr = 0; hr < 24; hr++) h += `<i class="an-heat-x">${hr % 3 === 0 ? String(hr).padStart(2, '0') : ''}</i>`;
    grid.forEach((row, d) => {
      h += `<span class="an-heat-y">${esc(dow[d])}</span>`;
      row.forEach((v, hr) => {
        h += `<button type="button" class="an-hc l${level(v)}" ${tip([[fmt(v), w('metrics').orders], [`${dow[d]}, ${String(hr).padStart(2, '0')}:00–${String(hr).padStart(2, '0')}:59`, '']])} aria-label="${esc(`${dow[d]} ${hr}:00 — ${v}`)}"></button>`;
      });
    });
    h += `</div><div class="an-scale"><span>${esc(w('less'))}</span>${[0, 1, 2, 3, 4, 5].map((l) => `<i class="an-hc l${l}"></i>`).join('')}<span>${esc(w('more'))}</span></div></div>`;
    return card(w('hHeat'), h, { note: w('heatNote') });
  }

  function weddings() {
    const W = data.weddings;
    // Ось времени без дыр: месяц без свадеб стоит нулём, а не пропадает.
    const months = [];
    if (W.months.length) {
      const counts = new Map(W.months.map((m) => [m.month, m.count]));
      let [y, m] = W.months[0].month.split('-').map(Number);
      const last = W.months[W.months.length - 1].month;
      for (let i = 0; i < 24; i++) {
        const key = `${y}-${String(m).padStart(2, '0')}`;
        months.push({ month: key, count: counts.get(key) ?? 0 });
        if (key >= last) break;
        m += 1;
        if (m > 12) { m = 1; y += 1; }
      }
    }
    let body;
    if (!months.length) body = `<div class="an-empty">${esc(w('empty'))}</div>`;
    else body = columns(months.map((m) => ({ key: m.month, count: m.count })), 'count', 'month', {
      height: 150,
      lines: (b, _key, group, v) => [[fmt(v), w('metrics').orders], [bucketLabel(b.key, group, true), '']],
    });
    const lead = W.leadDays !== null ? `<p class="an-sum"><span>${esc(w('leadDays'))} <b>${esc(`${Math.round(W.leadDays)} ${w('days')}`)}</b> ${esc(w('before'))}</span></p>` : '';
    return card(w('hWeddings'), lead + body);
  }

  function guestsAndLangs() {
    const G = data.guests;
    const stat = (label, value, sub = '') => `<div class="an-st"><b>${esc(value)}</b><span>${esc(label)}${sub ? ` · ${esc(sub)}` : ''}</span></div>`;
    let h = '<div class="an-stats">';
    h += stat(w('gPremium'), fmt(G.premiumOrders), `${G.share}% ${w('gShare')}`);
    h += stat(w('gLinks'), fmt(G.links));
    h += stat(w('gSent'), G.links ? `${fmt(G.sent)} / ${fmt(G.links)}` : '0');
    h += stat(w('gAvg'), String(G.avgPerOrder).replace('.', ','));
    h += stat(w('gRevenue'), money(G.revenue));
    h += '</div>';
    const C = w('cols');
    const langs = sortable('langs', data.langs.map((r) => ({ ...r, name: r.lang === 'ru' ? 'Русский' : 'O‘zbekcha' })), [
      ['name', C.lang], ['orders', C.orders, fmt, 'r'], ['paid', C.paid, fmt, 'r'], ['revenue', C.revenue, money, 'r'],
    ], { initial: { key: 'orders', dir: 'desc' } });
    return `<div class="an-two">${card(w('hGuests'), h)}${card(w('hLangs'), langs)}</div>`;
  }

  function music() {
    const M = data.music;
    const names = w('musicTypes');
    const max = Math.max(1, ...M.types.map((x) => x.count));
    let types = '<div class="an-bars">';
    for (const x of M.types) {
      types += `<div class="an-br"><span>${esc(names[x.type] ?? x.type)}</span>${meter(x.count, max)}<b>${esc(fmt(x.count))}</b></div>`;
    }
    types += '</div>';
    let top = `<p class="an-sub">${esc(w('topSongs'))}</p>`;
    if (!M.top.length) top += `<div class="an-empty">${esc(w('noSongs'))}</div>`;
    M.top.forEach((song, i) => {
      top += `<div class="an-song"><span class="n">${i + 1}</span><div><b>${esc(song.title)}</b><span>${esc(song.artist)}</span></div><em>${esc(fmt(song.count))}×</em></div>`;
    });
    return card(w('hMusic'), (M.types.length ? types : `<div class="an-empty">${esc(w('empty'))}</div>`) + top);
  }

  function people() {
    const C = w('cols');
    const admins = sortable('admins', data.admins.map((r) => ({ ...r, who: r.name === 'auto' ? w('auto') : r.name })), [
      ['who', C.who], ['count', C.count, fmt, 'r'], ['medianMinutes', C.median, minutes, 'r'],
    ], { initial: { key: 'count', dir: 'desc' } });
    const refs = sortable('refs', data.referrals.map((r) => ({ ...r, who: r.username ? `@${r.username}` : (r.name || `id ${r.id}`) })), [
      ['who', C.who], ['invited', C.invited, fmt, 'r'], ['ordered', C.ordered, fmt, 'r'], ['paid', C.paid, fmt, 'r'],
    ], { initial: { key: 'invited', dir: 'desc' } });
    return `<div class="an-two">${card(w('hAdmins'), admins)}${card(w('hRefs'), refs, { note: w('refNote') })}</div>`;
  }

  function drafts() {
    const list = data.now.drafts;
    const names = STEP_LABELS[lang()];
    if (!list.length) return card(w('hDrafts'), `<div class="an-empty">${esc(w('empty'))}</div>`, { note: w('draftsNote') });
    const max = Math.max(1, ...list.map((x) => x.count));
    let h = '<div class="an-bars">';
    for (const x of list) h += `<div class="an-br"><span>${esc(`${x.step + 1}. ${names[x.step] ?? ''}`)}</span>${meter(x.count, max)}<b>${esc(fmt(x.count))}</b></div>`;
    return card(w('hDrafts'), `${h}</div>`, { note: w('draftsNote') });
  }

  function feed() {
    if (!data.feed.length) return '';
    let h = '<ol class="an-feed">';
    for (const e of data.feed) {
      const ms = Date.parse(`${String(e.at).replace(' ', 'T')}Z`) + TZ;
      const stamp = new Date(ms).toISOString();
      h += `<li class="an-ev an-ev--${e.kind}"><time>${esc(`${dayLabel(stamp.slice(0, 10))}, ${stamp.slice(11, 16)}`)}</time>
        <span><b>#${esc(e.id)}</b> ${esc(e.couple)} · ${esc(e.kind === 'paid' ? w('feedPaid') : w('feedOrder'))}</span>
        <em>${esc(money(e.total))} · ${esc(e.web ? w('viaWeb') : w('viaTg'))}</em></li>`;
    }
    return card(w('hFeed'), `${h}</ol>`);
  }

  function danger() {
    return `<section class="an-card an-danger"><header class="an-card-h"><h2>${esc(w('hDanger'))}</h2></header>
      <p class="an-note">${esc(w('dangerNote'))}</p>
      <div class="an-danger-a"><button type="button" class="an-tool an-tool--danger" data-an-reset>${esc(w('reset'))}</button>
      ${data?.since ? `<button type="button" class="an-tool" data-an-restore>${esc(w('restore'))}</button>` : ''}</div></section>`;
  }

  function render() {
    tips = [];
    let h = `<div class="an${loading ? ' an--loading' : ''}">${filters()}`;
    if (!data) {
      h += `<div class="an-empty an-empty--big">${esc(failed ? w('error') : w('loading'))}</div>`;
      return `${h}</div><div id="an-tip" class="an-tip" hidden role="tooltip"></div>`;
    }
    if (failed) h += `<div class="an-err">${esc(w('error'))}</div>`;
    h += sinceBanner() + nowStrip() + kpiGrid() + dynamics() + funnel() + channels() + tables()
      + heat() + weddings() + guestsAndLangs() + music() + people() + drafts() + feed() + danger();
    return `${h}</div><div id="an-tip" class="an-tip" hidden role="tooltip"></div>`;
  }

  /* ── CSV: то, что на экране, — в файл для таблиц ── */
  function csv(id) {
    if (!data) return;
    const g = data.range.group;
    const sets = {
      series: [['period', 'visitors', 'new_people', 'studio_opens', 'orders', 'web_orders', 'paid', 'revenue', 'cancelled'],
        ...data.series.map((b) => [bucketLabel(b.key, g, true), b.visitors, b.newPeople, b.opens, b.orders, b.web, b.paid, b.revenue, b.cancelled])],
      sources: [['source', 'people', 'orders', 'paid', 'revenue', 'reach_pct', 'conversion_pct'],
        ...data.sources.map((r) => [sourceName(r.source), r.people, r.orders, r.paid, r.revenue, r.reach, r.conversion])],
      templates: [['template', 'orders', 'paid', 'revenue', 'conversion_pct'],
        ...data.templates.map((r) => [r.name, r.orders, r.paid, r.revenue, r.conversion])],
      promos: [['code', 'orders', 'paid', 'discount', 'revenue', 'conversion_pct'],
        ...data.promos.map((r) => [r.code, r.orders, r.paid, r.discount, r.revenue, r.conversion])],
    };
    const rows = sets[id];
    if (!rows) return;
    const cell = (v) => {
      const text = String(v ?? '');
      // Формулу из ячейки Excel не исполняет: ведущие = + - @ гасим апострофом.
      const safe = /^[=+\-@]/.test(text) && !/^-?\d/.test(text) ? `'${text}` : text;
      return /[",;\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
    };
    const body = `﻿${rows.map((r) => r.map(cell).join(',')).join('\n')}`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' }));
    a.download = `nvate-${id}-${data.range.from}_${data.range.to}.csv`;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  async function post(path) {
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Init-Data': initData() }, body: '{}' });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error || 'error');
  }

  /* События вкладки. Возвращает true, если клик был наш. */
  function click(e, repaint) {
    const el = e.target.closest('[data-an-preset],[data-an-group],[data-an-metric],[data-an-view],[data-an-sort],[data-an-csv],[data-an-apply],[data-an-reset],[data-an-restore],[data-an-orders]');
    if (!el) return false;
    const d = el.dataset;
    if (d.anPreset) {
      // Новый период — своя группировка: «сегодня» по часам, год по неделям.
      range = { ...range, preset: d.anPreset, group: 'auto' };
      if (d.anPreset !== 'custom') { store.set('nv_an_range', range); load(repaint); } else repaint();
    } else if (d.anGroup) {
      range = { ...range, group: d.anGroup };
      store.set('nv_an_range', range);
      load(repaint);
    } else if (d.anMetric) {
      metric = d.anMetric;
      store.set('nv_an_metric', metric);
      repaint();
    } else if (d.anView) {
      view = d.anView;
      repaint();
    } else if (d.anSort) {
      const [id, key] = d.anSort.split(':');
      const cur = sorts[id];
      sorts[id] = { key, dir: cur?.key === key && cur.dir === 'desc' ? 'asc' : 'desc' };
      store.set('nv_an_sorts', sorts);
      repaint();
    } else if (d.anCsv) {
      csv(d.anCsv);
    } else if ('anApply' in d) {
      const from = document.getElementById('an-from')?.value;
      const to = document.getElementById('an-to')?.value;
      if (from && to) {
        range = { ...range, preset: 'custom', group: 'auto', from: from <= to ? from : to, to: from <= to ? to : from };
        store.set('nv_an_range', range);
        load(repaint);
      }
    } else if ('anReset' in d) {
      if (!confirm(w('resetAsk'))) return true;
      post('/api/admin/analytics/reset').then(() => load(repaint)).catch((err) => alert(err.message));
    } else if ('anRestore' in d) {
      post('/api/admin/analytics/restore').then(() => load(repaint)).catch((err) => alert(err.message));
    } else if ('anOrders' in d) {
      onOrders?.();
    }
    return true;
  }

  // Подсказка: наведение мышью, касание пальцем и фокус с клавиатуры.
  function wireTips(root) {
    root.addEventListener('pointerover', (e) => { const el = e.target.closest('[data-tip]'); if (el) showTip(el); });
    root.addEventListener('pointerout', (e) => { if (e.target.closest('[data-tip]')) hideTip(); });
    root.addEventListener('focusin', (e) => { const el = e.target.closest('[data-tip]'); if (el) showTip(el); });
    root.addEventListener('focusout', hideTip);
    window.addEventListener('scroll', hideTip, { passive: true });
  }

  return { render, load, ensure, click, wireTips, hasData: () => Boolean(data) };
}

// Шаги студии по порядку — тот же список, что и STEPS в public/app/app.js.
const STEP_LABELS = {
  uz: ['Ismlar', 'Sana', 'Joy', 'Musiqa', 'Dizayn', 'Suratlar', 'Ko‘rish', 'Mehmonlar', 'To‘lov'],
  ru: ['Имена', 'Дата', 'Место', 'Музыка', 'Дизайн', 'Фото', 'Просмотр', 'Гости', 'Оплата'],
};
