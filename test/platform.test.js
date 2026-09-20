import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const testDataDir = mkdtempSync(path.join(tmpdir(), 'nvate-test-'));
process.env.NVATE_DATA_DIR = testDataDir;
process.env.DEV_NO_AUTH = '0';
process.env.BOT_TOKEN = 'test-token';
process.env.ADMIN_CHAT_IDS = '';
process.env.NVATE_DISABLE_WATCH = '1';
process.env.BASE_URL = 'https://nvate.uz';
process.env.YOUTUBE_API_KEY = '';
// Only an explicitly named disposable database may be used by tests.
process.env.DATABASE_URL = process.env.NVATE_TEST_DATABASE_URL || '';
delete process.env.NVATE_MIGRATE_SQLITE;
delete process.env.RAILWAY_ENVIRONMENT;
delete process.env.MUSIC_STORAGE;

/* Наружу тесты не ходят: YouTube и Audius отвечают подготовленными ответами.
   Незаданный адрес ведёт себя как упавший источник. */
const REMOTE = new Map();
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input?.url ?? input);
  if (!/^https:\/\/(?:www\.youtube\.com|api\.audius\.co)\//.test(url)) return realFetch(input, init);
  const handler = [...REMOTE].find(([prefix]) => url.startsWith(prefix))?.[1];
  return handler ? handler(url, init) : new Response('offline', { status: 503 });
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
REMOTE.set('https://www.youtube.com/oembed', (url) => {
  const id = new URL(url).searchParams.get('url').slice(-11);
  return id === 'privatevid1'
    ? new Response('', { status: 401 })
    : json({ title: 'Ibrohim Nurmatov - Oh sevaman yor', author_name: 'Ibrohim Nurmatov' });
});

const dbModule = await import('../src/db.js');
const { validateForm, buildPreviewApp, submitApplication, ValidationError } = await import('../src/service.js');
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
  music: {
    provider: 'youtube', trackId: 'EFUAY_KiRt0', title: 'Oh sevaman yor', artist: 'Ibrohim Nurmatov',
    duration: 222, startAt: 74.35, volume: 1,
  },
  templateId: 'oqshom',
  guestNames: [],
  addons: [],
  phone: '+998 90 123 45 67',
  submissionKey: '12345678-1234-4123-8123-123456789abc',
  ...overrides,
});

const signedInitData = (user) => {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user) });
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN).digest();
  params.set('hash', crypto.createHmac('sha256', secret).update(check).digest('hex'));
  return params.toString();
};

let server;
let baseUrl;

before(async () => {
  server = createServer({ onNewApplication: async () => {} });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  (await dbModule.db.close());
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

const PUBLIC_IDS = ['nafis', 'chizgi', 'oqshom', 'gulzor', 'anor', 'charos', 'deco'];
const HIDDEN_IDS = ['nur', 'marvarid', 'shirin', 'atlas'];

test('catalog exposes seven designs and keeps the legacy renderer alive', () => {
  assert.deepEqual(publicTemplates().map((template) => template.id), PUBLIC_IDS);
  // Снятые с витрины темы не предлагаются парам, но оплаченные ссылки на них
  // обязаны открываться — поэтому они остаются в allTemplates().
  assert.deepEqual(new Set(allTemplates().map((template) => template.id)), new Set([...PUBLIC_IDS, ...HIDDEN_IDS]));
  for (const id of HIDDEN_IDS) assert.equal(allTemplates().find((t) => t.id === id).listed, false, `${id} должен быть скрыт`);
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
    chizgi: /class="chizgi-date/,
    anor: /class="anor-date/,
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
    photoNames[0], "var id='EFUAY_KiRt0',s=74.35", 'seekTo(s,true)', 'data-envelope-scene',
  ]) assert.ok(html.includes(expected), `missing personalized value: ${expected}`);
});

test('strict validation rejects impossible and past wedding dates', () => {
  assert.throws(() => validateForm(baseForm({ weddingDate: `${nextYear}-02-31` })), ValidationError);
  assert.throws(() => validateForm(baseForm({ weddingDate: `${new Date().getFullYear() - 1}-12-31` })), ValidationError);
  assert.doesNotThrow(() => validateForm(baseForm()));
});

test('submission key makes application creation idempotent', async () => {
  const user = { id: 7001, username: 'test_user' };
  const first = (await submitApplication(baseForm(), user));
  const second = (await submitApplication(baseForm(), user));
  assert.equal(second.id, first.id);
  assert.equal(second.duplicate, true);
  const count = (await dbModule.db.prepare('SELECT COUNT(*) AS count FROM applications WHERE tg_user_id = ?').get(user.id)).count;
  assert.equal(count, 1);
});

test('concurrent submissions return one order with a numeric Telegram ID', async () => {
  const form = baseForm({ submissionKey: 'abcdefab-1234-4123-8123-123456789abc' });
  const user = { id: 4503599627370000, username: 'concurrency_test' };
  const results = await Promise.all(Array.from({ length: 5 }, () => submitApplication(form, user)));
  assert.equal(new Set(results.map((r) => r.id)).size, 1);
  assert.equal(results[0].app.tg_user_id, user.id);
});

test('payment is atomic, concurrent confirmations cannot duplicate guest links', async () => {
  const { payApplication, cancelApplication } = await import('../src/service.js');
  const first = await submitApplication(baseForm({
    submissionKey: 'abcdefac-1234-4123-8123-123456789abc', guestNames: ['Aziz', 'Азиз'],
  }), { id: 89001 });
  const outcomes = await Promise.allSettled([payApplication(first.id), payApplication(first.id)]);
  assert.equal(outcomes.filter((r) => r.status === 'fulfilled').length, 1);
  const paid = await dbModule.getApplication(first.id);
  const guests = await dbModule.listGuests(first.id);
  assert.equal(paid.status, 'paid');
  assert.equal(guests.length, 2);
  assert.equal(new Set(guests.map((g) => g.slug)).size, 2);
  assert.equal((await fetch(`${baseUrl}/${paid.slug}/${guests[0].slug}`)).status, 200);
  const orders = await dbModule.listRecentOrders();
  assert.equal(orders.find((a) => a.id === first.id).guests.length, 2);
  assert.equal((await dbModule.adminStats()).totals.paid, 1);
  await assert.rejects(cancelApplication(first.id), ValidationError);

  const second = await submitApplication(baseForm({ submissionKey: 'abcdefad-1234-4123-8123-123456789abc' }), { id: 89002 });
  // Simulate failure after a payment update: the committed status must remain new.
  await assert.rejects(dbModule.transaction(async () => {
    await dbModule.markPaid(second.id, 'rollback-test');
    await dbModule.insertGuest(-999999, 'invalid foreign key', 'invalid');
  }));
  assert.equal((await dbModule.getApplication(second.id)).status, 'new');
  const next = await payApplication(second.id);
  assert.notEqual(next.app.slug, paid.slug, 'same couple names must get distinct links');
});

test('phone is the only contact we ask for — Telegram comes from the bot', async () => {
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
  const created = (await submitApplication(
    baseForm({ submissionKey: '22345678-1234-4123-8123-123456789abc' }),
    user
  )).app;
  // Telegram берём из initData, а не из полей формы.
  assert.equal(created.tg_user_id, 7101);
  assert.equal(created.tg_username, 'from_bot');
});

