// Открытие приглашения и живая среда страницы.
//
// ── Конверт ───────────────────────────────────────────────────────────────
// Конверт нарисован, а не снят: бумага, подкладка, диагональные швы и
// сургучная печать собраны из градиентов и теней. Поэтому он принимает цвет
// любой темы — от винного бархата до мраморного ар-деко — и открывается
// одинаково: печать откалывается, клапан откидывается назад, письмо с именами
// выезжает наверх, камера наезжает на бумагу и передаёт кадр самой странице.
//
// Чтобы стык не читался, бумага письма и бумага приглашения совпадают по цвету:
// тема задаёт --ev-paper, и он же лежит в основе первой секции.
//
// ── Среда страницы ────────────────────────────────────────────────────────
// Фон приглашения — медленно дышащая акварельная бумага (video[data-living-bg]),
// звёздное поле (starfield), параллакс, полоса прочитанного и пыльца.
//
// Шаблон вставляет {{{envelope}}} первым элементом <body>, {{{experienceCSS}}}
// в <head> и {{{experienceScript}}} перед </body>.

import { escapeHtml } from './templateEngine.js';

// Конверт каждой темы: бумага, подкладка, воск и чернила. Ключ — id шаблона.
const ENVELOPES = {
  // Ночные
  oqshom: { paper: '#e9e2cd', paper2: '#d6cdb2', liner: '#123a2c', wax: '#1d5340', waxHi: '#4d8f74', ink: '#1a4534', hint: '#e7d9ae', room: '#050d09' },
  nafis: { paper: '#f0e6d8', paper2: '#dfd0bb', liner: '#4a1024', wax: '#7d1b33', waxHi: '#c05a70', ink: '#5c1a2c', hint: '#eccfae', room: '#0c0508' },
  // Светлые и цветные
  nur: { paper: '#fdfaf3', paper2: '#eee6d6', liner: '#c8b184', wax: '#c39a52', waxHi: '#f0d79a', ink: '#7a6231', hint: '#6d5c3c', room: '#e8dfcd' },
  gulzor: { paper: '#f6f4e9', paper2: '#e3e2cf', liner: '#3f5d3c', wax: '#4f7346', waxHi: '#8fb47f', ink: '#365234', hint: '#dfe7d4', room: '#101d12' },
  marvarid: { paper: '#fbf1ef', paper2: '#f0dcd9', liner: '#c99aa4', wax: '#b76e7f', waxHi: '#e6a9b4', ink: '#8c4f5e', hint: '#f3d9dd', room: '#20131a' },
  charos: { paper: '#f7f5f1', paper2: '#e7e2da', liner: '#2b2b2f', wax: '#b08c46', waxHi: '#f0dca6', ink: '#3b3b40', hint: '#e6ded0', room: '#141416' },
  shirin: { paper: '#fdf1e2', paper2: '#f2ddc2', liner: '#a24a24', wax: '#c2603a', waxHi: '#efa07a', ink: '#8c3f22', hint: '#f7d9b6', room: '#2a1409' },
  deco: { paper: '#efe9dc', paper2: '#ddd3bf', liner: '#101014', wax: '#c9a55a', waxHi: '#f2dfa8', ink: '#1b1b20', hint: '#e8d5a4', room: '#0a0a0d' },
  // Legacy — старые оплаченные ссылки продолжают открываться
  atlas: { paper: '#f7ecd8', paper2: '#e6d5b8', liner: '#7a3520', wax: '#a5442c', waxHi: '#dd8b62', ink: '#7b3a22', hint: '#f0d5ac', room: '#1a0d07' },
};

const DEFAULT_ENVELOPE = { paper: '#f2ece0', paper2: '#e0d7c6', liner: '#5b4630', wax: '#8a4a2c', waxHi: '#d69a6d', ink: '#5b3320', hint: '#e8d6bc', room: '#120c08' };

