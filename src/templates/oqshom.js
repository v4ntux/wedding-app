import { GRAIN, experienceCSS, envelopeHTML, experienceScript, audioWidget, countdownScript } from './shared.js';

// Oqshom — вечерний сад: глубокая хвойная зелень и шампань-«фольга».
// Подпись шаблона: золотые ботанические ветви, дорисовывающие себя при появлении.

// Ветвь с листьями: штрих дорисовывается через stroke-dashoffset (класс .draw).
function branch(flip = false) {
  return `<svg class="branch${flip ? ' flip' : ''}" viewBox="0 0 220 44" fill="none" aria-hidden="true">
<path class="draw" pathLength="100" d="M6 32 C48 12 96 34 130 24 C160 15 190 22 214 12" stroke="#C2A660" stroke-width="1.1"/>
<path class="draw" pathLength="100" d="M52 24 C56 16 62 13 70 13 C68 21 62 26 52 24Z" stroke="#C2A660" stroke-width=".9"/>
<path class="draw" pathLength="100" d="M96 30 C100 22 106 19 114 19 C112 27 106 32 96 30Z" stroke="#C2A660" stroke-width=".9"/>
<path class="draw" pathLength="100" d="M150 20 C154 12 160 9 168 9 C166 17 160 22 150 20Z" stroke="#C2A660" stroke-width=".9"/>
<circle cx="36" cy="26" r="1.6" fill="#C2A660" opacity=".8"/>
<circle cx="132" cy="24" r="1.5" fill="#C2A660" opacity=".7"/>
<circle cx="196" cy="17" r="1.4" fill="#C2A660" opacity=".6"/>
</svg>`;
}