test('a chosen song keeps its provider, id and exact start — nothing else is trusted', () => {
  const clean = validateForm(baseForm());
  assert.deepEqual(
    [clean.musicType, clean.musicValue, clean.musicStart, clean.musicEnd, clean.musicMeta.volume],
    ['youtube', 'EFUAY_KiRt0', 74.35, null, 1],
  );
  assert.equal(clean.musicMeta.cover, 'https://i.ytimg.com/vi/EFUAY_KiRt0/mqdefault.jpg', 'обложка YouTube — по id, а не от клиента');

  const song = (patch) => baseForm({ music: { ...baseForm().music, ...patch } });
  const rejects = (patch, pattern) => assert.throws(
    () => validateForm(song(patch)),
    (error) => error instanceof ValidationError && error.step === 'music' && pattern.test(error.message),
    JSON.stringify(patch),
  );
  rejects({ provider: 'spotify' }, /заново/);
  rejects({ trackId: 'not a video' }, /заново/);
  rejects({ provider: 'audius', trackId: '../../etc' }, /заново/);
  rejects({ startAt: -1 }, /Начало/);
  rejects({ startAt: 222 }, /Начало/);
  rejects({ startAt: 'soon' }, /Начало/);
  rejects({ duration: 0 }, /длину/);
  rejects({ volume: 3 }, /громкость/);
  // Произвольный адрес звука не принимается ни в каком виде.
  assert.throws(() => validateForm(baseForm({ music: null, musicType: 'custom', musicValue: 'https://evil.example/a.mp3' })), ValidationError);
  assert.equal(validateForm(baseForm({ music: null })).musicType, 'none');
  assert.equal(validateForm(song({ title: `<b>${'x'.repeat(300)}` })).musicMeta.title.length, 120);
});

test('a popular start point is only suggested once several couples agree', async () => {
  const submit = async (id, startAt) => submitApplication(baseForm({
    music: { ...baseForm().music, trackId: 'popularSong', startAt },
    submissionKey: `3234567${id}-1234-4123-8123-123456789abc`,
  }), { id: 7200 + id, username: `cut_${id}` });
  assert.equal(await dbModule.popularCut('youtube', 'popularSong'), null, 'без заявок подсказки быть не должно');

  await submit(1, 18.4);
  assert.equal(await dbModule.popularCut('youtube', 'popularSong'), null, 'одна пара — ещё не рекомендация');

  await submit(2, 19);   // та же пятисекундная корзина, что и 18.4
  await submit(3, 44);
  assert.deepEqual(await dbModule.popularCut('youtube', 'popularSong'), { start: 18, uses: 2 }, 'предлагаем самую раннюю секунду корзины');
  const hint = await (await fetch(`${baseUrl}/api/music/hint?provider=youtube&id=popularSong`)).json();
  assert.deepEqual(hint.hint, { start: 18, uses: 2 });
  assert.equal((await fetch(`${baseUrl}/api/music/hint?provider=youtube&id=bad`)).status, 400);
});

test('the venue catalog hides drafts from couples and keeps them for the admin', async () => {
  (await saveVenues([
    { id: 'live-one', name: 'Navro‘z', kind: 'toyxona', address: 'Mang‘it', lat: 42.1178, lng: 60.0601, seats: 300 },
    { id: 'draft-one', name: 'Oq saroy', kind: 'toyxona', address: 'Mang‘it', lat: 42.1207, lng: 60.0614, draft: true },
    { name: 'Без точки', kind: 'kafe' },                       // некуда поставить метку
    { id: 'abroad', name: 'Далеко', lat: 10, lng: 10 },        // за пределами страны
  ]));
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
  (await updatePricing({ templates: { deco: 999000 }, guestLink: 25000 }, allTemplates().map((t) => t.id)));
  assert.equal(templatePrice('deco', base.basePrice), 999000);
  assert.equal(guestPrice(), 25000);
  assert.equal(publicTemplates().find((t) => t.id === 'deco').price, 999000);
  // Пустое значение возвращает заводскую цену из manifest.json.
  (await updatePricing({ templates: { deco: null }, guestLink: null }, allTemplates().map((t) => t.id)));
  assert.equal(templatePrice('deco', base.basePrice), base.basePrice);
  assert.equal(guestPrice(), 10000);
  await assert.rejects(updatePricing({ templates: { deco: -5 } }, ['deco']), /цена/i);
});

test('the admin switch hides a design from the shelf and brings it back', async () => {
  const { updatePricing } = await import('../src/pricing.js');
  const ids = allTemplates().map((t) => t.id);

  // Выключили — тема исчезла из витрины, но осталась в каталоге рендера.
  (await updatePricing({ listed: { deco: false } }, ids));
  assert.equal(publicTemplates().some((t) => t.id === 'deco'), false, 'deco остался в витрине');
  assert.equal(allTemplates().find((t) => t.id === 'deco').listed, false);
  assert.ok(allTemplates().some((t) => t.id === 'deco'), 'deco пропал из каталога рендера');

  // Включили скрытую заводскую тему — она появилась у пар.
  (await updatePricing({ listed: { nur: true } }, ids));
  assert.ok(publicTemplates().some((t) => t.id === 'nur'), 'nur не вернулся в витрину');

  // Пустое значение возвращает заводское из manifest.json.
  (await updatePricing({ listed: { deco: null, nur: null } }, ids));
  assert.ok(publicTemplates().some((t) => t.id === 'deco'));
  assert.equal(publicTemplates().some((t) => t.id === 'nur'), false);
});

