import './config.js';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';
import { schema, migrations } from './schema.js';

export const dataDir = path.resolve(process.env.NVATE_DATA_DIR || 'data');
mkdirSync(dataDir, { recursive: true });
const connectionString = (process.env.DATABASE_URL || '').trim();
export const databaseEngine = connectionString ? 'postgresql' : 'sqlite';
if (process.env.RAILWAY_ENVIRONMENT && !connectionString) {
  throw new Error('Set DATABASE_URL to the nvate PostgreSQL service reference before deploying.');
}
if (connectionString && !/^postgres(?:ql)?:\/\//.test(connectionString)) {
  throw new Error('DATABASE_URL must be a PostgreSQL connection URL.');
}
const context = new AsyncLocalStorage();
let pool, sqlite;
// Preserve the JSON API's numeric IDs, including Telegram IDs (up to 52 bits).
const types = { getTypeParser(oid, format) {
  if (oid === 20) return (value) => {
    const number = Number(value);
    if (!Number.isSafeInteger(number)) throw new Error('Database integer exceeds JavaScript safe range');
    return number;
  };
  return pg.types.getTypeParser(oid, format);
} };

function postgresSql(sql) {
  let index = 0;
  return sql.replace(/'([^']|'')*'|\?/g, (part) => part === '?' ? `$${++index}` : part)
    .replaceAll("datetime('now')", "to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')")
    .replaceAll('CAST(music_start / 5 AS INTEGER)', 'FLOOR(music_start / 5)');
}
async function query(sql, params = []) {
  return (context.getStore() || pool).query(postgresSql(sql), params);
}

if (connectionString) {
  pool = new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000, statement_timeout: 30000, types });
  pool.on('error', (error) => console.error('[db] idle connection error:', error.code));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(728194023)');
    await client.query(postgresSql(schema.replace(/\s*PRAGMA[^;]+;/g, '')
      .replaceAll('INTEGER PRIMARY KEY AUTOINCREMENT', 'BIGSERIAL PRIMARY KEY')
      .replace(/(tg_user_id|application_id|owner_id) INTEGER/g, '$1 BIGINT')
      .replaceAll(' REAL', ' DOUBLE PRECISION')));
    for (const [, ddl] of migrations) {
      await client.query(ddl.replace('ADD COLUMN ', 'ADD COLUMN IF NOT EXISTS ')
        .replace('confirmed_by INTEGER', 'confirmed_by BIGINT').replace(' REAL', ' DOUBLE PRECISION'));
    }
    await client.query('ALTER TABLE guests ADD COLUMN IF NOT EXISTS sent INTEGER NOT NULL DEFAULT 0');
    await client.query('ALTER TABLE guests ADD COLUMN IF NOT EXISTS message_id BIGINT');
    await client.query('ALTER TABLE tracks ADD COLUMN IF NOT EXISTS source_id TEXT');
    await client.query('ALTER TABLE tracks ADD COLUMN IF NOT EXISTS top_start DOUBLE PRECISION');
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS tracks_source ON tracks(source, source_id) WHERE source_id IS NOT NULL');
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS applications_submission_key ON applications(tg_user_id, submission_key) WHERE submission_key IS NOT NULL');
    await client.query('CREATE TABLE IF NOT EXISTS nvate_migrations (name TEXT PRIMARY KEY, completed_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
} else {
  sqlite = new DatabaseSync(path.join(dataDir, 'wedding.db'));
  sqlite.exec(schema);
  const columns = sqlite.prepare('PRAGMA table_info(applications)').all().map((c) => c.name);
  for (const [col, ddl] of migrations) if (!columns.includes(col)) sqlite.exec(ddl);
  const guestColumns = sqlite.prepare('PRAGMA table_info(guests)').all().map((c) => c.name);
  if (!guestColumns.includes('sent')) sqlite.exec('ALTER TABLE guests ADD COLUMN sent INTEGER NOT NULL DEFAULT 0');
  // Сообщение бота с одноразовой кнопкой «Отправить»: её снимают после отправки.
  if (!guestColumns.includes('message_id')) sqlite.exec('ALTER TABLE guests ADD COLUMN message_id INTEGER');
  const trackColumns = sqlite.prepare('PRAGMA table_info(tracks)').all().map((c) => c.name);
  if (!trackColumns.includes('source_id')) sqlite.exec('ALTER TABLE tracks ADD COLUMN source_id TEXT');
  if (!trackColumns.includes('top_start')) sqlite.exec('ALTER TABLE tracks ADD COLUMN top_start REAL');
  sqlite.exec('CREATE UNIQUE INDEX IF NOT EXISTS tracks_source ON tracks(source, source_id) WHERE source_id IS NOT NULL');
  sqlite.exec('CREATE UNIQUE INDEX IF NOT EXISTS applications_submission_key ON applications(tg_user_id, submission_key) WHERE submission_key IS NOT NULL');
}

