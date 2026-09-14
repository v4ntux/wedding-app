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
process.env.YTDLP_BIN = 'nvate-missing-ytdlp';
// Only an explicitly named disposable database may be used by tests.
process.env.DATABASE_URL = process.env.NVATE_TEST_DATABASE_URL || '';
delete process.env.NVATE_MIGRATE_SQLITE;
delete process.env.RAILWAY_ENVIRONMENT;

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

test('the cut keeps a start and runs to the end of the track', () => {
  const clean = validateForm(baseForm({ musicStart: 12, musicEnd: null }));
  assert.equal(clean.musicStart, 12);
  assert.equal(clean.musicEnd, null);
});

test('a popular start point is only suggested once several couples agree', async () => {
  const track = {
    name: 'Shared Song',
    artist: 'Shared Artist',
    url: 'https://audio-ssl.itunes.apple.com/shared.m4a',
  };
  const key = musicKey({ musicType: 'itunes', musicValue: track });
  assert.ok(key);
  assert.equal((await dbModule.popularCut(key)), null, 'без заявок подсказки быть не должно');

  const submit = async (id, start) => (await submitApplication(baseForm({
    musicValue: track,
    musicStart: start,
    submissionKey: `3234567${id}-1234-4123-8123-123456789abc`,
  }), { id: 7200 + id, username: `cut_${id}` }));

  await submit(1, 18);
  assert.equal((await dbModule.popularCut(key)), null, 'одна пара — ещё не рекомендация');

  await submit(2, 19);   // та же пятисекундная корзина, что и 18
  await submit(3, 44);
  const cut = (await dbModule.popularCut(key));
  assert.deepEqual(cut, { start: 18, uses: 2 }, 'предлагаем самую раннюю секунду корзины');
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

test('a cut track plays from its start to the very end and returns to that start', async () => {
  const { audioWidget } = await import('../src/blocks.js');
  const widget = audioWidget({ url: 'https://example.com/song.mp3', playable: true, start: 20, end: 0 }, 'ru');
  assert.doesNotMatch(widget, /a\.loop=true/, 'петля с 0:00 перескакивала через выбранное начало');
  assert.match(widget, /addEventListener\('ended'/);
  assert.match(widget, /s=20/);
  // iOS не перематывает до метаданных: старт задаётся и фрагментом, и после loadedmetadata.
  assert.match(widget, /song\.mp3#t=20/);
  assert.match(widget, /addEventListener\('loadedmetadata',seek\)/);
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

  const mine = await music.userTracks(8001);
  assert.deepEqual(mine.map((t) => [t.title, t.artist, t.duration]), [['Yor-yor', 'Ansambl', 214]]);
  assert.equal(mine[0].url, `/uploads/${first.track.file}`);
  assert.equal((await music.userTracks(8002)).length, 0, 'чужие треки не видны');
  assert.equal(await music.addTrack(Buffer.from('definitely not an audio file'), { ownerId: 8001, title: 'x' }), null);
  assert.deepEqual(music.metaFromFileName('Shahzoda - Yor-yor_remix.mp3'), { artist: 'Shahzoda', title: 'Yor-yor remix' });
});

test('the nvate shelf is shared: popularity and start points come from real orders', async () => {
  const music = await import('../src/music.js');
  const { track } = await music.addTrack(id3('shelf-song'), { ownerId: 1, title: 'Kelin salom', source: 'admin', library: true });
  const [shelf] = await music.libraryTracks();
  assert.equal(shelf.id, Number(track.id));

  const key = musicKey({ musicType: 'upload', musicValue: track.file });
  assert.equal(key, track.file, 'ключ полного трека — имя файла');
  for (const [i, start] of [[1, 42], [2, 43]]) {
    await submitApplication(baseForm({
      musicType: 'upload', musicValue: track.file, musicStart: start,
      submissionKey: `4234567${i}-1234-4123-8123-123456789abc`,
    }), { id: 8100 + i, username: `shelf_${i}` });
  }
  assert.equal((await music.libraryTracks())[0].uses, 2);
  assert.deepEqual(await dbModule.popularCut(key), { start: 42, uses: 2 });
  assert.equal(await music.trackLabel(track.file), 'Kelin salom');

  // Снять с полки — не удалить: заказы, которые уже играют файл, не ломаются.
  await music.saveLibrary([]);
  assert.equal((await music.libraryTracks()).length, 0);
  assert.equal((await dbModule.getTrack(track.id)).file, track.file);
});

test('HTTP: the shelf is public, personal music and shelf edits need Telegram', async () => {
  const shelf = await fetch(`${baseUrl}/api/music`);
  assert.equal(shelf.status, 200);
  const body = await shelf.json();
  assert.ok(Array.isArray(body.tracks));
  assert.ok(body.tracks.every((t) => t.url.startsWith('/uploads/')), 'только наши полные файлы, без чужих превью');
  assert.equal((await fetch(`${baseUrl}/api/music/mine`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/admin/library`)).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/admin/library`, { method: 'POST', body: id3('x') })).status, 403);
});

test('YouTube search reads the results page and keeps only real songs', async () => {
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
  const bad = await fetch(`${baseUrl}/api/music/youtube/info?url=${encodeURIComponent('https://example.com/song')}`);
  assert.equal(bad.status, 400);
});

test('«Топ выбор» с YouTube — пик пересмотров после вступления, а не первая секунда', async () => {
  const { parseHeatmap, peakMoment, songMeta } = await import('../src/youtube.js');
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
  assert.deepEqual(songMeta('Shahzoda - Yomg‘ir | Шахзода - Ёмгир (AUDIO)', 'Shahzoda'), { title: 'Yomg‘ir', artist: 'Shahzoda' });
  assert.deepEqual(songMeta('Kelin salom [Official Video]', 'Ansambl - Topic'), { title: 'Kelin salom', artist: 'Ansambl' });
});

test('a YouTube song is downloaded once for everyone and joins the shelf once a couple picks it', async () => {
  const music = await import('../src/music.js');
  let downloads = 0;
  const m4a = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypM4A '), Buffer.alloc(40)]);
  const fake = {
    download: async () => {
      downloads += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { buffer: m4a, name: 'Yor-yor.m4a' };
    },
    info: async () => ({ title: 'Yor-yor', artist: 'Shahzoda', duration: 214 }),
    top: async () => 66,
  };
  const [first, second] = await Promise.all([music.youtubeSong('yoryor00001', fake), music.youtubeSong('yoryor00001', fake)]);
  assert.equal(downloads, 1, 'две пары разом — одно скачивание');
  assert.equal(second.id, first.id);
  assert.equal((await music.youtubeSong('yoryor00001', fake)).id, first.id);
  assert.equal(downloads, 1, 'скачанная песня отдаётся сразу');
  const song = music.publicTrack(first);
  assert.deepEqual([song.title, song.artist, song.duration, song.youtubeId], ['Yor-yor', 'Shahzoda', 214, 'yoryor00001']);
  const onShelf = async () => (await music.libraryTracks()).some((t) => t.id === song.id);
  assert.equal(await onShelf(), false, 'на полку — только после выбора парой');

  const cut = await (await fetch(`${baseUrl}/api/music/cut?type=upload&url=${encodeURIComponent(song.file)}`)).json();
  assert.deepEqual(cut.cut, { start: 66, uses: 0 }, 'пока пар мало — подсказывает YouTube');

  await submitApplication(baseForm({
    musicType: 'upload', musicValue: song.file, musicStart: 66,
    submissionKey: '52345671-1234-4123-8123-123456789abc',
  }), { id: 8301, username: 'yt_song' });
  assert.equal(await onShelf(), true);
  await music.saveLibrary((await music.libraryTracks()).filter((t) => t.id !== song.id));
  assert.equal(await onShelf(), false, 'снятая админом песня сама не возвращается');
  assert.equal(await music.youtubeSong('failed00001', { ...fake, download: async () => null }), null);
});

const signedInitData = (user) => {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user) });
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN).digest();
  params.set('hash', crypto.createHmac('sha256', secret).update(check).digest('hex'));
  return params.toString();
};

test('HTTP: songs by link need Telegram and only ever reach YouTube, Instagram or TikTok', async () => {
  const post = (url, initData = '') => fetch(`${baseUrl}/api/music/link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-init-data': initData },
    body: JSON.stringify({ url }),
  });
  assert.equal((await post('https://youtu.be/abcdefghijk')).status, 401);
  const couple = signedInitData({ id: 8401, first_name: 'Test' });
  // Внутренняя сеть и чужие сайты — не песня: yt-dlp за ними не ходит.
  for (const url of ['http://nvate-postgres.railway.internal/', 'https://example.com/song.mp4', 'http://www.tiktok.com/@a/video/1']) {
    assert.equal((await post(url, couple)).status, 400, url);
  }
  assert.equal((await post('https://www.tiktok.com/@nvate/video/1', couple)).status, 501, 'без yt-dlp скачивать нечем');
  const config = await (await fetch(`${baseUrl}/api/config`)).json();
  assert.equal(config.downloadEnabled, false);
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