export function envelopeExperienceCSS() {
  return `<style>
body.locked{overflow:hidden;height:100dvh;overscroll-behavior:none}

/* ── Сцена открытия: конверт ───────────────────────────────────────────── */
/* Конверт нарисован целиком: бумага — градиент с зерном, клапан — треугольник
   на 3D-петле, воск — радиальный градиент с неровной кромкой. Всё принимает
   цвет темы через --ev-*, поэтому одна сцена обслуживает все дизайны. */
.ev-scene{position:fixed;inset:0;z-index:9000;display:grid;place-items:center;overflow:hidden;
  background:var(--ev-room,#120c08);touch-action:none;perspective:1600px}
.ev-scene[hidden]{display:none}

/* Комната: мягкий свет сверху и виньетка — конверт лежит на столе, а не парит. */
.ev-room{position:absolute;inset:0;
  background:
    radial-gradient(64% 42% at 50% 8%,color-mix(in srgb,var(--ev-wax-hi,#d69a6d) 26%,transparent),transparent 68%),
    radial-gradient(80% 60% at 50% 108%,rgba(0,0,0,.5),transparent 62%);
  opacity:.9}

.ev-stage{position:relative;width:min(78vw,360px);transform-style:preserve-3d;
  transform:rotateX(9deg) translateZ(0)}
.ev-env{position:relative;width:100%;aspect-ratio:1.44/1;transform-style:preserve-3d;
  animation:evIdle 7.5s ease-in-out infinite alternate}
@keyframes evIdle{from{transform:rotateZ(-.5deg) translateY(-4px)}to{transform:rotateZ(.5deg) translateY(4px)}}

/* Задняя стенка: она же тень под письмом. */
.ev-env:before{content:'';position:absolute;inset:0;border-radius:4px;
  background:linear-gradient(168deg,var(--ev-paper-2,#e0d7c6),color-mix(in srgb,var(--ev-paper-2,#e0d7c6) 78%,#000));
  box-shadow:0 42px 80px -30px rgba(0,0,0,.75),0 4px 12px rgba(0,0,0,.3)}

/* Письмо: чуть уже конверта, выезжает вверх при открытии. */
.ev-letter{position:absolute;z-index:2;left:4%;right:4%;top:5%;height:92%;
  display:grid;place-items:center;padding:6% 7%;border-radius:3px;
  background:linear-gradient(176deg,var(--ev-paper,#f2ece0),var(--ev-paper-2,#e0d7c6));
  background-image:var(--ev-grain,none),linear-gradient(176deg,var(--ev-paper,#f2ece0),var(--ev-paper-2,#e0d7c6));
  box-shadow:0 -2px 10px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.6);
  transform:translateY(0);will-change:transform}
.ev-letter-in{color:var(--ev-ink,#5b3320);text-align:center;opacity:0;transform:translateY(10px);
  transition:opacity .9s ease,transform 1.2s cubic-bezier(.2,.7,.2,1)}
.ev-letter-in small{display:block;font:600 .58rem/1 var(--ev-sans,'Manrope',ui-sans-serif,system-ui,sans-serif);
  letter-spacing:.32em;text-transform:uppercase;opacity:.75}
.ev-letter-in b{display:block;margin:.5em 0 .42em;font:400 clamp(1.7rem,7.4vw,2.3rem)/1.02 var(--ev-display,'Cormorant Garamond',Georgia,serif);
  letter-spacing:-.015em;text-wrap:balance}
.ev-letter-in b i{display:block;margin:.06em 0;font-size:.44em;font-style:italic;opacity:.66}
.ev-letter-in span{display:block;font:500 .56rem/1 var(--ev-sans,'Manrope',ui-sans-serif,system-ui,sans-serif);
  letter-spacing:.24em;opacity:.86}

/* Передний карман со швами: две диагонали, сходящиеся к центру. */
.ev-pocket{position:absolute;z-index:3;inset:0;border-radius:4px;overflow:hidden;
  background:linear-gradient(172deg,var(--ev-paper,#f2ece0),var(--ev-paper-2,#e0d7c6) 88%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 -6px 16px -8px rgba(0,0,0,.35)}
.ev-pocket:before,.ev-pocket:after{content:'';position:absolute;top:-56%;width:150%;height:150%;
  background:linear-gradient(180deg,color-mix(in srgb,var(--ev-paper-2,#e0d7c6) 84%,#000),transparent 62%);
  opacity:.5}
.ev-pocket:before{left:-96%;transform-origin:100% 100%;transform:rotate(-34.5deg)}
.ev-pocket:after{right:-96%;transform-origin:0 100%;transform:rotate(34.5deg)}

/* Клапан: треугольник на верхней петле, с подкладкой на изнанке. */
.ev-flap{position:absolute;z-index:4;top:0;left:0;right:0;height:62%;transform-origin:50% 0;
  transform-style:preserve-3d;transform:rotateX(0deg);will-change:transform;
  clip-path:polygon(0 0,100% 0,50% 100%);
  background:linear-gradient(178deg,var(--ev-paper,#f2ece0),color-mix(in srgb,var(--ev-paper-2,#e0d7c6) 92%,#000));
  filter:drop-shadow(0 6px 8px rgba(0,0,0,.26))}
/* Изнанка клапана — цветная подкладка конверта. */
.ev-flap:after{content:'';position:absolute;inset:0;transform:rotateX(180deg);backface-visibility:hidden;
  background:linear-gradient(178deg,var(--ev-liner,#5b4630),color-mix(in srgb,var(--ev-liner,#5b4630) 76%,#000));
  clip-path:polygon(0 0,100% 0,50% 100%)}

/* Сургучная печать: неровная кромка, объём и блик. */
.ev-wax{position:absolute;z-index:6;left:50%;top:56%;width:22%;aspect-ratio:1;
  display:grid;place-items:center;transform:translate(-50%,-50%);
  border-radius:47% 53% 51% 49%/49% 47% 53% 51%;
  background:
    radial-gradient(circle at 34% 28%,var(--ev-wax-hi,#d69a6d),transparent 46%),
    radial-gradient(circle at 62% 74%,rgba(0,0,0,.34),transparent 52%),
    var(--ev-wax,#8a4a2c);
  box-shadow:0 8px 18px -6px rgba(0,0,0,.6),inset 0 1px 2px rgba(255,255,255,.35)}
.ev-wax b{color:color-mix(in srgb,var(--ev-wax-hi,#d69a6d) 72%,#fff);
  font:400 .74rem/1 var(--ev-display,'Cormorant Garamond',Georgia,serif);letter-spacing:.06em;
  text-shadow:0 1px 1px rgba(0,0,0,.4)}
.ev-wax:after{content:'';position:absolute;inset:11%;border-radius:inherit;
  border:1px solid color-mix(in srgb,var(--ev-wax-hi,#d69a6d) 46%,transparent);opacity:.7}

/* ── Открытие ───────────────────────────────────────────────────────────
   Печать откалывается → клапан откидывается → письмо выезжает → наезд. */
.ev-scene.is-running .ev-wax{animation:evWaxOff 900ms cubic-bezier(.3,0,.2,1) forwards}
@keyframes evWaxOff{
  0%{transform:translate(-50%,-50%) scale(1) rotate(0)}
  28%{transform:translate(-50%,-58%) scale(1.09) rotate(-5deg)}
  100%{opacity:0;transform:translate(-50%,-125%) scale(.86) rotate(-22deg)}}

.ev-scene.is-running .ev-flap{animation:evFlap 1500ms cubic-bezier(.42,0,.18,1) 420ms forwards}
@keyframes evFlap{
  0%{transform:rotateX(0deg)}
  100%{transform:rotateX(-176deg)}}
/* После полуоборота клапан должен уйти ЗА конверт. */
.ev-scene.is-running .ev-flap{animation-fill-mode:forwards}
.ev-scene.is-flap-back .ev-flap{z-index:1}

.ev-scene.is-running .ev-letter{animation:evLetter 1900ms cubic-bezier(.24,.68,.2,1) 1250ms forwards}
@keyframes evLetter{
  0%{transform:translateY(0)}
  100%{transform:translateY(-74%)}}
.ev-scene.is-running .ev-letter-in{opacity:1;transform:none;transition-delay:1.9s}

/* Наезд камеры: бумага письма вырастает в бумагу страницы. */
.ev-scene.is-leaving .ev-stage{animation:evDolly 1400ms cubic-bezier(.5,0,.25,1) forwards}
.ev-scene.is-leaving{animation:evFade 1400ms cubic-bezier(.55,0,.35,1) forwards}
@keyframes evDolly{0%{transform:rotateX(9deg) scale(1)}100%{transform:rotateX(0deg) scale(3.4) translateY(14%)}}
@keyframes evFade{0%{opacity:1}62%{opacity:.9}100%{opacity:0}}
body.ev-handoff .inv{animation:evMeet 1400ms cubic-bezier(.5,0,.25,1) forwards}
@keyframes evMeet{0%{transform:scale(1.05)}100%{transform:none}}

/* Подсказка: единственный интерактивный элемент сцены. */
.ev-trigger{position:absolute;inset:0;z-index:8;display:grid;width:100%;height:100%;align-content:end;
  justify-items:center;padding:0 20px max(30px,env(safe-area-inset-bottom));border:0;background:transparent;
  color:var(--ev-hint,#e8d6bc);cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.ev-trigger:focus-visible{outline:1px solid currentColor;outline-offset:-14px}
.ev-hint{display:flex;align-items:center;gap:12px;font:600 .64rem/1.3 var(--ev-sans,'Manrope',ui-sans-serif,system-ui,sans-serif);
  letter-spacing:.26em;text-transform:uppercase;text-shadow:0 2px 16px rgba(0,0,0,.5);transition:opacity .5s ease}
.ev-hint:before,.ev-hint:after{content:'';width:24px;height:1px;background:currentColor;opacity:.6}
.ev-scene.is-running .ev-hint{opacity:0}
.ev-scene:not(.is-running) .ev-hint{animation:evHint 3.4s ease-in-out infinite}
@keyframes evHint{0%,100%{opacity:.62}50%{opacity:1}}

/* Reduced-motion гасит только фоновые петли: покачивание конверта, блеск воска
   и мигание подсказки. Само открытие остаётся — иначе гость не поймёт, что
   произошло, и увидит просто исчезнувший конверт. */
@media (prefers-reduced-motion:reduce){
  .ev-env,.ev-hint,.ev-scene:not(.is-running) .ev-wax{animation:none!important}
}


/* ── Живой фон страницы ────────────────────────────────────────────────── */
/* Раньше здесь крутился полноэкранный видеоролик. На телефоне он стоил
   декодирования каждого кадра и нескольких мегабайт трафика — а видно было
   только медленное шевеление света. Теперь то же шевеление делают два
   градиента: они не грузятся, не декодируются и живут на GPU. */
.living-bg{position:fixed;inset:0;z-index:-2;overflow:hidden;background:var(--paper,#f2ede3);pointer-events:none}
.living-bg i{position:absolute;inset:-25%;display:block;
  background:
    radial-gradient(42% 34% at 28% 24%,color-mix(in srgb,var(--accent,#b08968) 22%,transparent),transparent 70%),
    radial-gradient(46% 38% at 74% 68%,color-mix(in srgb,var(--accent-2,#7a8b6f) 18%,transparent),transparent 72%);
  opacity:.7;animation:paperBreath 26s ease-in-out infinite alternate}
.living-bg:after{content:'';position:absolute;inset:0;background:var(--bg-veil,radial-gradient(120% 80% at 50% 0,transparent 40%,rgba(255,255,255,.4)))}
@keyframes paperBreath{from{transform:translate3d(-1.5%,1%,0) scale(1)}to{transform:translate3d(1.5%,-1%,0) scale(1.06)}}

/* Пыльца: несколько точек, плывущих вверх. Дёшево и оживляет кадр. */
.motes{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none}
.motes i{position:absolute;bottom:-12px;width:var(--s,4px);height:var(--s,4px);border-radius:50%;background:var(--mote,rgba(255,255,255,.75));box-shadow:0 0 10px var(--mote,rgba(255,255,255,.6));opacity:0;animation:moteUp var(--t,22s) linear var(--dl,0s) infinite}
@keyframes moteUp{0%{opacity:0;transform:translateY(0) translateX(0)}
  12%{opacity:var(--o,.5)}
  88%{opacity:var(--o,.5)}
  100%{opacity:0;transform:translateY(-104vh) translateX(var(--dx,20px))}}

/* Параллакс: элемент едет медленнее страницы (правила появления — в theme.js).
   Сдвиг пишем в отдельное свойство translate, а не в transform: иначе он
   затирал поворот и центрирование, заданные темой, и кадр уезжал в сторону. */
[data-parallax]{will-change:translate}

/* Плеер: кнопка и выезжающий из-под неё регулятор громкости. Слайдер
   появляется вместе с музыкой и прячется, когда его перестают трогать. */
#mplayer{position:fixed;right:16px;bottom:16px;z-index:8000;display:flex;align-items:center;gap:10px}
#mbtn{position:relative;width:52px;height:52px;border-radius:50%;cursor:pointer;font-size:1.25rem;
  box-shadow:0 4px 14px rgba(0,0,0,.18);flex:0 0 52px}
#mvol{width:0;height:34px;padding:0;margin:0;opacity:0;pointer-events:none;
  transition:width .5s var(--e-signature),opacity .4s ease;
  -webkit-appearance:none;appearance:none;background:transparent;cursor:pointer}
#mplayer.vol-open #mvol{width:clamp(96px,26vw,140px);opacity:1;pointer-events:auto}
#mvol::-webkit-slider-runnable-track{height:4px;border-radius:99px;
  background:linear-gradient(90deg,var(--accent,#b08968) var(--vol,70%),color-mix(in srgb,var(--line,rgba(0,0,0,.2)) 70%,transparent) var(--vol,70%))}
#mvol::-moz-range-track{height:4px;border-radius:99px;background:color-mix(in srgb,var(--line,rgba(0,0,0,.2)) 70%,transparent)}
#mvol::-moz-range-progress{height:4px;border-radius:99px;background:var(--accent,#b08968)}
#mvol::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;margin-top:-7px;border-radius:50%;
  background:var(--paper,#f4efe6);border:1px solid var(--accent,#b08968);box-shadow:0 2px 8px rgba(0,0,0,.28)}
#mvol::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:var(--paper,#f4efe6);
  border:1px solid var(--accent,#b08968);box-shadow:0 2px 8px rgba(0,0,0,.28)}
#mvol:focus-visible{outline:1px solid var(--accent,#b08968);outline-offset:6px}
#mbtn.on{animation:mpulse 2s ease-in-out infinite}
@keyframes mpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}

/* ── Legacy-конверт: страхует оплаченные ссылки на снятых с витрины темах ── */
.envx{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;background:var(--envx-bg,#1a1a1a);transition:opacity .9s ease}
.envx.gone{opacity:0;pointer-events:none}
.env{position:relative;width:min(86vw,430px);aspect-ratio:1.45;perspective:1300px;cursor:pointer}
.env>div{position:absolute}
.env-back{inset:0;z-index:1;background:var(--env-face,#333)}
.env-paper{left:6%;right:6%;top:7%;bottom:9%;z-index:2;background:var(--env-paper,#f6f1e6);transition:transform 1.5s cubic-bezier(.23,.75,.3,1) .95s}
.env-front{inset:0;z-index:3;background:var(--env-face,#333);clip-path:polygon(0 0,50% 47%,100% 0,100% 100%,0 100%)}
.env-flap{left:0;right:0;top:0;height:52%;z-index:4;background:var(--env-flap,var(--env-face,#333));clip-path:polygon(0 0,100% 0,50% 100%);transform-origin:top center;transition:transform 1.25s cubic-bezier(.45,.05,.2,1)}
.env-seal{left:50%;top:47%;width:76px;height:76px;z-index:5;transform:translate(-50%,-50%);border-radius:50%;display:flex;align-items:center;justify-content:center;transition:opacity .55s ease .4s}
.envx.open .env-flap{transform:rotateX(180deg)}
.envx.open .env-seal{opacity:0}
.envx.open .env-paper{transform:translateY(-84%) scale(1.02)}
.env-hint{font-size:.7rem;letter-spacing:3.5px;text-transform:uppercase;color:var(--env-hint,#ddd)}

@media (prefers-reduced-motion:reduce){
.ev-hint,#mbtn.on{animation:none}
.motes{display:none}
.envx,.env-flap,.env-paper,.env-seal{transition:none!important}
}
</style>`;
}

