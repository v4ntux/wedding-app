// Рендер приглашений: шаблоны живут в templates/ (см. templateStore.js),
// здесь — подготовка данных (buildData), демо и водяная сетка.

import { findMusicPreset, MAP_TILES } from './config.js';
import { mapsLinks, youtubeId } from './service.js';
import { getTemplate } from './templateStore.js';
import { renderTemplate, escapeHtml } from './templateEngine.js';
import { GRAIN, audioWidget, mapEmbed, madeFooter, countdownScript } from './blocks.js';
import { envelopeScene, envelopeExperienceCSS, envelopeExperienceScript, livingBackground, starfield } from './experience.js';
import { coreCSS, monogram } from './theme.js';
import { normalizeDesign, STATIONERY } from './design.js';

export { escapeHtml };

// Локализация страниц приглашений. Язык выбирает пара при заказе (uz по умолчанию).
// Шаблон может переопределить любые строки через "strings" в manifest.json.
const LOCALES = {
  uz: {
    months: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
    weekdays: ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'],
    fmt: (d, m, y) => `${d}-${m}, ${y}`,
    L: {
      sub: 'Taklifnoma',
      invite: 'Sizni hayotimizdagi eng baxtli kun — to‘yimizga taklif qilamiz!',
      greet: 'Hurmatli',
      greetTail: 'Sizni to‘yimizda ko‘rishdan behad xursand bo‘lamiz!',
      days: 'kun', hours: 'soat', min: 'daqiqa', sec: 'soniya',
      sign: 'Hurmat bilan,', and: 'va',
      gmaps: 'Google xarita', ymaps: 'Yandex xarita', music: 'Musiqa',
      openHint: 'Ochish uchun bosing',
      emo: 'Ikki qalb endi bir yo‘ldan boradi. Hayotimizdagi eng go‘zal kunda yonimizda bo‘lishingiz — biz uchun eng katta baxt.',
      until: 'To‘ygacha qoldi',
      final: 'Kelishingizni intiqlik bilan kutamiz!',
      made: 'nvate bilan yaratildi',
      gallery: 'Biz haqimizda', when: 'Qachon', where: 'Qayerda',
    },
  },
  ru: {
    months: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    weekdays: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
    fmt: (d, m, y) => `${d} ${m} ${y}`,
    L: {
      sub: 'Приглашение',
      invite: 'Приглашаем Вас разделить с нами радость самого счастливого дня!',
      greet: 'Уважаемый(ая)',
      greetTail: 'Мы будем очень рады видеть Вас на нашей свадьбе!',
      days: 'дней', hours: 'часов', min: 'минут', sec: 'секунд',
      sign: 'С любовью,', and: 'и',
      gmaps: 'Google Maps', ymaps: 'Yandex Maps', music: 'Музыка',
      openHint: 'Нажмите, чтобы открыть',
      emo: 'Два сердца теперь идут одной дорогой. Ваше присутствие рядом в самый прекрасный день нашей жизни — большое счастье для нас.',
      until: 'До свадьбы осталось',
      final: 'С нетерпением ждём встречи с Вами!',
      made: 'Создано с nvate',
      gallery: 'О нас', when: 'Когда', where: 'Где',
    },
  },
};

function firstChar(s) {
  return [...String(s ?? '')][0] ?? '';
}

// Светлая ли бумага темы: от этого зависит, выворачивать ли карту в ночь.
function isLightPaper(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? ''));
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const luma = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return luma / 255 > 0.55;
}

