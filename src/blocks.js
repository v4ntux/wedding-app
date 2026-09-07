// Блоки движка приглашений: музыка, карта, отсчёт, текстура бумаги.
// Открытие (конверт) живёт отдельно — см. experience.js.
// Шаблоны из templates/ вставляют их как {{{audioWidget}}}, {{{map}}} и т.д.
// Все пользовательские значения экранируются здесь (в buildData данные сырые).

import { escapeHtml } from './templateEngine.js';

// Бумажное зерно: едва заметная текстура, накладывается поверх фона секций ({{{grain}}}).
export const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.045'/%3E%3C/svg%3E")`;

// Музыка: скрытый <audio> + плавающая кнопка с векторной иконкой. Старт — из experience.js
// через window.__music.start() с нарастанием громкости ~2.5s.
const MUSIC_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>';

/* Кнопка музыки и регулятор громкости — одна разметка на оба режима. */
function player(musicLabel, volumeLabel) {
  return `<div id="mplayer"><input id="mvol" type="range" min="0" max="100" step="1" value="70" aria-label="${volumeLabel}">`
    + `<button id="mbtn" aria-label="${musicLabel}">${MUSIC_ICON}</button></div>`;
}

export function audioWidget(music, lang = 'uz') {
  if (!music) return '';
  const musicLabel = lang === 'ru' ? 'Музыка' : 'Musiqa';
  const volumeLabel = lang === 'ru' ? 'Громкость' : 'Ovoz balandligi';
  const start = Number(music.start) || 0;
  const end = Number(music.end) || 0;
  if (music.youtubeId) {
    const src = `https://www.youtube.com/embed/${music.youtubeId}?autoplay=1&start=${start}${end > start ? '&end=' + end : ''}&loop=1&playlist=${music.youtubeId}`;
    return `${player(musicLabel, volumeLabel)}<div id="ytbox" style="position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;bottom:0;right:0"></div>
<script>(function(){var on=false,b=document.getElementById('mbtn'),x=document.getElementById('ytbox'),
box=document.getElementById('mplayer'),vol=document.getElementById('mvol'),hide=null,frame=null;
var saved=Number(localStorage.getItem('nv_volume'));
var level=Number.isFinite(saved)&&saved>=0&&saved<=100?saved:70;
vol.value=level;paint();
function paint(){vol.style.setProperty('--vol',vol.value+'%')}
function send(cmd,args){try{frame&&frame.contentWindow&&frame.contentWindow.postMessage(JSON.stringify({event:'command',func:cmd,args:args||[]}),'*')}catch(e){}}
function showVol(){box.classList.add('vol-open');clearTimeout(hide);hide=setTimeout(function(){box.classList.remove('vol-open')},5000)}
function play(){x.innerHTML='<iframe id="ytframe" src="${src}&enablejsapi=1" allow="autoplay" width="1" height="1"></iframe>';
frame=document.getElementById('ytframe');b.classList.add('on');on=true;
setTimeout(function(){send('setVolume',[Number(vol.value)])},1200);showVol()}
function stop(){x.innerHTML='';frame=null;b.classList.remove('on');on=false;box.classList.remove('vol-open')}
b.addEventListener('click',function(e){e.stopPropagation();on?stop():play()});
vol.addEventListener('input',function(){paint();send('setVolume',[Number(vol.value)]);
try{localStorage.setItem('nv_volume',vol.value)}catch(e){}showVol()});
vol.addEventListener('click',function(e){e.stopPropagation()});
window.__music={start:function(){if(!on)play()}};
})();</script>`;
  }
  if (!music.playable) return '';
  return `<audio id="bgm" preload="auto" src="${escapeHtml(music.url)}"></audio>${player(musicLabel, volumeLabel)}
<script>(function(){var a=document.getElementById('bgm'),b=document.getElementById('mbtn'),
box=document.getElementById('mplayer'),vol=document.getElementById('mvol'),s=${start},e=${end},tm=null,hide=null;
// Громкость гостя запоминается: второй раз подбирать её не придётся.
var saved=Number(localStorage.getItem('nv_volume'));
var level=Number.isFinite(saved)&&saved>=0&&saved<=100?saved:70;
vol.value=level;paint();
function paint(){vol.style.setProperty('--vol',vol.value+'%')}
function target(){return Number(vol.value)/100}
if(e>s){a.addEventListener('timeupdate',function(){if(a.currentTime>=e){a.currentTime=s;a.play()}})}else{a.loop=true}
function fade(to,ms){if(tm)clearInterval(tm);var f0=a.volume,t0=Date.now();
tm=setInterval(function(){var k=Math.min(1,(Date.now()-t0)/ms);a.volume=Math.max(0,Math.min(1,f0+(to-f0)*k));if(k>=1){clearInterval(tm);tm=null}},50)}
function showVol(){box.classList.add('vol-open');clearTimeout(hide);hide=setTimeout(function(){box.classList.remove('vol-open')},5000)}
function play(ms){if(s&&a.currentTime<s)a.currentTime=s;a.volume=0;
a.play().then(function(){b.classList.add('on');fade(target(),ms);showVol()}).catch(function(){})}
window.__music={start:function(){play(2500)}};
b.addEventListener('click',function(ev){ev.stopPropagation();
if(a.paused){play(600)}else{a.pause();b.classList.remove('on');box.classList.remove('vol-open')}});
vol.addEventListener('input',function(){paint();if(tm){clearInterval(tm);tm=null}a.volume=target();
try{localStorage.setItem('nv_volume',vol.value)}catch(e2){}showVol()});
vol.addEventListener('click',function(ev){ev.stopPropagation()});
})();</script>`;
}

