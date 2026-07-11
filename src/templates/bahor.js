import { GRAIN, experienceCSS, envelopeHTML, experienceScript, audioWidget, countdownScript, mapEmbed } from './shared.js';

// Bahor — бохо-флористика (по мотивам «Boho Floral»): сливки, пыльная роза,
// шалфей и терракота; акварельные цветы, фото в арке, рукописные имена.

// Акварельная веточка: эвкалиптовые листья, пионовые бутоны, точки-гипсофила.
function bloom(cls = '') {
  return `<svg class="bloom ${cls}" viewBox="0 0 160 70" fill="none" aria-hidden="true">
<path d="M10 62 C46 44 76 30 118 14" stroke="#8FA68E" stroke-width="1.2"/>
<path d="M44 64 C74 52 104 44 142 34" stroke="#A3B5A0" stroke-width="1"/>
<g fill="#8FA68E" opacity=".75">
<ellipse cx="38" cy="48" rx="7" ry="3.6" transform="rotate(-28 38 48)"/>
<ellipse cx="58" cy="38" rx="7" ry="3.6" transform="rotate(-24 58 38)"/>
<ellipse cx="80" cy="29" rx="6.4" ry="3.3" transform="rotate(-20 80 29)"/>
</g>
<g fill="#C98A8E">
<circle cx="118" cy="13" r="7.5" opacity=".85"/><circle cx="112" cy="19" r="4.4" opacity=".6"/>
<circle cx="126" cy="19" r="3.4" opacity=".55"/>
</g>
<circle cx="118" cy="13" r="2.6" fill="#F5E9DC"/>
<g fill="#C77B5B" opacity=".7"><circle cx="142" cy="34" r="3.2"/><circle cx="148" cy="40" r="2.2"/></g>
<g fill="#D9BFB0" opacity=".8"><circle cx="96" cy="44" r="1.6"/><circle cx="106" cy="38" r="1.3"/><circle cx="70" cy="52" r="1.4"/></g>
</svg>`;
}