// Данные для шаблона. Значения сырые: {{x}} экранирует движок,
// готовые блоки ({{{audioWidget}}} и т.п.) экранируют внутри себя.
export function buildData(app, guestName = null, tpl = null) {
  const lang = app.lang === 'ru' ? 'ru' : 'uz';
  const loc = LOCALES[lang];
  const L = { ...loc.L, ...(tpl?.strings?.[lang] ?? {}) };
  Object.assign(L, lang === 'ru'
    ? { openLetter:'Открыть приглашение', replay:'Вернуть конверт', scroll:'Ваша история начинается здесь', story:'Наша история', dateLabel:'Сохраните этот день', dress:'Дресс-код', calendar:'Добавить в календарь', close:'Закрыть', quote:'Один день. Одна любовь. Целая жизнь вместе.' }
    : { openLetter:'Taklifnomani ochish', replay:'Konvertga qaytish', scroll:'Hikoyangiz shu yerdan boshlanadi', story:'Bizning hikoyamiz', dateLabel:'Bu kunni eslab qoling', dress:'Kiyim uslubi', calendar:'Taqvimga qo‘shish', close:'Yopish', quote:'Bir kun. Bir muhabbat. Bir umrlik baxt.' });
  const mapEnabled = app.map_enabled === undefined ? true : Boolean(Number(app.map_enabled));
  const links = mapEnabled ? mapsLinks(app.lat, app.lng) : { google: '', yandex: '' };

  let music = null;
  if (app.music_type === 'preset') {
    const preset = findMusicPreset(app.music_value);
    if (preset) music = { url: preset.url, name: preset.name, playable: true };
  } else if (app.music_type === 'itunes') {
    try {
      const v = JSON.parse(app.music_value);
      music = { url: v.url, name: `${v.name} — ${v.artist}`, playable: true };
    } catch { music = null; }
  } else if (app.music_type === 'upload') {
    music = { url: `/uploads/${app.music_value}`, name: L.music, playable: true };
  } else if (app.music_type === 'youtube') {
    const id = youtubeId(app.music_value);
    if (id) music = { youtubeId: id, name: 'YouTube', url: app.music_value, playable: false };
  } else if (app.music_type === 'custom') {
    const url = app.music_value ?? '';
    music = { url, name: L.music, playable: /\.(mp3|ogg|m4a|wav)(\?|$)/i.test(url) };
  }
  if (music) {
    music.start = Number(app.music_start) || 0;
    music.end = Number(app.music_end) || 0;
  }

  // Дополнительные функции заказа (дресс-код, свой домен и т.п.). Хранятся
  // как JSON, чтобы новая опция не требовала миграции схемы.
  let extras = {};
  try {
    const raw = app.extras;
    if (raw) extras = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    extras = {};
  }
  if (!extras || typeof extras !== 'object') extras = {};
  const design = normalizeDesign(extras.design);
  const stationery = STATIONERY[tpl?.id] || STATIONERY.ivory;

  let photos = [];
  try {
    photos = JSON.parse(app.photos ?? '[]');
  } catch {
    photos = [];
  }
  photos = photos.map((p) => (String(p).startsWith('/') ? String(p) : `/uploads/${p}`));

  const [y, m, d] = app.wedding_date.split('-').map(Number);
  const lat = Number(app.lat);
  const lng = Number(app.lng);
  const targetIso = `${app.wedding_date}T${app.wedding_time}:00+05:00`;

  return {
    lang,
    L,
    design,
    stationery,
    effect: design.effect === 'signature' ? stationery.effect : design.effect,
    styleVars: `--paper:${stationery.paper};--ink:${stationery.ink};--accent:${stationery.accent};--envelope:${stationery.envelope};--scene-position:${stationery.tile}`,
    groom: app.groom_name,
    bride: app.bride_name,
    groomInitial: firstChar(app.groom_name),
    brideInitial: firstChar(app.bride_name),
    dateIso: app.wedding_date,
    time: app.wedding_time,
    dateText: loc.fmt(d, loc.months[m - 1], y),
    day: d,
    monthName: loc.months[m - 1],
    year: y,
    weekday: loc.weekdays[new Date(y, m - 1, d).getDay()],
    targetIso,
    address: app.address ?? '',
    lat,
    lng,
    mapEnabled,
    gmaps: links.google,
    ymaps: links.yandex,
    guestName: guestName ?? null,
    photos,
    // Блоки движка — в шаблоне вставлять как {{{...}}}.
    grain: GRAIN,
    envelope: envelopeScene({
      theme: tpl?.id,
      openHint: L.openHint,
      groom: app.groom_name,
      bride: app.bride_name,
      groomInitial: firstChar(app.groom_name),
      brideInitial: firstChar(app.bride_name),
      sub: L.sub,
      date: loc.fmt(d, loc.months[m - 1], y),
      lang,
      design,
    }),
    extras,
    livingBg: livingBackground(),
    /* Звёзд стало вдвое меньше. Каждая — отдельный узел с бесконечной
       анимацией мерцания, и на телефоне пять десятков таких узлов поверх
       страницы стоят дороже, чем весь остальной декор. На глаз небо то же:
       разреженное ночное небо и выглядит правдоподобнее плотной россыпи. */
    starfield: starfield(18),
    starfieldDense: starfield(24, 1),
    coreCSS: coreCSS(),
    monogram: monogram(`${firstChar(app.groom_name)}${firstChar(app.bride_name)}`),
    monogramFilled: monogram(`${firstChar(app.groom_name)}${firstChar(app.bride_name)}`, 'mono--filled'),
    experienceCSS: envelopeExperienceCSS(),
    experienceScript: envelopeExperienceScript(),
    audioWidget: audioWidget(music, lang),
    map: mapEmbed({
      lat, lng, lang, address: app.address, enabled: mapEnabled,
      tone: isLightPaper(stationery?.paper) ? 'light' : 'dark', tiles: MAP_TILES,
    }),
    countdown: countdownScript(targetIso),
    made: madeFooter(lang),
  };
}

export function renderInvitation(app, guestName = null) {
  const tpl = getTemplate(app.template_id);
  if (!tpl) throw new Error(`шаблон "${app.template_id}" не найден`);
  return renderTemplate(tpl.tree, buildData(app, guestName, tpl));
}

// Водяная сетка + запрет копирования: чтобы демо не украли скриншотом.
const WM_SVG = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="150"><text x="10" y="80" font-family="Arial" font-size="22" fill="rgba(140,140,140,0.30)">DEMO · NAMUNA</text></svg>'
);
const WATERMARK = `
<div style="position:fixed;inset:-60%;z-index:99990;pointer-events:none;transform:rotate(-18deg);background:url('data:image/svg+xml,${WM_SVG}') repeat"></div>
<script>document.addEventListener('contextmenu',function(e){e.preventDefault()});
document.addEventListener('selectstart',function(e){e.preventDefault()});</script>
<style>body{-webkit-user-select:none;user-select:none}</style>`;

