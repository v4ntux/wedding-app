/* ── Показатели для админки ──
   Один запрос — один период. Период задают дни по Ташкенту (UTC+5, без летнего
   времени): «сегодня» у админа начинается в его полночь, а не в полночь UTC.

   Строки берём из базы простыми выборками по диапазону дат и складываем здесь,
   в JS: так одинаково работают PostgreSQL и SQLite, а новый разрез — это
   десяток строк кода, а не миграция. Даты в базе — текст «YYYY-MM-DD HH:MM:SS»
   в UTC, поэтому диапазон сравнивается как строки.

   Что откуда считается:
   · заявки (orders) — по дате оформления (created_at);
   · оплаты и выручка — по дате подтверждения (paid_at): деньги пришли тогда;
   · конверсия в оплату — когортная: из заявок периода сколько уже оплачено;
   · люди — новые (users.first_seen) и активные (лента events + новые);
   · воронка — лента events: кто открыл студию и до какого шага дошёл.

   «Обнулить статистику» ничего не удаляет: в settings ложится момент, с
   которого показатели считаются (stats_since). Возврат — одной кнопкой. */
import { db, getSetting, setSetting } from './db.js';
import { allTemplates } from './templateStore.js';
import { parseMusicMeta } from './musicSelection.js';

const TZ_MS = 5 * 3600_000;     // Asia/Tashkent
const DAY_MS = 86400_000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const STEPS = 9;                // шаги студии: 0 — имена … 8 — контакты и оплата
const MUSIC_TYPES = new Set(['youtube', 'upload', 'nvate', 'audius', 'none']);

/* ── Время ── */

const pad = (n) => String(n).padStart(2, '0');
export function utcStr(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} `
    + `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
const parseUtc = (text) => (text ? Date.parse(`${String(text).slice(0, 19).replace(' ', 'T')}Z`) : NaN);
// Местные (ташкентские) день, час и день недели момента ms.
const local = (ms) => new Date(ms + TZ_MS);
export const localDay = (ms) => local(ms).toISOString().slice(0, 10);
const dayStart = (day) => Date.parse(`${day}T00:00:00Z`) - TZ_MS;
const weekday = (ms) => (local(ms).getUTCDay() + 6) % 7;   // пн = 0

function bucketOf(ms, group) {
  const day = localDay(ms);
  if (group === 'hour') return `${day} ${pad(local(ms).getUTCHours())}`;
  if (group === 'month') return day.slice(0, 7);
  if (group === 'week') return localDay(dayStart(day) - weekday(ms) * DAY_MS);
  return day;
}

// Все корзины от start до end, включая пустые: у графика не должно быть дыр.
function bucketList(startMs, endMs, group) {
  const keys = [];
  const seen = new Set();
  const step = group === 'hour' ? 3600_000 : DAY_MS;
  for (let ms = startMs; ms < endMs; ms += step) {
    const key = bucketOf(ms, group);
    if (!seen.has(key)) { seen.add(key); keys.push(key); }
    if (keys.length > 800) break;
  }
  return keys;
}

function pickGroup(requested, days) {
  const group = ['hour', 'day', 'week', 'month'].includes(requested) ? requested : 'auto';
  if (group === 'auto') return days <= 2 ? 'hour' : days <= 62 ? 'day' : days <= 400 ? 'week' : 'month';
  // Слишком мелкая корзина на длинном периоде даёт сотни столбиков по одному пикселю.
  if (group === 'hour' && days > 3) return 'day';
  if (group === 'day' && days > 400) return 'week';
  if (group === 'week' && days > 2000) return 'month';
  return group;
}

/* ── Базовая точка («обнулить статистику») ── */

export function statsSince() {
  const value = getSetting('stats_since');
  return value && typeof value.at === 'string' ? value : null;
}

export async function resetAnalytics(by = null) {
  // Даты в базе — с точностью до секунды: счёт идёт со следующей целой
  // секунды, иначе заявка, оформленная в момент нажатия, попала бы в новый счёт.
  const value = { at: utcStr(Math.floor(Date.now() / 1000) * 1000 + 1000), by };
  await setSetting('stats_since', value);
  return value;
}

export async function restoreAnalytics() {
  await setSetting('stats_since', null);
}

/* ── Выборки ── */

const APP_FIELDS = `id, tg_user_id, web_owner, claimed_at, status, total_price, template_id, template_price,
  premium, premium_price, discount, promo_code, source, lang, music_type, music_value, music_meta,
  guest_names, wedding_date, created_at, paid_at, confirmed_by, confirmed_by_name, groom_name, bride_name`;

