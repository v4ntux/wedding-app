import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const testDataDir = mkdtempSync(path.join(tmpdir(), 'nvate-test-'));
process.env.NVATE_DATA_DIR = testDataDir;
process.env.DEV_NO_AUTH = '0';
process.env.BOT_TOKEN = 'test-token';
process.env.ADMIN_CHAT_IDS = '';
process.env.NVATE_DISABLE_WATCH = '1';

const dbModule = await import('../src/db.js');
const { validateForm, buildPreviewApp, submitApplication, musicKey, ValidationError } = await import('../src/service.js');
const { renderInvitation, renderDemo } = await import('../src/render.js');
const { publicTemplates, allTemplates } = await import('../src/templateStore.js');
const { slugify, coupleSlugBase } = await import('../src/slug.js');
const { detectFileType, UPLOADS_DIR } = await import('../src/upload.js');
const { publicVenues, allVenues, saveVenues } = await import('../src/venues.js');
const { createServer } = await import('../src/server.js');
const { escapeHtml } = await import('../public/admin/sanitize.js');

mkdirSync(UPLOADS_DIR, { recursive: true });
const photoNames = [
  '11111111-1111-4111-8111-111111111111.png',
  '22222222-2222-4222-8222-222222222222.png',
];
for (const name of photoNames) writeFileSync(path.join(UPLOADS_DIR, name), Buffer.from('test-image'));

const nextYear = new Date().getFullYear() + 1;
const baseForm = (overrides = {}) => ({
  lang: 'ru',
  groomName: 'Алишер',
  brideName: 'Зебо',
  weddingDate: `${nextYear}-10-10`,
  weddingTime: '19:45',
  mapEnabled: true,
  lat: 41.3111,
  lng: 69.2797,
  address: 'Дворец торжеств, Ташкент',
  photos: photoNames,
  musicType: 'itunes',
  musicValue: {
    name: 'Preview Song',
    artist: 'Preview Artist',
    url: 'https://audio-ssl.itunes.apple.com/example.m4a',
  },
  musicStart: 7,
  musicEnd: null,
  templateId: 'oqshom',
  guestNames: [],
  addons: [],
  phone: '+998 90 123 45 67',
  submissionKey: '12345678-1234-4123-8123-123456789abc',
  ...overrides,
});

let server;
let baseUrl;

before(async () => {
  server = createServer({ onNewApplication: async () => {} });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  dbModule.db.close();
  rmSync(testDataDir, { recursive: true, force: true });
});

test('slug generation handles Cyrillic and Uzbek names', () => {
  assert.equal(slugify('Алишер Ўғли'), 'alisher-ogli');
  assert.equal(coupleSlugBase('Али', 'Зебо'), 'ali-and-zebo');
});

test('upload type detection trusts signatures, not filenames', () => {
  assert.deepEqual(detectFileType(Buffer.from([0xff, 0xd8, 0xff, ...Array(12).fill(0)])), { ext: 'jpg', kind: 'image' });
  assert.equal(detectFileType(Buffer.from('not an image payload')), null);
});

const PUBLIC_IDS = ['nafis', 'nur', 'oqshom', 'gulzor', 'marvarid', 'charos', 'shirin', 'deco'];

test('catalog exposes eight designs and keeps the legacy renderer alive', () => {
  assert.deepEqual(publicTemplates().map((template) => template.id), PUBLIC_IDS);
  // Atlas снят с витрины, но оплаченные ссылки на нём обязаны открываться.
  assert.deepEqual(new Set(allTemplates().map((template) => template.id)), new Set([...PUBLIC_IDS, 'atlas']));
});

