export const schema = `
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
    map_enabled INTEGER NOT NULL DEFAULT 1,
    music_type TEXT NOT NULL DEFAULT 'none',
    music_value TEXT,
    music_start REAL,
    music_end REAL,
    template_id TEXT NOT NULL,
    template_price INTEGER NOT NULL,
    premium INTEGER NOT NULL DEFAULT 0,
    premium_price INTEGER NOT NULL DEFAULT 0,
    domain_enabled INTEGER NOT NULL DEFAULT 0,
    domain_price INTEGER NOT NULL DEFAULT 0,
    guest_names TEXT,
    photos TEXT,
    total_price INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    slug TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    paid_at TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    sent INTEGER NOT NULL DEFAULT 0,
    UNIQUE(application_id, slug)
  );

  -- Полные треки: присланные боту, загруженные в студии и библиотека nvate.
  -- Сам звук лежит файлом в uploads, здесь — чей он, как зовётся и сколько длится.
  CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER,
    file TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT,
    duration REAL,
    source TEXT NOT NULL DEFAULT 'upload',
    tg_unique_id TEXT,
    library INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS tracks_owner ON tracks(owner_id);
  CREATE INDEX IF NOT EXISTS tracks_file ON tracks(file);
  CREATE UNIQUE INDEX IF NOT EXISTS tracks_telegram ON tracks(owner_id, tg_unique_id) WHERE tg_unique_id IS NOT NULL;
`;
export const migrations = [
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
  ['map_enabled', 'ALTER TABLE applications ADD COLUMN map_enabled INTEGER NOT NULL DEFAULT 1'],
  ['domain_enabled', 'ALTER TABLE applications ADD COLUMN domain_enabled INTEGER NOT NULL DEFAULT 0'],
  ['domain_price', 'ALTER TABLE applications ADD COLUMN domain_price INTEGER NOT NULL DEFAULT 0'],
  ['extras', 'ALTER TABLE applications ADD COLUMN extras TEXT'],
  ['submission_key', 'ALTER TABLE applications ADD COLUMN submission_key TEXT'],
];
