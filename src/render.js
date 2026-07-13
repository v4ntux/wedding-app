// Рендер приглашений: шаблоны живут в templates/ (см. templateStore.js),
// здесь — подготовка данных (buildData), демо и водяная сетка.

import { findMusicPreset } from './config.js';
import { mapsLinks, youtubeId } from './service.js';
import { getTemplate, allTemplates } from './templateStore.js';
import { renderTemplate, escapeHtml } from './templateEngine.js';
import { GRAIN, experienceCSS, experienceScript, audioWidget, mapEmbed, countdownScript } from './blocks.js';

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
    },
  },
};

function firstChar(s) {
  return [...String(s ?? '')][0] ?? '';
}

// Данные для шаблона. Значения сырые: {{x}} экранирует движок,
// готовые блоки ({{{audioWidget}}} и т.п.) экранируют внутри себя.
export function buildData(app, guestName = null, tpl = null) {
  const lang = app.lang === 'ru' ? 'ru' : 'uz';
  const loc = LOCALES[lang];
  const L = { ...loc.L, ...(tpl?.strings?.[lang] ?? {}) };
  const links = mapsLinks(app.lat, app.lng);

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
  const targetIso = `${app.wedding_date}T${app.wedding_time}:00`;

  return {
    lang,
    L,
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
    gmaps: links.google,
    ymaps: links.yandex,
    guestName: guestName ?? null,
    photos,
    // Блоки движка — в шаблоне вставлять как {{{...}}}.
    grain: GRAIN,
    experienceCSS: experienceCSS(),
    experienceScript: experienceScript(),
    audioWidget: audioWidget(music),
    map: mapEmbed({ lat, lng, lang, address: app.address }),
    countdown: countdownScript(targetIso),
  };
}

export function renderInvitation(app, guestName = null) {
  let tpl = getTemplate(app.template_id);
  if (!tpl) {
    // Шаблон могли удалить из templates/ — оплаченные страницы не должны падать.
    tpl = allTemplates()[0];
    if (!tpl) throw new Error('в templates/ нет ни одного шаблона');
    console.warn(`[render] шаблон "${app.template_id}" не найден — рендерю "${tpl.id}"`);
  }
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
  const sample = {
    lang,
    groom_name: String(opts.groom ?? '').slice(0, 100).trim() || 'Ali',
    bride_name: String(opts.bride ?? '').slice(0, 100).trim() || 'Zebo',
    wedding_date: '2026-09-19',
    wedding_time: '18:00',
    address: 'To‘yxona «Navro‘z», Toshkent',
    lat: 41.311081,
    lng: 69.240562,
    music_type: 'none',
    music_value: null,
    template_id: templateId,
    photos: JSON.stringify(['/demo/sample1.svg', '/demo/sample2.svg']),
  };
  return withWatermark(renderInvitation(sample, null));
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
