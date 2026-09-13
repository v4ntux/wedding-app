// Ядро оформления приглашений: типографика, сетка, компоненты и вся моушн-система.
// Шаблон из templates/ подключает {{{coreCSS}}} и задаёт поверх только палитру,
// шрифты и собственный декор — поэтому новая тема стоит сотню строк, а не пятьсот.
//
// ── Моушн-система (Premium) ───────────────────────────────────────────────
// Одна кривая на 80 % движений; входы тормозятся, выходы разгоняются. Никакого
// linear для перемещений: линейно двигаются только бесконечные петли (пыльца).
//
//   --e-signature  cubic-bezier(.4,0,.2,1)    основная
//   --e-enter      cubic-bezier(.05,.7,.1,1)  появление
//   --e-exit       cubic-bezier(.3,0,1,1)     уход
//   --t-quick 180ms · --t-base 420ms · --t-slow 780ms · --t-epic 1100ms
//
// В каждой сцене три слоя: основной (контент), вторичный (тени, линии, иконки)
// и фоновый (живая бумага, пыльца, дыхание монограммы). Без третьего слоя
// страница выглядит плоской, сколько ни полируй первый.

// Бумажное зерно: перекрывает плоскость заливки, без него фон выглядит
// напечатанным на пластике.
const GRAIN_URL = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.86' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.055'/%3E%3C/svg%3E\")";