async function collect(lo, hi) {
  const [created, paid, people, events, guests] = await Promise.all([
    db.prepare(`SELECT ${APP_FIELDS} FROM applications WHERE created_at >= ? AND created_at < ?`).all(lo, hi),
    db.prepare(`SELECT ${APP_FIELDS} FROM applications WHERE status = 'paid' AND paid_at >= ? AND paid_at < ?`).all(lo, hi),
    db.prepare('SELECT tg_user_id, entry, ref_by, started, opened, first_seen FROM users WHERE first_seen >= ? AND first_seen < ?').all(lo, hi),
    db.prepare('SELECT user_id, kind, step, at FROM events WHERE at >= ? AND at < ?').all(lo, hi),
    db.prepare(`SELECT g.application_id, g.sent FROM guests g JOIN applications a ON a.id = g.application_id
      WHERE a.status = 'paid' AND a.paid_at >= ? AND a.paid_at < ?`).all(lo, hi),
  ]);
  return { created, paid, people, events, guests };
}

/* Человек за заказом: у заказа с сайта — его сессия, даже если заказ уже
   уехал в Telegram. Иначе одна пара считалась бы двумя людьми. */
const personOf = (app) => Number(app.web_owner ?? app.tg_user_id);
const isWeb = (app) => app.web_owner !== null && app.web_owner !== undefined;
const num = (v) => Number(v) || 0;
const pct = (part, whole) => (whole > 0 ? Math.min(100, Math.round((part / whole) * 1000) / 10) : 0);
const median = (values) => {
  const list = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!list.length) return null;
  const mid = list.length >> 1;
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
};
// Подтвердил человек, а не промокод на всю сумму: у автоподтверждения нет confirmed_by.
const humanConfirmed = (app) => app.confirmed_by !== null && app.confirmed_by !== undefined;

function kpis(rows) {
  const { created, paid, people, events, guests } = rows;
  const active = new Set(events.map((e) => Number(e.user_id)));
  for (const p of people) active.add(Number(p.tg_user_id));
  const opened = new Set(events.filter((e) => e.kind === 'open').map((e) => Number(e.user_id)));
  const orderers = new Set(created.map(personOf));
  const cohortPaid = created.filter((a) => a.status === 'paid');
  const revenue = paid.reduce((s, a) => s + num(a.total_price), 0);
  const webCreated = created.filter(isWeb);
  const confirmMin = paid.filter(humanConfirmed)
    .map((a) => (parseUtc(a.paid_at) - parseUtc(a.created_at)) / 60_000)
    .filter((m) => m >= 0);
  return {
    visitors: active.size,
    newPeople: people.length,
    newWeb: people.filter((p) => Number(p.tg_user_id) < 0).length,
    newBot: people.filter((p) => Number(p.tg_user_id) > 0 && num(p.started)).length,
    opens: opened.size,
    orders: created.length,
    orderers: orderers.size,
    paid: paid.length,
    revenue,
    avgCheck: paid.length ? Math.round(revenue / paid.length) : 0,
    conversion: pct(cohortPaid.length, created.length),
    visitToOrder: pct(orderers.size, active.size),
    cancelled: created.filter((a) => a.status === 'cancelled').length,
    waiting: created.filter((a) => a.status === 'new').length,
    discount: paid.reduce((s, a) => s + num(a.discount), 0),
    guestLinks: guests.length,
    guestRevenue: paid.reduce((s, a) => s + (num(a.premium) ? num(a.premium_price) : 0), 0),
    webOrders: webCreated.length,
    tgOrders: created.length - webCreated.length,
    webLinked: webCreated.filter((a) => Number(a.tg_user_id) > 0).length,
    confirmMinutes: median(confirmMin),
  };
}

/* ── Разрезы ── */