test('the invitation player starts at the exact second and waits for a tap when autoplay is blocked', async () => {
  const { audioWidget } = await import('../src/blocks.js');
  const widget = audioWidget({ kind: 'audio', url: '/api/music/audio/nvate/7', start: 74.35, end: 0, volume: 0.6 }, 'ru');
  assert.match(widget, /id="mplayer"/);
  assert.match(widget, /id="mvol"[^>]*type="range"/);
  assert.match(widget, /nv_volume/, 'громкость гостя запоминается между визитами');
  // Первый визит: в хранилище пусто, и регулятор обязан встать на 70, а не на Number(null) === 0.
  const vm = await import('node:vm');
  const volumeScript = widget.match(/<script>([\s\S]*?)<\/script>/)[1];
  const nodes = {};
  const element = (id) => (nodes[id] ??= {
    id, value: '', style: { setProperty() {} }, classList: { add() {}, remove() {}, contains: () => false },
    addEventListener() {}, getBoundingClientRect: () => ({ top: 0 }), play: () => Promise.resolve(), pause() {},
  });
  vm.runInNewContext(volumeScript, {
    document: { getElementById: element, querySelector: () => null, addEventListener() {}, removeEventListener() {} },
    localStorage: { getItem: () => null, setItem() {} },
    window: {}, addEventListener() {}, innerHeight: 800, requestAnimationFrame() {}, setTimeout, clearTimeout, setInterval, clearInterval, Date,
  });
  assert.equal(Number(nodes.mvol.value), 70, 'первый визит гостя — не немой');
  assert.match(widget, /aria-label="Громкость"/);
  // iOS не перематывает до метаданных: старт задаётся и фрагментом, и после loadedmetadata.
  assert.match(widget, /src="\/api\/music\/audio\/nvate\/7#t=74\.35"/);
  assert.match(widget, /s=74\.35/);
  assert.match(widget, /addEventListener\('loadedmetadata',seek\)/);
  assert.match(widget, /mv=0\.6/, 'громкость, заданная парой, — доля от громкости гостя');
  assert.match(widget, /NotAllowedError[\s\S]*waitTap/, 'запрет автозапуска ждёт касания, а не молчит');
  assert.doesNotMatch(widget, /a\.loop=true/, 'петля с 0:00 перескакивала через выбранное начало');
  assert.match(widget, /addEventListener\('ended'/);

  const yt = audioWidget({ kind: 'youtube', videoId: 'EFUAY_KiRt0', start: 74.35, volume: 1 }, 'uz');
  assert.match(yt, /youtube\.com\/iframe_api/, 'официальный IFrame Player API');
  assert.match(yt, /new YT\.Player/);
  assert.match(yt, /start:Math\.floor\(s\)/);
  assert.match(yt, /seekTo\(s,true\)/, 'дробное начало — через seekTo');
  assert.match(yt, /setVolume/);
  assert.doesNotMatch(yt, /to‘lqin|волн/i, 'никаких технических оговорок для гостя');
  assert.equal(audioWidget({ kind: 'youtube', videoId: `'"><script>`, start: 0 }), '', 'разметка вместо id не проходит');
});

test('old invitations keep playing: uploaded files, YouTube links, iTunes and direct mp3', () => {
  const base = buildPreviewApp(baseForm({ music: null }));
  const render = (patch) => renderInvitation({ ...base, ...patch });
  assert.match(render({ music_type: 'upload', music_value: '33333333-3333-4333-8333-333333333333.mp3', music_start: 20 }),
    /src="\/uploads\/33333333-3333-4333-8333-333333333333\.mp3#t=20"/);
  assert.match(render({ music_type: 'youtube', music_value: 'https://www.youtube.com/watch?v=EFUAY_KiRt0', music_start: 12 }), /var id='EFUAY_KiRt0',s=12/);
  assert.match(render({
    music_type: 'itunes', music_value: JSON.stringify({ name: 'a', artist: 'b', url: 'https://audio-ssl.itunes.apple.com/x.m4a' }), music_start: 7,
  }), /x\.m4a#t=7/);
  assert.match(render({ music_type: 'custom', music_value: 'https://cdn.example/song.mp3' }), /src="https:\/\/cdn\.example\/song\.mp3"/);
  assert.doesNotMatch(render({ music_type: 'nvate', music_value: 'not-an-id' }), /id="mplayer"/, 'битый id — без плеера, а не с ошибкой');
  assert.doesNotMatch(render({ music_type: 'none', music_value: null }), /id="mplayer"/);
});

const id3 = (tag) => Buffer.concat([Buffer.from('ID3'), Buffer.from(tag.padEnd(61, '.'))]);

test('a song sent to the bot lands whole in the couple’s studio and never twice', async () => {
  const music = await import('../src/music.js');
  const meta = { ownerId: 8001, title: 'Yor-yor', artist: 'Ansambl', duration: 214, source: 'bot', tgUniqueId: 'AgADyor' };
  const first = await music.addTrack(id3('yor-yor'), meta);
  const again = await music.addTrack(id3('yor-yor'), meta);
  assert.equal(first.duplicate, false);
  assert.equal(again.duplicate, true, 'повторная пересылка не плодит копии');
  assert.equal(again.track.id, first.track.id);

  const mine = await music.searchUserTracks('', { owner: 8001 });
  assert.deepEqual(mine.items.map((t) => [t.provider, t.title, t.artist, t.duration]), [['upload', 'Yor-yor', 'Ansambl', 214]]);
  assert.equal(mine.items[0].audioUrl, `/uploads/${first.track.file}`);
  assert.equal((await music.searchUserTracks('', { owner: 8002 })).items.length, 0, 'чужие треки не видны');
  assert.equal((await music.searchUserTracks('', {})).items.length, 0, 'без владельца — ничего');
  assert.equal(await music.addTrack(Buffer.from('definitely not an audio file'), { ownerId: 8001, title: 'x' }), null);
  assert.deepEqual(music.metaFromFileName('Shahzoda - Yor-yor_remix.mp3'), { artist: 'Shahzoda', title: 'Yor-yor remix' });
});

test('nVate songs already in invitations keep playing, but the studio no longer offers them', async () => {
  const { saveUpload } = await import('../src/upload.js');
  const saved = saveUpload(id3('kelin-salom'));
  const id = await dbModule.insertLibraryTrack({
    title: 'Kelin salom', artist: 'Ansambl', category: 'wedding', duration: 201.5, storage: 'local', audioKey: saved.file, source: 'nvate',
  });
  assert.equal((await fetch(`${baseUrl}/api/music/search?provider=nvate`)).status, 400, 'в студии nVate больше нет');
  assert.notEqual((await fetch(`${baseUrl}/api/music/tracks`)).status, 200, 'полки библиотеки больше нет');

  const audio = await fetch(`${baseUrl}/api/music/audio/nvate/${id}`, { redirect: 'manual' });
  assert.equal(audio.status, 302);
  assert.equal(audio.headers.get('location'), `/uploads/${saved.file}`);
  const file = await fetch(`${baseUrl}${audio.headers.get('location')}`);
  assert.equal(file.status, 200);
  assert.match(file.headers.get('cache-control'), /immutable/);

  const base = buildPreviewApp(baseForm({ music: null }));
  const html = renderInvitation({ ...base, music_type: 'nvate', music_value: String(id), music_start: 42.5 });
  assert.match(html, new RegExp(`src="/api/music/audio/nvate/${id}#t=42\\.5"`));
});

test('the old shelf moves into the library once, and YouTube downloads stay out', async () => {
  const music = await import('../src/music.js');
  const shelf = await music.addTrack(id3('old-shelf'), { ownerId: 1, title: 'Eski', source: 'admin', library: true });
  const downloaded = await music.addTrack(id3('old-yt'), { title: 'Downloaded', source: 'youtube', library: true });
  assert.equal(await dbModule.migrateLegacyShelf(), 1);
  assert.equal(await dbModule.migrateLegacyShelf(), 0, 'повторный запуск ничего не дублирует');
  assert.ok(await dbModule.libraryTrackByLegacy(shelf.track.id));
  assert.equal(await dbModule.libraryTrackByLegacy(downloaded.track.id), null);
});

test('HTTP: the studio offers YouTube and the couple’s own music; importing needs Telegram', async () => {
  const config = await (await fetch(`${baseUrl}/api/config`)).json();
  assert.deepEqual(config.music.providers.map((p) => p.id), ['youtube', 'upload']);
  assert.equal(typeof config.music.import.link, 'boolean');
  assert.equal(typeof config.music.import.video, 'boolean');
  assert.equal(config.music.maxMediaMb, 60);
  assert.equal(config.downloadEnabled, undefined);

  for (const provider of ['nvate', 'audius', 'spotify']) {
    assert.equal((await fetch(`${baseUrl}/api/music/search?provider=${provider}&q=hi`)).status, 400, provider);
  }
  assert.equal((await fetch(`${baseUrl}/api/music/search?provider=upload`)).status, 401);
  const mine = await (await fetch(`${baseUrl}/api/music/search?provider=upload`, {
    headers: { 'x-init-data': signedInitData({ id: 8001, first_name: 'Bot' }) },
  })).json();
  assert.equal(mine.items[0].title, 'Yor-yor');

  for (const route of ['/api/music/audio/youtube/EFUAY_KiRt0', '/api/music/audio/nvate/abc', '/api/music/audio/audius/..%2F..', '/api/music/audio/upload/evil.mp3']) {
    assert.equal((await fetch(`${baseUrl}${route}`, { redirect: 'manual' })).status, 404, route);
  }
  assert.notEqual((await fetch(`${baseUrl}/api/admin/music`)).status, 200, 'библиотеки в админке больше нет');
  assert.equal((await fetch(`${baseUrl}/api/music/link`, { method: 'POST' })).status, 404);
  const json = { 'content-type': 'application/json' };
  assert.equal((await fetch(`${baseUrl}/api/music/import`, { method: 'POST', headers: json, body: JSON.stringify({ url: 'https://vt.tiktok.com/x/' }) })).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/music/import/abc`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/music/upload`, { method: 'POST', body: id3('x') })).status, 401);
});

