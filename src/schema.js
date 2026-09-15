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

  -- Полные треки: присланные боту, загруженные в студии, скачанные с YouTube и
  -- библиотека nvate. Сам звук лежит файлом в uploads, здесь — чей он, как
  -- зовётся и сколько длится. source_id — id ролика YouTube: песня одна на всех.
  -- top_start — самый переслушиваемый момент ролика. library: 1 — на полке,
  -- -1 — админ снял с полки, 0 — песня с YouTube попадает туда, когда её выберут.
  CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER,
    file TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT,
    duration REAL,
    source TEXT NOT NULL DEFAULT 'upload',
    source_id TEXT,
    top_start REAL,
    tg_unique_id TEXT,
    library INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS tracks_owner ON tracks(owner_id);
  CREATE INDEX IF NOT EXISTS tracks_file ON tracks(file);
  CREATE UNIQUE INDEX IF NOT EXISTS tracks_telegram ON tracks(owner_id, tg_unique_id) WHERE tg_unique_id IS NOT NULL;

  -- Библиотека nVate: курируемые полные песни, которые видят все пары. Звук и
  -- обложка лежат в хранилище по ключам (storage: local - папка uploads, s3 -
  -- Cloudflare R2); адрес для проигрывания сервер выдаёт сам. is_active = 0 -
  -- песня снята с полки, но уже оформленные приглашения её играют.
  -- legacy_track_id - песня перенесена со старой полки из таблицы tracks.
  CREATE TABLE IF NOT EXISTS music_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist TEXT,
    category TEXT NOT NULL DEFAULT 'wedding',
    duration REAL,
    storage TEXT NOT NULL DEFAULT 'local',
    audio_key TEXT NOT NULL,
    cover_key TEXT,
    cover_storage TEXT,
    source TEXT NOT NULL DEFAULT 'nvate',
    license TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    legacy_track_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS music_tracks_shelf ON music_tracks(is_active, category);
  CREATE UNIQUE INDEX IF NOT EXISTS music_tracks_legacy ON music_tracks(legacy_track_id) WHERE legacy_track_id IS NOT NULL;
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
  // Выбранная песня: название, исполнитель, обложка, длительность и громкость.
  // Сам источник и id песни — в music_type и music_value, начало — в music_start.
  ['music_meta', 'ALTER TABLE applications ADD COLUMN music_meta TEXT'],
  // Обложка своей песни: картинка ролика, из которого извлечён звук.
  ['tracks_cover', 'ALTER TABLE tracks ADD COLUMN cover TEXT'],
  // Одна песня из ссылки или видео — у каждой пары своя строка с тем же файлом.
  // Уникальный индекс старого загрузчика YouTube (одна строка на ролик на всех)
  // такое запрещал, поэтому он уступает место обычному индексу для поиска.
  ['tracks_source_unique_drop', 'DROP INDEX IF EXISTS tracks_source'],
];
