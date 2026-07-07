import { GRAIN, experienceCSS, envelopeHTML, experienceScript, audioWidget, countdownScript } from './shared.js';

// Marsala — глубокое бордо и сливочная бумага, полевые цветы.
// По референсу Pinterest: винные панели, классическая дата-«решётка», отсчёт на бордо.

// Веточка полевых цветов: шалфейные стебли, сиреневые и пыльно-розовые бутоны.
function sprig(cls = '') {
  return `<svg class="sprig ${cls}" viewBox="0 0 140 70" fill="none" aria-hidden="true">
<path d="M8 66 C34 44 52 26 66 6" stroke="#8C9A7E" stroke-width="1.3"/>
<path d="M34 68 C56 52 74 42 96 26" stroke="#8C9A7E" stroke-width="1.2"/>
<path d="M62 69 C84 58 106 52 128 40" stroke="#9AA48B" stroke-width="1.1"/>
<path d="M40 40 C36 32 40 26 46 24 C48 32 46 38 40 40Z" fill="#8C9A7E" opacity=".8"/>
<path d="M78 46 C74 39 77 33 83 31 C85 38 84 44 78 46Z" fill="#9AA48B" opacity=".7"/>
<g fill="#9C8AA5"><ellipse cx="66" cy="7" rx="3.4" ry="5" transform="rotate(18 66 7)"/><ellipse cx="60" cy="10" rx="3" ry="4.4" transform="rotate(-16 60 10)"/><ellipse cx="70" cy="12" rx="2.8" ry="4.2" transform="rotate(44 70 12)"/></g>
<g fill="#C08A97"><ellipse cx="96" cy="26" rx="3" ry="4.6" transform="rotate(24 96 26)"/><ellipse cx="90" cy="30" rx="2.6" ry="4" transform="rotate(-12 90 30)"/></g>
<g fill="#B9A0C4" opacity=".85"><circle cx="128" cy="40" r="2.6"/><circle cx="122" cy="44" r="2"/><circle cx="131" cy="46" r="1.8"/></g>
<g fill="#C08A97" opacity=".6"><circle cx="46" cy="30" r="1.4"/><circle cx="84" cy="38" r="1.3"/><circle cx="106" cy="50" r="1.2"/></g>
</svg>`;
}