function series(rows, keys, group) {
  const map = new Map(keys.map((key) => [key, {
    key, visitors: new Set(), newPeople: 0, opens: new Set(), orders: 0, web: 0, paid: 0, revenue: 0, cancelled: 0,
  }]));
  const at = (ms) => map.get(bucketOf(ms, group));
  for (const e of rows.events) {
    const b = at(parseUtc(e.at));
    if (!b) continue;
    b.visitors.add(Number(e.user_id));
    if (e.kind === 'open') b.opens.add(Number(e.user_id));
  }
  for (const p of rows.people) {
    const b = at(parseUtc(p.first_seen));
    if (!b) continue;
    b.newPeople += 1;
    b.visitors.add(Number(p.tg_user_id));
  }
  for (const a of rows.created) {
    const b = at(parseUtc(a.created_at));
    if (!b) continue;
    b.orders += 1;
    if (isWeb(a)) b.web += 1;
    if (a.status === 'cancelled') b.cancelled += 1;
  }
  for (const a of rows.paid) {
    const b = at(parseUtc(a.paid_at));
    if (!b) continue;
    b.paid += 1;
    b.revenue += num(a.total_price);
  }
  return [...map.values()].map((b) => ({ ...b, visitors: b.visitors.size, opens: b.opens.size }));
}

/* Воронка по ленте событий: открыл студию → дошёл до шага k → заявка → оплата.
   Шаг — номер последнего раскрытого блока студии (0 — имена). */
function funnel(rows) {
  const maxStep = new Map();
  for (const e of rows.events) {
    if (e.kind !== 'open' && e.kind !== 'step') continue;
    const id = Number(e.user_id);
    const step = e.kind === 'step' && Number.isInteger(Number(e.step)) ? Number(e.step) : 0;
    maxStep.set(id, Math.max(maxStep.get(id) ?? 0, step));
  }
  const reached = Array.from({ length: STEPS }, (_, k) => [...maxStep.values()].filter((s) => s >= k).length);
  const orderers = new Set(rows.created.map(personOf));
  const payers = new Set(rows.created.filter((a) => a.status === 'paid').map(personOf));
  return {
    steps: reached,                 // steps[0] — открыли студию
    orders: orderers.size,
    paid: payers.size,
  };
}

function channels(rows) {
  const make = (id) => ({ id, people: 0, opens: 0, orders: 0, paid: 0, revenue: 0, cohortPaid: 0, linked: 0 });
  const out = { tg: make('tg'), web: make('web') };
  for (const p of rows.people) out[Number(p.tg_user_id) < 0 ? 'web' : 'tg'].people += 1;
  const opened = new Set(rows.events.filter((e) => e.kind === 'open').map((e) => Number(e.user_id)));
  for (const id of opened) out[id < 0 ? 'web' : 'tg'].opens += 1;
  for (const a of rows.created) {
    const row = out[isWeb(a) ? 'web' : 'tg'];
    row.orders += 1;
    if (a.status === 'paid') row.cohortPaid += 1;
    if (isWeb(a) && Number(a.tg_user_id) > 0) row.linked += 1;
  }
  for (const a of rows.paid) {
    const row = out[isWeb(a) ? 'web' : 'tg'];
    row.paid += 1;
    row.revenue += num(a.total_price);
  }
  return Object.values(out).map(({ cohortPaid, ...row }) => ({ ...row, conversion: pct(cohortPaid, row.orders) }));
}

function grouped(rows, keyOfApp, keyOfPerson = null) {
  const map = new Map();
  const at = (key) => {
    if (!map.has(key)) map.set(key, { key, people: 0, orders: 0, paid: 0, revenue: 0, discount: 0, cohortPaid: 0 });
    return map.get(key);
  };
  if (keyOfPerson) for (const p of rows.people) at(keyOfPerson(p)).people += 1;
  for (const a of rows.created) {
    const row = at(keyOfApp(a));
    row.orders += 1;
    if (a.status === 'paid') row.cohortPaid += 1;
  }
  for (const a of rows.paid) {
    const row = at(keyOfApp(a));
    row.paid += 1;
    row.revenue += num(a.total_price);
    row.discount += num(a.discount);
  }
  return [...map.values()].map(({ cohortPaid, ...row }) => ({
    ...row,
    conversion: pct(cohortPaid, row.orders),
    reach: keyOfPerson ? pct(row.orders, row.people) : null,
  })).sort((a, b) => b.revenue - a.revenue || b.orders - a.orders || b.people - a.people);
}

async function referrals(rows) {
  const invited = rows.people.filter((p) => Number(p.ref_by) > 0);
  if (!invited.length) return [];
  const byRef = new Map();
  for (const p of invited) {
    const id = Number(p.ref_by);
    if (!byRef.has(id)) byRef.set(id, { id, invited: [], username: null, name: null, ordered: 0, paid: 0 });
    byRef.get(id).invited.push(Number(p.tg_user_id));
  }
  const list = [...byRef.values()].sort((a, b) => b.invited.length - a.invited.length).slice(0, 20);
  for (const row of list) {
    const who = await db.prepare('SELECT username, first_name FROM users WHERE tg_user_id = ?').get(row.id);
    row.username = who?.username ?? null;
    row.name = who?.first_name ?? null;
    for (const id of row.invited) {
      const apps = await db.prepare('SELECT status FROM applications WHERE tg_user_id = ?').all(id);
      if (apps.length) row.ordered += 1;
      if (apps.some((a) => a.status === 'paid')) row.paid += 1;
    }
  }
  return list.map(({ invited: ids, ...row }) => ({ ...row, invited: ids.length }));
}