test('every public design ships the shared finish: envelope, glass and gilded type', () => {
  for (const id of PUBLIC_IDS) {
    const html = renderDemo(id, { lang: 'ru' });
    assert.match(html, /class="ev-env"/, `${id}: нет конверта`);
    assert.match(html, /class="ev-wax"/, `${id}: нет сургучной печати`);
    assert.match(html, /--ev-paper:#[0-9a-f]{6}/i, `${id}: конверт не принял цвет темы`);
    assert.match(html, /gilt-dust/, `${id}: нет золотой пыли`);
    assert.ok((html.match(/glass card fx/g) || []).length >= 2, `${id}: стеклянных карточек меньше двух`);
    assert.match(html, /hero__names fx fx--rise gilt/, `${id}: имена не золотые`);
  }
});

test('each design keeps its own palette — линейка не должна слипаться в одну тему', () => {
  const papers = new Set();
  for (const id of PUBLIC_IDS) {
    const paper = renderDemo(id, { lang: 'ru' }).match(/--paper:(#[0-9a-f]{6})/i)?.[1];
    assert.ok(paper, `${id}: не найдена базовая бумага`);
    papers.add(paper.toLowerCase());
  }
  assert.equal(papers.size, PUBLIC_IDS.length, 'у двух дизайнов совпала палитра');
});

test('each design lays the page out differently — не только цветом', () => {
  // Подача даты — самый заметный узел страницы: у каждого дизайна он свой.
  const dateBlocks = {
    oqshom: /when glass card fx/,
    nafis: /class="nafis-date/,
    nur: /class="nur-date/,
    gulzor: /class="gulzor-date/,
    marvarid: /class="pearl-date/,
    charos: /class="charos-date/,
    shirin: /class="shirin-date/,
    deco: /class="deco-date/,
  };
  for (const [id, pattern] of Object.entries(dateBlocks)) {
    assert.match(renderDemo(id, { lang: 'ru' }), pattern, `${id}: дата подана чужим макетом`);
  }
});

test('all public and legacy templates render in Uzbek, Russian, full and card modes', () => {
  for (const id of allTemplates().map((template) => template.id)) {
    for (const lang of ['uz', 'ru']) {
      for (const card of [false, true]) {
        const html = renderDemo(id, { lang, card });
        assert.ok(html.length > 20_000, `${id}/${lang}/${card} should be a complete page`);
        assert.doesNotMatch(html, /\{\{/);
        assert.match(html, /(?:data-envelope-scene|id="envx")/);
        if (card) assert.match(html, /data-card-preview/);
      }
    }
  }
});

test('personalized preview uses the exact production renderer and order data', () => {
  const app = buildPreviewApp(baseForm());
  const html = renderInvitation(app);
  for (const expected of [
    'Алишер', 'Зебо', `10 октября ${nextYear}`, '19:45', 'Дворец торжеств, Ташкент',
    photoNames[0], 'https://audio-ssl.itunes.apple.com/example.m4a', 'data-envelope-scene',
  ]) assert.ok(html.includes(expected), `missing personalized value: ${expected}`);
});

test('strict validation rejects impossible and past wedding dates', () => {
  assert.throws(() => validateForm(baseForm({ weddingDate: `${nextYear}-02-31` })), ValidationError);
  assert.throws(() => validateForm(baseForm({ weddingDate: `${new Date().getFullYear() - 1}-12-31` })), ValidationError);
  assert.doesNotThrow(() => validateForm(baseForm()));
});

test('submission key makes application creation idempotent', () => {
  const user = { id: 7001, username: 'test_user' };
  const first = submitApplication(baseForm(), user);
  const second = submitApplication(baseForm(), user);
  assert.equal(second.id, first.id);
  assert.equal(second.duplicate, true);
  const count = dbModule.db.prepare('SELECT COUNT(*) AS count FROM applications WHERE tg_user_id = ?').get(user.id).count;
  assert.equal(count, 1);
});

test('phone is the only contact we ask for — Telegram comes from the bot', () => {
  // Телефона нет — заявку не принимаем: подтверждать оплату не по чему.
  assert.throws(
    () => validateForm(baseForm({ phone: '' }), { requirePhone: true }),
    (error) => error instanceof ValidationError && error.step === 'review'
  );
  // Явная опечатка в номере видна сразу, а не после оплаты.
  assert.throws(
    () => validateForm(baseForm({ phone: '123' }), { requirePhone: true }),
    /Некорректный номер/
  );
  const user = { id: 7101, username: 'from_bot' };
  const created = submitApplication(
    baseForm({ submissionKey: '22345678-1234-4123-8123-123456789abc' }),
    user
  ).app;
  // Telegram берём из initData, а не из полей формы.
  assert.equal(created.tg_user_id, 7101);
  assert.equal(created.tg_username, 'from_bot');
});

test('the cut keeps a start and runs to the end of the track', () => {
  const clean = validateForm(baseForm({ musicStart: 12, musicEnd: null }));
  assert.equal(clean.musicStart, 12);
  assert.equal(clean.musicEnd, null);
});

test('a popular start point is only suggested once several couples agree', () => {
  const track = {
    name: 'Shared Song',
    artist: 'Shared Artist',
    url: 'https://audio-ssl.itunes.apple.com/shared.m4a',
  };
  const key = musicKey({ musicType: 'itunes', musicValue: track });
  assert.ok(key);
  assert.equal(dbModule.popularCut(key), null, 'без заявок подсказки быть не должно');

  const submit = (id, start) => submitApplication(baseForm({
    musicValue: track,
    musicStart: start,
    submissionKey: `3234567${id}-1234-4123-8123-123456789abc`,
  }), { id: 7200 + id, username: `cut_${id}` });

  submit(1, 18);
  assert.equal(dbModule.popularCut(key), null, 'одна пара — ещё не рекомендация');

  submit(2, 19);   // та же пятисекундная корзина, что и 18
  submit(3, 44);
  const cut = dbModule.popularCut(key);
  assert.deepEqual(cut, { start: 18, uses: 2 }, 'предлагаем самую раннюю секунду корзины');
});

test('the venue catalog hides drafts from couples and keeps them for the admin', () => {
  saveVenues([
    { id: 'live-one', name: 'Navro‘z', kind: 'toyxona', address: 'Mang‘it', lat: 42.1178, lng: 60.0601, seats: 300 },
    { id: 'draft-one', name: 'Oq saroy', kind: 'toyxona', address: 'Mang‘it', lat: 42.1207, lng: 60.0614, draft: true },
    { name: 'Без точки', kind: 'kafe' },                       // некуда поставить метку
    { id: 'abroad', name: 'Далеко', lat: 10, lng: 10 },        // за пределами страны
  ]);
  assert.deepEqual(allVenues().map((v) => v.id), ['live-one', 'draft-one']);
  assert.deepEqual(publicVenues().map((v) => v.id), ['live-one']);
  assert.equal(publicVenues()[0].seats, 300);
});

test('legacy Atlas applications render Atlas rather than the public master', () => {
  const app = buildPreviewApp(baseForm());
  app.template_id = 'atlas';
  const html = renderInvitation(app);
  assert.ok(html.includes('--anor:#A54B3F'));
  assert.ok(html.includes('id="envx"'));
  assert.ok(!html.includes('couture-hero'));
});

test('an unknown historical template fails visibly instead of rendering the wrong design', () => {
  const app = buildPreviewApp(baseForm());
  app.template_id = 'deleted-template';
  assert.throws(() => renderInvitation(app), /deleted-template/);
});

test('envelope opens in four beats and hands the page over on the dolly', () => {
  const html = renderDemo('oqshom', { lang: 'ru' });
  assert.match(html, /data-envelope-scene/);
  assert.match(html, /class="ev-trigger"/);
  // Печать → клапан → письмо → наезд камеры.
  assert.match(html, /@keyframes evWaxOff/);
  assert.match(html, /@keyframes evFlap/);
  assert.match(html, /@keyframes evLetter/);
  assert.match(html, /@keyframes evDolly/);
});

test('admin pricing overrides the manifest and falls back when cleared', async () => {
  const { templatePrice, guestPrice, updatePricing } = await import('../src/pricing.js');
  const base = allTemplates().find((t) => t.id === 'deco');
  updatePricing({ templates: { deco: 999000 }, guestLink: 25000 }, allTemplates().map((t) => t.id));
  assert.equal(templatePrice('deco', base.basePrice), 999000);
  assert.equal(guestPrice(), 25000);
  assert.equal(publicTemplates().find((t) => t.id === 'deco').price, 999000);
  // Пустое значение возвращает заводскую цену из manifest.json.
  updatePricing({ templates: { deco: null }, guestLink: null }, allTemplates().map((t) => t.id));
  assert.equal(templatePrice('deco', base.basePrice), base.basePrice);
  assert.equal(guestPrice(), 10000);
  assert.throws(() => updatePricing({ templates: { deco: -5 } }, ['deco']), /цена/i);
});

test('music player ships a volume control that remembers the guest choice', async () => {
  const { audioWidget } = await import('../src/blocks.js');
  const widget = audioWidget({ url: 'https://example.com/song.mp3', playable: true, start: 0, end: 0 }, 'ru');
  assert.match(widget, /id="mplayer"/);
  assert.match(widget, /id="mvol"[^>]*type="range"/);
  assert.match(widget, /nv_volume/, 'громкость должна запоминаться между визитами');
  assert.match(widget, /aria-label="Громкость"/);
  // YouTube-режим управляет громкостью через postMessage к плееру.
  const yt = audioWidget({ youtubeId: 'abc123', playable: false, start: 0, end: 0 }, 'ru');
  assert.match(yt, /setVolume/);
  assert.match(yt, /enablejsapi=1/);
});

test('Admin sanitizer neutralizes stored markup and attributes', () => {
  const hostile = `<img src=x onerror="globalThis.pwned=1">'&`;
  const escaped = escapeHtml(hostile);
  assert.equal(escaped, '&lt;img src=x onerror=&quot;globalThis.pwned=1&quot;&gt;&#39;&amp;');
  assert.doesNotMatch(escaped, /<img|onerror="/);
});

test('HTTP catalog and render routes are healthy with security headers', async () => {
  const configResponse = await fetch(`${baseUrl}/api/config`);
  assert.equal(configResponse.status, 200);
  assert.equal(configResponse.headers.get('x-content-type-options'), 'nosniff');
  const config = await configResponse.json();
  assert.deepEqual(config.templates.map((template) => template.id), PUBLIC_IDS);
  assert.deepEqual(config.addons, []);

  for (const id of ['nafis', 'deco']) {
    for (const suffix of ['', '?card=1', '?lang=ru']) {
      const response = await fetch(`${baseUrl}/demo/${id}${suffix}`);
      const html = await response.text();
      assert.equal(response.status, 200);
      assert.doesNotMatch(html, /\{\{/);
    }
  }
  assert.equal((await fetch(`${baseUrl}/demo/not-a-template`)).status, 404);
});

test('payment proofs are not public and require admin authentication', async () => {
  const proofName = 'proof-1-1700000000000.jpg';
  writeFileSync(path.join(UPLOADS_DIR, proofName), Buffer.from([0xff, 0xd8, 0xff, ...Array(12).fill(0)]));
  assert.equal((await fetch(`${baseUrl}/uploads/${proofName}`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/api/admin/proofs/${proofName}`)).status, 403);
});

test('preview and application endpoints reject unauthenticated requests in production mode', async () => {
  for (const route of ['/api/preview', '/api/applications']) {
    const response = await fetch(`${baseUrl}${route}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ initData: '', form: baseForm() }),
    });
    assert.equal(response.status, 401);
  }
});