test('YouTube search reads the results page and keeps only songs the author lets us embed', async () => {
  const { parseResultsPage, parseDuration, youtubeIdOf } = await import('../src/youtube.js');
  const data = { contents: { list: [
    { videoRenderer: { videoId: 'abcdefghijk', title: { runs: [{ text: 'Yor-yor' }] }, ownerText: { runs: [{ text: 'Shahzoda' }] }, lengthText: { simpleText: '3:45' } } },
    // Прямой эфир: длительности нет — песней не считается.
    { videoRenderer: { videoId: 'livestream1', title: { runs: [{ text: 'Efir' }] } } },
  ] } };
  const html = `<html><script>var ytInitialData = ${JSON.stringify(data)};</script></html>`;
  assert.deepEqual(parseResultsPage(html), [{ id: 'abcdefghijk', title: 'Yor-yor', channel: 'Shahzoda', duration: 225 }]);
  assert.deepEqual(parseResultsPage('<html>капча</html>'), []);
  assert.equal(parseDuration('1:02:03'), 3723);
  assert.equal(youtubeIdOf('https://youtu.be/abcdefghijk?t=3'), 'abcdefghijk');
  assert.equal(youtubeIdOf('EFUAY_KiRt0'), 'EFUAY_KiRt0', 'новые заявки хранят сам id');

  const results = { contents: { list: [
    { videoRenderer: { videoId: 'EFUAY_KiRt0', title: { runs: [{ text: 'Ibrohim Nurmatov - Oh sevaman yor' }] }, ownerText: { runs: [{ text: 'Ibrohim Nurmatov' }] }, lengthText: { simpleText: '3:42' } } },
    // Автор запретил встраивание — плеер его не покажет, в выдачу не берём.
    { videoRenderer: { videoId: 'privatevid1', title: { runs: [{ text: 'Closed' }] }, lengthText: { simpleText: '3:00' } } },
    { videoRenderer: { videoId: 'longconcert', title: { runs: [{ text: 'Concert' }] }, lengthText: { simpleText: '1:20:00' } } },
  ] } };
  REMOTE.set('https://www.youtube.com/results', () => new Response(`<script>var ytInitialData = ${JSON.stringify(results)};</script>`));
  const found = await (await fetch(`${baseUrl}/api/music/search?provider=youtube&q=${encodeURIComponent('oh sevaman')}`)).json();
  assert.deepEqual(
    found.items.map((t) => [t.id, t.title, t.artist, t.duration, t.playback, t.audioUrl]),
    [['EFUAY_KiRt0', 'Oh sevaman yor', 'Ibrohim Nurmatov', 222, 'youtube', undefined]],
    'звук YouTube через сервер не идёт',
  );
  const shortQuery = await (await fetch(`${baseUrl}/api/music/search?provider=youtube&q=o`)).json();
  assert.ok(shortQuery.items.every((t) => t.provider === 'youtube' && t.uses >= 1), 'одна буква — не запрос: вместо выдачи — топ nVate');
  REMOTE.set('https://www.youtube.com/results', () => new Response('<html>капча</html>'));
  const down = await fetch(`${baseUrl}/api/music/search?provider=youtube&q=${encodeURIComponent('boshqa qoshiq')}`);
  assert.equal(down.status, 502, 'заглушка вместо выдачи — «недоступно», а не «ничего не нашлось»');
});

test('«Топ nVate»: songs couples put into invitations, most chosen first, personal files stay private', async () => {
  const { topSongs, forgetTopSongs } = await import('../src/musicTop.js');
  const music = await import('../src/music.js');
  const { saveUpload } = await import('../src/upload.js');
  const choose = (i, song) => submitApplication(baseForm({ music: song, submissionKey: `7234567${i}-1234-4123-8123-123456789abc` }), { id: 8700 + i });
  await choose(1, { provider: 'youtube', trackId: 'topSongAAAA', startAt: 12 });
  await choose(2, { provider: 'youtube', trackId: 'topSongAAAA', startAt: 30 });
  // Звук, скачанный из того же ролика, — та же песня.
  const fromVideo = await music.registerTrack(saveUpload(id3('top-from-video')).file, {
    ownerId: 8703, title: 'Oh sevaman yor', artist: 'Ibrohim', duration: 222, source: 'youtube', sourceId: 'topSongAAAA',
  });
  await choose(3, { provider: 'upload', trackId: fromVideo.file, startAt: 5 });
  // Песня из бота — личная: чужим парам её не показываем.
  const personal = await music.registerTrack(saveUpload(id3('top-personal')).file, { ownerId: 8704, title: 'Oilaviy', source: 'bot' });
  for (const i of [4, 5, 6, 7]) await choose(i, { provider: 'upload', trackId: personal.file, startAt: 0 });

  forgetTopSongs();
  const { items } = await topSongs();
  const song = items.find((item) => item.id === 'topSongAAAA');
  assert.deepEqual([song.uses, song.provider, song.cover], [3, 'youtube', 'https://i.ytimg.com/vi/topSongAAAA/mqdefault.jpg']);
  assert.ok(!items.some((item) => item.id === personal.file || item.title === 'Oilaviy'), 'личные файлы в топ не попадают');
  const counts = items.map((item) => item.uses);
  assert.deepEqual(counts, [...counts].sort((a, b) => b - a), 'сначала то, что выбирают чаще');
  const http = await (await fetch(`${baseUrl}/api/music/search?provider=youtube`)).json();
  assert.ok(http.items.some((item) => item.id === 'topSongAAAA' && item.uses === 3), 'пустой поиск YouTube — это топ');
});

test('«Топ выбор» с YouTube — пик пересмотров после вступления, а не первая секунда', async () => {
  const { parseHeatmap, peakMoment, songMeta, heatCurve } = await import('../src/youtube.js');
  // Сто точек по 2,25 с: начало смотрят все, а переслушивают припев на 1:07.
  const markers = Array.from({ length: 100 }, (_, i) => ({
    startMillis: String(i * 2250),
    durationMillis: '2250',
    intensityScoreNormalized: i === 0 ? 1 : i === 30 ? 0.9 : 0.5 + (i % 3) * 0.01,
  }));
  const html = `<script>var d={"markerType":"MARKER_TYPE_HEATMAP","markers":${JSON.stringify(markers)},"markersMetadata":{}};</script>`;
  assert.equal(peakMoment(parseHeatmap(html)), 65, 'на две секунды раньше пика');
  assert.equal(peakMoment(markers.map((m) => ({ ...m, intensityScoreNormalized: 0.5 }))), null, 'ровный график пика не даёт');
  assert.equal(parseHeatmap('<html>капча</html>'), null);
  // Весь график — для шкалы выбора начала, пока звук ролика не скачан.
  const curve = heatCurve(markers);
  assert.deepEqual([curve.values.length, curve.end, curve.values[30]], [100, 225, 0.9]);
  assert.equal(heatCurve([]), null);
  assert.deepEqual(songMeta('Shahzoda - Yomg‘ir | Шахзода - Ёмгир (AUDIO)', 'Shahzoda'), { title: 'Yomg‘ir', artist: 'Shahzoda' });
  assert.deepEqual(songMeta('Kelin salom [Official Video]', 'Ansambl - Topic'), { title: 'Kelin salom', artist: 'Ansambl' });
});

