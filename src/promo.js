/* Промокоды.
 *
 * Код несёт только правило скидки — процент или сумму. Посчитанная скидка
 * ложится в саму заявку (discount) рядом с итогом, поэтому правка кода задним
 * числом не переписывает историю заказов: так же, как цена шаблона.
 *
 * Место под скидку занимает заявка, а не подтверждённая оплата (см. db.js):
 * код «первым десяти» иначе разошёлся бы сотне пар, и узнали бы мы об этом
 * только на подтверждении.
 */

import * as db from './db.js';

// Код читают с экрана и диктуют по телефону: только заглавные, цифры и дефис.
const CODE_RE = /^[A-Z0-9][A-Z0-9-]{1,23}$/;
const MAX_AMOUNT = 100_000_000;
const MAX_USES = 1_000_000;

export function normalizeCode(value) {
  const code = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
  return CODE_RE.test(code) ? code : null;
}

/* Сегодня по часам сервера — тот же день, с которым сверяется дата свадьбы. */
export function today() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/* Скидка от всей суммы: шаблон, именные ссылки и допы вместе. Больше итога
   скидка не бывает — в счёте не может остаться минус. */
export function discountOf(promo, total) {
  if (!promo || !(total > 0)) return 0;
  const raw = promo.kind === 'amount'
    ? Number(promo.value)
    : Math.round((total * Number(promo.value)) / 100);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(total, Math.round(raw));
}

export function promoAvailable(row, day = today()) {
  if (!row || !row.active) return false;
  if (row.expires_at && String(row.expires_at) < day) return false;
  if (row.max_uses !== null && row.max_uses !== undefined && Number(row.used) >= Number(row.max_uses)) return false;
  return true;
}

/* Что студия покажет паре: правило скидки и ничего о лимитах и сроках —
   недоступный код неотличим от несуществующего. */
export async function lookupPromo(rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const row = (await db.getPromo(code));
  if (!promoAvailable(row)) return null;
  return { code: row.code, kind: row.kind === 'amount' ? 'amount' : 'percent', value: Number(row.value) };
}

/* Снимок для админки: вместе с занятыми местами и признаком «код ещё ловит». */
export async function promoSnapshot() {
  const day = today();
  return (await db.listPromos()).map((row) => ({
    code: row.code,
    kind: row.kind === 'amount' ? 'amount' : 'percent',
    value: Number(row.value),
    maxUses: row.max_uses ?? null,
    used: Number(row.used),
    expiresAt: row.expires_at ?? null,
    active: Boolean(row.active),
    comment: row.comment ?? null,
    available: promoAvailable(row, day),
  }));
}

/* Правка из админки приходит целиком, как справочник тойхон. Принимаем только
   разумные правила: процент до ста, сумма и лимит в рамках, дата календарная. */
export function cleanPromoList(list) {
  const rows = [];
  const seen = new Set();
  for (const raw of (Array.isArray(list) ? list.slice(0, 200) : [])) {
    const code = normalizeCode(raw?.code);
    if (!code) {
      if (String(raw?.code ?? '').trim()) throw new Error(`Некорректный код: «${String(raw.code).trim().slice(0, 30)}»`);
      continue;
    }
    if (seen.has(code)) throw new Error(`Код ${code} повторяется`);
    seen.add(code);

    const kind = raw.kind === 'amount' ? 'amount' : 'percent';
    const value = Math.round(Number(raw.value));
    if (!Number.isFinite(value) || value <= 0) throw new Error(`Укажите размер скидки у кода ${code}`);
    if (kind === 'percent' && value > 100) throw new Error(`Скидка в процентах не больше 100 (${code})`);
    if (kind === 'amount' && value > MAX_AMOUNT) throw new Error(`Слишком большая скидка у кода ${code}`);

    const rawUses = raw.maxUses;
    const maxUses = rawUses === null || rawUses === undefined || rawUses === '' ? null : Math.round(Number(rawUses));
    if (maxUses !== null && (!Number.isFinite(maxUses) || maxUses < 1 || maxUses > MAX_USES)) {
      throw new Error(`Некорректный лимит у кода ${code}`);
    }

    const rawDate = typeof raw.expiresAt === 'string' ? raw.expiresAt.trim() : '';
    const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null;
    if (rawDate && !expiresAt) throw new Error(`Некорректная дата у кода ${code}`);

    rows.push({
      code, kind, value, maxUses, expiresAt,
      active: raw.active !== false,
      comment: String(raw.comment ?? '').trim().slice(0, 200) || null,
    });
  }
  return rows;
}

export async function savePromos(list) {
  return db.savePromos(cleanPromoList(list));
}