// Полноэкранная сцена открытия. Пользовательские значения экранируются здесь.
export function envelopeScene({ theme, openHint = '', groom = '', bride = '', groomInitial = '', brideInitial = '', sub = '', date = '' } = {}) {
  const t = ENVELOPES[theme] ?? DEFAULT_ENVELOPE;
  const vars = [
    `--ev-paper:${t.paper}`,
    `--ev-paper-2:${t.paper2}`,
    `--ev-liner:${t.liner}`,
    `--ev-wax:${t.wax}`,
    `--ev-wax-hi:${t.waxHi}`,
    `--ev-ink:${t.ink}`,
    `--ev-hint:${t.hint}`,
    `--ev-room:${t.room}`,
  ].join(';');

  const monogram = `${escapeHtml(groomInitial)}${brideInitial ? '&#183;' + escapeHtml(brideInitial) : ''}`;

  return `<div class="ev-scene" data-envelope-scene style="${vars}">
  <div class="ev-room" aria-hidden="true"></div>
  <div class="ev-stage" aria-hidden="true">
    <div class="ev-env">
      <div class="ev-letter">
        <div class="ev-letter-in">
          <small>${escapeHtml(sub)}</small>
          <b>${escapeHtml(groom)}<i>&amp;</i>${escapeHtml(bride)}</b>
          <span>${escapeHtml(date)}</span>
        </div>
      </div>
      <div class="ev-pocket"></div>
      <div class="ev-flap"></div>
      <div class="ev-wax"><b>${monogram}</b></div>
    </div>
  </div>
  <button type="button" class="ev-trigger" data-envelope-trigger aria-label="${escapeHtml(openHint)}">
    <span class="ev-hint">${escapeHtml(openHint)}</span>
  </button>
</div>`;
}

