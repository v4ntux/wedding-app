// Обложки витрины студии: настоящий кадр каждого дизайна вместо нарисованной
// карточки. Скрипт открывает /demo/<id> в Chromium, снимает сцену открытия
// (или титул после неё — что у темы узнаваемее), режет окно 3:4 и сохраняет
// WebP в public/app/covers/<id>.webp.
//
//   npm start  (в другом окне), затем:
//   node scripts/render-covers.mjs [http://localhost:3000] [id …]
//
// Playwright в зависимости проекта не входит: скрипт берёт его из глобальной
// установки (npm i -g playwright) или из PLAYWRIGHT_MODULE.

import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const modulePath = process.env.PLAYWRIGHT_MODULE || (() => {
  try { return require.resolve('playwright'); } catch { return null; }
})();
if (!modulePath) {
  console.error('Нужен Playwright: npm i -g playwright или PLAYWRIGHT_MODULE=/путь/к/playwright/index.mjs');
  process.exit(1);
}
const pw = await import(modulePath);
const { chromium } = pw.chromium ? pw : pw.default;

const base = (process.argv[2] && /^https?:/.test(process.argv[2]) ? process.argv[2] : 'http://localhost:3000').replace(/\/+$/, '');
const only = process.argv.slice(2).filter((a) => !/^https?:/.test(a));
const out = path.resolve('public/app/covers');
mkdirSync(out, { recursive: true });

// Что снимать: сцену до касания или титул после открытия, и где окно 3:4.
// top — верх окна в долях высоты экрана 390×844.
const SHOTS = {
  darvoza: { at: 'scene', top: 0.13 },
  uzuk: { at: 'hero', top: 0.12 },
  kitob: { at: 'scene', top: 0.2 },
  hikoya: { at: 'hero', top: 0.18 },
  kino: { at: 'hero', top: 0.16 },
  lola: { at: 'scene', top: 0.03 },
  jilo: { at: 'scene', top: 0.17 },
  ipak: { at: 'hero', top: 0.2 },
  xabar: { at: 'scene', top: 0.02 },
  sof: { at: 'hero', top: 0.24 },
  moviy: { at: 'scene', top: 0.22 },
  nozik: { at: 'scene', top: 0.15 },
  oqshom: { at: 'hero', top: 0.2 },
  chizgi: { at: 'hero', top: 0.3 },
  anor: { at: 'hero', top: 0.2 },
};

const W = 390, H = 844, CROP_H = Math.round(W * 4 / 3);
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const config = await (await fetch(`${base}/api/config`)).json();
const ids = (only.length ? only : config.templates.map((t) => t.id)).filter((id) => SHOTS[id] || only.includes(id));

for (const id of ids) {
  const shot = SHOTS[id] || { at: 'hero', top: 0.2 };
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto(`${base}/demo/${id}?lang=uz&__motion_test=1`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1600);
  if (shot.at === 'hero') {
    const trigger = await page.$('[data-envelope-trigger], #env');
    if (trigger) await trigger.click();
    await page.waitForTimeout(6000);
  }
  // Экран блокировки Xabar показывает текущее время гостя; на обложке —
  // время и дату самой свадьбы, иначе картинка навсегда застынет в дне рендера.
  if (id === 'xabar') await page.evaluate(() => {
    const clock = document.querySelector('[data-clock]'); if (clock) clock.textContent = '18:00';
    const today = document.querySelector('[data-today]'), when = document.querySelector('.xb-event span');
    if (today && when) today.textContent = when.textContent.split(' · ')[0];
  });
  // Водяная сетка демо на обложке не нужна.
  await page.addStyleTag({ content: 'div[style*="DEMO"]{display:none!important}' });
  await page.evaluate(() => { for (const el of document.querySelectorAll('div')) if ((el.getAttribute('style') || '').includes('rotate(-18deg)')) el.remove(); });
  const y = Math.max(0, Math.min(H - CROP_H, Math.round(H * shot.top)));
  const png = await page.screenshot({ clip: { x: 0, y, width: W, height: CROP_H } });
  // PNG → WebP силами того же Chromium.
  const webp = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/webp', 0.82).split(',')[1];
  }, png.toString('base64'));
  writeFileSync(path.join(out, `${id}.webp`), Buffer.from(webp, 'base64'));
  console.log(`${id}.webp`, Math.round(Buffer.from(webp, 'base64').length / 1024), 'KB');
  await page.close();
}
await browser.close();
