import { GRAIN, experienceCSS, envelopeHTML, experienceScript, audioWidget, countdownScript, mapEmbed } from './shared.js';

// Royal — глубокий сапфир и золото (по мотивам «Royal Blue»): дворцовая
// орнаментальная рамка, золотые вензеля по углам, торжественная типографика.

// Угловой золотой вензель: волюта с листьями, зеркалится через CSS transform.
function flourish(cls = '') {
  return `<svg class="flr ${cls}" viewBox="0 0 120 120" fill="none" aria-hidden="true">
<path d="M6 6 C64 10 96 40 108 108" stroke="#C9A959" stroke-width="1.2"/>
<path d="M6 6 C36 8 58 20 70 44" stroke="#C9A959" stroke-width=".8" opacity=".7"/>
<path d="M24 14 C34 6 46 8 50 18 C42 24 30 22 24 14Z" fill="#C9A959" opacity=".85"/>
<path d="M58 30 C68 24 78 27 80 36 C72 42 62 39 58 30Z" fill="#C9A959" opacity=".7"/>
<path d="M88 62 C98 58 106 62 106 71 C98 75 90 71 88 62Z" fill="#C9A959" opacity=".55"/>
<circle cx="12" cy="24" r="2" fill="#E3CD96"/><circle cx="40" cy="34" r="1.6" fill="#E3CD96"/>
<circle cx="76" cy="56" r="1.5" fill="#E3CD96" opacity=".8"/>
</svg>`;
}

// Золотой разделитель: ромб с расходящимися линиями.
function divider() {
  return `<svg class="dvd" viewBox="0 0 160 24" fill="none" aria-hidden="true">
<path d="M4 12 H62" stroke="#C9A959" stroke-width=".9"/>
<path d="M98 12 H156" stroke="#C9A959" stroke-width=".9"/>
<rect x="73" y="5" width="14" height="14" transform="rotate(45 80 12)" stroke="#C9A959" stroke-width="1.1"/>
<rect x="77" y="9" width="6" height="6" transform="rotate(45 80 12)" fill="#C9A959"/>
</svg>`;
}

