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
         address, lat, lng, map_enabled, music_type, music_value, music_start, music_end,
         template_id, template_price, premium, premium_price, domain_enabled, domain_price, guest_names, photos, extras, submission_key, total_price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`
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
      a.totalPrice
    ));
  return Number(res.lastInsertRowid);
}

export async function getApplicationBySubmissionKey(tgUserId, submissionKey) {
  return (await db.prepare('SELECT * FROM applications WHERE tg_user_id = ? AND submission_key = ?')
    .get(tgUserId, submissionKey)) ?? null;
}

export async function getApplication(id) {
  return (await db.prepare('SELECT * FROM applications WHERE id = ?').get(id)) ?? null;
}

// Заявки пользователя для раздела «Мои приглашения» (новые сверху).
export async function listApplicationsByUser(tgUserId) {
  return (await db
    .prepare('SELECT * FROM applications WHERE tg_user_id = ? ORDER BY id DESC LIMIT 50')
    .all(tgUserId));
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
    `INSERT INTO tracks (owner_id, file, title, artist, duration, source, source_id, top_start, tg_unique_id, library)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    t.library ? 1 : 0
  ));
  return Number(res.lastInsertRowid);
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

// Полка nvate: песни от админа и песни с YouTube, которые пары уже поставили в
// приглашение. Сверху то, что выбирают чаще.
export async function listLibrary() {
  return db.prepare(`SELECT t.*, ${TRACK_USES} AS uses FROM tracks t
    WHERE t.library = 1 OR (t.library = 0 AND t.source = 'youtube' AND ${TRACK_USES} > 0)
    ORDER BY uses DESC, t.id DESC LIMIT 120`).all();
}

export async function trackBySource(source, sourceId) {
  return (await db.prepare(`SELECT t.*, ${TRACK_USES} AS uses FROM tracks t WHERE t.source = ? AND t.source_id = ?`)
    .get(source, sourceId)) ?? null;
}

// Снятая админом песня (-1) не возвращается на полку сама, даже если её выбирают.
export async function setTrackLibrary(id, on) {
  return (await db.prepare('UPDATE tracks SET library = ? WHERE id = ?').run(on ? 1 : -1, id)).changes === 1;
}

export async function updateTrackMeta(id, title, artist) {
  (await db.prepare('UPDATE tracks SET title = ?, artist = ? WHERE id = ?').run(title, artist || null, id));
}

/* Откуда пары запускают этот самый трек. Один и тот же куплет нравится многим,
   поэтому популярную точку старта мы предлагаем следующей паре — вместо того,
   чтобы каждый раз искать её пальцем заново. Считаем по пятисекундным корзинам
   (совпадение до кадра ничего не значит), а предлагаем самую раннюю секунду из
   корзины: начать чуть раньше не страшно, начать позже — значит срезать фразу. */
export async function popularCut(musicValue, { minUses = 2 } = {}) {
  if (!musicValue) return null;
  const row = (await db
    .prepare(
      `SELECT CAST(MIN(music_start) AS INTEGER) AS start, COUNT(*) AS c
         FROM applications
        WHERE music_value = ? AND music_start IS NOT NULL AND music_start > 0
        GROUP BY CAST(music_start / 5 AS INTEGER)
        ORDER BY c DESC, start ASC
        LIMIT 1`
    )
    .get(musicValue));
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

// Сводная статистика для админ-панели (агрегаты по всем заявкам).
export async function adminStats() {
  const totals = { all: 0, new: 0, paid: 0, cancelled: 0, revenue: 0 };
  for (const r of (await db.prepare(
    "SELECT status, COUNT(*) c, COALESCE(SUM(total_price),0) s FROM applications GROUP BY status"
  ).all())) {
    totals.all += Number(r.c);
    if (r.status in totals) totals[r.status] = Number(r.c);
    if (r.status === 'paid') totals.revenue = Number(r.s);
  }
  totals.conversion = totals.all ? Math.round((totals.paid / totals.all) * 100) : 0;
  totals.avgCheck = totals.paid ? Math.round(totals.revenue / totals.paid) : 0;

  const templates = (await db.prepare(
    `SELECT template_id AS id, COUNT(*) c,
            COALESCE(SUM(CASE WHEN status='paid' THEN total_price END),0) revenue
     FROM applications GROUP BY template_id ORDER BY c DESC`
  ).all()).map((r) => ({ id: r.id, count: Number(r.c), revenue: Number(r.revenue) }));

  let topMusic = [];
  for (const r of (await db.prepare(
    "SELECT music_value, COUNT(*) c FROM applications WHERE music_type='itunes' GROUP BY music_value ORDER BY c DESC LIMIT 5"
  ).all())) {
    try {
      const v = JSON.parse(r.music_value);
      topMusic.push({ name: v.name, artist: v.artist, count: Number(r.c) });
    } catch { /* пропускаем битые */ }
  }
  // Полные треки: название берём из tracks, в заявке лежит только имя файла.
  for (const r of (await db.prepare(
    "SELECT music_value, COUNT(*) c FROM applications WHERE music_type='upload' GROUP BY music_value ORDER BY c DESC LIMIT 5"
  ).all())) {
    const track = await trackByFile(r.music_value);
    if (track) topMusic.push({ name: track.title, artist: track.artist ?? '', count: Number(r.c) });
  }
  topMusic = topMusic.sort((a, b) => b.count - a.count).slice(0, 5);

  const byDay = (await db.prepare(
    `SELECT substr(created_at,1,10) d, COUNT(*) c,
            SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) paid
     FROM applications GROUP BY d ORDER BY d DESC LIMIT 14`
  ).all()).map((r) => ({ day: r.d, count: Number(r.c), paid: Number(r.paid) })).reverse();

  const guestLinks = Number((await db.prepare('SELECT COUNT(*) c FROM guests').get()).c);
  const premiumRevenue = Number(
    (await db.prepare("SELECT COALESCE(SUM(premium_price),0) s FROM applications WHERE status='paid' AND premium=1").get()).s
  );

  return { totals, templates, topMusic, byDay, guestLinks, premiumRevenue };
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
    premium: Boolean(a.premium),
    slug: a.slug,
    contactTg: a.contact_tg,
    phone: a.phone,
    phone2: a.phone2,
    createdAt: a.created_at,
    paidAt: a.paid_at,
    confirmedBy: a.confirmed_by,
    confirmedByName: a.confirmed_by_name,
    paymentProof: a.payment_proof ? `/api/admin/proofs/${encodeURIComponent(a.payment_proof)}` : null,
    guests: (await db.prepare('SELECT name, slug, sent FROM guests WHERE application_id = ? ORDER BY id').all(a.id))
      .map((g) => ({ name: g.name, slug: g.slug, sent: Boolean(g.sent) })),
  })));
}
