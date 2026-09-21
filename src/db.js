import { db, transaction } from './storage.js';
export { db, transaction };
const settings = new Map();
export async function refreshSettings() {
  const rows = await db.prepare('SELECT key, value FROM settings').all();
  settings.clear();
  for (const row of rows) { try { settings.set(row.key, JSON.parse(row.value)); } catch {} }
}
await refreshSettings();

/* Настройки платформы: то, что админ меняет на ходу (цены). Значение — JSON,
   поэтому новая настройка не требует миграции. */
export function getSetting(key) { return structuredClone(settings.get(key) ?? null); }

export async function setSetting(key, value) {
  (await db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
    .run(key, JSON.stringify(value)));
  settings.set(key, structuredClone(value));
  return value;
}

export async function insertApplication(a) {
  const res = (await db
    .prepare(
      `INSERT INTO applications
        (tg_user_id, tg_username, phone, phone2, contact_tg, event_type, lang, groom_name, bride_name, wedding_date, wedding_time,
         address, lat, lng, map_enabled, music_type, music_value, music_start, music_end, music_meta,
         template_id, template_price, premium, premium_price, domain_enabled, domain_price, guest_names, photos, extras, submission_key, promo_code, discount, source,
         web_owner, claim_code, total_price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`
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
      a.mapEnabled ? 1 : 0,
      a.musicType,
      a.musicValue ?? null,
      a.musicStart ?? null,
      a.musicEnd ?? null,
      a.musicMeta ? JSON.stringify(a.musicMeta) : null,
      a.templateId,
      a.templatePrice,
      a.premium ? 1 : 0,
      a.premiumPrice,
      a.domainEnabled ? 1 : 0,
      a.domainPrice ?? 0,
      a.guestNames ? JSON.stringify(a.guestNames) : null,
      a.photos ? JSON.stringify(a.photos) : null,
      a.extras && Object.keys(a.extras).length ? JSON.stringify(a.extras) : null,
      a.submissionKey ?? null,
      a.promoCode ?? null,
      a.discount ?? 0,
      a.source ?? null,
      a.webOwner ?? null,
      a.claimCode ?? null,
      a.totalPrice
    ));
  return Number(res.lastInsertRowid);
}

/* Заказ с сайта мог уже уехать в Telegram (tg_user_id переписан при привязке):
   повтор той же отправки ищем и по сессии браузера, которая его оформила. */
export async function getApplicationBySubmissionKey(userId, submissionKey) {
  return (await db.prepare('SELECT * FROM applications WHERE (tg_user_id = ? OR web_owner = ?) AND submission_key = ?')
    .get(userId, userId, submissionKey)) ?? null;
}

export async function getApplication(id) {
  return (await db.prepare('SELECT * FROM applications WHERE id = ?').get(id)) ?? null;
}

// Заявки пользователя для раздела «Мои приглашения» (новые сверху). Сайт видит
// и те свои заказы, что уже привязаны к Telegram.
export async function listApplicationsByUser(userId) {
  return (await db
    .prepare('SELECT * FROM applications WHERE tg_user_id = ? OR web_owner = ? ORDER BY id DESC LIMIT 50')
    .all(userId, userId));
}

export async function getApplicationBySlug(slug) {
  return (await db.prepare("SELECT * FROM applications WHERE slug = ? AND status = 'paid'").get(slug)) ?? null;
}

export async function slugTaken(slug) {
  return (await db.prepare('SELECT 1 FROM applications WHERE slug = ?').get(slug)) !== undefined;
}

// Сколько раз выбирали каждый шаблон — для бейджа TOP в форме.
export async function templatePopularity() {
  const rows = (await db.prepare('SELECT template_id, COUNT(*) AS c FROM applications GROUP BY template_id').all());
  const out = {};
  for (const r of rows) out[r.template_id] = Number(r.c);
  return out;
}

/* ── Треки ── */