// Локация в приглашении: живая карта, если её включили, или крупная
// типографическая сцена с названием места без декоративной иллюстрации.
export function mapEmbed({ lat, lng, lang, address, enabled = true }) {
  if (!enabled) {
    const kicker = lang === 'ru' ? 'МЕСТО ВСТРЕЧИ' : 'UCHRASHUV MANZILI';
    return `<style>
.venue-type{position:relative;display:grid;min-height:clamp(310px,62vh,520px);margin:28px auto;overflow:hidden;place-content:center;padding:54px 22px;color:var(--gold,#c7a75f);text-align:center;border-block:1px solid currentColor;background:radial-gradient(circle at 50% 46%,color-mix(in srgb,currentColor 16%,transparent),transparent 36%),linear-gradient(180deg,transparent,rgba(5,4,2,.24),transparent);isolation:isolate}
.venue-type:before{content:'';position:absolute;left:50%;top:50%;width:min(72vw,390px);aspect-ratio:1;border:1px solid currentColor;border-radius:50%;opacity:.13;transform:translate(-50%,-50%);box-shadow:0 0 0 34px color-mix(in srgb,currentColor 5%,transparent),0 0 0 72px color-mix(in srgb,currentColor 3%,transparent);animation:venueAura 8s ease-in-out infinite alternate}
.venue-type:after{content:'';position:absolute;inset:13px;border:1px solid currentColor;opacity:.16;clip-path:polygon(0 0,24% 0,24% 1px,76% 1px,76% 0,100% 0,100% 100%,76% 100%,76% calc(100% - 1px),24% calc(100% - 1px),24% 100%,0 100%)}
.venue-type small{position:relative;z-index:2;margin-bottom:24px;font:500 clamp(.58rem,1.8vw,.75rem)/1.4 ui-monospace,monospace;letter-spacing:.34em;text-transform:uppercase;opacity:.72}
.venue-type b{position:relative;z-index:2;display:block;max-width:900px;color:var(--paper,#fff9eb);font:500 clamp(3.2rem,13vw,7.7rem)/.9 Georgia,serif;letter-spacing:-.055em;overflow-wrap:anywhere;text-wrap:balance;text-shadow:0 0 34px color-mix(in srgb,currentColor 26%,transparent);animation:venueTitle 6.8s ease-in-out infinite alternate}
.venue-type span{position:relative;z-index:2;display:block;width:min(170px,52vw);height:1px;margin:32px auto 0;background:linear-gradient(90deg,transparent,currentColor,transparent);opacity:.78}
.venue-type span:after{content:'';position:absolute;left:0;top:-2px;width:5px;height:5px;border-radius:50%;background:currentColor;box-shadow:0 0 14px currentColor;animation:venueTrace 5.4s ease-in-out infinite}
@keyframes venueAura{to{opacity:.25;transform:translate(-50%,-50%) scale(1.08) rotate(6deg)}}
@keyframes venueTitle{to{transform:translateY(-5px);letter-spacing:-.035em;text-shadow:0 0 48px color-mix(in srgb,currentColor 38%,transparent)}}
@keyframes venueTrace{50%{left:calc(100% - 5px)}100%{left:0}}
@media(prefers-reduced-motion:reduce){.venue-type:before,.venue-type b,.venue-type span:after{animation:none}}
</style><div class="venue-type"><small>${kicker}</small><b>${escapeHtml(address || '')}</b><span aria-hidden="true"></span></div>`;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  const mapLang = lang === 'ru' ? 'ru_RU' : 'uz_UZ';
  const mapTitle = lang === 'ru' ? 'Карта места' : 'Joy xaritasi';
  const pt = `${lng},${lat}`;
  const src = `https://yandex.ru/map-widget/v1/?ll=${pt}&z=16&pt=${pt},pm2rdm&lang=${mapLang}`;
  return `<div class="mapbox"><iframe src="${src}" loading="lazy" allowfullscreen
referrerpolicy="no-referrer-when-downgrade" title="${mapTitle}" aria-label="${escapeHtml(address || mapTitle)}"></iframe></div>`;
}

// Живой отсчёт до события: пишет в элементы #cd #ch #cm #cs.
// Отсчёт с перекидными цифрами: разряд меняется — старая цифра уходит вверх,
// новая приходит снизу. Двигаются только изменившиеся разряды, поэтому секунды
// «тикают», а дни стоят на месте.
export function countdownScript(targetIso) {
  return `<style>
.roll{position:relative;display:inline-flex;overflow:hidden;height:1em;vertical-align:baseline;line-height:1;font:inherit;letter-spacing:inherit}
.roll u{position:relative;display:block;text-decoration:none;transition:transform .52s cubic-bezier(.22,.61,.36,1),opacity .52s ease}
.roll u.out{position:absolute;transform:translateY(-100%);opacity:0}
.roll u.in{animation:rollIn .52s cubic-bezier(.22,.61,.36,1) both}
@keyframes rollIn{from{transform:translateY(100%);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.roll u{transition:none}.roll u.in{animation:none}}
</style><script>(function(){
var t=new Date('${targetIso}').getTime(),ids=['cd','ch','cm','cs'],cells={};
function p(n){return n<10?'0'+n:''+n}
ids.forEach(function(id){
  var el=document.getElementById(id);if(!el)return;
  el.textContent='';
  cells[id]={host:el,digits:[]};
});
// Каждый разряд — отдельный барабан: при смене «10» на «09» едет только последняя цифра.
function setValue(id,str){
  var c=cells[id];if(!c)return;
  var chars=String(str).split('');
  while(c.digits.length>chars.length){c.host.removeChild(c.digits.pop().box)}
  chars.forEach(function(ch,i){
    var d=c.digits[i];
    if(!d){
      var box=document.createElement('span');box.className='roll';
      var u=document.createElement('u');u.textContent=ch;box.appendChild(u);
      c.host.appendChild(box);c.digits[i]={box:box,cur:u,val:ch};return;
    }
    if(d.val===ch)return;
    var next=document.createElement('u');next.textContent=ch;next.className='in';
    var prev=d.cur;prev.classList.add('out');
    d.box.appendChild(next);
    setTimeout(function(){if(prev.parentNode)prev.parentNode.removeChild(prev)},560);
    d.cur=next;d.val=ch;
  });
}
function tick(){
  var x=Math.max(0,t-Date.now());
  setValue('cd',Math.floor(x/864e5));
  setValue('ch',p(Math.floor(x/36e5)%24));
  setValue('cm',p(Math.floor(x/6e4)%60));
  setValue('cs',p(Math.floor(x/1e3)%60));
}
tick();setInterval(tick,1000);
})();</script>`;
}