// Живой фон страницы: дышащая акварельная бумага + пыльца.
// Пыльцы немного: каждая частица — узел с бесконечной анимацией, и на телефоне
// заметна не она, а севшая батарея.
export function livingBackground(motes = 4) {
  const dots = Array.from({ length: motes }, (_, i) => {
    const left = ((i * 37) % 100) + ((i % 3) * 2);
    const size = 2 + (i % 4);
    const dur = 18 + ((i * 7) % 16);
    const delay = -((i * 13) % 24);
    const dx = ((i % 5) - 2) * 16;
    const op = (0.28 + ((i % 4) * 0.11)).toFixed(2);
    return `<i style="left:${left}%;--s:${size}px;--t:${dur}s;--dl:${delay}s;--dx:${dx}px;--o:${op}"></i>`;
  }).join('');
  return `<div class="living-bg" aria-hidden="true"><i></i></div>
<div class="motes" aria-hidden="true">${dots}</div>`;
}

/* Звёздное поле приглашения. Раскладка детерминированная: один и тот же
   шаблон всегда даёт одинаковый HTML — это важно для кэша и тестов, а глазу
   хватает того, что размеры, яркость и темп мерцания у звёзд разные. */
export function starfield(count = 34, shooting = 1) {
  const stars = Array.from({ length: count }, (_, i) => {
    const x = ((i * 37 + (i % 7) * 11) % 100).toFixed(2);
    const y = ((i * 53 + (i % 5) * 17) % 100).toFixed(2);
    const size = i % 11 === 0 ? 2.6 : i % 4 === 0 ? 1.8 : 1.1;
    const opacity = (0.32 + ((i % 6) * 0.11)).toFixed(2);
    /* Мерцание вдвое медленнее прежнего: звёзды за текстом должны быть
       атмосферой, а частое мигание фона мешает читать. */
    const period = (7.2 + ((i * 7) % 46) / 5).toFixed(1);
    const delay = (-((i * 13) % 52) / 10).toFixed(1);
    const big = i % 11 === 0 ? ' class="big"' : '';
    return `<i${big} style="--x:${x}%;--y:${y}%;--s:${size}px;--o:${opacity};--t:${period}s;--dl:${delay}s"></i>`;
  }).join('');

  const falls = Array.from({ length: shooting }, (_, i) => {
    const x = (14 + i * 38) % 74;
    const y = (6 + i * 17) % 34;
    const period = 34 + i * 18;
    const delay = -(i * 11);
    const tail = 110 + i * 40;
    return `<u style="--x:${x}%;--y:${y}%;--t:${period}s;--dl:${delay}s;--tail:${tail}px"></u>`;
  }).join('');

  return `<div class="stars" aria-hidden="true">${stars}${falls}</div>
<div class="gilt-dust" aria-hidden="true"></div>`;
}

