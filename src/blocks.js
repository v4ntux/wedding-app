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

/* Кнопка стоит слева внизу, а когда до экрана доезжает футер, поднимается и
   держится чуть выше него: подпись nVate.uz внизу страницы не перекрывается.
   Скролл читаем через rAF — не чаще кадра. */
const LIFT_JS = `(function(){var raf=0;
function lift(){raf=0;var f=document.querySelector('.made');if(!f)return;
var over=innerHeight-f.getBoundingClientRect().top;box.style.transform=over>0?'translate3d(0,'+(-over)+'px,0)':''}
function queue(){if(!raf)raf=requestAnimationFrame(lift)}
addEventListener('scroll',queue,{passive:true});addEventListener('resize',queue);lift()})();`;

/* Кнопка музыки и регулятор громкости — одна разметка на оба режима. */
function player(musicLabel, volumeLabel) {
  return `<div id="mplayer"><input id="mvol" type="range" min="0" max="100" step="1" value="70" aria-label="${volumeLabel}">`
    + `<button id="mbtn" aria-label="${musicLabel}">${MUSIC_ICON}</button></div>`;
}

/* Громкость гостя запоминается: второй раз подбирать её не придётся. Песня
   звучит в доле от неё, которую задала пара (mv). */
const VOLUME_JS = `var stored=null;try{stored=localStorage.getItem('nv_volume')}catch(_){}
// Number(null) — это 0: без этой проверки первый визит начинался с немого регулятора.
var saved=stored===null||stored===''?NaN:Number(stored);
vol.value=Number.isFinite(saved)&&saved>=0&&saved<=100?saved:70;paint();
function paint(){vol.style.setProperty('--vol',vol.value+'%')}
function remember(){try{localStorage.setItem('nv_volume',vol.value)}catch(_){}}
function showVol(){box.classList.add('vol-open');clearTimeout(hide);hide=setTimeout(function(){box.classList.remove('vol-open')},5000)}
// Песня пропала (снята, удалена, закрыта автором) — кнопку убираем молча.
function gone(){box.style.display='none';box.classList.remove('vol-open')}
vol.addEventListener('click',function(ev){ev.stopPropagation()});`;

/* Браузер не дал включить звук без касания: кнопка мягко зовёт, а первое же
   касание страницы включает песню. Касание самой кнопки она обработает сама. */
const WAIT_JS = `var waiting=null;
function waitTap(go){if(waiting)return;b.classList.add('wait');
waiting=function(ev){document.removeEventListener('pointerdown',waiting,true);document.removeEventListener('keydown',waiting,true);
waiting=null;b.classList.remove('wait');if(!box.contains(ev.target))go()};
document.addEventListener('pointerdown',waiting,true);document.addEventListener('keydown',waiting,true)}`;

const num = (value) => Number((Number(value) || 0).toFixed(2));

