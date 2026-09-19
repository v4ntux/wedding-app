// Цены платформы: значение по умолчанию живёт в коде (manifest шаблона,
// config.js), а админ может переопределить его на ходу — переопределения
// лежат в таблице settings и переживают перезапуск.
//
// Заявка всегда сохраняет цену на момент оформления (template_price,
// total_price), поэтому смена прайса не переписывает историю заказов.

import * as db from './db.js';
import { ADDONS, GUEST_LINK_PRICE } from './config.js';

const KEY = 'pricing';
const MAX_PRICE = 100_000_000;

function read() {
  const raw = db.getSetting(KEY);
  return raw && typeof raw === 'object' ? raw : {};
}

function cleanAmount(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0 || n > MAX_PRICE) return null;
  return n;
}

/* Цена шаблона: переопределение админа или цена из manifest.json. */
export function templatePrice(id, fallback) {
  const over = read().templates?.[id];
  const clean = cleanAmount(over);
  return clean === null ? fallback : clean;
}

/* Шаблон в витрине или спрятан. Переключатель админки лежит поверх
   manifest.json: заводское значение остаётся в файле, решение — в settings.
   Спрятанный шаблон по-прежнему рендерит уже оплаченные ссылки. */
export function templateListed(id, fallback) {
  const over = read().listed?.[id];
  return typeof over === 'boolean' ? over : fallback;
}

/* Именная ссылка для гостя — цена за одного. */
export function guestPrice() {
  const clean = cleanAmount(read().guestLink);
  return clean === null ? GUEST_LINK_PRICE : clean;
}

/* Допфункция (свой домен и т.п.). */
export function addonPrice(id, fallback) {
  const clean = cleanAmount(read().addons?.[id]);
  return clean === null ? fallback : clean;
}

/* Актуальные допфункции с учётом переопределений — для формы и расчёта. */
export function pricedAddons() {
  return ADDONS.map((addon) => ({ ...addon, price: addonPrice(addon.id, addon.price) }));
}

/* Снимок прайса для админки: и текущее значение, и заводское. */
export function pricingSnapshot(templates = []) {
  return {
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      price: t.price,
      defaultPrice: t.basePrice ?? t.price,
      listed: t.listed !== false,
      defaultListed: t.baseListed !== false,
    })),
    guestLink: { price: guestPrice(), defaultPrice: GUEST_LINK_PRICE },
    addons: ADDONS.map((a) => ({ id: a.id, ru: a.ru, uz: a.uz, price: addonPrice(a.id, a.price), defaultPrice: a.price })),
  };
}

/* Сохранение из админки. Принимаем только известные ключи и разумные суммы;
   пустое значение (null) возвращает заводскую цену. */
export async function updatePricing(patch = {}, knownTemplateIds = []) {
  const current = read();
  const next = {
    templates: { ...(current.templates ?? {}) },
    listed: { ...(current.listed ?? {}) },
    addons: { ...(current.addons ?? {}) },
    guestLink: current.guestLink,
  };

  /* Выключатель витрины. null возвращает заводское значение из manifest.json. */
  if (patch.listed && typeof patch.listed === 'object') {
    for (const [id, value] of Object.entries(patch.listed)) {
      if (!knownTemplateIds.includes(id)) continue;
      if (value === null || value === '') { delete next.listed[id]; continue; }
      next.listed[id] = Boolean(value);
    }
  }

  if (patch.templates && typeof patch.templates === 'object') {
    for (const [id, value] of Object.entries(patch.templates)) {
      if (!knownTemplateIds.includes(id)) continue;
      if (value === null || value === '') { delete next.templates[id]; continue; }
      const clean = cleanAmount(value);
      if (clean === null) throw new Error(`Некорректная цена шаблона «${id}»`);
      next.templates[id] = clean;
    }
  }

  if (patch.addons && typeof patch.addons === 'object') {
    for (const [id, value] of Object.entries(patch.addons)) {
      if (!ADDONS.some((a) => a.id === id)) continue;
      if (value === null || value === '') { delete next.addons[id]; continue; }
      const clean = cleanAmount(value);
      if (clean === null) throw new Error(`Некорректная цена опции «${id}»`);
      next.addons[id] = clean;
    }
  }

  if ('guestLink' in patch) {
    if (patch.guestLink === null || patch.guestLink === '') delete next.guestLink;
    else {
      const clean = cleanAmount(patch.guestLink);
      if (clean === null) throw new Error('Некорректная цена именной ссылки');
      next.guestLink = clean;
    }
  }

  (await db.setSetting(KEY, next));
  return next;
}