function songOf(app) {
  const meta = parseMusicMeta(app.music_meta);
  if (meta?.title) return { title: String(meta.title), artist: String(meta.artist ?? '') };
  if (app.music_type === 'itunes') {
    try {
      const v = JSON.parse(app.music_value ?? '{}');
      if (v.name) return { title: String(v.name), artist: String(v.artist ?? '') };
    } catch { /* старое значение без JSON */ }
  }
  return null;
}

function music(rows) {
  const types = new Map();
  const songs = new Map();
  for (const a of rows.created) {
    const type = MUSIC_TYPES.has(a.music_type) ? a.music_type : (a.music_type ? 'other' : 'none');
    types.set(type, (types.get(type) ?? 0) + 1);
    const song = songOf(a);
    if (!song) continue;
    const key = `${a.music_type}:${a.music_value}`;
    if (!songs.has(key)) songs.set(key, { ...song, type: a.music_type, count: 0 });
    songs.get(key).count += 1;
  }
  return {
    types: [...types].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    top: [...songs.values()].sort((a, b) => b.count - a.count).slice(0, 10),
  };
}

function heat(rows) {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const a of rows.created) {
    const ms = parseUtc(a.created_at);
    if (Number.isFinite(ms)) grid[weekday(ms)][local(ms).getUTCHours()] += 1;
  }
  return grid;
}

function weddings(rows) {
  const months = new Map();
  const lead = [];
  for (const a of rows.created) {
    if (a.status === 'cancelled' || !DAY_RE.test(String(a.wedding_date ?? ''))) continue;
    const month = String(a.wedding_date).slice(0, 7);
    months.set(month, (months.get(month) ?? 0) + 1);
    const days = (Date.parse(`${a.wedding_date}T00:00:00Z`) - Date.parse(`${localDay(parseUtc(a.created_at))}T00:00:00Z`)) / DAY_MS;
    if (days >= 0) lead.push(days);
  }
  return {
    months: [...months].map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month)),
    leadDays: median(lead),
  };
}

function guestStats(rows) {
  const premium = rows.paid.filter((a) => num(a.premium));
  return {
    premiumOrders: premium.length,
    share: pct(premium.length, rows.paid.length),
    links: rows.guests.length,
    sent: rows.guests.filter((g) => num(g.sent)).length,
    avgPerOrder: premium.length ? Math.round((rows.guests.length / premium.length) * 10) / 10 : 0,
    revenue: premium.reduce((s, a) => s + num(a.premium_price), 0),
  };
}

function admins(rows) {
  const map = new Map();
  for (const a of rows.paid) {
    const name = humanConfirmed(a) ? (a.confirmed_by_name || String(a.confirmed_by)) : 'auto';
    if (!map.has(name)) map.set(name, { name, count: 0, minutes: [] });
    const row = map.get(name);
    row.count += 1;
    const m = (parseUtc(a.paid_at) - parseUtc(a.created_at)) / 60_000;
    if (humanConfirmed(a) && m >= 0) row.minutes.push(m);
  }
  return [...map.values()].map(({ minutes, ...row }) => ({ ...row, medianMinutes: median(minutes) }))
    .sort((a, b) => b.count - a.count);
}

// Последние события периода — лента «что происходило».
function feed(rows) {
  const items = [];
  for (const a of rows.created) {
    items.push({ at: a.created_at, kind: 'order', id: Number(a.id), web: isWeb(a), total: num(a.total_price),
      couple: `${a.groom_name ?? ''} & ${a.bride_name ?? ''}`, status: a.status });
  }
  for (const a of rows.paid) {
    items.push({ at: a.paid_at, kind: 'paid', id: Number(a.id), web: isWeb(a), total: num(a.total_price),
      couple: `${a.groom_name ?? ''} & ${a.bride_name ?? ''}`, by: humanConfirmed(a) ? a.confirmed_by_name : 'auto' });
  }
  return items.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 25);
}