// One async interface for production PostgreSQL and offline development SQLite.
export const db = {
  prepare(sql) {
    return {
      async all(...params) { return pool ? (await query(sql, params)).rows : sqlite.prepare(sql).all(...params); },
      async get(...params) { return (await this.all(...params))[0]; },
      async run(...params) {
        if (!pool) return sqlite.prepare(sql).run(...params);
        const insert = /^\s*INSERT INTO (applications|guests|tracks|music_tracks)\b/i.test(sql);
        const result = await query(insert ? `${sql} RETURNING id` : sql, params);
        return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id };
      },
    };
  },
  async close() { if (pool) await pool.end(); else sqlite.close(); },
};

let sqliteQueue = Promise.resolve();
export async function transaction(work) {
  if (context.getStore()) return work();
  if (!pool) {
    const previous = sqliteQueue;
    let release;
    sqliteQueue = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      sqlite.exec('BEGIN IMMEDIATE');
      const result = await context.run(sqlite, work);
      sqlite.exec('COMMIT');
      return result;
    } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    finally { release(); }
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await context.run(client, work);
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function healthCheck() {
  await db.prepare('SELECT 1 AS ok').get();
  return { status: 'ok', database: databaseEngine };
}

export async function lockPayments() {
  if (pool) await query('SELECT pg_advisory_xact_lock(728194025)');
}

// Run on the first PostgreSQL startup, while the old app is stopped. The source
// SQLite file is retained, and the import plus marker commit together.
export async function migrateSqlite(sourcePath) {
  if (!pool) throw new Error('SQLite migration requires DATABASE_URL');
  if (!existsSync(sourcePath)) throw new Error('SQLite migration source is missing');
  return transaction(async () => {
    await query('SELECT pg_advisory_xact_lock(728194024)');
    if ((await query("SELECT 1 FROM nvate_migrations WHERE name = 'sqlite-v1'")).rowCount) return { alreadyMigrated: true };
    for (const table of ['applications', 'guests', 'settings']) {
      if ((await query(`SELECT 1 FROM ${table} LIMIT 1`)).rowCount) throw new Error(`Refusing to import into nonempty ${table}`);
    }
    const source = new DatabaseSync(sourcePath, { readOnly: true });
    const counts = {};
    try {
      source.exec('BEGIN');
      for (const table of ['applications', 'settings', 'guests']) {
        const rows = source.prepare(`SELECT * FROM ${table}`).all();
        const targetCols = new Set((await query('SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ?', [table])).rows.map((c) => c.column_name));
        for (const row of rows) {
          const columns = Object.keys(row);
          if (columns.some((col) => !targetCols.has(col))) throw new Error(`Unknown source column in ${table}`);
          await query(`INSERT INTO ${table} (${columns.map((col) => `"${col}"`).join(',')}) VALUES (${columns.map(() => '?').join(',')})`, columns.map((col) => row[col]));
        }
        counts[table] = rows.length;
        if ((await query(`SELECT COUNT(*) AS count FROM ${table}`)).rows[0].count !== rows.length) throw new Error(`Import count mismatch: ${table}`);
      }
      for (const table of ['applications', 'guests']) {
        await query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM ${table}`);
      }
      await query("INSERT INTO nvate_migrations (name) VALUES ('sqlite-v1')");
      source.exec('COMMIT');
      console.log('[db] SQLite import verified:', JSON.stringify(counts));
      return counts;
    } finally { source.close(); }
  });
}

if (process.env.NVATE_MIGRATE_SQLITE) await migrateSqlite(path.resolve(process.env.NVATE_MIGRATE_SQLITE));
console.log(`[db] ${databaseEngine} ready`);
