import { GRAIN, experienceCSS, envelopeHTML, experienceScript, audioWidget, countdownScript } from './shared.js';

// Atlas — слоновая кость, мягкое золото и приглушённый гранат (анор).
// Мотивы сюзане: восьмилепестковый медальон, стежковые рамки, арка-михраб для фото.

// Медальон сюзане: два кольца и восемь лепестков тонкой золотой линией, гранат в центре.
function medallion(size, opacity = 1) {
  let petals = '';
  for (let i = 0; i < 8; i++) {
    petals += `<path d="M50 13 C57 26 57 36 50 43 C43 36 43 26 50 13Z" transform="rotate(${i * 45} 50 50)"/>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" aria-hidden="true" style="opacity:${opacity}">
<circle cx="50" cy="50" r="46" stroke="#B08D4F" stroke-width="1"/>
<circle cx="50" cy="50" r="39" stroke="#B08D4F" stroke-width=".6" opacity=".6"/>
<g stroke="#B08D4F" stroke-width=".9">${petals}</g>
<circle cx="50" cy="52" r="6.5" stroke="#A54B3F" stroke-width="1.1"/>
<path d="M46 46 L47.6 41 L50 45 L52.4 41 L54 46" stroke="#A54B3F" stroke-width="1.1" stroke-linejoin="round"/>
</svg>`;
}

// Веточка граната: плод с короной и два листа на тонком стебле — разделитель секций.
function anorDivider() {
  return `<svg class="anor" viewBox="0 0 120 34" fill="none" aria-hidden="true">
<path d="M4 17 H44" stroke="#B08D4F" stroke-width=".8"/>
<path d="M76 17 H116" stroke="#B08D4F" stroke-width=".8"/>
<circle cx="60" cy="19" r="7" stroke="#A54B3F" stroke-width="1.2"/>
<path d="M56 13 L57.5 8 L60 12 L62.5 8 L64 13" stroke="#A54B3F" stroke-width="1.1" stroke-linejoin="round"/>
<path d="M48 20 C50 14 54 12 57 13 C56 18 53 21 48 20Z" fill="#7D8663" opacity=".75"/>
<path d="M72 20 C70 14 66 12 63 13 C64 18 67 21 72 20Z" fill="#7D8663" opacity=".75"/>
</svg>`;
}

export default function atlas(d) {
  const seal = medallion(52);
  return `<!DOCTYPE html>
<html lang="${d.lang}">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${d.groom} &amp; ${d.bride} — ${d.L.sub}</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Forum&family=Literata:ital,opsz,wght@0,7..72,300;0,7..72,400;1,7..72,300&display=swap" rel="stylesheet">
${experienceCSS()}
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--ivory:#F7F2E8;--sand:#EBE1CD;--gold:#B08D4F;--gold-l:#C9AE7E;--brown:#4A392C;--soft:#6B5A48;--anor:#A54B3F;--leaf:#7D8663;
--envx-bg:linear-gradient(170deg,#DCCFB4,#EBE1CD 55%,#D8C9AC);--env-face:#F1EADB;--env-flap:#E9DFC9;--env-paper:#FBF8F0;--env-hint:#8A7354}
html{scroll-behavior:smooth}
body{margin:0;background:#E2D6BE;background-image:${GRAIN};font-family:'Literata',serif;font-weight:300;color:var(--brown);line-height:1.65}
.paper{max-width:540px;margin:0 auto;background:var(--ivory);background-image:${GRAIN};box-shadow:0 24px 90px rgba(90,70,40,.4);position:relative}
@media(min-width:580px){.paper{margin:30px auto 56px}}
.sheet{margin:13px;border:1px solid var(--gold-l);outline:1px dashed rgba(176,141,79,.55);outline-offset:5px;overflow:hidden}
.env-seal{background:radial-gradient(circle at 38% 32%,#FBF6EA,#EFE5D0)}
.env-flap{border-bottom:0}
.env-front:before{content:'';position:absolute;left:8%;right:8%;bottom:7%;height:1px;background:var(--gold-l);opacity:.7}
h1,h2,.forum{font-family:'Forum',serif;font-weight:400}
.s-hero{position:relative;text-align:center;padding:72px 24px 40px}
.hero-med{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);pointer-events:none}
.names{position:relative;font-family:'Forum',serif;font-size:2.05rem;letter-spacing:6px;text-transform:uppercase;line-height:1.3;color:var(--brown)}
.names .med-sep{display:flex;justify-content:center;margin:12px 0}
.hero-date{position:relative;margin-top:26px;font-size:.74rem;letter-spacing:4px;text-transform:uppercase;color:var(--gold)}
.s-title{padding:34px 24px 4px;text-align:center}
.stitch-caps{display:flex;align-items:center;justify-content:center;gap:14px}
.stitch-caps:before,.stitch-caps:after{content:'';width:46px;border-top:1px dashed var(--gold)}
.stitch-caps span{font-size:.76rem;letter-spacing:5px;text-transform:uppercase;color:var(--anor)}
.s-msg{padding:18px 38px 6px;text-align:center;font-style:italic;font-size:1.05rem;line-height:1.8;color:var(--soft)}
.s-msg .greet{font-style:normal;font-family:'Forum',serif;font-size:1.25rem;color:var(--anor);margin-bottom:8px}
.s-photo{padding:36px 44px 6px;text-align:center}
.arch{display:inline-block;padding:10px;border:1px solid var(--gold-l);border-radius:999px 999px 4px 4px;background:#FBF8F0}
.arch img{width:100%;max-width:330px;aspect-ratio:3/4.2;object-fit:cover;display:block;border-radius:990px 990px 2px 2px}
.s-emo{padding:32px 40px 8px;text-align:center;font-size:1rem;line-height:1.9;color:var(--soft)}
.anor{width:120px;height:34px;display:block;margin:0 auto 16px}
.s-when{padding:16px 24px 10px;text-align:center}
.when-week{font-size:.72rem;letter-spacing:4px;text-transform:uppercase;color:var(--gold);margin-bottom:10px}
.when-date{font-family:'Forum',serif;font-size:2rem;color:var(--brown);line-height:1.25}
.when-time{margin-top:10px;font-family:'Forum',serif;font-size:1.5rem;color:var(--anor)}
.s-venue{padding:16px 34px 42px;text-align:center}
.s-venue .addr{font-size:1.05rem;max-width:340px;margin:0 auto 16px}
.btn{display:inline-block;margin:4px 5px;padding:11px 22px;border:1px solid var(--gold);color:var(--brown);text-decoration:none;font-size:.68rem;letter-spacing:2.5px;text-transform:uppercase;transition:background .3s ease,color .3s ease}
.btn:hover{background:var(--gold);color:var(--ivory)}
.s-cd{background:var(--sand);background-image:${GRAIN};border-top:1px solid var(--gold-l);border-bottom:1px solid var(--gold-l);padding:42px 18px;text-align:center}
.cd-label{font-size:.72rem;letter-spacing:4px;text-transform:uppercase;color:var(--anor);margin-bottom:20px}
.cd{display:flex;justify-content:center;align-items:baseline}
.cd>div{min-width:70px;position:relative}
.cd>div+div:before{content:'';position:absolute;left:0;top:12%;bottom:22%;width:1px;background:var(--gold-l)}
.cd b{display:block;font-family:'Forum',serif;font-weight:400;font-size:2.1rem;color:var(--brown)}
.cd span{font-size:.6rem;letter-spacing:2px;text-transform:uppercase;color:var(--gold)}
.s-final{padding:46px 32px 18px;text-align:center}
.final-msg{font-style:italic;font-size:1.12rem;color:var(--soft);margin-bottom:20px}
.sign-label{font-size:.68rem;letter-spacing:3px;text-transform:uppercase;color:var(--gold);margin-bottom:8px}
.sign{font-family:'Forum',serif;font-size:1.5rem;letter-spacing:2px;color:var(--brown)}
.s-made{padding:8px 0 26px;text-align:center;font-size:.6rem;letter-spacing:3px;text-transform:uppercase;color:#A6906F}
#mbtn{border:1px solid var(--gold);background:var(--ivory);color:var(--gold)}
#mbtn.on{background:var(--gold);color:var(--ivory)}
</style>
</head>
<body>
${envelopeHTML({ seal, hint: d.L.openHint })}
<main class="paper"><div class="sheet">
  <section class="s-hero">
    <div class="hero-med fx" style="--d:.25s">${medallion(280, 0.13)}</div>
    <h1 class="names fx">${d.groom}<span class="med-sep">${medallion(30, 0.9)}</span>${d.bride}</h1>
    <div class="hero-date fx" style="--d:.2s">${d.dateText}</div>
  </section>
  <section class="s-title fx"><div class="stitch-caps"><span>${d.L.sub}</span></div></section>
  <section class="s-msg fx" style="--d:.1s">
    ${d.guestName ? `<div class="greet">${d.L.greet} ${d.guestName}!</div><p>${d.L.greetTail}</p>` : `<p>${d.L.invite}</p>`}
  </section>
  ${d.photos[0] ? `<section class="s-photo fx"><span class="arch"><img src="${d.photos[0]}" alt="${d.groom} &amp; ${d.bride}"></span></section>` : ''}
  <section class="s-emo fx">${anorDivider()}<p>${d.L.emo}</p></section>
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
    ${anorDivider()}
    <p class="final-msg">${d.L.final}</p>
    <div class="sign-label">${d.L.sign}</div>
    <div class="sign">${d.groom} ${d.L.and} ${d.bride}</div>
  </section>
  <footer class="s-made">Made with ♥</footer>
</div></main>
${audioWidget(d.music)}
${experienceScript()}
${countdownScript(d.targetIso)}
</body>
</html>`;
}
