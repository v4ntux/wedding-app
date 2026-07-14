import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'wedding.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_user_id INTEGER NOT NULL,
    tg_username TEXT,
    phone TEXT,
    phone2 TEXT,
    contact_tg TEXT,
    event_type TEXT NOT NULL DEFAULT 'wedding',
    lang TEXT NOT NULL DEFAULT 'uz',
    groom_name TEXT NOT NULL,
    bride_name TEXT NOT NULL,
    wedding_date TEXT NOT NULL,
    wedding_time TEXT NOT NULL,
    address TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    music_type TEXT NOT NULL DEFAULT 'none',
    music_value TEXT,
    music_start REAL,
    music_end REAL,
    template_id TEXT NOT NULL,
    template_price INTEGER NOT NULL,
    premium INTEGER NOT NULL DEFAULT 0,
    premium_price INTEGER NOT NULL DEFAULT 0,
    guest_names TEXT,
    photos TEXT,
    total_price INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    slug TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    paid_at TEXT
  );

  CREATE TABLE IF NOT EXISTS guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    sent INTEGER NOT NULL DEFAULT 0,
    UNIQUE(application_id, slug)
  );
`);

// Миграции для баз, созданных ранними версиями.
const appCols = db.prepare('PRAGMA table_info(applications)').all().map((c) => c.name);
for (const [col, ddl] of [
  ['photos', 'ALTER TABLE applications ADD COLUMN photos TEXT'],
  ['lang', "ALTER TABLE applications ADD COLUMN lang TEXT NOT NULL DEFAULT 'uz'"],
  ['music_start', 'ALTER TABLE applications ADD COLUMN music_start REAL'],
  ['music_end', 'ALTER TABLE applications ADD COLUMN music_end REAL'],
  ['phone', 'ALTER TABLE applications ADD COLUMN phone TEXT'],
  ['event_type', "ALTER TABLE applications ADD COLUMN event_type TEXT NOT NULL DEFAULT 'wedding'"],
  ['phone2', 'ALTER TABLE applications ADD COLUMN phone2 TEXT'],
  ['contact_tg', 'ALTER TABLE applications ADD COLUMN contact_tg TEXT'],
  ['confirmed_by', 'ALTER TABLE applications ADD COLUMN confirmed_by INTEGER'],
  ['confirmed_by_name', 'ALTER TABLE applications ADD COLUMN confirmed_by_name TEXT'],
  ['payment_proof', 'ALTER TABLE applications ADD COLUMN payment_proof TEXT'],
  ['main_sent', 'ALTER TABLE applications ADD COLUMN main_sent INTEGER NOT NULL DEFAULT 0'],
]) {
  if (!appCols.includes(col)) db.exec(ddl);
}

const guestCols = db.prepare('PRAGMA table_info(guests)').all().map((c) => c.name);
if (!guestCols.includes('sent')) db.exec('ALTER TABLE guests ADD COLUMN sent INTEGER NOT NULL DEFAULT 0');

export function insertApplication(a) {
  const res = db
    .prepare(
      `INSERT INTO applications
        (tg_user_id, tg_username, phone, phone2, contact_tg, event_type, lang, groom_name, bride_name, wedding_date, wedding_time,
         address, lat, lng, music_type, music_value, music_start, music_end,
         template_id, template_price, premium, premium_price, guest_names, photos, total_price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`
    )
    .run(
      a.tgUserId,
      a.tgUsername ?? null,
      a.phone ?? null,
      a.phone2 ?? null,
      a.contactTg ?? null,
      a.eventType ?? 'wedding',
      a.lang,
      a.groomName,
      a.brideName,
      a.weddingDate,
      a.weddingTime,
      a.address ?? null,
      a.lat,
      a.lng,
      a.musicType,
      a.musicValue ?? null,
      a.musicStart ?? null,
      a.musicEnd ?? null,
      a.templateId,
      a.templatePrice,
      a.premium ? 1 : 0,
      a.premiumPrice,
      a.guestNames ? JSON.stringify(a.guestNames) : null,
      a.photos ? JSON.stringify(a.photos) : null,
      a.totalPrice
    );
  return Number(res.lastInsertRowid);
}

export function getApplication(id) {
  return db.prepare('SELECT * FROM applications WHERE id = ?').get(id) ?? null;
}

// Заявки пользователя для раздела «Мои приглашения» (новые сверху).
export function listApplicationsByUser(tgUserId) {
  return db
    .prepare('SELECT * FROM applications WHERE tg_user_id = ? ORDER BY id DESC LIMIT 50')
    .all(tgUserId);
}

export function getApplicationBySlug(slug) {
  return db.prepare("SELECT * FROM applications WHERE slug = ? AND status = 'paid'").get(slug) ?? null;
}

export function slugTaken(slug) {
  return db.prepare('SELECT 1 FROM applications WHERE slug = ?').get(slug) !== undefined;
}

// Сколько раз выбирали каждый шаблон — для бейджа TOP в форме.
export function templatePopularity() {
  const rows = db.prepare('SELECT template_id, COUNT(*) AS c FROM applications GROUP BY template_id').all();
  const out = {};
  for (const r of rows) out[r.template_id] = Number(r.c);
  return out;
}

// Топ-3 трека из каталога, которые выбирают чаще всего.
export function topMusic(limit = 3) {
  const rows = db
    .prepare("SELECT music_value, COUNT(*) AS c FROM applications WHERE music_type = 'itunes' GROUP BY music_value ORDER BY c DESC LIMIT ?")
    .all(limit);
  const out = [];
  for (const r of rows) {
    try {
      out.push({ ...JSON.parse(r.music_value), uses: Number(r.c) });
    } catch { /* пропускаем битые записи */ }
  }
  return out;
}

// Атомарно: сработает только если заявка ещё в статусе 'new' (защита от двойного клика).
export function markPaid(id, slug) {
  const res = db
    .prepare("UPDATE applications SET status = 'paid', slug = ?, paid_at = datetime('now') WHERE id = ? AND status = 'new'")
    .run(slug, id);
  return res.changes === 1;
}

export function markCancelled(id) {
  const res = db
    .prepare("UPDATE applications SET status = 'cancelled' WHERE id = ? AND status = 'new'")
    .run(id);
  return res.changes === 1;
}

export function insertGuest(applicationId, name, slug) {
  db.prepare('INSERT INTO guests (application_id, name, slug) VALUES (?, ?, ?)').run(applicationId, name, slug);
}

export function getGuest(applicationId, slug) {
  return db.prepare('SELECT * FROM guests WHERE application_id = ? AND slug = ?').get(applicationId, slug) ?? null;
}

export function listGuests(applicationId) {
  return db.prepare('SELECT * FROM guests WHERE application_id = ? ORDER BY id').all(applicationId);
}

// Сводная статистика для админ-панели (агрегаты по всем заявкам).
export function adminStats() {
  const totals = { all: 0, new: 0, paid: 0, cancelled: 0, revenue: 0 };
  for (const r of db.prepare(
    "SELECT status, COUNT(*) c, COALESCE(SUM(total_price),0) s FROM applications GROUP BY status"
  ).all()) {
    totals.all += Number(r.c);
    if (r.status in totals) totals[r.status] = Number(r.c);
    if (r.status === 'paid') totals.revenue = Number(r.s);
  }
  totals.conversion = totals.all ? Math.round((totals.paid / totals.all) * 100) : 0;
  totals.avgCheck = totals.paid ? Math.round(totals.revenue / totals.paid) : 0;

  const templates = db.prepare(
    `SELECT template_id AS id, COUNT(*) c,
            COALESCE(SUM(CASE WHEN status='paid' THEN total_price END),0) revenue
     FROM applications GROUP BY template_id ORDER BY c DESC`
  ).all().map((r) => ({ id: r.id, count: Number(r.c), revenue: Number(r.revenue) }));

  const topMusic = [];
  for (const r of db.prepare(
    "SELECT music_value, COUNT(*) c FROM applications WHERE music_type='itunes' GROUP BY music_value ORDER BY c DESC LIMIT 5"
  ).all()) {
    try {
      const v = JSON.parse(r.music_value);
      topMusic.push({ name: v.name, artist: v.artist, count: Number(r.c) });
    } catch { /* пропускаем битые */ }
  }

  const byDay = db.prepare(
    `SELECT substr(created_at,1,10) d, COUNT(*) c,
            SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) paid
     FROM applications GROUP BY d ORDER BY d DESC LIMIT 14`
  ).all().map((r) => ({ day: r.d, count: Number(r.c), paid: Number(r.paid) })).reverse();

  const guestLinks = Number(db.prepare('SELECT COUNT(*) c FROM guests').get().c);
  const premiumRevenue = Number(
    db.prepare("SELECT COALESCE(SUM(premium_price),0) s FROM applications WHERE status='paid' AND premium=1").get().s
  );

  return { totals, templates, topMusic, byDay, guestLinks, premiumRevenue };
}

// Записать, какой админ подтвердил оплату, когда и скриншот чека.
export function recordConfirmation(id, adminId, adminName, proof) {
  db.prepare(
    'UPDATE applications SET confirmed_by = ?, confirmed_by_name = ?, payment_proof = ? WHERE id = ?'
  ).run(adminId ?? null, adminName ?? null, proof ?? null, id);
}

export function markMainSent(id) {
  db.prepare('UPDATE applications SET main_sent = 1 WHERE id = ?').run(id);
}

export function markGuestSent(applicationId, slug) {
  db.prepare('UPDATE guests SET sent = 1 WHERE application_id = ? AND slug = ?').run(applicationId, slug);
}

// Последние заявки для админ-панели: кто подтвердил, когда, скриншот, гости.
export function listRecentOrders(limit = 30) {
  const rows = db.prepare('SELECT * FROM applications ORDER BY id DESC LIMIT ?').all(limit);
  return rows.map((a) => ({
    id: a.id,
    groom: a.groom_name,
    bride: a.bride_name,
    date: a.wedding_date,
    templateId: a.template_id,
    status: a.status,
    total: a.total_price,
    premium: Boolean(a.premium),
    slug: a.slug,
    contactTg: a.contact_tg,
    phone: a.phone,
    phone2: a.phone2,
    createdAt: a.created_at,
    paidAt: a.paid_at,
    confirmedBy: a.confirmed_by,
    confirmedByName: a.confirmed_by_name,
    paymentProof: a.payment_proof ? `/uploads/${a.payment_proof}` : null,
    guests: db.prepare('SELECT name, slug, sent FROM guests WHERE application_id = ? ORDER BY id').all(a.id)
      .map((g) => ({ name: g.name, slug: g.slug, sent: Boolean(g.sent) })),
  }));
}