test('Audius songs already chosen keep one card shape and play through our address', async () => {
  const raw = (id, extra = {}) => ({
    id, title: `Song ${id}`, duration: 201, user: { name: 'Artist' },
    artwork: { '480x480': `https://cdn.example/${id}.jpg` }, is_streamable: true, access: { stream: true }, ...extra,
  });
  REMOTE.set('https://api.audius.co/v1/tracks/search', (url) => (new URL(url).searchParams.get('app_name') === 'nvate'
    ? json({ data: [raw('D7KyD'), raw('Gated', { is_stream_gated: true }), raw('NoLen', { duration: 0 })] })
    : new Response('no app name', { status: 400 })));
  const { searchAudius } = await import('../src/audius.js');
  const found = await searchAudius('piano');
  assert.deepEqual(found.items, [{
    id: 'D7KyD', provider: 'audius', title: 'Song D7KyD', artist: 'Artist', duration: 201,
    cover: 'https://cdn.example/D7KyD.jpg', playback: 'audio', audioUrl: '/api/music/audio/audius/D7KyD',
  }]);
  const stream = await fetch(`${baseUrl}/api/music/audio/audius/D7KyD`, { redirect: 'manual' });
  assert.equal(stream.status, 302);
  assert.equal(stream.headers.get('location'), 'https://api.audius.co/v1/tracks/D7KyD/stream?app_name=nvate');

  REMOTE.set('https://api.audius.co/v1/tracks/D7KyD', () => json({ data: raw('D7KyD') }));
  REMOTE.set('https://api.audius.co/v1/tracks/Remvd', () => new Response('', { status: 404 }));
  const created = await submitApplication(baseForm({
    music: { provider: 'audius', trackId: 'D7KyD', title: 'x', cover: 'javascript:alert(1)', duration: 201, startAt: 30.25, volume: 0.8 },
    submissionKey: '62345671-1234-4123-8123-123456789abc',
  }), { id: 8501 });
  const meta = JSON.parse(created.app.music_meta);
  assert.deepEqual([meta.title, meta.cover, meta.volume], ['Song D7KyD', 'https://cdn.example/D7KyD.jpg', 0.8]);
  const html = renderInvitation(created.app);
  assert.match(html, /src="\/api\/music\/audio\/audius\/D7KyD#t=30\.25"/);
  assert.match(html, /mv=0\.8/);
  await assert.rejects(submitApplication(baseForm({
    music: { provider: 'audius', trackId: 'Remvd', startAt: 0 },
    submissionKey: '62345672-1234-4123-8123-123456789abc',
  }), { id: 8502 }), /недоступна/);

  assert.equal((await fetch(`${baseUrl}/api/music/search?provider=audius&q=other`)).status, 400, 'в студии Audius больше нет');
});

test('studio music core: listening never selects, one phase at a time, no search races', async () => {
  const vm = await import('node:vm');
  const sandbox = { setTimeout, clearTimeout, AbortController, console };
  vm.runInNewContext(readFileSync(new URL('../public/app/music-core.js', import.meta.url), 'utf8'), sandbox);
  const Core = sandbox.NvMusicCore;
  const plain = (value) => JSON.parse(JSON.stringify(value));
  const yt = (id, title, duration = 222) => ({ id, provider: 'youtube', title, artist: 'Ibrohim Nurmatov', duration, cover: null, playback: 'youtube' });

  assert.equal(Core.clock(74.35), '01:14');
  assert.equal(Core.clock(74.35, true), '01:14.3');
  assert.deepEqual(plain(Core.STUDIO_PROVIDERS), ['youtube', 'upload']);
  assert.equal(Core.initialState().provider, 'youtube', 'студия открывается на YouTube');

  const store = Core.createStore(Core.initialState());
  const phases = [];
  store.subscribe((s) => phases.push(s.phase));
  store.dispatch({ type: 'open' });
  store.dispatch({ type: 'search:start', key: 'k1' });
  assert.equal(store.get().phase, 'SEARCHING');
  store.dispatch({ type: 'search:done', key: 'k1', items: [yt('EFUAY_KiRt0', 'Oh sevaman yor'), yt('GYK4g5HNeVo', 'Oh sevaman yor (live)')], next: null });
  assert.equal(store.get().phase, 'RESULTS');
  store.dispatch({ type: 'search:done', key: 'stale', items: [], next: null });
  assert.equal(store.get().search.items.length, 2, 'ответ на старый запрос выдачу не трогает');

  // Послушать A, пауза, послушать B — выбора так и нет.
  store.dispatch({ type: 'preview:load', key: 'youtube:EFUAY_KiRt0' });
  store.dispatch({ type: 'preview:playing', key: 'youtube:EFUAY_KiRt0' });
  store.dispatch({ type: 'preview:paused', key: 'youtube:EFUAY_KiRt0' });
  store.dispatch({ type: 'preview:load', key: 'youtube:GYK4g5HNeVo' });
  store.dispatch({ type: 'preview:playing', key: 'youtube:EFUAY_KiRt0' });
  assert.equal(store.get().preview.status, 'loading', 'событие прежней песни не оживляет новую');
  assert.equal(store.get().phase, 'PREVIEWING');
  assert.equal(store.get().draft, null, 'прослушивание не выбирает песню');
  assert.equal(store.get().saved, null);

  const b = store.get().search.items[1];
  store.dispatch({ type: 'select', track: b, startAt: 0 });
  assert.equal(store.get().phase, 'SELECTED');
  store.dispatch({ type: 'draft:ready', key: 'youtube:GYK4g5HNeVo', duration: 222 });
  assert.equal(store.get().phase, 'CHOOSING_START');
  store.dispatch({ type: 'start', startAt: 500 });
  assert.equal(store.get().draft.startAt, 221.5, 'начало не заходит за конец песни');
  store.dispatch({ type: 'start', startAt: 74.354 });
  assert.equal(store.get().draft.startAt, 74.35);
  store.dispatch({ type: 'save:start' });
  assert.equal(store.get().phase, 'SAVING');
  const selection = Core.toSelection(store.get().draft.track, store.get().draft.startAt);
  store.dispatch({ type: 'save:done', selection });
  assert.equal(store.get().phase, 'SAVED');
  assert.deepEqual(plain(store.get().saved), {
    provider: 'youtube', trackId: 'GYK4g5HNeVo', title: 'Oh sevaman yor (live)', artist: 'Ibrohim Nurmatov',
    cover: null, duration: 222, startAt: 74.35, volume: 1,
  });
  assert.ok(phases.indexOf('PREVIEWING') < phases.indexOf('SELECTED'), 'сначала слушают, потом выбирают');

  // Быстрый набор: ответ «oh s» пришёл позже ответа «oh sevaman» — и выброшен.
  const calls = [];
  const flow = Core.createStore(Core.initialState());
  const search = Core.createSearch({
    store: flow,
    browses: (provider) => provider !== 'youtube',
    request: (params, signal) => new Promise((resolve, reject) => {
      calls.push({ params, signal, resolve });
      signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }),
  });
  flow.dispatch({ type: 'open' });
  flow.dispatch({ type: 'provider', provider: 'youtube' });
  flow.dispatch({ type: 'query', query: 'o' });
  await search.now();
  assert.equal(calls.length, 0, 'одна буква — не запрос');
  assert.equal(flow.get().search.status, 'idle');
  flow.dispatch({ type: 'query', query: 'oh s' });
  const early = search.now();
  flow.dispatch({ type: 'query', query: 'oh sevaman' });
  const late = search.now();
  assert.equal(calls.length, 2);
  assert.equal(calls[0].signal.aborted, true, 'старый запрос отменён');
  calls[1].resolve({ items: [yt('EFUAY_KiRt0', 'Oh sevaman yor')], next: 1 });
  calls[0].resolve({ items: [yt('staleResul1', 'stale')], next: null });
  await Promise.all([early, late]);
  assert.deepEqual(plain(flow.get().search.items.map((t) => t.id)), ['EFUAY_KiRt0']);
  const more = search.more();
  assert.equal(calls[2].params.page, 1);
  calls[2].resolve({ items: [yt('EFUAY_KiRt0', 'dup'), yt('GYK4g5HNeVo', 'next')], next: null });
  await more;
  assert.deepEqual(plain(flow.get().search.items.map((t) => t.id)), ['EFUAY_KiRt0', 'GYK4g5HNeVo'], '«Yana ko‘rsatish» дописывает без повторов');

  // Черновики прошлых версий и адрес звука из выбора.
  assert.equal(Core.migrateDraftMusic({ type: 'itunes', value: {} }, 7), null);
  assert.equal(Core.migrateDraftMusic({ type: 'youtube', value: 'https://youtu.be/EFUAY_KiRt0', name: 'Oh', artist: 'YouTube · Ibrohim' }, 12).trackId, 'EFUAY_KiRt0');
  assert.equal(Core.migrateDraftMusic({ type: 'upload', value: '33333333-3333-4333-8333-333333333333.mp3', name: 'Yor', duration: 200 }, 30).startAt, 30);
  assert.equal(Core.trackFromSelection({ provider: 'nvate', trackId: '7', duration: 100 }).audioUrl, '/api/music/audio/nvate/7');
  assert.equal(Core.trackFromSelection({ provider: 'youtube', trackId: 'EFUAY_KiRt0' }).audioUrl, undefined);
  assert.equal(Core.normalizeSelection({ provider: 'nvate', trackId: '7', cover: 'javascript:alert(1)' }).cover, null);

  // Звук ролика скачан: черновик переезжает на свою песню с тем же началом.
  const file = '44444444-4444-4444-8444-444444444444.mp3';
  const own = { id: file, provider: 'upload', title: 'Oh sevaman yor', artist: 'Ibrohim Nurmatov', duration: 221.4, cover: null, playback: 'audio', audioUrl: `/uploads/${file}` };
  const swap = Core.createStore(Core.initialState());
  swap.dispatch({ type: 'select', track: yt('EFUAY_KiRt0', 'Oh sevaman yor'), startAt: 64 });
  swap.dispatch({ type: 'draft:ready', key: 'youtube:EFUAY_KiRt0', duration: 222 });
  swap.dispatch({ type: 'draft:swap', key: 'youtube:stale000000', track: own });
  assert.equal(swap.get().draft.track.provider, 'youtube', 'ответ для другой песни черновик не трогает');
  swap.dispatch({ type: 'draft:swap', key: 'youtube:EFUAY_KiRt0', track: own });
  assert.deepEqual(plain([swap.get().draft.track.provider, swap.get().draft.startAt, swap.get().draft.ready]), ['upload', 64, true]);
  swap.dispatch({ type: 'provider', provider: 'nvate' });
  assert.equal(swap.get().provider, 'youtube', 'nVate в студии не выбрать');

  // Задачи импорта: одна очередь в состоянии шага, прогресс в пределах 0…1.
  swap.dispatch({ type: 'import:add', job: { id: 'j1', status: 'working', progress: 2, label: 'TikTok', auto: true } });
  assert.equal(swap.get().imports[0].progress, 1);
  swap.dispatch({ type: 'back' });
  assert.equal(swap.get().phase, 'IMPORTING');
  swap.dispatch({ type: 'import:update', job: { id: 'j1', status: 'done', track: own, auto: false } });
  assert.deepEqual(plain([swap.get().imports[0].status, swap.get().imports[0].auto, swap.get().imports[0].track.id]), ['done', true, file]);
  swap.dispatch({ type: 'import:remove', id: 'j1' });
  assert.equal(swap.get().imports.length, 0);
});