// Демо шаблона: те же рендеры, данные подставляются из формы (имена, язык).
export function renderDemo(templateId, opts = {}) {
  const tpl = getTemplate(templateId);
  if (!tpl) return null;
  const lang = opts.lang === 'ru' ? 'ru' : 'uz';
  const demoLat = Number(opts.lat);
  const demoLng = Number(opts.lng);
  const sample = {
    lang,
    groom_name: String(opts.groom ?? '').slice(0, 100).trim() || 'Ali',
    bride_name: String(opts.bride ?? '').slice(0, 100).trim() || 'Zebo',
    wedding_date: '2026-09-19',
    wedding_time: '18:00',
    address: String(opts.address ?? '').slice(0, 140).trim() || 'To‘yxona «Navro‘z», Mang‘it',
    lat: Number.isFinite(demoLat) ? demoLat : 42.1151,
    lng: Number.isFinite(demoLng) ? demoLng : 60.0593,
    map_enabled: opts.map === undefined ? 1 : (String(opts.map) === '1' ? 1 : 0),
    music_type: 'none',
    music_value: null,
    template_id: templateId,
    // Демо умеет показать заказ с подключёнными допфункциями: /demo/<id>?addons=dress
    extras: JSON.stringify(Object.fromEntries(
      String(opts.addons ?? '').split(',').map((s) => s.trim()).filter(Boolean).map((id) => [id, true])
    )),
    photos: JSON.stringify(['/demo/sample1.svg', '/demo/sample2.svg']),
  };
  const html = renderInvitation(sample, null);
  if (opts.card) {
    const cardMode = `<style>
html,body{width:100%;min-height:100%;overflow:hidden!important;scrollbar-width:none;scroll-behavior:auto!important;touch-action:none;user-select:none}
body::-webkit-scrollbar{display:none}.envx,.cinematic-intro,.envelope-scene,.ev-scene,#mbtn{display:none!important}
/* Витрина в студии показывает сразу несколько карточек. Тяжёлые фоновые слои
   (блюры, конические градиенты, частицы) в миниатюре не читаются, а рендерер
   кладут — поэтому в режиме карточки они выключены. */
.nacre,.veins,.sunbeams,.dust,.rays,.leaves,.petals,.stars,.gilt-dust,.sun,.haze,.living-bg,.motes{display:none!important}.paper{margin:0 auto!important;box-shadow:none!important}
.fx{opacity:1!important;transform:none!important;filter:none!important;transition:none!important}
iframe{pointer-events:none!important}
</style><script>(function(){
document.body.classList.remove('locked');
document.querySelectorAll('.fx').forEach(function(x){x.classList.add('in')});
document.querySelectorAll('audio').forEach(function(x){x.pause()});
// Студия просит замереть, когда карточка уходит из фокуса карусели:
// на телефоне одновременно живёт только один пример.
addEventListener('message',function(e){
  var d=e&&e.data;
  if(!d||typeof d!=='object'||!d.nvate)return;
  var stop=d.nvate==='pause';
  if(document.getAnimations)document.getAnimations().forEach(function(a){try{stop?a.pause():a.play()}catch(_){}});
  document.querySelectorAll('video').forEach(function(v){try{stop?v.pause():v.play()}catch(_){}});
});
function startPan(){
  var paper=document.querySelector('.paper')||document.body;
  var distance=Math.max(0,Math.ceil(paper.getBoundingClientRect().height-window.innerHeight));
  if(distance<8)return;
  var frame=window.frameElement;
  var seenAt=frame?Number(frame.dataset.seenAt)||Date.now():Date.now();
  var startDelay=Math.max(0,2000-(Date.now()-seenAt));
  paper.style.willChange='transform';
  paper.animate([
    {offset:0,transform:'translate3d(0,0,0)'},
    {offset:.9,transform:'translate3d(0,-'+distance+'px,0)'},
    {offset:1,transform:'translate3d(0,-'+distance+'px,0)'}
  ],{
    duration:Math.max(34000,distance*20),
    delay:startDelay,
    iterations:Infinity,
    direction:'alternate',
    easing:'cubic-bezier(.28,.18,.55,1)',
    fill:'both'
  });
}
startPan();
})();</script>`;
    const previewHtml = html.replace(/<body([^>]*)>/, '<body$1 data-card-preview>');
    return previewHtml.replace('</body>', `${cardMode}</body>`);
  }
  return withWatermark(html);
}

// Накладывает водяную сетку на любую страницу (демо и предпросмотр).
export function withWatermark(html) {
  return html.replace('</body>', `${WATERMARK}</body>`);
}

export function renderNotFound() {
  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>404</title>
<style>body{font-family:Georgia,serif;background:#FDFBF7;color:#352E3C;display:flex;justify-content:center;
align-items:center;min-height:100vh;margin:0}div{text-align:center}</style></head>
<body><div><h1>404</h1><p>Topilmadi · Не найдено</p></div></body></html>`;
}