export async function insertTrack(t) {
  const duration = Number(t.duration);
  const top = t.topStart === null || t.topStart === undefined ? NaN : Number(t.topStart);
  const res = (await db.prepare(
    `INSERT INTO tracks (owner_id, file, title, artist, duration, source, source_id, top_start, tg_unique_id, library, cover)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    t.ownerId ?? null,
    t.file,
    t.title,
    t.artist ?? null,
    Number.isFinite(duration) && duration > 0 ? duration : null,
    t.source ?? 'upload',
    t.sourceId ?? null,
    Number.isFinite(top) && top >= 0 ? top : null,
    t.tgUniqueId ?? null,
    t.library ? 1 : 0,
    t.cover ?? null
  ));
  return Number(res.lastInsertRowid);
}

// Какие песни пары уже поставили в приглашения (отменённые заявки не в счёт) —
// сырьё для «Топ nVate» (src/musicTop.js).
export async function topMusicRows(limit = 200) {
  return db.prepare(
    `SELECT music_type AS type, music_value AS value, MAX(music_meta) AS meta, COUNT(*) AS uses, MAX(created_at) AS last
       FROM applications
      WHERE music_type IN ('youtube', 'upload') AND music_value IS NOT NULL AND status <> 'cancelled'
      GROUP BY music_type, music_value
      ORDER BY uses DESC, last DESC
      LIMIT ?`
  ).all(limit);
}

// Песня, уже извлечённая из этой ссылки или видео: у пары или (owner = null) у кого угодно.
export async function trackBySource(ownerId, source, sourceId) {
  if (ownerId === null || ownerId === undefined) {
    return (await db.prepare('SELECT * FROM tracks WHERE source = ? AND source_id = ? ORDER BY id DESC LIMIT 1')
      .get(source, sourceId)) ?? null;
  }
  return (await db.prepare('SELECT * FROM tracks WHERE owner_id = ? AND source = ? AND source_id = ? ORDER BY id DESC LIMIT 1')
    .get(ownerId, source, sourceId)) ?? null;
}

// Сколько заявок уже играет этот файл — по нему полка сортируется.
const TRACK_USES = "(SELECT COUNT(*) FROM applications a WHERE a.music_type = 'upload' AND a.music_value = t.file)";

export async function getTrack(id) {
  return (await db.prepare(`SELECT t.*, ${TRACK_USES} AS uses FROM tracks t WHERE t.id = ?`).get(id)) ?? null;
}

// Библиотечная запись важнее личной копии того же файла.
export async function trackByFile(file) {
  return (await db.prepare('SELECT * FROM tracks WHERE file = ? ORDER BY library DESC, id LIMIT 1').get(file)) ?? null;
}

export async function trackByTelegram(ownerId, uniqueId) {
  return (await db.prepare(`SELECT t.*, ${TRACK_USES} AS uses FROM tracks t WHERE t.owner_id = ? AND t.tg_unique_id = ?`)
    .get(ownerId, uniqueId)) ?? null;
}

export async function listTracksByOwner(ownerId, limit = 40) {
  return db.prepare(`SELECT t.*, ${TRACK_USES} AS uses FROM tracks t WHERE t.owner_id = ? ORDER BY t.id DESC LIMIT ?`)
    .all(ownerId, limit);
}

/* ── Библиотека nVate ── */

// Сколько заявок уже играет песню библиотеки — по этому полка сортируется.
const LIBRARY_USES = "(SELECT COUNT(*) FROM applications a WHERE a.music_type = 'nvate' AND a.music_value = CAST(m.id AS TEXT))";

export async function insertLibraryTrack(t) {
  const duration = Number(t.duration);
  const res = await db.prepare(
    `INSERT INTO music_tracks (title, artist, category, duration, storage, audio_key, cover_key, cover_storage, source, license, is_active, legacy_track_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    t.title,
    t.artist || null,
    t.category,
    Number.isFinite(duration) && duration > 0 ? duration : null,
    t.storage,
    t.audioKey,
    t.coverKey ?? null,
    t.coverStorage ?? null,
    t.source ?? 'nvate',
    t.license || null,
    t.active === false ? 0 : 1,
    t.legacyTrackId ?? null
  );
  return Number(res.lastInsertRowid);
}

export async function getLibraryTrack(id) {
  return (await db.prepare(`SELECT m.*, ${LIBRARY_USES} AS uses FROM music_tracks m WHERE m.id = ?`).get(id)) ?? null;
}

export async function libraryTrackByLegacy(trackId) {
  return (await db.prepare('SELECT * FROM music_tracks WHERE legacy_track_id = ?').get(trackId)) ?? null;
}

/* Полка для студии и админки: поиск по названию и исполнителю, категория и
   страницы. Сверху то, что пары выбирают чаще. */
export async function searchLibrary({ query = '', category = null, activeOnly = true, limit = 20, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (activeOnly) where.push('m.is_active = 1');
  if (category) { where.push('m.category = ?'); params.push(category); }
  const needle = String(query ?? '').trim().toLowerCase();
  if (needle) {
    const like = `%${needle.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push("(LOWER(m.title) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(m.artist, '')) LIKE ? ESCAPE '\\')");
    params.push(like, like);
  }
  return db.prepare(`SELECT m.*, ${LIBRARY_USES} AS uses FROM music_tracks m
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY uses DESC, m.id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
}

const LIBRARY_FIELDS = {
  title: 'title', artist: 'artist', category: 'category', license: 'license', duration: 'duration',
  active: 'is_active', coverKey: 'cover_key', coverStorage: 'cover_storage',
};

export async function updateLibraryTrack(id, patch) {
  const sets = [];
  const params = [];
  for (const [field, column] of Object.entries(LIBRARY_FIELDS)) {
    if (!Object.hasOwn(patch, field)) continue;
    sets.push(`${column} = ?`);
    params.push(field === 'active' ? (patch.active ? 1 : 0) : (patch[field] ?? null));
  }
  if (!sets.length) return false;
  sets.push("updated_at = datetime('now')");
  return (await db.prepare(`UPDATE music_tracks SET ${sets.join(', ')} WHERE id = ?`).run(...params, id)).changes === 1;
}

// Старая полка (tracks.library = 1) переезжает в библиотеку один раз. Песни,
// скачанные когда-то с YouTube, туда не попадают: их звук не наш.
export async function migrateLegacyShelf() {
  return (await db.prepare(`INSERT INTO music_tracks (title, artist, category, duration, storage, audio_key, source, legacy_track_id)
    SELECT t.title, t.artist, 'wedding', t.duration, 'local', t.file, t.source, t.id FROM tracks t
     WHERE t.library = 1 AND t.source <> 'youtube'
       AND NOT EXISTS (SELECT 1 FROM music_tracks m WHERE m.legacy_track_id = t.id)`).run()).changes;
}

/* Откуда пары запускают этот самый трек. Один и тот же куплет нравится многим,
   поэтому популярную точку старта мы предлагаем следующей паре — вместо того,
   чтобы каждый раз искать её пальцем заново. Считаем по пятисекундным корзинам
   (совпадение до кадра ничего не значит), а предлагаем самую раннюю секунду из
   корзины: начать чуть раньше не страшно, начать позже — значит срезать фразу. */
export async function popularCut(musicType, musicValue, { minUses = 2 } = {}) {
  if (!musicType || !musicValue) return null;
  const row = (await db
    .prepare(
      `SELECT CAST(MIN(music_start) AS INTEGER) AS start, COUNT(*) AS c
         FROM applications
        WHERE music_type = ? AND music_value = ? AND music_start IS NOT NULL AND music_start > 0
        GROUP BY CAST(music_start / 5 AS INTEGER)
        ORDER BY c DESC, start ASC
        LIMIT 1`
    )
    .get(musicType, musicValue));
  if (!row || Number(row.c) < minUses) return null;
  return { start: Number(row.start), uses: Number(row.c) };
}

// Атомарно: сработает только если заявка ещё в статусе 'new' (защита от двойного клика).
export async function markPaid(id, slug) {
  const res = (await db
    .prepare("UPDATE applications SET status = 'paid', slug = ?, paid_at = datetime('now') WHERE id = ? AND status = 'new'")
    .run(slug, id));
  return res.changes === 1;
}

export async function markCancelled(id) {
  const res = (await db
    .prepare("UPDATE applications SET status = 'cancelled' WHERE id = ? AND status = 'new'")
    .run(id));
  return res.changes === 1;
}

/* ── Промокоды ──
   Место под скидку занимает уже сама заявка, а не оплата: иначе код «первым
   десяти» разошёлся бы сотне, и админ узнал бы об этом на подтверждении.
   Отклонённая заявка своё место возвращает. */

export async function listPromos() {
  return db.prepare('SELECT * FROM promo_codes ORDER BY created_at DESC, code').all();
}

export async function getPromo(code) {
  return (await db.prepare('SELECT * FROM promo_codes WHERE code = ?').get(code)) ?? null;
}

/* Занять место одним запросом: проверка и счётчик в одном UPDATE, поэтому две
   заявки, пришедшие в одну секунду, не разделят последнее место на двоих. */
export async function claimPromo(code, today) {
  const res = (await db.prepare(`UPDATE promo_codes SET used = used + 1
     WHERE code = ? AND active = 1
       AND (max_uses IS NULL OR used < max_uses)
       AND (expires_at IS NULL OR expires_at >= ?)`).run(code, today));
  return res.changes === 1;
}

export async function releasePromo(code) {
  (await db.prepare('UPDATE promo_codes SET used = used - 1 WHERE code = ? AND used > 0').run(code));
}

/* Список из админки приходит целиком, как справочник тойхон: правим и удаляем
   в одном сохранении. Счётчик used правкой не трогаем — он о прошлом. */
export async function savePromos(rows) {
  return transaction(async () => {
    const keep = new Set();
    for (const row of rows) {
      keep.add(row.code);
      (await db.prepare(`INSERT INTO promo_codes (code, kind, value, max_uses, expires_at, active, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET kind = excluded.kind, value = excluded.value,
           max_uses = excluded.max_uses, expires_at = excluded.expires_at,
           active = excluded.active, comment = excluded.comment`)
        .run(row.code, row.kind, row.value, row.maxUses ?? null, row.expiresAt ?? null, row.active ? 1 : 0, row.comment ?? null));
    }
    for (const row of (await db.prepare('SELECT code FROM promo_codes').all())) {
      if (!keep.has(row.code)) (await db.prepare('DELETE FROM promo_codes WHERE code = ?').run(row.code));
    }
    return listPromos();
  });
}

export async function insertGuest(applicationId, name, slug) {
  (await db.prepare('INSERT INTO guests (application_id, name, slug) VALUES (?, ?, ?)').run(applicationId, name, slug));
}

export async function getGuest(applicationId, slug) {
  return (await db.prepare('SELECT * FROM guests WHERE application_id = ? AND slug = ?').get(applicationId, slug)) ?? null;
}

export async function getGuestById(id) {
  return (await db.prepare('SELECT * FROM guests WHERE id = ?').get(id)) ?? null;
}

export async function setGuestMessage(id, messageId) {
  (await db.prepare('UPDATE guests SET message_id = ? WHERE id = ?').run(messageId, id));
}

export async function listGuests(applicationId) {
  return (await db.prepare('SELECT * FROM guests WHERE application_id = ? ORDER BY id').all(applicationId));
}

// Записать, какой админ подтвердил оплату, когда и скриншот чека.
export async function recordConfirmation(id, adminId, adminName, proof) {
  (await db.prepare(
    'UPDATE applications SET confirmed_by = ?, confirmed_by_name = ?, payment_proof = ? WHERE id = ?'
  ).run(adminId ?? null, adminName ?? null, proof ?? null, id));
}

export async function markMainSent(id) {
  (await db.prepare('UPDATE applications SET main_sent = 1 WHERE id = ?').run(id));
}

export async function markGuestSent(applicationId, slug) {
  (await db.prepare('UPDATE guests SET sent = 1 WHERE application_id = ? AND slug = ?').run(applicationId, slug));
}

// Последние заявки для админ-панели: кто подтвердил, когда, скриншот, гости.
export async function listRecentOrders(limit = 30) {
  const rows = (await db.prepare('SELECT * FROM applications ORDER BY id DESC LIMIT ?').all(limit));
  return Promise.all(rows.map(async (a) => ({
    id: a.id,
    groom: a.groom_name,
    bride: a.bride_name,
    date: a.wedding_date,
    templateId: a.template_id,
    status: a.status,
    total: a.total_price,
    promo: a.promo_code ?? null,
    discount: Number(a.discount ?? 0),
    premium: Boolean(a.premium),
    slug: a.slug,
    contactTg: a.contact_tg,
    phone: a.phone,
    phone2: a.phone2,
    createdAt: a.created_at,
    paidAt: a.paid_at,
    confirmedBy: a.confirmed_by,
    confirmedByName: a.confirmed_by_name,
    /* Откуда заказ: с сайта (web) или из бота. У заказа с сайта Telegram
       появляется, только когда пара перешла по своей ссылке на бота. */
    channel: a.web_owner != null ? 'web' : 'tg',
    linked: Number(a.tg_user_id) > 0,
    tgUsername: a.tg_username ?? null,
    claimedAt: a.claimed_at ?? null,
    source: a.source ?? null,
    lang: a.lang,
    paymentProof: a.payment_proof ? `/api/admin/proofs/${encodeURIComponent(a.payment_proof)}` : null,
    guests: (await db.prepare('SELECT name, slug, sent FROM guests WHERE application_id = ? ORDER BY id').all(a.id))
      .map((g) => ({ name: g.name, slug: g.slug, sent: Boolean(g.sent) })),
  })));
}

/* ── Пользователи ──
   Строка заводится при первом касании: /start в боте или открытие студии.
   Дальше она только дополняется — имя и язык обновляем, флаги не гасим. */
/* entry и ref_by — про первое касание: чем человек пришёл в первый раз, тем и
   остаётся. COALESCE держит уже записанную метку, поэтому второй заход по
   рекламной ссылке не переписывает источник, с которого человека привели. */
export async function touchUser({ id, username = null, firstName = null, lang = null, source = 'bot', entry = null, refBy = null }) {
  const tgId = Number(id);
  // Отрицательный id — пара с сайта (см. web_sessions), ноль — никто.
  if (!Number.isSafeInteger(tgId) || tgId === 0) return;
  const started = source === 'bot' ? 1 : 0;
  const opened = source === 'studio' ? 1 : 0;
  // Сам себя привести нельзя: ссылку кидают в общий чат, откуда её жмут и свои.
  const referrer = Number(refBy) > 0 && Number(refBy) !== tgId ? Number(refBy) : null;
  await db.prepare(
    `INSERT INTO users (tg_user_id, username, first_name, lang, started, opened, entry, ref_by, first_seen, last_seen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(tg_user_id) DO UPDATE SET
       username = COALESCE(excluded.username, users.username),
       first_name = COALESCE(excluded.first_name, users.first_name),
       lang = COALESCE(excluded.lang, users.lang),
       started = CASE WHEN excluded.started = 1 THEN 1 ELSE users.started END,
       opened = CASE WHEN excluded.opened = 1 THEN 1 ELSE users.opened END,
       entry = COALESCE(users.entry, excluded.entry),
       ref_by = COALESCE(users.ref_by, excluded.ref_by),
       last_seen = excluded.last_seen`
  ).run(tgId, username, firstName, lang, started, opened, entry, referrer);
}

// Метка, с которой человек когда-то пришёл: её заявка забирает себе.
export async function userEntry(id) {
  const row = (await db.prepare('SELECT entry, ref_by FROM users WHERE tg_user_id = ?').get(Number(id) || 0));
  return { entry: row?.entry ?? null, refBy: row?.ref_by ?? null };
}

/* Черновик студии: step — номер незаконченного шага, null — черновика больше
   нет (отправили заявку или начали заново). Пишем только по живой строке. */
export async function setUserDraft(id, step) {
  const tgId = Number(id);
  if (!Number.isSafeInteger(tgId) || tgId === 0) return;
  const value = Number.isInteger(step) && step >= 0 ? step : null;
  if (value === null) {
    await db.prepare("UPDATE users SET draft_step = NULL, draft_at = NULL, last_seen = datetime('now') WHERE tg_user_id = ?").run(tgId);
    return;
  }
  await db.prepare("UPDATE users SET draft_step = ?, draft_at = datetime('now'), last_seen = datetime('now') WHERE tg_user_id = ?")
    .run(value, tgId);
}


/* ── Сессии сайта ──
   В cookie лежит случайный токен, в базе — только его sha256. Id пары на
   сайте — номер строки со знаком минус. */
export async function createWebSession(tokenHash) {
  const res = await db.prepare('INSERT INTO web_sessions (token_hash) VALUES (?)').run(tokenHash);
  return -Number(res.lastInsertRowid);
}

export async function webSessionUser(tokenHash) {
  const row = await db.prepare('SELECT id FROM web_sessions WHERE token_hash = ?').get(tokenHash);
  return row ? -Number(row.id) : null;
}

export async function touchWebSession(userId) {
  const id = -Number(userId);
  if (!(id > 0)) return;
  await db.prepare("UPDATE web_sessions SET last_seen = datetime('now') WHERE id = ?").run(id);
}

/* ── События для показателей ──
   open — открыл студию, step — дошёл до шага (номер с нуля), start — /start в
   боте. Пишем мимоходом: статистика не должна ронять запрос. */
export async function logEvent(userId, kind, step = null) {
  const id = Number(userId);
  if (!Number.isSafeInteger(id) || id === 0) return;
  await db.prepare('INSERT INTO events (user_id, kind, step) VALUES (?, ?, ?)')
    .run(id, String(kind).slice(0, 16), Number.isInteger(step) ? step : null);
}

/* ── Заказ с сайта → Telegram ──
   Пока пара не открыла бота, tg_user_id у заказа отрицательный (сессия
   сайта). Привязка переписывает его на настоящий Telegram — дальше заказ
   живёт как обычный: ссылка, QR и именные ссылки уходят в бот. */
export async function getApplicationByClaim(code) {
  return (await db.prepare('SELECT * FROM applications WHERE claim_code = ?').get(code)) ?? null;
}

// Непривязанные заказы той же сессии сайта: один браузер — одна пара.
export async function unclaimedByOwner(webOwner) {
  return db.prepare('SELECT * FROM applications WHERE web_owner = ? AND tg_user_id < 0 ORDER BY id').all(webOwner);
}

// Заказы с сайта, где пара вписала этот username, а бота так и не открыла.
export async function unclaimedByUsername(username) {
  const name = String(username ?? '').trim().toLowerCase();
  if (!name) return [];
  return db.prepare(`SELECT * FROM applications
     WHERE tg_user_id < 0 AND LOWER(contact_tg) = ? AND status <> 'cancelled'
     ORDER BY id DESC LIMIT 5`).all(name);
}

// Атомарно: сработает, только если заказ ещё ничей в Telegram.
export async function claimApplication(id, tgUserId, username = null) {
  const res = await db.prepare(`UPDATE applications
     SET tg_user_id = ?, tg_username = COALESCE(?, tg_username), claimed_at = datetime('now')
     WHERE id = ? AND tg_user_id < 0`).run(tgUserId, username, id);
  return res.changes === 1;
}