export function audioWidget(music, lang = 'uz') {
  if (!music) return '';
  const musicLabel = lang === 'ru' ? 'Музыка' : 'Musiqa';
  const volumeLabel = lang === 'ru' ? 'Громкость' : 'Ovoz balandligi';
  const start = Math.max(0, num(music.start));
  const end = Math.max(0, num(music.end));
  const volume = Math.min(1, Math.max(0.1, Number(music.volume) || 1));
  const videoId = music.kind === 'youtube' ? music.videoId : music.youtubeId;
  if (videoId) {
    if (!/^[\w-]{11}$/.test(String(videoId))) return '';
    /* Официальный плеер YouTube (IFrame Player API). Создаём его сразу при
       загрузке страницы: когда гость откроет конверт, playVideo() прозвучит без
       ожидания сети — у браузера меньше поводов счесть звук автозапуском. */
    return `${player(musicLabel, volumeLabel)}<div id="ytbox" aria-hidden="true" style="position:fixed;left:0;bottom:0;width:200px;height:200px;overflow:hidden;opacity:0;pointer-events:none;z-index:-1"><div id="ytp"></div></div>
<script>(function(){var id='${videoId}',s=${start},mv=${volume},b=document.getElementById('mbtn'),
box=document.getElementById('mplayer'),vol=document.getElementById('mvol'),hide=null,p=null,ready=false,want=false,on=false,guard=null;
${VOLUME_JS}
${WAIT_JS}
function level(){return Math.round(Math.max(0,Math.min(100,Number(vol.value)*mv)))}
function go(){if(!ready)return;try{p.setVolume(level());p.seekTo(s,true);p.playVideo()}catch(_){}
clearTimeout(guard);guard=setTimeout(function(){if(want&&!on)waitTap(go)},2600)}
function build(){if(p||!window.YT||!YT.Player)return;
p=new YT.Player('ytp',{width:200,height:200,videoId:id,
playerVars:{start:Math.floor(s),playsinline:1,controls:0,disablekb:1,fs:0,rel:0,iv_load_policy:3},
events:{onReady:function(){ready=true;if(want)go()},
onStateChange:function(ev){if(ev.data===1){on=true;clearTimeout(guard);b.classList.add('on');b.classList.remove('wait');showVol()}
else if(ev.data===2){on=false;b.classList.remove('on')}
else if(ev.data===0){try{p.seekTo(s,true);p.playVideo()}catch(_){}}},
onError:function(){want=false;gone()}}})}
if(window.YT&&YT.Player)build();else{var prior=window.onYouTubeIframeAPIReady;
window.onYouTubeIframeAPIReady=function(){if(typeof prior==='function')prior();build()};
var tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';tag.async=true;tag.onerror=gone;document.head.appendChild(tag)}
${LIFT_JS}
window.__music={start:function(){want=true;go()}};
b.addEventListener('click',function(ev){ev.stopPropagation();
if(on){want=false;try{p.pauseVideo()}catch(_){}box.classList.remove('vol-open')}else{want=true;go()}});
vol.addEventListener('input',function(){paint();try{if(p&&ready)p.setVolume(level())}catch(_){}remember();showVol()});
})();</script>`;
  }
  if (!music.url || music.playable === false) return '';
  /* #t=74.35 — медиафрагмент: браузер сам начнёт загрузку с нужного места. Без
     него iOS молча игнорирует currentTime до метаданных, и гость слышал вступление. */
  const src = start > 0 && !String(music.url).includes('#') ? `${music.url}#t=${start}` : music.url;
  return `<audio id="bgm" preload="auto" src="${escapeHtml(src)}"></audio>${player(musicLabel, volumeLabel)}
<script>(function(){var a=document.getElementById('bgm'),b=document.getElementById('mbtn'),
box=document.getElementById('mplayer'),vol=document.getElementById('mvol'),s=${start},e=${end},mv=${volume},tm=null,hide=null,tail=false;
${VOLUME_JS}
${WAIT_JS}
function target(){return Math.max(0,Math.min(1,Number(vol.value)/100*mv))}
// Конца у отрывка нет: трек доигрывает до последней секунды и начинается
// снова с выбранного места. Прежняя петля a.loop возвращала его на 0:00 —
// в обход начала, которое пара отметила в студии.
function seek(){try{if(s&&a.currentTime<s-.3)a.currentTime=s}catch(_){}}
a.addEventListener('loadedmetadata',seek);
a.addEventListener('error',gone);
if(e>s){a.addEventListener('timeupdate',function(){if(a.currentTime>=e){a.currentTime=s;a.play()}})}
else{
// Последние полторы секунды трек уходит в тишину и возвращается к началу
// так же мягко, как зазвучал впервые, — без обрыва на полуслове.
a.addEventListener('timeupdate',function(){if(!tail&&a.duration&&a.duration-a.currentTime<1.6&&!a.paused){tail=true;fade(0,1400)}});
a.addEventListener('ended',function(){tail=false;a.currentTime=s;a.play().then(function(){fade(target(),2000)}).catch(function(){})})}
function fade(to,ms){if(tm)clearInterval(tm);var f0=a.volume,t0=Date.now();
tm=setInterval(function(){var k=Math.min(1,(Date.now()-t0)/ms);a.volume=Math.max(0,Math.min(1,f0+(to-f0)*k));if(k>=1){clearInterval(tm);tm=null}},50)}
function play(ms){seek();a.volume=0;
a.play().then(function(){b.classList.add('on');b.classList.remove('wait');fade(target(),ms);showVol()})
.catch(function(err){if(err&&err.name==='NotAllowedError')waitTap(function(){play(600)})})}
${LIFT_JS}
window.__music={start:function(){play(2500)}};
b.addEventListener('click',function(ev){ev.stopPropagation();
if(a.paused){play(600)}else{a.pause();b.classList.remove('on');box.classList.remove('vol-open')}});
vol.addEventListener('input',function(){paint();if(tm){clearInterval(tm);tm=null}a.volume=target();remember();showVol()});
})();</script>`;
}

