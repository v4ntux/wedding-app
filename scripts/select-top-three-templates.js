// Run with DATABASE_URL in the production environment. Default is read-only.
// Add --apply only after verifying the aggregated report and taking a database backup.
// Hiding a template does not delete files or change already-published invitations.
import { db } from '../src/db.js';
import { allTemplates } from '../src/templateStore.js';
import { updatePricing } from '../src/pricing.js';

const apply = process.argv.includes('--apply');
const ranked = await db.prepare(`
  SELECT template_id,
    SUM(CASE WHEN status <> 'cancelled' THEN 1 ELSE 0 END) AS orders,
    SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid
  FROM applications
  WHERE template_id IS NOT NULL
  GROUP BY template_id
  ORDER BY orders DESC, paid DESC, template_id ASC
`).all();
const known = allTemplates();
const knownIds = new Set(known.map((item) => item.id));
const report = ranked.map((row) => ({
  id: String(row.template_id), orders: Number(row.orders),
  paid: Number(row.paid), known: knownIds.has(String(row.template_id)),
}));
const winners = report.filter((row) => row.known && row.orders > 0).slice(0, 3);
console.log(JSON.stringify({ mode: apply ? 'apply' : 'read-only', report, selected: winners }, null, 2));

if (apply) {
  if (winners.length !== 3) throw new Error('Fewer than 3 templates have non-cancelled orders; no changes made.');
  const selected = new Set(winners.map((row) => row.id));
  const listed = Object.fromEntries(known.map((item) => [item.id, selected.has(item.id)]));
  await updatePricing({ listed }, known.map((item) => item.id));
  console.log('Catalog visibility updated. Original template files were preserved.');
}
await db.close();