// Снимок «сейчас», не зависящий от периода: что ждёт админа прямо сейчас.
async function snapshot() {
  const one = async (sql) => num((await db.prepare(sql).get())?.c);
  const drafts = (await db.prepare(`SELECT u.draft_step AS step, COUNT(*) AS c FROM users u
      WHERE u.draft_step IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.tg_user_id = u.tg_user_id OR a.web_owner = u.tg_user_id)
      GROUP BY u.draft_step ORDER BY u.draft_step`).all())
    .map((r) => ({ step: num(r.step), count: num(r.c) }));
  return {
    waiting: await one("SELECT COUNT(*) AS c FROM applications WHERE status = 'new'"),
    unlinked: await one("SELECT COUNT(*) AS c FROM applications WHERE tg_user_id < 0 AND status <> 'cancelled'"),
    stuck: drafts.reduce((s, r) => s + r.count, 0),
    drafts,
  };
}

// Самая ранняя запись — начало «всего времени».
async function earliest() {
  const rows = await Promise.all([
    db.prepare('SELECT MIN(created_at) AS m FROM applications').get(),
    db.prepare('SELECT MIN(first_seen) AS m FROM users').get(),
    db.prepare('SELECT MIN(at) AS m FROM events').get(),
  ]);
  const times = rows.map((r) => parseUtc(r?.m)).filter(Number.isFinite);
  return times.length ? Math.min(...times) : Date.now();
}

/* ── Точка входа ── */

export async function analytics({ from, to, group } = {}) {
  const since = statsSince();
  const sinceMs = since ? parseUtc(since.at) : null;
  const today = localDay(Date.now());
  const toDay = DAY_RE.test(String(to ?? '')) ? String(to) : today;
  const endMs = dayStart(toDay) + DAY_MS;
  const bounded = DAY_RE.test(String(from ?? ''));
  let startMs = bounded ? dayStart(String(from)) : dayStart(localDay(sinceMs ?? await earliest()));
  if (startMs >= endMs) throw new RangeError('Начало периода позже конца');
  if (endMs - startMs > 3660 * DAY_MS) startMs = endMs - 3660 * DAY_MS;

  // Счёт идёт не раньше базовой точки, а корзины графика — по всему периоду:
  // дни до сброса честно стоят нулями.
  const countFrom = Math.max(startMs, sinceMs ?? -Infinity);
  const days = Math.round((endMs - startMs) / DAY_MS);
  const g = pickGroup(group, days);
  const keys = bucketList(startMs, endMs, g);

  const empty = { created: [], paid: [], people: [], events: [], guests: [] };
  const rows = countFrom < endMs ? await collect(utcStr(countFrom), utcStr(endMs)) : empty;

  // Прошлый период той же длины — для стрелок ▲▼ у показателей.
  let previous = null;
  if (bounded) {
    const prevStart = Math.max(startMs - (endMs - startMs), sinceMs ?? -Infinity);
    if (prevStart < startMs) {
      const prevRows = await collect(utcStr(prevStart), utcStr(startMs));
      previous = { from: localDay(prevStart), to: localDay(startMs - 1), kpi: kpis(prevRows) };
    }
  }

  const names = new Map(allTemplates().map((t) => [t.id, t.name]));
  return {
    range: { from: localDay(startMs), to: localDay(endMs - 1), days, group: g, bounded, today, tz: 'Asia/Tashkent' },
    since,
    kpi: kpis(rows),
    previous,
    series: series(rows, keys, g),
    funnel: funnel(rows),
    channels: channels(rows),
    sources: grouped(rows, (a) => a.source || 'direct', (p) => p.entry || 'direct')
      .map(({ key, ...row }) => ({ source: key, ...row })),
    templates: grouped(rows, (a) => a.template_id)
      .map(({ key, people, reach, ...row }) => ({ id: key, name: names.get(key) ?? key, ...row })),
    promos: grouped({ ...rows, created: rows.created.filter((a) => a.promo_code), paid: rows.paid.filter((a) => a.promo_code) },
      (a) => a.promo_code).map(({ key, people, reach, ...row }) => ({ code: key, ...row })),
    langs: grouped(rows, (a) => a.lang || 'uz').map(({ key, people, reach, ...row }) => ({ lang: key, ...row })),
    referrals: await referrals(rows),
    music: music(rows),
    heat: heat(rows),
    weddings: weddings(rows),
    guests: guestStats(rows),
    admins: admins(rows),
    feed: feed(rows),
    now: await snapshot(),
  };
}