test('magic import: a link or a video becomes the couple’s own song and is never fetched twice', async () => {
  const { readFile, writeFile } = await import('node:fs/promises');
  const extract = await import('../src/extract.js');
  const imports = await import('../src/musicImport.js');
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(40).fill(7)]);
  const brand = (name) => Buffer.concat([Buffer.from([0, 0, 0, 32]), Buffer.from(`ftyp${name}`), Buffer.alloc(20)]);
  const runs = [];
  extract.useLookup(async (host) => [{ address: host.endsWith('.lan.example') ? '192.168.1.20' : '203.0.113.9', family: 4 }]);
  extract.useRunner(async (bin, args, { onLine } = {}) => {
    if (args.includes('--version') || args.includes('-version')) return { code: 0, stdout: 'test', stderr: '' };
    runs.push([bin, args]);
    if (bin === 'ffmpeg' && !args.includes('-map')) {
      return { code: 1, stdout: '', stderr: '  Duration: 00:03:21.50, start: 0.000000, bitrate: 128 kb/s' };
    }
    if (bin === 'ffmpeg') {
      const input = await readFile(args[args.indexOf('-i') + 1]);
      if (input.includes('silent')) return { code: 1, stdout: '', stderr: "Stream map '0:a:0' matches no streams." };
      await writeFile(args.at(-1), id3('from-video'));
      return { code: 0, stdout: '', stderr: '' };
    }
    const url = args.at(-1);
    if (url.includes('private')) return { code: 1, stdout: '', stderr: 'ERROR: [Instagram] p1: Requested content is not available, login required' };
    const template = args[args.indexOf('-o') + 1];
    await writeFile(template.replace('%(ext)s', 'mp3'), id3(`link-${url}`));
    await writeFile(template.replace('%(ext)s', 'jpg'), jpeg);
    onLine?.('[download]  42.0% of 3.10MiB at 1.20MiB/s');
    onLine?.('[ExtractAudio] Destination: media.mp3');
    onLine?.(JSON.stringify({ id: 'v1', title: 'Yor-yor', uploader: 'Shahzoda', duration: 201 }));
    return { code: 0, stdout: '', stderr: '' };
  });
  try {
    const first = await imports.importLink(9101, 'смотрите https://vt.tiktok.com/ZSabc123/ #fyp');
    assert.equal(first.site, 'tiktok');
    const done = await imports.waitForImport(first.id);
    assert.equal(done.status, 'done', done.error);
    assert.deepEqual([done.track.provider, done.track.title, done.track.artist, done.track.duration], ['upload', 'Yor-yor', 'Shahzoda', 201.5]);
    assert.match(done.track.audioUrl, /^\/uploads\/[0-9a-f-]{36}\.mp3$/);
    assert.match(done.track.cover, /^\/uploads\/[0-9a-f-]{36}\.jpg$/, 'обложка — картинка ролика у нас, а не чужая ссылка');
    const ytdlp = runs.find(([bin]) => bin === 'yt-dlp')[1];
    assert.ok(ytdlp.includes('default,-generic'), 'произвольные страницы yt-dlp не открывает');
    assert.equal(ytdlp.at(-2), '--', 'ссылка не может стать ключом команды');

    const fetched = runs.filter(([bin]) => bin === 'yt-dlp').length;
    const again = await imports.importLink(9101, 'https://vt.tiktok.com/ZSabc123/');
    assert.deepEqual([again.status, again.track.id], ['done', done.track.id]);
    const other = await imports.importLink(9102, 'https://vt.tiktok.com/ZSabc123/');
    assert.equal(other.track.id, done.track.id, 'другая пара получает тот же файл без скачивания');
    assert.equal(runs.filter(([bin]) => bin === 'yt-dlp').length, fetched);
    assert.equal(imports.importJob(9102, first.id), null, 'чужую задачу не показываем');

    const yt = await imports.waitForImport((await imports.importLink(9101, 'https://youtu.be/EFUAY_KiRt0?t=3')).id);
    assert.equal(yt.track.cover, 'https://i.ytimg.com/vi/EFUAY_KiRt0/mqdefault.jpg');
    assert.equal((await imports.importYoutube(9101, 'EFUAY_KiRt0')).track.id, yt.track.id, 'ссылка и id ролика — одна песня');

    const closed = await imports.waitForImport((await imports.importLink(9101, 'https://www.instagram.com/p/private1/')).id);
    assert.deepEqual([closed.status, closed.error], ['error', 'private']);
    for (const bad of ['ftp://example.com/a.mp3', 'http://127.0.0.1:3000/x', 'http://10.1.2.3/v.mp4', 'https://cam.lan.example/v', 'http://localhost/x', 'просто текст']) {
      await assert.rejects(imports.importLink(9101, bad), (error) => error.code === 'link', bad);
    }

    const video = await imports.waitForImport((await imports.importVideo(9101, Buffer.from('fake mp4 with sound'), { title: 'To‘y video' })).id);
    assert.deepEqual([video.status, video.track.title, video.track.duration], ['done', 'To‘y video', 201.5]);
    const silent = await imports.waitForImport((await imports.importVideo(9101, Buffer.from('silent clip'), {})).id);
    assert.deepEqual([silent.status, silent.error], ['error', 'noaudio']);

    assert.equal(extract.mediaKind(brand('M4A ')), 'audio');
    assert.equal(extract.mediaKind(brand('isom')), 'video');
    assert.equal(extract.mediaKind(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, ...Array(20).fill(0)])), 'video');
    assert.equal(extract.mediaKind(id3('x')), 'audio');
    assert.equal(extract.mediaKind(jpeg), null);
    assert.equal(extract.importErrorOf({ stderr: 'ERROR: [youtube] x: Sign in to confirm you’re not a bot' }), 'blocked');
    assert.equal(extract.importErrorOf({ error: Object.assign(new Error('spawn'), { code: 'ENOENT' }) }), 'unavailable');
    assert.equal(extract.siteOf('https://www.instagram.com/reel/abc/'), 'instagram');

    const auth = { 'x-init-data': signedInitData({ id: 9103, first_name: 'Import' }) };
    const json = { ...auth, 'content-type': 'application/json' };
    const started = await (await fetch(`${baseUrl}/api/music/import`, { method: 'POST', headers: json, body: JSON.stringify({ url: 'https://www.tiktok.com/@a/video/42' }) })).json();
    assert.equal(started.ok, true);
    await imports.waitForImport(started.job.id);
    const polled = await (await fetch(`${baseUrl}/api/music/import/${started.job.id}`, { headers: auth })).json();
    assert.equal(polled.job.status, 'done');
    const stranger = { 'x-init-data': signedInitData({ id: 9104, first_name: 'Other' }) };
    assert.equal((await fetch(`${baseUrl}/api/music/import/${started.job.id}`, { headers: stranger })).status, 404);
    const badLink = await fetch(`${baseUrl}/api/music/import`, { method: 'POST', headers: json, body: JSON.stringify({ url: 'http://localhost/x' }) });
    assert.deepEqual([badLink.status, (await badLink.json()).error], [400, 'link']);
    const song = await (await fetch(`${baseUrl}/api/music/upload`, {
      method: 'POST', headers: { ...auth, 'x-file-name': encodeURIComponent('Ansambl - Yor-yor.mp3') }, body: id3('upload-song'),
    })).json();
    assert.deepEqual([song.track.provider, song.track.title, song.track.artist], ['upload', 'Yor-yor', 'Ansambl']);
    const clip = await (await fetch(`${baseUrl}/api/music/upload`, { method: 'POST', headers: auth, body: brand('isom') })).json();
    assert.equal(clip.job.kind, 'video');
    assert.equal((await imports.waitForImport(clip.job.id)).status, 'done');
  } finally {
    extract.useRunner(null);
    extract.useLookup(null);
  }
});