export default function marsala(d) {
  const seal = `<span class="sealtxt">${d.groom.charAt(0)}<i>·</i>${d.bride.charAt(0)}</span>`;
  const front = `<div class="env-names">${d.groom} <span>&amp;</span> ${d.bride}</div>`;
  return `<!DOCTYPE html>
<html lang="${d.lang}">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${d.groom} &amp; ${d.bride} — ${d.L.sub}</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap" rel="stylesheet">
${experienceCSS()}
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--wine:#5C2233;--wine-d:#471A28;--cream:#F4EFE4;--ink:#463037;--soft:#5C4650;
--rose:#C08A97;--rose-l:#DFC9CF;--sage:#8C9A7E;
--envx-bg:linear-gradient(165deg,#3C1520,#5C2233 60%,#4A1B2A);--env-face:#4E1C2B;--env-flap:#431825;--env-paper:#F4EFE4;--env-hint:#DFC9CF}
html{scroll-behavior:smooth}
body{margin:0;background:#E5DBCE;background-image:${GRAIN};font-family:'Cormorant Garamond',serif;color:var(--ink);line-height:1.6}
.paper{max-width:520px;margin:0 auto;background:var(--cream);background-image:${GRAIN};box-shadow:0 24px 90px rgba(60,18,32,.35);position:relative;overflow:hidden}
@media(min-width:560px){.paper{margin:30px auto 56px}}
.sprig{width:120px;height:60px;display:block}
.env-names{position:absolute;left:0;right:0;bottom:12%;text-align:center;font-family:'Great Vibes','Cormorant Garamond',cursive;font-size:1.7rem;color:var(--cream);opacity:.92}
.env-names span{font-size:1.1rem;color:var(--rose)}
.env-seal{background:radial-gradient(circle at 38% 32%,#F7F1E3,#E3D7C0)}
.sealtxt{font-family:'Great Vibes','Cormorant Garamond',cursive;font-size:1.55rem;color:var(--wine)}
.sealtxt i{font-style:normal;color:var(--rose);margin:0 3px;font-size:1rem}
.s-hero{background:var(--wine);background-image:${GRAIN};color:var(--cream);text-align:center;padding:76px 24px 54px}
.names{font-family:'Great Vibes','Cormorant Garamond',cursive;font-weight:400;font-size:3.1rem;line-height:1.16;margin:0 0 22px}
.names .amp{display:block;font-size:1.6rem;color:var(--rose);margin:4px 0}
.hero-date{display:inline-block;font-size:.78rem;letter-spacing:4px;text-transform:uppercase;color:var(--rose-l);border-top:1px solid rgba(223,201,207,.45);border-bottom:1px solid rgba(223,201,207,.45);padding:10px 26px}
.s-title{padding:48px 24px 6px;text-align:center}
.rule-caps{display:flex;align-items:center;justify-content:center;gap:16px}
.rule-caps:before,.rule-caps:after{content:'';width:44px;height:1px;background:var(--rose)}
.rule-caps span{font-size:.78rem;letter-spacing:5px;text-transform:uppercase;color:var(--wine)}
.s-msg{padding:20px 36px 6px;text-align:center;font-style:italic;font-size:1.14rem;line-height:1.75;color:var(--soft)}
.s-msg .greet{font-style:normal;font-size:1.3rem;color:var(--wine);margin-bottom:8px}
.s-photo{padding:36px 28px 4px;position:relative}
.s-photo img{width:100%;aspect-ratio:4/5;object-fit:cover;display:block;border:1px solid rgba(92,34,51,.28);padding:9px;background:#FBF8F0}
.s-photo .sprig{position:absolute;top:14px;right:14px;transform:rotate(24deg);width:96px;height:48px}
.s-emo{padding:34px 38px 10px;text-align:center;font-size:1.06rem;line-height:1.85;color:var(--soft)}
.s-emo .sprig{margin:0 auto 14px}
.s-when{padding:14px 24px 8px;text-align:center}
.when-grid{display:flex;align-items:center;justify-content:center;gap:20px}
.when-side{font-size:.7rem;letter-spacing:3px;text-transform:uppercase;color:var(--wine);border-top:1px solid var(--rose);border-bottom:1px solid var(--rose);padding:9px 0;min-width:88px}
.when-day{font-size:3.8rem;font-weight:500;color:var(--wine);line-height:1}
.when-time{margin-top:16px;font-size:1.4rem;color:var(--ink)}
.s-venue{padding:14px 32px 40px;text-align:center}
.s-venue .addr{font-size:1.16rem;max-width:340px;margin:0 auto 14px}
.btn{display:inline-block;margin:4px 5px;padding:11px 22px;border:1px solid var(--wine);color:var(--wine);text-decoration:none;font-size:.7rem;letter-spacing:2.5px;text-transform:uppercase;transition:background .3s ease,color .3s ease}
.btn:hover{background:var(--wine);color:var(--cream)}
.s-photo2{padding:0 28px 40px}
.s-photo2 img{width:100%;aspect-ratio:16/11;object-fit:cover;display:block;border:1px solid rgba(92,34,51,.28);padding:9px;background:#FBF8F0}
.s-cd{background:var(--wine);background-image:${GRAIN};color:var(--cream);padding:46px 18px;text-align:center}
.cd-label{font-size:.72rem;letter-spacing:4px;text-transform:uppercase;color:var(--rose-l);margin-bottom:22px}
.cd{display:flex;justify-content:center;gap:6px}
.cd>div{min-width:66px}
.cd b{display:block;font-size:2.2rem;font-weight:500}
.cd span{font-size:.58rem;letter-spacing:2px;text-transform:uppercase;color:var(--rose-l)}
.s-final{padding:48px 32px 20px;text-align:center}
.final-msg{font-style:italic;font-size:1.2rem;color:var(--soft);margin-bottom:22px}
.sign-label{font-size:.7rem;letter-spacing:3px;text-transform:uppercase;color:var(--rose);margin-bottom:6px}
.sign{font-family:'Great Vibes','Cormorant Garamond',cursive;font-size:2rem;color:var(--wine)}
.s-made{padding:6px 0 28px;text-align:center;font-size:.6rem;letter-spacing:3px;text-transform:uppercase;color:#A5888F;font-family:'Cormorant Garamond',serif}
#mbtn{border:1px solid var(--wine);background:var(--cream);color:var(--wine)}
#mbtn.on{background:var(--wine);color:var(--cream)}
</style>
</head>
<body>
${envelopeHTML({ seal, front, hint: d.L.openHint })}
<main class="paper">
  <section class="s-hero">
    <h1 class="names fx">${d.groom}<span class="amp">&amp;</span>${d.bride}</h1>
    <div class="hero-date fx" style="--d:.2s">${d.dateText}</div>
  </section>
  <section class="s-title fx"><div class="rule-caps"><span>${d.L.sub}</span></div></section>
  <section class="s-msg fx" style="--d:.1s">
    ${d.guestName ? `<div class="greet">${d.L.greet} ${d.guestName}!</div><p>${d.L.greetTail}</p>` : `<p>${d.L.invite}</p>`}
  </section>
  ${d.photos[0] ? `<section class="s-photo fx"><img src="${d.photos[0]}" alt="${d.groom} &amp; ${d.bride}">${sprig()}</section>` : ''}
  <section class="s-emo fx">${sprig()}<p>${d.L.emo}</p></section>
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
    <a class="btn" href="${d.gmaps}" target="_blank" rel="noopener">${d.L.gmaps}</a><a class="btn" href="${d.ymaps}" target="_blank" rel="noopener">${d.L.ymaps}</a>
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
