// Общий движок «переживания» приглашения: конверт → открытие → бумага выезжает →
// музыка с плавным нарастанием → кинематографичные появления блоков при скролле.
// Скин конверта (цвета, печать) задаёт каждый шаблон через CSS-переменные --env-*.

// Бумажное зерно: едва заметная текстура, накладывается поверх фона секций.
export const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.045'/%3E%3C/svg%3E")`;

// Геометрия конверта + reveal-переходы. Подключается до CSS шаблона.
export function experienceCSS() {
  return `<style>
body.locked{overflow:hidden;height:100dvh}
.envx{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;background:var(--envx-bg,#1a1a1a);transition:opacity .9s ease}
.envx.gone{opacity:0;pointer-events:none}
.env{position:relative;width:min(86vw,430px);aspect-ratio:1.45;perspective:1300px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.env:focus-visible{outline:1px solid var(--env-hint,#ddd);outline-offset:10px}
.env>div{position:absolute}
.env-back{inset:0;z-index:1;background:var(--env-face,#333)}
.env-paper{left:6%;right:6%;top:7%;bottom:9%;z-index:2;background:var(--env-paper,#f6f1e6);box-shadow:0 4px 18px rgba(0,0,0,.22);transition:transform 1.5s cubic-bezier(.23,.75,.3,1) .95s}
.env-front{inset:0;z-index:3;background:var(--env-face,#333);clip-path:polygon(0 0,50% 47%,100% 0,100% 100%,0 100%);box-shadow:0 22px 60px rgba(0,0,0,.38)}
.env-front:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.14),rgba(255,255,255,.05) 55%,rgba(0,0,0,.1));clip-path:inherit}
.env-flap{left:0;right:0;top:0;height:52%;z-index:4;background:var(--env-flap,var(--env-face,#333));clip-path:polygon(0 0,100% 0,50% 100%);transform-origin:top center;transition:transform 1.25s cubic-bezier(.45,.05,.2,1);backface-visibility:hidden}
.env-flap:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(0,0,0,.16));clip-path:inherit}
.env-seal{left:50%;top:47%;width:76px;height:76px;z-index:5;transform:translate(-50%,-50%);border-radius:50%;display:flex;align-items:center;justify-content:center;transition:opacity .55s ease .4s;box-shadow:0 2px 8px rgba(0,0,0,.3),inset 0 1px 2px rgba(255,255,255,.35)}
.envx.open .env-flap{transform:rotateX(180deg)}
.envx.open .env-seal{opacity:0}
.envx.open .env-paper{transform:translateY(-84%) scale(1.02)}
.env-hint{font-size:.7rem;letter-spacing:3.5px;text-transform:uppercase;color:var(--env-hint,#ddd);animation:envhint 2.8s ease-in-out infinite}
@keyframes envhint{0%,100%{opacity:.5}50%{opacity:1}}
.fx{opacity:0;transform:translateY(26px);filter:blur(10px)}
.fx.in{opacity:1;transform:none;filter:none;transition:opacity 1s cubic-bezier(.22,.61,.36,1),transform 1.15s cubic-bezier(.22,.61,.36,1),filter 1.15s ease;transition-delay:var(--d,0s)}
#mbtn{position:fixed;right:16px;bottom:16px;z-index:8000;width:52px;height:52px;border-radius:50%;cursor:pointer;font-size:1.25rem;box-shadow:0 4px 14px rgba(0,0,0,.18)}
#mbtn.on{animation:mpulse 2s ease-in-out infinite}
@keyframes mpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
@media (prefers-reduced-motion:reduce){
.fx{opacity:1;transform:none;filter:none}
.envx,.env-flap,.env-paper,.env-seal{transition:none!important}
.env-hint,#mbtn.on{animation:none}
}
</style>`;
}

// Разметка конверта. seal — содержимое сургучной печати, front — надпись на кармане.
export function envelopeHTML({ seal = '', front = '', hint }) {
  return `<div class="envx" id="envx">
  <div class="env" id="env" role="button" tabindex="0" aria-label="${hint}">
    <div class="env-back"></div>
    <div class="env-paper"></div>
    <div class="env-front">${front}</div>
    <div class="env-flap"></div>
    <div class="env-seal">${seal}</div>
  </div>
  <div class="env-hint">${hint}</div>
</div>`;
}