test('the database opens again after a restart: every migration can run twice', async () => {
  const { spawnSync } = await import('node:child_process');
  const dir = mkdtempSync(path.join(tmpdir(), 'nvate-restart-'));
  try {
    const env = { ...process.env, NVATE_DATA_DIR: dir, DATABASE_URL: '' };
    const script = "const { db } = await import('./src/storage.js'); await db.close();";
    for (const start of ['первый', 'второй']) {
      const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: new URL('..', import.meta.url), env, encoding: 'utf8' });
      assert.equal(run.status, 0, `${start} запуск: ${run.stderr}`);
    }
    const { DatabaseSync } = await import('node:sqlite');
    const sqlite = new DatabaseSync(path.join(dir, 'wedding.db'), { readOnly: true });
    const indexes = sqlite.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'tracks'").all();
    sqlite.close();
    assert.ok(indexes.some((index) => index.name === 'tracks_by_source'));
    assert.ok(!indexes.some((index) => /UNIQUE/i.test(index.sql || '') && /source_id/.test(index.sql || '')),
      'одна ссылка у двух пар — две строки: уникального индекса по источнику нет');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('R2/S3 links are signed on the server with AWS Signature V4', async () => {
  const { presign, validKey } = await import('../src/objectStore.js');
  // Пример из документации AWS «Authenticating Requests: Using Query Parameters».
  const url = presign({
    host: 'examplebucket.s3.amazonaws.com', pathname: '/test.txt', region: 'us-east-1',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    expires: 86400, now: new Date('2013-05-24T00:00:00Z'),
  });
  assert.match(url, /X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404$/);
  assert.equal(validKey('music/0b9c3b9e-1f5a-4c7e-9d1a-2b3c4d5e6f70.mp3'), true);
  assert.equal(validKey('../secret.txt'), false);
});

test('an invitation names the venue kind and landmark from the catalog, not from the form', async () => {
  await saveVenues([{ id: 'saroy', name: 'Oq saroy', kind: 'toyxona', address: 'Mang‘it, bozor yonida', lat: 42.1207, lng: 60.0614 }]);
  const chosen = renderInvitation(buildPreviewApp(baseForm({ venueId: 'saroy', address: 'Oq saroy' })));
  assert.match(chosen, /class="venue__meta">Тойхона · Mang‘it, bozor yonida</);
  const manual = renderInvitation(buildPreviewApp(baseForm({ venueId: 'no-such-place' })));
  assert.doesNotMatch(manual, /class="venue__meta"/, 'своё место — без чужой подписи');
});

test('the paid couple gets a QR card drawn into the nvate.uz frame', async () => {
  const { renderShareCard } = await import('../src/share.js');
  const { PNG } = await import('pngjs');
  const card = PNG.sync.read(renderShareCard('https://nvate.uz/alisher-and-zebo'));
  const frame = PNG.sync.read(readFileSync('public/assets/share/qr-frame.png'));
  assert.equal(card.width, frame.width);
  assert.equal(card.height, frame.height);
  const rgb = (png, x, y) => [...png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 3)];
  let ink = 0;
  let total = 0;
  for (let y = 610; y < 1068; y += 3) {
    for (let x = 330; x < 790; x += 3) {
      const [r, , b] = rgb(card, x, y);
      if (r < 190 && b < 120) ink += 1;
      total += 1;
    }
  }
  assert.ok(ink / total > 0.25 && ink / total < 0.75, `код заполняет квадрат наполовину, а не ${ink / total}`);
  assert.deepEqual(rgb(card, 40, 40), rgb(frame, 40, 40), 'цветы и рамка остаются нетронутыми');
});

test('the railway address moves to nvate.uz while health checks stay put', async () => {
  const { request } = await import('node:http');
  const get = (pathname, host) => new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: server.address().port, path: pathname, headers: { Host: host } }, (res) => {
      res.resume();
      resolve(res);
    });
    req.on('error', reject);
    req.end();
  });
  const moved = await get('/alisher-and-zebo?from=qr', 'nvate.up.railway.app');
  assert.equal(moved.statusCode, 301);
  assert.equal(moved.headers.location, 'https://nvate.uz/alisher-and-zebo?from=qr');
  assert.equal((await get('/health', 'nvate.up.railway.app')).statusCode, 200);
  assert.equal((await get('/app/', 'nvate.uz')).statusCode, 200);
});