// Локация в приглашении: живая карта, если её включили, или крупная
// типографическая сцена с названием места без декоративной иллюстрации.
export function mapEmbed({ lat, lng, lang, address, enabled = true, tone = 'dark', tiles = '' }) {
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
/* Дыхание заголовка — только сдвиг и свечение. Разрядку (letter-spacing) тут
   анимировать нельзя: строка в 13vw переверстывается каждый кадр. */
@keyframes venueTitle{to{transform:translateY(-5px);text-shadow:0 0 48px color-mix(in srgb,currentColor 38%,transparent)}}
@keyframes venueTrace{50%{transform:translateX(calc(min(170px,52vw) - 5px))}100%{transform:translateX(0)}}
@media(prefers-reduced-motion:reduce){.venue-type:before,.venue-type b,.venue-type span:after{animation:none}}
</style><div class="venue-type"><small>${kicker}</small><b>${escapeHtml(address || '')}</b><span aria-hidden="true"></span></div>`;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  /* Своя карта вместо виджета Яндекса: на ней ровно одна метка — эта тойхона,
     со свечением «праздник будет здесь». Чужих меток, линейки, компаса и
     кнопок у неё нет; палец страницу не останавливает — листается сквозь. */
  const label = lang === 'ru' ? 'Карта места' : 'Joy xaritasi';
  const name = String(address || '').slice(0, 140);
  const safe = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
  const cfg = { lat, lng, name, tone: tone === 'light' ? 'light' : 'dark', tiles: tiles || '' };
  return `<link rel="stylesheet" href="/app/map.css">
<div class="mapbox"><div class="nvmap-host" role="img" aria-label="${escapeHtml(name || label)}"></div></div>
<script src="/app/map.js"></script>
<script>(function(){var c=${safe(cfg)},host=document.querySelector('.mapbox .nvmap-host');
if(!host||!window.NvMap)return;
var map=NvMap.create(host,{lat:c.lat,lng:c.lng,zoom:16,tiles:c.tiles||undefined,tone:c.tone,interactive:false});
map.setPins([{id:'here',lat:c.lat,lng:c.lng,label:c.name,here:true}]);
})();</script>`;
}

/* Подпись платформы в конце каждого приглашения. Это реклама, поэтому она
   живая: кольца прорисовываются, по имени проходит блик, стрелка зовёт, а
   весь блок — ссылка на бота, где гость может собрать своё приглашение. */
export function madeFooter(lang = 'uz', bot = 'nvate_bot') {
  const ru = lang === 'ru';
  const kicker = ru ? 'Приглашение создано в' : 'Taklifnoma yaratildi';
  const cta = ru ? 'Создать своё' : 'O‘zingiznikini yarating';
  const handle = escapeHtml(String(bot).replace(/^@/, ''));
  return `<footer class="made fx">
<a class="made__link" href="https://t.me/${handle}" target="_blank" rel="noopener">
<svg class="made__rings" viewBox="0 0 56 34" aria-hidden="true"><circle cx="20" cy="17" r="12"/><circle cx="36" cy="17" r="12"/></svg>
<span class="made__copy"><small>${kicker}</small><b>nVate<i>.uz</i></b></span>
<span class="made__cta"><em>@${handle}<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10h10M11 6l4 4-4 4"/></svg></em><span>${cta}</span></span>
</a>
</footer>`;
}

// Живой отсчёт до события: пишет в элементы #cd #ch #cm #cs.
// Барабан из двух ячеек: видимая и следующая. Смена разряда — один сдвиг
// ленты на высоту строки, после которого лента молча возвращается на место.
// Ни одна ячейка не появляется и не исчезает: старая цифра не может остаться
// висеть поверх новой, а элементы не пересоздаются каждую секунду.
export function countdownScript(targetIso) {
  return `<style>
/* Окно высотой ровно в строку: всё, что выезжает, обрезается им, а не
   соседним разрядом. Ширину задаёт само число, поэтому широкие цифры антиквы
   (Cinzel, Italiana) не срезаются по бокам. */
.roll{display:block;overflow:hidden;height:1.12em;font:inherit;
  font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}
.roll-strip{display:block;will-change:transform;transform:translate3d(0,0,0)}
.roll-strip.go{transition:transform .46s cubic-bezier(.33,1,.68,1)}
.roll-strip.go{transform:translate3d(0,-1.12em,0)}
.roll u{display:block;height:1.12em;line-height:1.12;text-decoration:none;font:inherit;
  font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}
@media (prefers-reduced-motion:reduce){.roll-strip.go{transition:none}}
</style><script>(function(){
var t=new Date('${targetIso}').getTime(),ids=['cd','ch','cm','cs'],cells={};
function p(n){return n<10?'0'+n:''+n}
ids.forEach(function(id){
  var el=document.getElementById(id);if(!el)return;
  el.textContent='';
  var box=document.createElement('span');box.className='roll';
  var strip=document.createElement('span');strip.className='roll-strip';
  var cur=document.createElement('u'),next=document.createElement('u');
  strip.appendChild(cur);strip.appendChild(next);box.appendChild(strip);el.appendChild(box);
  cells[id]={strip:strip,cur:cur,next:next,val:null,busy:false,queued:null};
});
// Лента едет вверх ровно на одну строку. По окончании — снимаем переход,
// переносим значение в верхнюю ячейку и возвращаем ленту в ноль: следующий
// разряд стартует с той же точки, поэтому дрожания на стыке не возникает.
var calm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function roll(c,val){
  if(calm){c.cur.textContent=val;return}
  if(c.busy){c.queued=val;return}
  c.next.textContent=val;c.busy=true;
  var done=function(){
    c.strip.removeEventListener('transitionend',done);
    clearTimeout(guard);
    c.strip.classList.remove('go');
    c.cur.textContent=val;
    c.busy=false;
    var q=c.queued;c.queued=null;
    if(q!==null&&q!==val)roll(c,q);
  };
  var guard=setTimeout(done,560);
  c.strip.addEventListener('transitionend',done);
  // Считываем размер — этим браузер фиксирует нынешнее положение ленты. Без
  // такой засечки запись цифры и сдвиг сольются в один пересчёт стиля и
  // перехода не будет вовсе. requestAnimationFrame тут не годится: в свёрнутой
  // вкладке кадров нет, и разряд замирал бы на полпути.
  void c.strip.offsetHeight;
  c.strip.classList.add('go');
}
function setValue(id,str){
  var c=cells[id];if(!c)return;
  var val=String(str);
  if(c.val===val)return;
  var first=c.val===null;c.val=val;
  if(first){c.cur.textContent=val;return}
  roll(c,val);
}
function tick(){
  var x=Math.max(0,t-Date.now());
  // Дни тоже с ведущим нулём: иначе на «9 → 10» колонка дней меняла ширину и
  // тянула за собой сетку, а секунды дёргались вместе с ней.
  setValue('cd',p(Math.floor(x/864e5)));
  setValue('ch',p(Math.floor(x/36e5)%24));
  setValue('cm',p(Math.floor(x/6e4)%60));
  setValue('cs',p(Math.floor(x/1e3)%60));
  return x;
}
// setInterval за час набегает на полсекунды и цифры начинают прыгать через
// одну. Считаем до ближайшей смены секунды и просыпаемся ровно на ней.
var timer=null;
function loop(){
  var left=tick();
  var wait=left>0?(left%1000||1000):60000;
  timer=setTimeout(loop,wait+16);
}
loop();
// Вкладку свернули — таймеры замирают. Вернулись: пересчитываем сразу.
document.addEventListener('visibilitychange',function(){
  if(document.hidden)return;
  clearTimeout(timer);loop();
});
})();</script>`;
}