export default function royal(d) {
  const seal = `<span class="sealtxt">${d.groom.charAt(0)}<i>·</i>${d.bride.charAt(0)}</span>`;
  const front = `<div class="env-crest">${divider()}</div>`;
  return `<!DOCTYPE html>
<html lang="${d.lang}">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${d.groom} &amp; ${d.bride} — ${d.L.sub}</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
${experienceCSS()}
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--navy:#152742;--navy-d:#0E1B30;--gold:#C9A959;--gold-l:#E3CD96;--ivory:#F4EFE3;--mist:#B9C3D4;
--envx-bg:linear-gradient(170deg,#0A1425,#152742 60%,#0E1B30);--env-face:#12223B;--env-flap:#0D1930;--env-paper:#F4EFE3;--env-hint:#C9A959}
html{scroll-behavior:smooth}
body{margin:0;background:#0C1626;background-image:${GRAIN};font-family:'Jost',sans-serif;font-weight:300;color:var(--ivory);line-height:1.7}
.paper{max-width:520px;margin:0 auto;background:linear-gradient(180deg,#182B49,#152742 30%,#132340 70%,#111F3A);box-shadow:0 24px 90px rgba(0,0,0,.65);position:relative}
@media(min-width:560px){.paper{margin:30px auto 56px}}
.frame{margin:12px;border:1px solid rgba(201,169,89,.5);padding:3px}
.frame-in{border:1px solid rgba(201,169,89,.25);overflow:hidden;position:relative}
.env-crest{position:absolute;left:0;right:0;bottom:9%;display:flex;justify-content:center;opacity:.9}
.env-crest .dvd{width:130px;height:20px}
.env-seal{background:radial-gradient(circle at 38% 32%,#EFDFB4,#D6BC7E)}
.sealtxt{font-family:'Playfair Display',serif;font-size:1.3rem;color:#152742}
.sealtxt i{font-style:normal;color:#7A6537;margin:0 4px;font-size:.9rem}
.flr{width:96px;height:96px;position:absolute;opacity:.9}
.flr.tl{top:6px;left:6px}
.flr.tr{top:6px;right:6px;transform:scaleX(-1)}
.dvd{width:160px;height:24px;display:block;margin:0 auto}
h1,h2{font-family:'Playfair Display',serif;font-weight:500}
.s-hero{position:relative;text-align:center;padding:88px 24px 56px}
.eyebrow{font-size:.68rem;letter-spacing:5px;text-transform:uppercase;color:var(--gold);font-weight:400}
.names{font-size:2.5rem;line-height:1.3;color:var(--gold-l);margin:20px 0;font-family:'Playfair Display',serif;font-weight:500}
.names .amp{display:block;font-size:1.2rem;color:var(--gold);font-style:italic;margin:4px 0}
.hero-date{font-size:.74rem;letter-spacing:4px;text-transform:uppercase;color:var(--mist)}
.s-title{padding:26px 24px 4px;text-align:center}
.s-msg{padding:18px 38px 6px;text-align:center;font-size:.98rem;line-height:1.9;color:#D7DCE6}
.s-msg .greet{font-family:'Playfair Display',serif;font-size:1.3rem;color:var(--gold-l);margin-bottom:10px}
.s-photo{padding:36px 34px 8px}
.s-photo .ph{border:1px solid var(--gold);outline:1px solid rgba(201,169,89,.35);outline-offset:6px;padding:10px}
.s-photo img{width:100%;aspect-ratio:4/5;object-fit:cover;display:block}
.s-emo{padding:34px 40px 8px;text-align:center;font-size:.96rem;line-height:2;color:#C9D0DD}
.s-emo .dvd{margin-bottom:18px}
.s-when{padding:20px 24px 10px;text-align:center}
.when-week{font-size:.7rem;letter-spacing:4px;text-transform:uppercase;color:var(--mist);margin-bottom:12px}
.when-date{font-family:'Playfair Display',serif;font-size:1.9rem;color:var(--gold-l);line-height:1.3}
.when-time{margin-top:12px;font-family:'Playfair Display',serif;font-size:1.4rem;color:var(--gold)}
.s-venue{padding:18px 30px 44px;text-align:center}
.s-venue .addr{font-size:1rem;max-width:340px;margin:0 auto 18px;color:#D7DCE6}
.mapbox{border:1px solid var(--gold);padding:8px;background:var(--navy-d)}
.mapbox iframe{display:block;width:100%;height:240px;border:0;filter:grayscale(.2) brightness(.95)}
.s-cd{border-top:1px solid rgba(201,169,89,.4);border-bottom:1px solid rgba(201,169,89,.4);background:var(--navy-d);padding:44px 18px;text-align:center}
.cd-label{font-size:.7rem;letter-spacing:4px;text-transform:uppercase;color:var(--gold);margin-bottom:22px}
.cd{display:flex;justify-content:center;align-items:baseline;gap:4px}
.cd>div{min-width:64px;position:relative}
.cd>div+div:before{content:'✦';position:absolute;left:-7px;top:32%;font-size:.4rem;color:var(--gold)}
.cd b{display:block;font-family:'Playfair Display',serif;font-weight:500;font-size:2.1rem;color:var(--gold-l)}
.cd span{font-size:.58rem;letter-spacing:2px;text-transform:uppercase;color:var(--mist)}
.s-final{padding:48px 32px 20px;text-align:center}
.final-msg{font-family:'Playfair Display',serif;font-size:1.2rem;color:var(--gold-l);margin-bottom:22px;line-height:1.7}
.sign-label{font-size:.66rem;letter-spacing:3px;text-transform:uppercase;color:var(--mist);margin-bottom:8px}
.sign{font-family:'Playfair Display',serif;font-style:italic;font-size:1.4rem;color:var(--gold)}
.s-made{padding:10px 0 28px;text-align:center;font-size:.58rem;letter-spacing:3px;text-transform:uppercase;color:#5E6C84}
#mbtn{border:1px solid var(--gold);background:var(--navy-d);color:var(--gold)}
#mbtn.on{background:var(--gold);color:var(--navy-d)}
</style>
</head>
<body>
${envelopeHTML({ seal, front, hint: d.L.openHint })}
<main class="paper"><div class="frame"><div class="frame-in">
  ${flourish('tl')}${flourish('tr')}
  <section class="s-hero">
    <div class="eyebrow fx">${d.L.sub}</div>
    <h1 class="names fx" style="--d:.15s">${d.groom}<span class="amp">&amp;</span>${d.bride}</h1>
    <div class="hero-date fx" style="--d:.3s">${d.dateText}</div>
  </section>
  <section class="s-title fx">${divider()}</section>
  <section class="s-msg fx" style="--d:.1s">
    ${d.guestName ? `<div class="greet">${d.L.greet} ${d.guestName}!</div><p>${d.L.greetTail}</p>` : `<p>${d.L.invite}</p>`}
  </section>
  ${d.photos[0] ? `<section class="s-photo fx"><div class="ph"><img src="${d.photos[0]}" alt="${d.groom} &amp; ${d.bride}"></div></section>` : ''}
  <section class="s-emo fx">${divider()}<p>${d.L.emo}</p></section>
  <section class="s-when fx">
    <div class="when-week">${d.weekday}</div>
    <div class="when-date">${d.dateText}</div>
    <div class="when-time">${d.time}</div>
  </section>
  <section class="s-venue fx">
    ${d.address ? `<p class="addr">${d.address}</p>` : ''}
    ${mapEmbed(d)}
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