// Оркестровка: клик → створка (1.25s) → бумага (1.5s) → шелест (WebAudio, без файлов) →
// музыка с фейдом → оверлей исчезает → включаются reveal-наблюдатели.
export function experienceScript() {
  return `<script>(function(){
var x=document.getElementById('envx'),env=document.getElementById('env');
var rm=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function reveal(){
  var els=[].slice.call(document.querySelectorAll('.fx'));
  if(rm||!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in')});return}
  var io=new IntersectionObserver(function(en){en.forEach(function(t){if(t.isIntersecting){t.target.classList.add('in');io.unobserve(t.target)}})},{threshold:.12,rootMargin:'0px 0px -8% 0px'});
  els.forEach(function(e){io.observe(e)});
}
function sfx(){try{var C=window.AudioContext||window.webkitAudioContext;if(!C)return;
var c=new C(),n=Math.floor(c.sampleRate*.8),b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0),i;
for(i=0;i<n;i++){d[i]=(Math.random()*2-1)*Math.pow(1-i/n,2)}
var s=c.createBufferSource();s.buffer=b;
var f=c.createBiquadFilter();f.type='bandpass';f.frequency.value=1400;f.Q.value=.7;
var g=c.createGain();g.gain.setValueAtTime(0,c.currentTime);
g.gain.linearRampToValueAtTime(.05,c.currentTime+.12);
g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.75);
s.connect(f);f.connect(g);g.connect(c.destination);s.start()}catch(e){}}
if(!x){reveal();return}
document.body.classList.add('locked');
var opened=false;
function open(){if(opened)return;opened=true;x.classList.add('open');
if(!rm)sfx();
setTimeout(function(){if(window.__music)window.__music.start()},rm?50:1250);
setTimeout(function(){x.classList.add('gone')},rm?50:2550);
setTimeout(function(){x.style.display='none';document.body.classList.remove('locked');reveal()},rm?400:3450);}
env.addEventListener('click',open);
env.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});
})();</script>`;
}

// Музыка: скрытый <audio> + плавающая кнопка ♪. Старт — из experienceScript
// через window.__music.start() с нарастанием громкости ~2.5s (по мастер-инструкции).
export function audioWidget(music) {
  if (!music) return '';
  const start = music.start ?? 0;
  const end = music.end ?? 0;
  if (music.youtubeId) {
    const src = `https://www.youtube.com/embed/${music.youtubeId}?autoplay=1&start=${start}${end > start ? '&end=' + end : ''}&loop=1&playlist=${music.youtubeId}`;
    return `<button id="mbtn" aria-label="Music">♪</button><div id="ytbox" style="position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;bottom:0;right:0"></div>
<script>(function(){var on=false,b=document.getElementById('mbtn'),x=document.getElementById('ytbox');
function play(){x.innerHTML='<iframe src="${src}" allow="autoplay" width="1" height="1"></iframe>';b.classList.add('on');on=true}
function stop(){x.innerHTML='';b.classList.remove('on');on=false}
b.addEventListener('click',function(e){e.stopPropagation();on?stop():play()});
window.__music={start:function(){if(!on)play()}};
})();</script>`;
  }
  if (!music.playable) return '';
  return `<audio id="bgm" preload="auto" src="${music.url}"></audio><button id="mbtn" aria-label="Music">♪</button>
<script>(function(){var a=document.getElementById('bgm'),b=document.getElementById('mbtn'),s=${start},e=${end},tm=null;
if(e>s){a.addEventListener('timeupdate',function(){if(a.currentTime>=e){a.currentTime=s;a.play()}})}else{a.loop=true}
function fade(to,ms){if(tm)clearInterval(tm);var f0=a.volume,t0=Date.now();
tm=setInterval(function(){var k=Math.min(1,(Date.now()-t0)/ms);a.volume=f0+(to-f0)*k;if(k>=1){clearInterval(tm);tm=null}},50)}
function play(ms){if(s&&a.currentTime<s)a.currentTime=s;a.volume=0;
a.play().then(function(){b.classList.add('on');fade(1,ms)}).catch(function(){})}
window.__music={start:function(){play(2500)}};
b.addEventListener('click',function(ev){ev.stopPropagation();
if(a.paused){play(600)}else{a.pause();b.classList.remove('on')}});
})();</script>`;
}

// Живой отсчёт до свадьбы: пишет в элементы #cd #ch #cm #cs.
export function countdownScript(targetIso) {
  return `<script>(function(){var t=new Date('${targetIso}').getTime();
function p(n){return n<10?'0'+n:''+n}function g(i){return document.getElementById(i)}
function tick(){var x=Math.max(0,t-Date.now());g('cd').textContent=Math.floor(x/864e5);
g('ch').textContent=p(Math.floor(x/36e5)%24);g('cm').textContent=p(Math.floor(x/6e4)%60);
g('cs').textContent=p(Math.floor(x/1e3)%60)}tick();setInterval(tick,1000)})();</script>`;
}