export default function bahor(d) {
  const seal = `<span class="sealtxt">${d.groom.charAt(0)}<i>·</i>${d.bride.charAt(0)}</span>`;
  const front = `<div class="env-names">${d.groom} <span>&amp;</span> ${d.bride}</div>`;
  return `<!DOCTYPE html>
<html lang="${d.lang}">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${d.groom} &amp; ${d.bride} — ${d.L.sub}</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Marck+Script&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
${experienceCSS()}
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--cream:#FBF7EF;--blush:#F0E2DC;--rose:#C98A8E;--rose-d:#A96468;--sage:#8FA68E;--terra:#C77B5B;--ink:#4C4038;--soft:#6E6055;
--envx-bg:linear-gradient(165deg,#D8BBB4,#E8D3CE 55%,#D2B3AC);--env-face:#E0C4BD;--env-flap:#D6B6AE;--env-paper:#FBF7EF;--env-hint:#7C5A55}
html{scroll-behavior:smooth}
body{margin:0;background:#EFE4D8;background-image:${GRAIN};font-family:'Cormorant Garamond',serif;color:var(--ink);line-height:1.65}
.paper{max-width:520px;margin:0 auto;background:var(--cream);background-image:${GRAIN};box-shadow:0 24px 90px rgba(120,80,70,.3);position:relative;overflow:hidden}
@media(min-width:560px){.paper{margin:30px auto 56px}}
.bloom{width:140px;height:62px;display:block}
.env-names{position:absolute;left:0;right:0;bottom:12%;text-align:center;font-family:'Marck Script',cursive;font-size:1.6rem;color:#FBF7EF;opacity:.95}
.env-names span{font-size:1rem;color:#F5E0D8}
.env-seal{background:radial-gradient(circle at 38% 32%,#FBF3E8,#EBD9C6)}
.sealtxt{font-family:'Marck Script',cursive;font-size:1.4rem;color:var(--rose-d)}
.sealtxt i{font-style:normal;color:var(--sage);margin:0 3px;font-size:.95rem}
.s-hero{position:relative;text-align:center;padding:74px 24px 46px}
.s-hero .bloom{position:absolute}
.s-hero .b-tl{top:16px;left:10px;transform:rotate(-14deg)}
.s-hero .b-br{bottom:8px;right:10px;transform:rotate(166deg)}
.eyebrow{font-size:.7rem;letter-spacing:5px;text-transform:uppercase;color:var(--terra)}
.names{font-family:'Marck Script',cursive;font-weight:400;font-size:3rem;line-height:1.2;color:var(--rose-d);margin:16px 0}
.names .amp{display:block;font-size:1.4rem;color:var(--sage);margin:2px 0}
.hero-date{display:inline-block;font-size:.76rem;letter-spacing:4px;text-transform:uppercase;color:var(--soft);border-top:1px solid var(--rose);border-bottom:1px solid var(--rose);padding:9px 24px}
.s-title{padding:40px 24px 4px;text-align:center}
.rule-caps{display:flex;align-items:center;justify-content:center;gap:14px}
.rule-caps:before,.rule-caps:after{content:'';width:40px;height:1px;background:var(--sage)}
.rule-caps span{font-size:.76rem;letter-spacing:5px;text-transform:uppercase;color:var(--rose-d)}
.s-msg{padding:18px 36px 4px;text-align:center;font-style:italic;font-size:1.12rem;line-height:1.8;color:var(--soft)}
.s-msg .greet{font-style:normal;font-family:'Marck Script',cursive;font-size:1.5rem;color:var(--rose-d);margin-bottom:8px}
.s-photo{padding:34px 42px 4px;text-align:center}
.arch{display:inline-block;padding:10px;background:var(--blush);border-radius:999px 999px 8px 8px}
.arch img{width:100%;max-width:330px;aspect-ratio:3/4.2;object-fit:cover;display:block;border-radius:990px 990px 4px 4px}
.s-emo{padding:32px 40px 8px;text-align:center;font-size:1.04rem;line-height:1.9;color:var(--soft)}
.s-emo .bloom{margin:0 auto 12px}
.s-when{padding:14px 24px 8px;text-align:center}
.when-grid{display:flex;align-items:center;justify-content:center;gap:18px}
.when-side{font-size:.68rem;letter-spacing:3px;text-transform:uppercase;color:var(--terra);border-top:1px solid var(--rose);border-bottom:1px solid var(--rose);padding:9px 0;min-width:86px}
.when-day{font-size:3.6rem;font-weight:500;color:var(--rose-d);line-height:1}
.when-time{margin-top:14px;font-size:1.35rem;color:var(--ink)}
.s-venue{padding:14px 30px 40px;text-align:center}
.s-venue .addr{font-size:1.14rem;max-width:340px;margin:0 auto 14px}
.mapbox{border-radius:18px;overflow:hidden;border:1px solid #E3CFC0;padding:0;background:var(--blush)}
.mapbox iframe{display:block;width:100%;height:240px;border:0;filter:sepia(.1) saturate(.95)}
.s-photo2{padding:0 30px 38px}
.s-photo2 img{width:100%;aspect-ratio:16/11;object-fit:cover;display:block;border-radius:16px}
.s-cd{background:linear-gradient(160deg,#C98A8E,#A96468);background-image:${GRAIN};color:#FBF3EC;padding:44px 18px;text-align:center}
.cd-label{font-size:.72rem;letter-spacing:4px;text-transform:uppercase;color:#F2DCD4;margin-bottom:20px}
.cd{display:flex;justify-content:center;gap:6px}
.cd>div{min-width:64px}
.cd b{display:block;font-size:2.1rem;font-weight:500}
.cd span{font-size:.58rem;letter-spacing:2px;text-transform:uppercase;color:#F2DCD4}
.s-final{padding:46px 32px 18px;text-align:center}
.final-msg{font-style:italic;font-size:1.18rem;color:var(--soft);margin-bottom:20px}
.sign-label{font-size:.68rem;letter-spacing:3px;text-transform:uppercase;color:var(--sage);margin-bottom:6px}
.sign{font-family:'Marck Script',cursive;font-size:1.9rem;color:var(--rose-d)}
.s-made{padding:6px 0 26px;text-align:center;font-size:.6rem;letter-spacing:3px;text-transform:uppercase;color:#B49A8C}
#mbtn{border:1px solid var(--rose);background:var(--cream);color:var(--rose-d)}
#mbtn.on{background:var(--rose-d);color:var(--cream)}
</style>
</head>
<body>
${envelopeHTML({ seal, front, hint: d.L.openHint })}
<main class="paper">
  <section class="s-hero">
    <span class="b-tl fx" style="--d:.3s">${bloom()}</span>
    <span class="b-br fx" style="--d:.4s">${bloom()}</span>
    <div class="eyebrow fx">${d.L.sub}</div>
    <h1 class="names fx" style="--d:.1s">${d.groom}<span class="amp">&amp;</span>${d.bride}</h1>
    <div class="hero-date fx" style="--d:.2s">${d.dateText}</div>
  </section>
  <section class="s-msg fx" style="--d:.1s">
    ${d.guestName ? `<div class="greet">${d.L.greet} ${d.guestName}!</div><p>${d.L.greetTail}</p>` : `<p>${d.L.invite}</p>`}
  </section>
  ${d.photos[0] ? `<section class="s-photo fx"><span class="arch"><img src="${d.photos[0]}" alt="${d.groom} &amp; ${d.bride}"></span></section>` : ''}
  <section class="s-emo fx">${bloom()}<p>${d.L.emo}</p></section>
  <section class="s-when fx">
    <div class="when-grid">
      <div class="when-side">${d.weekday}</div>
      <div class="when-day">${d.day}</div>
      <div class="when-side">${d.monthName}<br>${d.year}</div>
    </div>
    <div class="when-time">${d.time}</div>
  </section>
  <section class="s-venue fx">
    ${d.address ? `<p class="addr">${d.address}</p>` : ''}
    ${mapEmbed(d)}
  </section>
  ${d.photos[1] ? `<section class="s-photo2 fx"><img src="${d.photos[1]}" alt=""></section>` : ''}
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
</main>
${audioWidget(d.music)}
${experienceScript()}
${countdownScript(d.targetIso)}
</body>
</html>`;
}