export function envelopeExperienceScript() {
  return `<script>(function(){
var scene=document.querySelector('[data-envelope-scene]'),legacy=document.getElementById('envx');
var force=(location.hostname==='localhost'||location.hostname==='127.0.0.1')&&new URLSearchParams(location.search).has('__motion_test');
var rm=!force&&window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

function reveal(){
  // Текст, проявляющийся по словам: разбиваем один раз при инициализации.
  [].forEach.call(document.querySelectorAll('.words'),function(w){
    if(w.dataset.split)return;w.dataset.split='1';
    var parts=w.textContent.split(/(\\s+)/),html='',n=0;
    parts.forEach(function(p){
      if(/^\\s*$/.test(p)){html+=p;return}
      html+='<span style="--i:'+(n++)+'">'+p.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</span>';
    });
    w.innerHTML=html;
  });
  // Индексы для каскадов: ячейки отсчёта и числа календаря.
  [].forEach.call(document.querySelectorAll('.cd'),function(g){
    [].forEach.call(g.children,function(c,i){c.style.setProperty('--i',i)});
  });
  var els=[].slice.call(document.querySelectorAll('.fx,.rule,.gold-rule,.glass,.words,.num,.mono,.shot,.cd,.cal'));
  if(rm||!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in')});return}
  var io=new IntersectionObserver(function(en){en.forEach(function(t){if(t.isIntersecting){t.target.classList.add('in');io.unobserve(t.target)}})},{threshold:.1,rootMargin:'0px 0px -6% 0px'});
  els.forEach(function(e){io.observe(e)});

  /* Страховка. Содержимое ждёт появления в кадре, и пока наблюдатель молчит,
     фотография стоит прозрачной — то есть её просто нет. Один порог на весь
     список (10 % площади) не берёт кадр выше экрана: снимок во весь экран
     такой доли в поле зрения может и не набрать. Поэтому по каждому скроллу
     дополнительно проверяем сами: что попало в кадр — показываем, и элемент
     из проверки уходит. Дешево, и «фото не видно» больше не случается. */
  var watch=els.slice(),pending=false;
  function sweep(){
    pending=false;
    for(var i=watch.length-1;i>=0;i--){
      var el=watch[i];
      if(el.classList.contains('in')){watch.splice(i,1);continue}
      var r=el.getBoundingClientRect();
      if(r.bottom>0&&r.top<innerHeight){el.classList.add('in');io.unobserve(el);watch.splice(i,1)}
    }
    if(!watch.length)removeEventListener('scroll',queue);
  }
  function queue(){if(!pending){pending=true;requestAnimationFrame(sweep)}}
  addEventListener('scroll',queue,{passive:true});
  addEventListener('resize',queue,{passive:true});
  setTimeout(sweep,700);
}

// Полоса прочитанного: вторичный слой навигации, ничего не загораживает.
function progress(){
  var bar=document.querySelector('.progress');
  if(!bar)return;
  var tick=false;
  function frame(){
    tick=false;
    var h=document.documentElement.scrollHeight-innerHeight;
    bar.style.setProperty('--p',h>0?Math.min(1,scrollY/h).toFixed(4):0);
  }
  addEventListener('scroll',function(){if(!tick){tick=true;requestAnimationFrame(frame)}},{passive:true});
  addEventListener('resize',frame);frame();
}

// Параллакс: элементы едут медленнее страницы.
function parallax(){
  var items=[].slice.call(document.querySelectorAll('[data-parallax]'));
  if(!items.length||rm)return;
  var tick=false;
  function frame(){
    tick=false;
    var vh=innerHeight;
    items.forEach(function(el){
      var r=el.getBoundingClientRect(),k=Number(el.getAttribute('data-parallax'))||.12;
      var mid=r.top+r.height/2-vh/2;
      el.style.translate='0 '+(-mid*k).toFixed(2)+'px';
    });
  }
  addEventListener('scroll',function(){if(!tick){tick=true;requestAnimationFrame(frame)}},{passive:true});
  addEventListener('resize',frame);frame();
}

// Шелест бумаги под фазы ролика.
function sfx(){try{var C=window.AudioContext||window.webkitAudioContext;if(!C)return;
var c=new C(),now=c.currentTime;
function noise(delay,duration,freq,volume){var n=Math.floor(c.sampleRate*duration),b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0),i;
for(i=0;i<n;i++){var edge=Math.sin(Math.PI*i/n);d[i]=(Math.random()*2-1)*edge}
var s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain(),at=now+delay;s.buffer=b;f.type='bandpass';f.frequency.value=freq;f.Q.value=.72;
g.gain.setValueAtTime(.0001,at);g.gain.linearRampToValueAtTime(volume,at+Math.min(.1,duration*.2));g.gain.exponentialRampToValueAtTime(.0001,at+duration);
s.connect(f);f.connect(g);g.connect(c.destination);s.start(at)}
noise(.05,.2,700,.12);noise(.55,1.05,1180,.05);noise(1.15,1.3,850,.055);
setTimeout(function(){try{c.close()}catch(e){}},3800)}catch(e){}}

function music(delay){setTimeout(function(){if(window.__music)window.__music.start()},delay)}

function start(){reveal();parallax();progress()}

// Карусель шаблонов в форме рендерит страницу без открытия.
if(document.body.hasAttribute('data-card-preview')){
  if(scene)scene.hidden=true;
  if(legacy)legacy.style.display='none';
  document.body.classList.remove('locked');start();return;
}

// ── Открытие конвертом ───────────────────────────────────────────────────
// Одна партитура на все темы: печать откалывается (0.9 c), клапан откидывается
// (0.42–1.92 c), письмо выезжает (1.25–3.15 c), камера наезжает (3.4–4.8 c).
// Медленно — это осознанно: гость должен успеть рассмотреть конверт.
if(scene){
  var trigger=scene.querySelector('[data-envelope-trigger]'),running=false,finished=false;
  document.body.classList.add('locked');
  function finish(){
    if(finished)return;finished=true;
    scene.hidden=true;
    document.body.classList.remove('ev-handoff');
    document.body.classList.remove('locked');
    start();
  }
  function openEnvelope(){
    if(running)return;running=true;
    scene.classList.add('is-running');
    if(!rm)sfx();
    music(rm?0:900);
    if(rm){finish();return}
    // Клапан перевалил за вертикаль — прячем его за конверт.
    setTimeout(function(){scene.classList.add('is-flap-back')},1500);
    setTimeout(function(){document.body.classList.add('ev-handoff');scene.classList.add('is-leaving')},3400);
    setTimeout(finish,4700);
  }
  trigger.addEventListener('click',openEnvelope);
  trigger.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();openEnvelope()}});
  return;
}

// ── Legacy-конверт: старые оплаченные ссылки ─────────────────────────────
if(!legacy){start();return}
var env=document.getElementById('env');
if(!env){legacy.style.display='none';start();return}
document.body.classList.add('locked');
var fin=false;
function openLegacy(){if(fin)return;fin=true;legacy.classList.add('open');
if(!rm)sfx();
music(rm?50:1250);
setTimeout(function(){legacy.classList.add('gone')},rm?50:2550);
setTimeout(function(){legacy.style.display='none';document.body.classList.remove('locked');start()},rm?400:3450);}
env.addEventListener('click',openLegacy);
env.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();openLegacy()}});
})();</script>`;
}