export function coreCSS() {
  return `<style>
*{box-sizing:border-box;margin:0;padding:0}

:root{
  --e-signature:cubic-bezier(.4,0,.2,1);
  --e-enter:cubic-bezier(.05,.7,.1,1);
  --e-exit:cubic-bezier(.3,0,1,1);
  --e-settle:cubic-bezier(.22,.61,.36,1);
  --t-quick:200ms; --t-base:520ms; --t-slow:960ms; --t-epic:1500ms;
  --grain:${GRAIN_URL};
}

html{scroll-behavior:smooth;background:var(--paper,#f4efe6)}
body{min-width:320px;overflow-x:hidden;background:transparent;color:var(--ink,#2c352d);
  font:300 1rem/1.75 var(--sans,system-ui,sans-serif);-webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility}

/* ── Каркас ────────────────────────────────────────────────────────────── */
.inv{position:relative;width:100%;overflow:clip}
.sec{position:relative;padding:clamp(78px,17vw,140px) clamp(20px,6vw,40px);text-align:center}
.sec--solid{background:var(--paper,#f4efe6)}
.sec--tint{background:linear-gradient(180deg,color-mix(in srgb,var(--paper,#f4efe6) 74%,transparent),color-mix(in srgb,var(--paper-2,#eae3d6) 92%,transparent))}
.sec--solid:before,.sec--tint:before{content:'';position:absolute;inset:0;pointer-events:none;background-image:var(--grain)}
.wrap{position:relative;z-index:1;width:min(100%,720px);margin:0 auto}

/* Полоса прочитанного: тончайший индикатор, вторичный слой навигации. */
.progress{position:fixed;top:0;left:0;z-index:8500;height:2px;width:100%;transform:scaleX(var(--p,0));
  transform-origin:left;background:linear-gradient(90deg,var(--accent,#b08968),var(--accent-2,#7a8b6f));
  opacity:.75;pointer-events:none;will-change:transform}

/* ── Типографика ───────────────────────────────────────────────────────── */
.num{display:inline-flex;align-items:center;gap:11px;color:var(--accent-2,#7a8b6f);
  font:500 .58rem/1 var(--sans);letter-spacing:.34em;text-transform:uppercase}
.num:before,.num:after{content:'';width:0;height:1px;background:currentColor;opacity:.55;
  transition:width var(--t-slow) var(--e-signature) var(--d,0s)}
.num.in:before,.num.in:after{width:18px}

.h2{margin:.42em 0 .3em;color:var(--ink);
  font:300 clamp(2.1rem,8.6vw,3.4rem)/1.06 var(--display);letter-spacing:-.02em;text-wrap:balance}
.lead{max-width:34ch;margin:0 auto;color:var(--muted,#767c6f);
  font:300 clamp(1rem,3.9vw,1.12rem)/1.72 var(--sans)}
.amp{display:block;margin:.08em auto;color:var(--accent,#b08968);font:400 1.5em/1 var(--script,var(--display))}

/* ── Монограмма ────────────────────────────────────────────────────────── */
/* Кольцо прорисовывается штрихом, инициалы проступают следом — вторичный слой
   догоняет основной, а не появляется вместе с ним. */
.mono{position:relative;display:grid;width:clamp(54px,14vw,66px);aspect-ratio:1;margin:0 auto;place-items:center;
  color:var(--accent,#b08968);font:400 clamp(1.5rem,5vw,1.9rem)/1 var(--script,var(--display))}
.mono svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.mono circle{fill:none;stroke:var(--line,rgba(44,53,45,.16));stroke-width:1;
  stroke-dasharray:302;stroke-dashoffset:302;transform:rotate(-90deg);transform-origin:50% 50%}
.mono.in circle{stroke-dashoffset:0;transition:stroke-dashoffset var(--t-epic) var(--e-signature) var(--d,0s)}
.mono b{position:relative;font-weight:400;opacity:0;transform:scale(.9)}
.mono.in b{opacity:1;transform:none;transition:opacity var(--t-slow) ease calc(var(--d,0s) + .34s),transform var(--t-slow) var(--e-settle) calc(var(--d,0s) + .34s)}
/* Фоновый слой: монограмма едва заметно дышит, когда всё уже на месте. */
.mono.in{animation:monoBreath 7s ease-in-out 1.6s infinite}
@keyframes monoBreath{0%,100%{transform:scale(1)}50%{transform:scale(1.028)}}
.mono--filled{border-radius:50%;background:var(--paper-2,#eae3d6)}

/* ── Появление содержимого ─────────────────────────────────────────────── */
/* Только прозрачность и сдвиг: размытие целой секции телефон считает каждый
   кадр, а на глаз добавляет к появлению почти ничего. */
.fx{opacity:0;transform:translateY(26px)}
.fx.in{opacity:1;transform:none;
  transition:opacity var(--t-slow) ease var(--d,0s),
             transform var(--t-epic) var(--e-enter) var(--d,0s)}
.fx--rise{transform:translateY(46px) scale(.985)}

/* Линия прочерчивается, а не проявляется. */
.rule{width:1px;height:var(--h,64px);margin:0 auto;background:currentColor;color:var(--line,rgba(44,53,45,.16));
  transform:scaleY(0);transform-origin:top}
.rule.in{transform:scaleY(1);transition:transform var(--t-epic) var(--e-signature) var(--d,0s)}
.rule--x{width:var(--w,120px);height:1px;transform:scaleX(0);transform-origin:center}
.rule--x.in{transform:scaleX(1)}

/* Имена пары — единственное место, где стоит разбирать строку до букв:
   это заголовок всей страницы, и он собирается из ничего на глазах. Каждая
   буква приходит со своей задержкой, из мягкой расфокусировки в резкость. */
.letters span{display:inline-block;white-space:pre;opacity:0;
  transform:translateY(.32em) scale(.94);filter:blur(7px)}
.letters.in span{opacity:1;transform:none;filter:blur(0);
  transition:opacity .62s ease,transform .95s var(--e-enter),filter .7s ease;
  transition-delay:calc(var(--d,0s) + var(--i,0)*.042s)}

/* Текст проявляется по словам — каскад 55 мс, суммарно в пределах полусекунды. */
.words span{display:inline-block;opacity:0;transform:translateY(.4em)}
.words.in span{opacity:1;transform:none;
  transition:opacity var(--t-base) ease,transform var(--t-slow) var(--e-enter);
  transition-delay:calc(var(--d,0s) + var(--i,0)*.055s)}

/* ── Фотография ────────────────────────────────────────────────────────── */
/* Кадр проявляется, изображение внутри доезжает своим ходом (follow-through),
   тень догоняет последней. Кадр всегда по центру колонки: смещать его влево
   или вправо тема не может — иначе на телефоне лицо уезжает за край.
   Шторку на clip-path не используем: она мешала темам со своей формой кадра
   (арка, медальон, ар-деко) и стоила лишней перерисовки на каждом кадре. */
.shot{position:relative;width:min(100%,560px);margin-inline:auto;aspect-ratio:4/5;overflow:hidden;
  background:var(--paper-3,#ded5c4);opacity:0;box-shadow:0 0 0 rgba(44,53,45,0)}
.shot.in{opacity:1;box-shadow:0 26px 60px -34px rgba(44,53,45,.5);
  transition:opacity var(--t-slow) ease var(--d,0s),box-shadow var(--t-slow) ease calc(var(--d,0s) + .3s)}
/* Точка внимания чуть выше центра: на свадебном снимке лица стоят в верхней
   половине кадра, и обрезка «по центру» в широкой рамке срезала головы.
   Тема может сдвинуть её своей --shot-focus, если у неё другая пропорция. */
.shot img{width:100%;height:100%;object-fit:cover;object-position:var(--shot-focus,50% 38%);
  filter:saturate(.86) contrast(1.02);
  transform:scale(1.08);transition:transform 1.9s var(--e-signature) var(--d,0s)}
.shot.in img{transform:scale(1)}
.shot:before{content:'';position:absolute;inset:14px;z-index:2;border:1px solid rgba(255,255,255,.6);pointer-events:none;
  opacity:0;transition:opacity var(--t-slow) ease calc(var(--d,0s) + .5s)}
.shot.in:before{opacity:1}
.shot:after{content:'';position:absolute;inset:0;z-index:1;pointer-events:none;
  background:linear-gradient(180deg,rgba(20,26,20,.14),transparent 34% 60%,rgba(20,26,20,.4))}
.shot--wide{aspect-ratio:3/4;width:min(100%,640px)}
.shot__cap{position:absolute;right:clamp(20px,6vw,30px);bottom:clamp(18px,5vw,26px);left:clamp(20px,6vw,30px);
  z-index:3;color:#fff;text-align:left;text-shadow:0 2px 18px rgba(0,0,0,.45)}
.shot__cap span{display:block;font:500 .56rem/1 var(--sans);letter-spacing:.3em;text-transform:uppercase;opacity:.88}
.shot__cap b{display:block;margin-top:8px;font:300 clamp(1.5rem,6vw,2.2rem)/1.1 var(--display)}

/* ── Дата и календарь ──────────────────────────────────────────────────── */
.when{display:grid;gap:clamp(26px,6vw,38px);justify-items:center}
.when__big{display:flex;align-items:baseline;justify-content:center;gap:clamp(10px,3vw,18px);
  color:var(--ink);font:300 clamp(3.6rem,17vw,6rem)/1 var(--display);letter-spacing:-.03em;font-variant-numeric:lining-nums}
.when__big em{color:var(--muted);font:300 clamp(1rem,3.6vw,1.15rem)/1 var(--sans);font-style:normal;
  letter-spacing:.24em;text-transform:uppercase}
.when__time{color:var(--accent,#b08968);font:400 clamp(1.5rem,6vw,2rem)/1 var(--display);font-style:italic}

.cal{width:min(100%,360px);border-collapse:collapse;color:var(--muted);font:400 .8rem/1 var(--sans)}
.cal caption{padding-bottom:16px;color:var(--accent-2,#7a8b6f);font:500 .58rem/1 var(--sans);letter-spacing:.3em;text-transform:uppercase}
.cal th{padding:0 0 12px;color:var(--accent-2,#7a8b6f);font:600 .56rem/1 var(--sans);letter-spacing:.14em;text-transform:uppercase;opacity:.72}
.cal td{position:relative;padding:8px 0;text-align:center}
/* Числа месяца проступают волной слева направо — каскад по 18 мс. */
.cal td span{display:inline-block;opacity:0;transform:translateY(6px)}
.cal.in td span{opacity:1;transform:none;transition:opacity 340ms ease,transform 420ms var(--e-enter);
  transition-delay:calc(var(--i,0)*18ms)}
.cal td.on{color:var(--ink);font-weight:500}
/* Кружок вокруг дня свадьбы обводится штрихом — это и есть точка внимания. */
.cal td.on:before{content:'';position:absolute;top:50%;left:50%;width:34px;height:34px;
  border:1px solid var(--accent,#b08968);border-radius:50%;transform:translate(-50%,-50%) scale(.4) rotate(-30deg);opacity:0}
.cal.in td.on:before{transform:translate(-50%,-50%) scale(1) rotate(0);opacity:1;
  transition:transform var(--t-epic) var(--e-settle) .75s,opacity var(--t-base) ease .75s}

/* ── Отсчёт ────────────────────────────────────────────────────────────── */
/* Четыре равные колонки, которым нельзя разъехаться: minmax(0,1fr) и min-width
   держат ячейку в её доле, а размер цифр подобран так, чтобы три знака дней
   («365») умещались в колонку на узком телефоне. Иначе разряд вылезал на
   соседний и перекрывал секунды. */
.cd{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));width:min(100%,600px);margin:0 auto}
.cd>div{position:relative;min-width:0;padding:clamp(14px,4vw,22px) 4px;opacity:0;transform:translateY(20px)}
.cd.in>div{opacity:1;transform:none;
  transition:opacity var(--t-base) ease,transform var(--t-slow) var(--e-enter);
  transition-delay:calc(var(--d,0s) + var(--i,0)*70ms)}
.cd>div+div:before{content:'';position:absolute;top:22%;bottom:22%;left:0;width:1px;background:var(--line-soft,rgba(44,53,45,.09))}
/* Высота строки здесь равна высоте барабана из countdownScript (1.12em): окно
   разряда закрыто именно там, и уходящая цифра секунд физически не может
   выехать на дни или часы. Сам разряд overflow не режет — иначе тема со
   свечением цифр (deco) получила бы срез по краю строки. */
.cd b{display:flex;align-items:flex-end;justify-content:center;isolation:isolate;
  color:var(--ink);font:300 clamp(1.9rem,9vw,3.3rem)/1.12 var(--display);
  letter-spacing:-.02em;font-variant-numeric:tabular-nums;white-space:nowrap}
.cd>div>span{display:block;margin-top:12px;color:var(--muted);font:500 .54rem/1 var(--sans);letter-spacing:.2em;text-transform:uppercase}

/* ── Место ─────────────────────────────────────────────────────────────── */
.venue__name{margin:.3em auto .5em;max-width:20ch;color:var(--ink);
  font:300 clamp(2rem,8.4vw,3.1rem)/1.1 var(--display);text-wrap:balance}
/* Вид и ориентир тойхоны из справочника: гость понимает, куда именно ехать. */
.venue__meta{margin:-.1em auto 1.2em;max-width:34ch;color:var(--muted);
  font:500 .72rem/1.6 var(--sans);letter-spacing:.14em;text-transform:uppercase;text-wrap:balance}
.mapbox{position:relative;width:min(100%,720px);margin:0 auto;overflow:hidden;background:var(--paper-3,#ded5c4)}
.mapbox iframe{display:block;width:100%;height:clamp(260px,42vh,360px);border:0;filter:grayscale(.5) sepia(.16) contrast(.96)}
.mapbox:after{content:'';position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 0 1px var(--line,rgba(44,53,45,.16))}
.mapbox .nvmap{display:block;width:100%;height:clamp(260px,42vh,360px)}
.routes{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:26px}
/* Кнопка: заливка приходит снизу, нажатие даёт короткую отдачу. */
.routes a{position:relative;overflow:hidden;padding:14px 28px;border:1px solid var(--line);color:var(--ink);
  text-decoration:none;font:500 .6rem/1 var(--sans);letter-spacing:.22em;text-transform:uppercase;
  transition:color var(--t-base) var(--e-signature),border-color var(--t-base) var(--e-signature),transform var(--t-quick) var(--e-signature)}
.routes a:before{content:'';position:absolute;inset:0;z-index:-1;background:var(--accent,#b08968);
  transform:translateY(101%);transition:transform var(--t-base) var(--e-signature)}
.routes a:hover{color:var(--paper,#f4efe6);border-color:var(--accent,#b08968)}
.routes a:hover:before{transform:none}
.routes a:active{transform:scale(.97)}

/* ── Финал ─────────────────────────────────────────────────────────────── */
.final{padding-block:clamp(96px,20vw,160px)}
.final__quote{max-width:18ch;margin:.36em auto .5em;color:var(--ink);
  font:300 clamp(2.2rem,9.6vw,3.6rem)/1.12 var(--display);font-style:italic;text-wrap:balance}
.final__sign{color:var(--muted);font:500 .58rem/1 var(--sans);letter-spacing:.3em;text-transform:uppercase}
/* Подпись платформы — реклама, поэтому живая и кликабельная (см. madeFooter):
   кольца прорисовываются, по «nVate.uz» проходит блик, стрелка зовёт к боту. */
.made{position:relative;z-index:1;padding:30px 18px calc(30px + env(safe-area-inset-bottom));
  background:var(--paper-2,#eae3d6);color:var(--muted);text-align:center}
.made__link{display:inline-flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px 14px;
  max-width:100%;padding:12px 18px 12px 14px;color:inherit;text-decoration:none;
  border:1px solid color-mix(in srgb,var(--gold,#c9a55a) 34%,transparent);border-radius:999px;
  background:color-mix(in srgb,var(--paper,#f4efe6) 55%,transparent);-webkit-tap-highlight-color:transparent;
  transition:transform var(--t-base) var(--e-settle),border-color var(--t-base) ease,box-shadow var(--t-base) ease}
.made__link:hover,.made__link:focus-visible{transform:translateY(-2px);border-color:var(--gold,#c9a55a);
  box-shadow:0 14px 34px -18px rgba(var(--gold-rgb,201,165,90),.75);outline:none}
.made__link:active{transform:scale(.98)}
.made__rings{width:44px;height:27px;flex:0 0 44px;overflow:visible}
.made__rings circle{fill:none;stroke:var(--gold,#c9a55a);stroke-width:1.7;stroke-dasharray:76;stroke-dashoffset:76}
.made.in .made__rings circle{animation:madeDraw 1.4s var(--e-signature) .2s forwards}
.made.in .made__rings circle+circle{animation-delay:.55s}
.made__copy{display:grid;gap:6px;text-align:left}
.made__copy small{font:500 .54rem/1 var(--sans);letter-spacing:.24em;text-transform:uppercase;opacity:.82}
.made__copy b{font:400 1.45rem/1 var(--display);letter-spacing:.01em;color:transparent;
  background:linear-gradient(100deg,var(--ink) 0 38%,var(--gold-hi,#fff0c8) 48%,var(--gold,#c9a55a) 54%,var(--ink) 64% 100%);
  background-size:260% 100%;background-position:100% 0;-webkit-background-clip:text;background-clip:text}
.made.in .made__copy b{animation:madeShine 5s var(--e-signature) 1.2s infinite}
.made__copy i{font-style:normal;color:var(--gold,#c9a55a);-webkit-text-fill-color:var(--gold,#c9a55a)}
.made__cta{display:grid;justify-items:start;gap:5px;padding-left:14px;text-align:left;
  border-left:1px solid color-mix(in srgb,var(--gold,#c9a55a) 30%,transparent)}
.made__cta em{display:inline-flex;align-items:center;gap:5px;color:var(--gold,#c9a55a);font:600 .74rem/1 var(--sans);font-style:normal}
.made__cta em svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.made.in .made__cta em svg{animation:madeNudge 2.2s var(--e-settle) 2s infinite}
.made__cta>span{font:500 .5rem/1 var(--sans);letter-spacing:.18em;text-transform:uppercase;opacity:.78}
@keyframes madeDraw{to{stroke-dashoffset:0}}
@keyframes madeShine{0%{background-position:100% 0}45%,100%{background-position:0 0}}
@keyframes madeNudge{0%,55%,100%{transform:none}28%{transform:translateX(4px)}}
/* На узком экране призыв встаёт под подписью: вместо черты сбоку — тонкая
   линия сверху, иначе вертикальный разделитель повисал на второй строке. */
@media (max-width:440px){
  .made__link{border-radius:22px;padding:14px 20px}
  .made__cta{flex-basis:100%;justify-items:center;padding:11px 0 0;border-left:0;
    border-top:1px solid color-mix(in srgb,var(--gold,#c9a55a) 24%,transparent)}
}

#mbtn{border:1px solid var(--line);background:color-mix(in srgb,var(--paper,#f4efe6) 92%,transparent);
  color:var(--accent-2,#7a8b6f);backdrop-filter:blur(10px);
  transition:transform var(--t-quick) var(--e-signature),background var(--t-base) var(--e-signature),color var(--t-base) var(--e-signature)}
#mbtn:active{transform:scale(.94)}
#mbtn.on{background:var(--accent-2,#7a8b6f);color:var(--paper,#f4efe6)}

/* ══ Ночь, золото и стекло ══════════════════════════════════════════════
   Общий премиальный слой: звёздное поле на фоне, стеклянные карточки и
   золотая типографика. Шаблон включает их палитрой и разметкой — сам слой
   один на все темы, поэтому пять шаблонов держат единый уровень отделки. */

/* Звёздное поле. Позиции и тайминги приходят из разметки (starfield()),
   поэтому небо у каждого шаблона своё, а код — общий. */
/* Без mix-blend-mode: полноэкранный слой со смешиванием заставляет телефон
   пересобирать кадр целиком, а разница на золотом фоне почти не видна.
   Сияние осталось только у крупных звёзд — оно там и читается. */
.stars{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;
  opacity:var(--stars-opacity,1)}
.stars i{position:absolute;top:var(--y);left:var(--x);width:var(--s,2px);aspect-ratio:1;border-radius:50%;
  background:var(--star,#fff3d2);opacity:calc(var(--o,.6) * .4);
  animation:starTwinkle var(--t,5s) ease-in-out var(--dl,0s) infinite alternate}
.stars i.big{box-shadow:0 0 calc(var(--s,2px) * 3) rgba(255,232,183,.55)}
/* Крупные звёзды получают лучи — тот самый блеск дорогой оптики. */
.stars i.big:before,.stars i.big:after{content:'';position:absolute;top:50%;left:50%;
  background:linear-gradient(90deg,transparent,var(--star,#fff3d2),transparent);
  transform:translate(-50%,-50%)}
.stars i.big:before{width:calc(var(--s,2px) * 9);height:1px}
.stars i.big:after{width:1px;height:calc(var(--s,2px) * 9);
  background:linear-gradient(180deg,transparent,var(--star,#fff3d2),transparent)}
@keyframes starTwinkle{from{opacity:calc(var(--o,.6) * .32);transform:scale(.78)}
  to{opacity:var(--o,.6);transform:scale(1.06)}}

/* Падающая звезда: редкая, медленная, с золотым хвостом. */
.stars u{position:absolute;top:var(--y);left:var(--x);width:2px;height:2px;border-radius:50%;
  background:#fff8e4;box-shadow:0 0 12px 2px rgba(255,231,178,.8);opacity:0;
  animation:starFall var(--t,14s) cubic-bezier(.3,0,.6,1) var(--dl,0s) infinite}
.stars u:after{content:'';position:absolute;top:50%;right:0;width:var(--tail,120px);height:1px;
  background:linear-gradient(90deg,transparent,rgba(255,236,196,.85));transform:translateY(-50%) rotate(0)}
@keyframes starFall{
  0%,84%{opacity:0;transform:translate3d(0,0,0) rotate(24deg)}
  86%{opacity:1}
  100%{opacity:0;transform:translate3d(46vw,32vh,0) rotate(24deg)}}

/* Золотая пыль поверх ночи — глубина между звёздами и контентом. */
.gilt-dust{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.5;
  background:
    radial-gradient(58% 34% at 50% 0%,rgba(var(--gold-rgb,214,178,110),.22),transparent 68%),
    radial-gradient(42% 28% at 8% 74%,rgba(var(--gold-rgb,214,178,110),.13),transparent 72%),
    radial-gradient(46% 30% at 96% 42%,rgba(var(--gold-rgb,214,178,110),.11),transparent 74%);
  animation:giltBreath 14s ease-in-out infinite alternate}
@keyframes giltBreath{from{opacity:.36;transform:translate3d(0,0,0) scale(1)}
  to{opacity:.62;transform:translate3d(0,-1.4%,0) scale(1.04)}}

/* Стеклянная карточка: один рецепт на дату, отсчёт, карту и цитату. */
.glass{position:relative;padding:clamp(26px,7vw,44px) clamp(20px,6vw,38px);
  border:1px solid var(--glass-edge,rgba(255,246,225,.22));border-radius:var(--glass-radius,26px);
  background:var(--glass-face,linear-gradient(158deg,rgba(255,248,232,.12),rgba(255,240,214,.04) 46%,rgba(10,8,5,.14)));
  box-shadow:0 30px 70px -44px rgba(0,0,0,.85),inset 0 1px 0 rgba(255,252,244,.28);
  -webkit-backdrop-filter:blur(14px) saturate(1.4);backdrop-filter:blur(14px) saturate(1.4);
  overflow:hidden;isolation:isolate}
.glass>*{position:relative;z-index:1}
/* Блик по стеклу — медленно проходит один раз при появлении секции. */
.glass:before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;
  background:linear-gradient(122deg,rgba(255,255,255,.2) 0%,rgba(255,255,255,.06) 20%,transparent 44%)}
.glass:after{content:'';position:absolute;top:0;bottom:0;left:-60%;z-index:0;width:45%;pointer-events:none;
  background:linear-gradient(100deg,transparent,rgba(255,247,224,.16),transparent);
  transform:skewX(-14deg);opacity:0}
.glass.in:after{animation:glassSweep 2.6s var(--e-signature) .5s 1 both}
/* Карточка не просто проявляется — она ложится на страницу: чуть отклонена
   к зрителю и выравнивается. Поворот крошечный, но глазу видно вес. */
.card.fx{transform:translateY(34px) perspective(900px) rotateX(5deg);transform-origin:50% 0}
.card.fx.in{transform:none;
  transition:opacity var(--t-slow) ease var(--d,0s),
             transform 1.35s var(--e-settle) var(--d,0s)}
@keyframes glassSweep{0%{left:-60%;opacity:0}18%{opacity:.9}100%{left:120%;opacity:0}}
.glass--tight{padding:clamp(20px,5vw,30px)}

/* Золотая надпись: настоящий градиент металла, а не плоский цвет. Блик стоит
   на месте — бегущий градиент по тексту заставлял телефон перерисовывать
   каждую золотую строку бесконечно. */
.gilt{background:linear-gradient(112deg,var(--gold-lo,#8a6a2f) 0%,var(--gold,#d9b874) 30%,
  var(--gold-hi,#fff0c8) 50%,var(--gold,#d9b874) 70%,var(--gold-lo,#8a6a2f) 100%);
  background-size:100% 100%;background-position:0 0;
  -webkit-background-clip:text;background-clip:text;color:transparent}
/* Золото по буквам не разложить: цвет даёт фон родителя, подрезанный по
   глифам, и прозрачность отдельной буквы его не тронет. Поэтому имена
   оживают иначе — по надписи один раз проливается металл: широкий градиент
   проезжает от края к центру и там замирает. Одиночный проход, не петля. */
.gilt.in{animation:giltPour 1.9s var(--e-signature) calc(var(--d,0s) + .1s) both}
@keyframes giltPour{
  from{background-size:260% 100%;background-position:118% 0}
  to{background-size:100% 100%;background-position:0 0}
}

/* Золотая линия-разделитель с сиянием по центру. */
.gold-rule{width:min(78%,320px);height:1px;margin:clamp(26px,6vw,38px) auto;
  background:linear-gradient(90deg,transparent,var(--gold,#d9b874),transparent);
  box-shadow:0 0 18px rgba(var(--gold-rgb,214,178,110),.4);
  transform:scaleX(0);transform-origin:center}
.gold-rule.in{transform:scaleX(1);transition:transform var(--t-epic) var(--e-signature) var(--d,0s)}
/* По прочерченной линии один раз проходит блик — как свет по натянутой нити. */
.gold-rule{position:relative;overflow:hidden}
.gold-rule:after{content:'';position:absolute;inset:0;transform:translateX(-120%);
  background:linear-gradient(90deg,transparent,rgba(255,248,225,.95),transparent)}
.gold-rule.in:after{animation:ruleGlint 1.5s var(--e-signature) calc(var(--d,0s) + .55s) both}
@keyframes ruleGlint{to{transform:translateX(120%)}}

@media (prefers-reduced-motion:reduce){
  .stars i,.stars u,.gilt-dust{animation:none!important}
  .glass.in:after{animation:none!important;opacity:0}
}

/* Узкий экран — самый слабый процессор: размытие под стеклом тут дороже всего.
   Карточек со стеклом на странице четыре и больше, поэтому на телефоне
   размытие снимается совсем, а плотность фона карточки поднимается — текст на
   ней читается так же, но кадр собирается без повторного размытия фона.
   Заодно гаснет золотая пыль: полноэкранный дышащий слой на телефоне не виден
   почти никак, а перерисовывается постоянно. */
@media (max-width:560px){
  .glass{-webkit-backdrop-filter:none;backdrop-filter:none;
    background:var(--glass-face-solid,linear-gradient(158deg,rgba(255,248,232,.2),rgba(255,240,214,.09) 46%,rgba(10,8,5,.34)))}
  .gilt-dust{animation:none;opacity:.34}
}

@media(min-width:820px){.sec{padding-block:clamp(120px,13vw,180px)}}

@media (prefers-reduced-motion:reduce){
  .fx,.words span,.letters span,.cd>div,.cal td span,.mono b,.shot{opacity:1!important;transform:none!important;filter:none!important}
  .gold-rule.in:after{animation:none;opacity:0}
  .made__rings circle{stroke-dashoffset:0!important;animation:none!important}
  .made__copy b,.made__cta em svg{animation:none!important}
  .rule,.mono circle{transform:none!important;stroke-dashoffset:0!important}
  .shot img{transform:none!important}
  .mono.in,.gilt.in{animation:none}
  .num:before,.num:after{width:18px}
  .cal td.on:before{transform:translate(-50%,-50%)!important;opacity:1!important}
}
</style>`;
}

// Монограмма с прорисовкой кольца: используется в титуле и финале.
export function monogram(initials, cls = '') {
  const safe = String(initials ?? '')
    .slice(0, 4)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<div class="mono ${cls}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48"/></svg><b>${safe}</b></div>`;
}