export default function oqshom(d) {
  const seal = `<span class="sealtxt">${d.groom.charAt(0)}<i>·</i>${d.bride.charAt(0)}</span>`;
  const front = `<div class="env-sprig">${branch()}</div>`;
  return `<!DOCTYPE html>
<html lang="${d.lang}">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${d.groom} &amp; ${d.bride} — ${d.L.sub}</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Prata&family=Manrope:wght@300;500&display=swap" rel="stylesheet">
${experienceCSS()}
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--night:#212C24;--night-d:#18211A;--champ:#E7D8B7;--gold:#C2A660;--ivory:#F1ECE0;--sage:#8FA084;
--envx-bg:linear-gradient(170deg,#10160F,#1C261E 60%,#141C15);--env-face:#1D2820;--env-flap:#161F18;--env-paper:#F1ECE0;--env-hint:#C2A660}
html{scroll-behavior:smooth}
body{margin:0;background:#121911;background-image:${GRAIN};font-family:'Manrope',sans-serif;font-weight:300;color:var(--ivory);line-height:1.7}
.paper{max-width:520px;margin:0 auto;background:linear-gradient(180deg,#222E25,#1B241D 30%,#1B241D 70%,#19221B);box-shadow:0 24px 90px rgba(0,0,0,.6);position:relative}
@media(min-width:560px){.paper{margin:30px auto 56px}}
.frame{margin:12px;border:1px solid rgba(194,166,96,.38);padding:2px;overflow:hidden}
.frame-in{border:1px solid rgba(194,166,96,.2)}
.env-sprig{position:absolute;left:0;right:0;bottom:8%;display:flex;justify-content:center;opacity:.85}
.env-sprig .branch{width:150px;height:30px}
.env-seal{background:radial-gradient(circle at 38% 32%,#EFE3C4,#D9C69A)}
.sealtxt{font-family:'Prata',serif;font-size:1.25rem;color:#2A3A2E}
.sealtxt i{font-style:normal;color:#7A6A42;margin:0 4px;font-size:.9rem}
.branch{width:190px;height:38px;display:block;margin:0 auto}
.branch.flip{transform:scaleX(-1)}
.draw{stroke-dasharray:100;stroke-dashoffset:100}
.fx.in .draw{stroke-dashoffset:0;transition:stroke-dashoffset 1.8s ease .35s}
@media (prefers-reduced-motion:reduce){.draw{stroke-dashoffset:0}}
.s-hero{position:relative;text-align:center;padding:86px 24px 60px}
.ring{position:absolute;left:50%;top:52%;width:250px;height:250px;transform:translate(-50%,-50%);border:1px solid rgba(194,166,96,.4);border-radius:50%;pointer-events:none}
.eyebrow{font-size:.68rem;letter-spacing:5px;text-transform:uppercase;color:var(--gold);font-weight:500}
.names{position:relative;font-family:'Prata',serif;font-weight:400;font-size:2.5rem;line-height:1.3;color:var(--champ);margin:20px 0}
.names .amp{display:block;font-size:1.15rem;color:var(--gold);margin:2px 0}
.hero-date{font-size:.74rem;letter-spacing:4px;text-transform:uppercase;color:var(--sage)}
.s-title{padding:26px 24px 4px;text-align:center}
.s-msg{padding:18px 38px 6px;text-align:center;font-size:.98rem;line-height:1.9;color:#D8D2C2}
.s-msg .greet{font-family:'Prata',serif;font-size:1.25rem;color:var(--champ);margin-bottom:10px}
.s-photo{padding:36px 30px 8px}
.s-photo .ph{border:1px solid rgba(194,166,96,.42);padding:9px}
.s-photo img{width:100%;aspect-ratio:4/5;object-fit:cover;display:block;filter:saturate(.92)}
.s-emo{padding:34px 40px 8px;text-align:center;font-size:.96rem;line-height:2;color:#CFC9B8}
.s-emo .branch{margin-bottom:18px}
.s-when{padding:20px 24px 10px;text-align:center}
.when-week{font-size:.7rem;letter-spacing:4px;text-transform:uppercase;color:var(--sage);margin-bottom:12px}
.when-date{font-family:'Prata',serif;font-size:1.9rem;color:var(--champ);line-height:1.3}
.when-time{margin-top:12px;font-family:'Prata',serif;font-size:1.4rem;color:var(--gold)}
.s-venue{padding:18px 34px 44px;text-align:center}
.s-venue .addr{font-size:1rem;max-width:340px;margin:0 auto 18px;color:#D8D2C2}
.btn{display:inline-block;margin:4px 5px;padding:11px 22px;border:1px solid var(--gold);color:var(--champ);text-decoration:none;font-size:.66rem;letter-spacing:2.5px;text-transform:uppercase;font-weight:500;transition:background .3s ease,color .3s ease}
.btn:hover{background:var(--gold);color:var(--night-d)}
.s-cd{border-top:1px solid rgba(194,166,96,.3);border-bottom:1px solid rgba(194,166,96,.3);background:var(--night-d);padding:44px 18px;text-align:center}
.cd-label{font-size:.7rem;letter-spacing:4px;text-transform:uppercase;color:var(--gold);margin-bottom:22px;font-weight:500}
.cd{display:flex;justify-content:center;align-items:baseline;gap:4px}
.cd>div{min-width:64px;position:relative}
.cd>div+div:before{content:'◆';position:absolute;left:-6px;top:34%;font-size:.32rem;color:var(--gold)}
.cd b{display:block;font-family:'Prata',serif;font-weight:400;font-size:2.1rem;color:var(--champ)}
.cd span{font-size:.58rem;letter-spacing:2px;text-transform:uppercase;color:var(--sage)}
.s-final{padding:48px 32px 20px;text-align:center}
.final-msg{font-family:'Prata',serif;font-size:1.2rem;color:var(--champ);margin-bottom:22px;line-height:1.7}
.sign-label{font-size:.66rem;letter-spacing:3px;text-transform:uppercase;color:var(--sage);margin-bottom:8px}
.sign{font-family:'Prata',serif;font-size:1.4rem;color:var(--gold)}
.s-made{padding:10px 0 28px;text-align:center;font-size:.58rem;letter-spacing:3px;text-transform:uppercase;color:#6E7A66}
#mbtn{border:1px solid var(--gold);background:var(--night-d);color:var(--gold)}
#mbtn.on{background:var(--gold);color:var(--night-d)}
</style>
</head>
<body>
${envelopeHTML({ seal, front, hint: d.L.openHint })}
<main class="paper"><div class="frame"><div class="frame-in">
  <section class="s-hero">
    <div class="ring fx" style="--d:.3s"></div>
    <div class="eyebrow fx">${d.L.sub}</div>
    <h1 class="names fx" style="--d:.15s">${d.groom}<span class="amp">&amp;</span>${d.bride}</h1>
    <div class="hero-date fx" style="--d:.3s">${d.dateText}</div>
  </section>
  <section class="s-title fx">${branch()}</section>
  <section class="s-msg fx" style="--d:.1s">
    ${d.guestName ? `<div class="greet">${d.L.greet} ${d.guestName}!</div><p>${d.L.greetTail}</p>` : `<p>${d.L.invite}</p>`}
  </section>
  ${d.photos[0] ? `<section class="s-photo fx"><div class="ph"><img src="${d.photos[0]}" alt="${d.groom} &amp; ${d.bride}"></div></section>` : ''}
  <section class="s-emo fx">${branch(true)}<p>${d.L.emo}</p></section>
  <section class="s-when fx">
    <div class="when-week">${d.weekday}</div>
    <div class="when-date">${d.dateText}</div>
    <div class="when-time">${d.time}</div>
  </section>
  <section class="s-venue fx">
    ${d.address ? `<p class="addr">${d.address}</p>` : ''}
    <a class="btn" href="${d.gmaps}" target="_blank" rel="noopener">${d.L.gmaps}</a><a class="btn" href="${d.ymaps}" target="_blank" rel="noopener">${d.L.ymaps}</a>
  </section>
  <section class="s-cd">
    <div class="cd-label fx">${d.L.until}</div>
    <div class="cd fx" style="--d:.15s">
      <div><b id="cd">0</b><span>${d.L.days}</span></div>
      <div><b id="ch">00</b><span>${d.L.hours}</span></div>
      <div><b id="cm">00</b><span>${d.L.min}</span></div>
      <div><b id="cs">00</b><span>${d.L.sec}</span></div>
    </div>
  </section>
  <section class="s-final fx">
    <p class="final-msg">${d.L.final}</p>
    <div class="sign-label">${d.L.sign}</div>
    <div class="sign">${d.groom} ${d.L.and} ${d.bride}</div>
  </section>
  <footer class="s-made">Made with ♥</footer>
</div></div></main>
${audioWidget(d.music)}
${experienceScript()}
${countdownScript(d.targetIso)}
</body>
</html>`;
}
