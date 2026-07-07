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
]) {
  if (!appCols.includes(col)) db.exec(ddl);
}

export function insertApplication(a) {
  const res = db
    .prepare(
      `INSERT INTO applications
        (tg_user_id, tg_username, phone, lang, groom_name, bride_name, wedding_date, wedding_time,
         address, lat, lng, music_type, music_value, music_start, music_end,
         template_id, template_price, premium, premium_price, guest_names, photos, total_price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`
    )
    .run(
      a.tgUserId,
      a.tgUsername ?? null,
      a.phone ?? null,
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