test('the studio eraser drops comments and indentation but never changes what runs', async () => {
  const vm = await import('node:vm');
  const { minifyCss, minifyHtml, minifyJs } = await import('../src/minify.js');
  // Регулярки, деление, шаблоны и ASI — места, где ластик мог бы спутать код с комментарием.
  const cases = [
    String.raw`const a = 6 / 2 / 3; const r = /\/\*x*\//.test('/*x*/'); [a, r]`,
    String.raw`const s = '// no' + "/* no */"; s`,
    'const t = `${ `${ { v: 1 }.v } // k` } /* w */`; t',
    'function g() { return /* a\nb */ 1 } g()',
    'let i = 1; const d = i++ / 2; [d, i]',
    'const o = { in: 4 }; o.in / 2 / 1',
    'let x = 1\n/2/1; x',
    'var y = 5\n++y\ny',
    "const rx = /[/*]+/g; 'a/*b'.replace(rx, '-')",
  ];
  for (const code of cases) {
    assert.equal(JSON.stringify(vm.runInNewContext(minifyJs(code))), JSON.stringify(vm.runInNewContext(code)), code);
  }
  for (const file of ['app.js', 'sky.js', 'ui.js', 'map.js']) {
    const source = readFileSync(new URL(`../public/app/${file}`, import.meta.url), 'utf8');
    const slim = minifyJs(source);
    assert.ok(slim.length < source.length * 0.8, `${file}: комментарии и отступы ушли`);
    assert.doesNotThrow(() => new vm.Script(slim), `${file}: стёртый скрипт компилируется`);
  }
  for (const file of ['music-core.js', 'music-player.js', 'music-start.js', 'music.js']) {
    const source = readFileSync(new URL(`../public/app/${file}`, import.meta.url), 'utf8');
    const slim = minifyJs(source);
    assert.ok(slim.length < source.length, `${file}: ластик прошёлся`);
    assert.doesNotThrow(() => new vm.Script(slim), `${file}: стёртый скрипт компилируется`);
  }
  assert.equal(minifyJs('const broken = ('), 'const broken = (', 'некомпилируемый исходник уходит как есть');

  assert.equal(
    minifyCss('@media (min-width: 760px) { /* note */ a :hover , b { color : red ; } }'),
    '@media (min-width: 760px){a :hover,b{color : red}}',
    'пробел перед :hover и перед скобкой медиазапроса значим',
  );
  assert.equal(minifyCss('a { background: url( data:x;y//z ) }'), 'a{background: url( data:x;y//z )}');
  assert.equal(
    minifyHtml('<p class="a  b">\n    Hi <b>there</b>\n</p>\n<!-- note -->\n<style>\n  a { color: red; }\n</style>\n<pre>  keep\n    this</pre>'),
    '<p class="a  b">\nHi <b>there</b>\n</p>\n<style>a{color: red}</style>\n<pre>  keep\n    this</pre>',
  );
});

test('HTTP: the studio arrives erased and compressed, and only the current build is cached forever', async () => {
  const page = await fetch(`${baseUrl}/app/`, { headers: { 'Accept-Encoding': 'br' } });
  assert.equal(page.headers.get('content-encoding'), 'br');
  assert.equal(page.headers.get('cache-control'), 'no-cache', 'разметку всегда сверяем с сервером');
  const html = await page.text();
  assert.doesNotMatch(html, /<!--|__V__/, 'в разметке ни комментариев, ни шаблонного тега');
  assert.match(html, /<link rel="preload" href="\/api\/config" as="fetch" crossorigin>/, 'настройки едут вместе со стилями');
  const tag = html.match(/app\.js\?v=([\w-]+)/)?.[1];
  assert.ok(tag, 'скрипт студии помечен тегом сборки');

  const script = await fetch(`${baseUrl}/app/app.js?v=${tag}`);
  assert.match(script.headers.get('cache-control'), /max-age=31536000, immutable/);
  const code = await script.text();
  assert.ok(code.length < readFileSync(new URL('../public/app/app.js', import.meta.url), 'utf8').length * 0.8);

  const stale = await fetch(`${baseUrl}/app/app.js?v=stale0000`);
  await stale.arrayBuffer();
  assert.equal(stale.headers.get('cache-control'), 'no-cache', 'файл под чужим тегом навечно не кешируем');
});

test('the invitation map shows only the chosen place, glowing, with no foreign widget', async () => {
  const { mapEmbed } = await import('../src/blocks.js');
  const html = mapEmbed({
    lat: 42.1151, lng: 60.0593, lang: 'ru', address: 'Navro‘z </script>', enabled: true,
    tone: 'light', tiles: 'https://tiles.example/{z}/{x}/{y}.png',
  });
  assert.match(html, /NvMap\.create/);
  assert.match(html, /here:true/);
  assert.match(html, /interactive:false/);
  assert.doesNotMatch(html, /yandex\.ru\/map-widget|<iframe/);
  assert.doesNotMatch(html, /<\/script>"/, 'название места не должно рвать скрипт');
});

test('every design ends with a live nVate.uz link to the bot', async () => {
  const { renderDemo } = await import('../src/render.js');
  for (const id of PUBLIC_IDS) {
    for (const lang of ['ru', 'uz']) {
      const html = renderDemo(id, { lang });
      assert.match(html, /href="https:\/\/t\.me\/nvate_bot"/, `${id}/${lang}: ссылка на бота`);
      assert.match(html, /nVate<i>\.uz<\/i>/, `${id}/${lang}: подпись nVate.uz`);
      assert.match(html, /class="mapbox"[\s\S]*here:true/, `${id}/${lang}: карта места со свечением`);
    }
  }
});

test('Admin sanitizer neutralizes stored markup and attributes', () => {
  const hostile = `<img src=x onerror="globalThis.pwned=1">'&`;
  const escaped = escapeHtml(hostile);
  assert.equal(escaped, '&lt;img src=x onerror=&quot;globalThis.pwned=1&quot;&gt;&#39;&amp;');
  assert.doesNotMatch(escaped, /<img|onerror="/);
});

test('HTTP catalog and render routes are healthy with security headers', async () => {
  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', database: process.env.NVATE_TEST_DATABASE_URL ? 'postgresql' : 'sqlite' });
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

/* Тот же 401 ловит и пара, открывшая nvate.uz в обычном браузере: подписи
   Telegram там нет. Студия узнаёт об этом из настроек и вместо мёртвой формы
   показывает вход в бот — кнопкой с телефона и кодом с компьютера. */
test('outside Telegram the studio is told to hand the couple the bot', async () => {
  const { RUNTIME } = await import('../src/config.js');
  const username = RUNTIME.botUsername;
  try {
    RUNTIME.botUsername = '';
    assert.equal((await fetch(`${baseUrl}/api/bot-qr.svg`)).status, 404, 'без имени бота вести некуда');

    RUNTIME.botUsername = 'nvate_bot';
    const config = await (await fetch(`${baseUrl}/api/config`)).json();
    assert.equal(config.requiresTelegram, true);
    assert.equal(config.botUrl, 'https://t.me/nvate_bot');

    const qr = await fetch(`${baseUrl}/api/bot-qr.svg`);
    assert.equal(qr.status, 200);
    assert.match(qr.headers.get('content-type'), /^image\/svg\+xml/);
    assert.match(await qr.text(), /<svg[^>]+viewBox/);
  } finally {
    RUNTIME.botUsername = username;
  }
});

// Разметка шлюза едет вместе со студией: без неё фронту некуда положить вход.
test('the studio ships the Telegram gate markup', () => {
  const html = readFileSync(path.join(process.cwd(), 'public', 'app', 'index.html'), 'utf8');
  for (const id of ['gate', 'gate-open', 'gate-qr']) {
    assert.match(html, new RegExp(`id="${id}"`), `шлюзу нужен #${id}`);
  }
  assert.match(html, /src="\/api\/bot-qr\.svg"/);
});
