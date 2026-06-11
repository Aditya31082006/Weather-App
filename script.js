/* =========================================================
   SKYPULSE — script.js
   ─────────────────────────────────────────────────────────
   ⚙  SETUP:  Replace the value below with your key from
              https://openweathermap.org/api
   ========================================================= */

const API_KEY = '061bba4e02e273832ea101ddbd90c8ef'; // OpenWeatherMap API key

const BASE    = 'https://api.openweathermap.org/data/2.5';
const ICON    = 'https://openweathermap.org/img/wn';
const UNITS   = 'metric';

/* ── DOM ─────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const scene       = $('scene');
const particles   = $('particles');
const themeBtn    = $('themeBtn');
const locateBtn   = $('locateBtn');
const searchInput = $('searchInput');
const searchBtn   = $('searchBtn');
const stLoad      = $('stLoad');
const stErr       = $('stErr');
const stWelcome   = $('stWelcome');
const stWeather   = $('stWeather');
const retryBtn    = $('retryBtn');

/* ── STATE ───────────────────────────────────────────── */
let lastQuery   = null;
let clockTimer  = null;
let activeTZ    = 0;

/* ── INJECT AMBIENT ORBS ────────────────────────────── */
;['orb-1','orb-2','orb-3'].forEach(cls => {
  const d = document.createElement('div');
  d.className = `orb ${cls}`;
  particles.appendChild(d);
});

/* ── THEME ───────────────────────────────────────────── */
function initTheme(){
  const t = localStorage.getItem('sp-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', t);
}
themeBtn.addEventListener('click', () => {
  const cur  = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('sp-theme', next);
});

/* ── SKY THEME PER CONDITION ─────────────────────────── */
function conditionKey(id, icon){
  const day = icon && !icon.endsWith('n');
  if(id >= 200 && id < 300) return 'storm';
  if(id >= 300 && id < 600) return 'rain';
  if(id >= 600 && id < 700) return 'snow';
  if(id >= 700 && id < 800) return id===721||id===751 ? 'haze' : 'mist';
  if(id === 800) return day ? 'clear' : 'default';
  if(id > 800)  return 'clouds';
  return 'default';
}

const ORB_PALETTES = {
  clear  :['rgba(255,195,40,.26)','rgba(255,130,0,.15)','rgba(255,60,0,.12)'],
  clouds :['rgba(130,160,200,.22)','rgba(90,120,170,.14)','rgba(70,100,150,.12)'],
  rain   :['rgba(50,100,200,.26)','rgba(20,70,160,.15)','rgba(0,50,130,.12)'],
  storm  :['rgba(100,20,160,.30)','rgba(60,10,110,.20)','rgba(180,50,220,.15)'],
  snow   :['rgba(190,225,255,.26)','rgba(150,200,240,.14)','rgba(110,180,220,.12)'],
  mist   :['rgba(130,150,170,.22)','rgba(100,120,140,.14)','rgba(80,100,120,.12)'],
  haze   :['rgba(210,165,55,.26)','rgba(185,130,35,.15)','rgba(160,105,15,.12)'],
  default:['rgba(100,180,255,.22)','rgba(0,220,255,.13)','rgba(120,60,220,.18)'],
};

const GLOW_COLORS = {
  clear :'rgba(255,210,60,.45)',
  storm :'rgba(190,100,255,.45)',
  rain  :'rgba(100,160,255,.40)',
  snow  :'rgba(200,230,255,.40)',
};

function applySky(id, icon){
  const key  = conditionKey(id, icon);
  document.documentElement.style.setProperty('--sky', `var(--sky-${key})`);
  const [a,b,c] = ORB_PALETTES[key] || ORB_PALETTES.default;
  document.documentElement.style.setProperty('--orb-a', a);
  document.documentElement.style.setProperty('--orb-b', b);
  document.documentElement.style.setProperty('--orb-c', c);
  $('heroGlow').style.background =
    `radial-gradient(circle,${GLOW_COLORS[key]||'rgba(255,255,255,.22)'} 0%,transparent 70%)`;
}

/* ── TIME HELPERS ────────────────────────────────────── */
function utcTime(unix, tz){
  const d = new Date((unix + tz) * 1000);
  return [d.getUTCHours(),d.getUTCMinutes()].map(n=>String(n).padStart(2,'0')).join(':');
}
function utcDate(unix, tz){
  return new Date((unix + tz)*1000).toLocaleDateString('en-US',{
    weekday:'long',day:'numeric',month:'long',timeZone:'UTC'
  });
}
function shortDay(unix){
  return new Date(unix*1000).toLocaleDateString('en-US',{weekday:'short'});
}
function startClock(tz){
  activeTZ = tz;
  if(clockTimer) clearInterval(clockTimer);
  const tick = () => $('wTime').textContent = utcTime(Math.floor(Date.now()/1000), tz);
  tick();
  clockTimer = setInterval(tick, 1000);
}

/* ── API FETCH ───────────────────────────────────────── */
async function api(path){
  const r = await fetch(`${BASE}${path}`);
  if(!r.ok){ const e = await r.json().catch(()=>({})); throw Object.assign(new Error(e.message||'error'),{status:r.status}); }
  return r.json();
}
function qCurrent(q){
  if(q.type==='city')   return `/weather?q=${encodeURIComponent(q.val)}&units=${UNITS}&appid=${API_KEY}`;
  return `/weather?lat=${q.val.lat}&lon=${q.val.lon}&units=${UNITS}&appid=${API_KEY}`;
}
function qForecast(q){
  if(q.type==='city')   return `/forecast?q=${encodeURIComponent(q.val)}&units=${UNITS}&cnt=40&appid=${API_KEY}`;
  return `/forecast?lat=${q.val.lat}&lon=${q.val.lon}&units=${UNITS}&cnt=40&appid=${API_KEY}`;
}
function qAQI(lat,lon){ return `/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`; }

/* ── RENDER ──────────────────────────────────────────── */
function renderMain(w){
  $('wCity').textContent   = w.name;
  $('wCountry').textContent = w.sys.country;
  $('wDate').textContent   = utcDate(Math.floor(Date.now()/1000), w.timezone);
  $('wIcon').src           = `${ICON}/${w.weather[0].icon}@4x.png`;
  $('wIcon').alt           = w.weather[0].description;
  $('wTemp').textContent   = Math.round(w.main.temp);
  $('wDesc').textContent   = w.weather[0].description;
  $('wFeels').textContent  = Math.round(w.main.feels_like);
  $('sHumidity').textContent   = `${w.main.humidity}%`;
  $('sWind').textContent       = `${(w.wind.speed*3.6).toFixed(1)} km/h`;
  $('sPressure').textContent   = `${w.main.pressure} hPa`;
  $('sVisibility').textContent = w.visibility >= 1000
    ? `${(w.visibility/1000).toFixed(1)} km`
    : `${w.visibility} m`;
  $('sSunrise').textContent = utcTime(w.sys.sunrise, w.timezone);
  $('sSunset').textContent  = utcTime(w.sys.sunset,  w.timezone);
  startClock(w.timezone);
  applySky(w.weather[0].id, w.weather[0].icon);
}

const AQI_LABEL = ['','Good','Fair','Moderate','Poor','Very Poor'];
const AQI_COLOR = ['','#00e400','#cccc00','#ff7e00','#ff0000','#8f0052'];

function renderAQI(data){
  if(!data?.list?.length) return;
  const aqi  = data.list[0].main.aqi;
  const comp = data.list[0].components;
  const pct  = ((aqi-1)/4)*100;
  $('aqiPill').textContent      = AQI_LABEL[aqi];
  $('aqiPill').style.color      = AQI_COLOR[aqi];
  $('aqiPill').style.borderColor= AQI_COLOR[aqi]+'55';
  $('aqiDot').style.left        = `${pct}%`;

  const pollutants = [
    {k:'PM2.5',v:comp.pm2_5?.toFixed(1)},
    {k:'PM10', v:comp.pm10?.toFixed(1)},
    {k:'O₃',   v:comp.o3?.toFixed(1)},
    {k:'NO₂',  v:comp.no2?.toFixed(1)},
    {k:'CO',   v:comp.co?.toFixed(0)},
  ];
  $('aqiChips').innerHTML = pollutants
    .filter(p=>p.v!=null)
    .map(p=>`<div class="chip"><b>${p.k}</b> ${p.v} µg/m³</div>`)
    .join('');
}

function renderHourly(forecast, tz){
  const slots = forecast.list.slice(0,12);
  $('hourlyRow').innerHTML = slots.map((s,i)=>`
    <div class="hcard${i===0?' now':''}">
      <span class="hcard-time">${i===0?'Now':utcTime(s.dt,tz)}</span>
      <img src="${ICON}/${s.weather[0].icon}@2x.png" alt="${s.weather[0].description}" loading="lazy"/>
      <span class="hcard-temp">${Math.round(s.main.temp)}°</span>
    </div>
  `).join('');
}

function renderDays(forecast){
  const days = {};
  forecast.list.forEach(s=>{
    const k = new Date(s.dt*1000).toISOString().slice(0,10);
    (days[k]||(days[k]=[])).push(s);
  });
  const entries = Object.entries(days).slice(0,5);
  $('daysGrid').innerHTML = entries.map(([,slots])=>{
    const noon = slots.reduce((b,s)=>
      Math.abs(new Date(s.dt*1000).getUTCHours()-12)<Math.abs(new Date(b.dt*1000).getUTCHours()-12)?s:b
    );
    const hi = Math.round(Math.max(...slots.map(s=>s.main.temp_max)));
    const lo = Math.round(Math.min(...slots.map(s=>s.main.temp_min)));
    return `
      <div class="dcard">
        <span class="dcard-day">${shortDay(noon.dt)}</span>
        <img src="${ICON}/${noon.weather[0].icon}@2x.png" alt="${noon.weather[0].description}" loading="lazy"/>
        <span class="dcard-hi">${hi}°</span>
        <span class="dcard-lo">${lo}°</span>
      </div>`;
  }).join('');
}

/* ── UI STATES ───────────────────────────────────────── */
function show(state){
  [stLoad,stErr,stWelcome,stWeather].forEach(el=>el.classList.add('hidden'));
  state.classList.remove('hidden');
}

function showErr(title, msg, emoji='⚠️'){
  $('errEmoji').textContent  = emoji;
  $('errTitle').textContent  = title;
  $('errMsg').textContent    = msg;
  show(stErr);
}

/* ── LOAD WEATHER ────────────────────────────────────── */
async function load(query){
  if(API_KEY === 'YOUR_API_KEY_HERE'){
    showErr(
      'API key not set',
      'Open script.js and replace YOUR_API_KEY_HERE with your free OpenWeatherMap key.',
      '🔑'
    );
    return;
  }
  lastQuery = query;
  show(stLoad);

  try {
    const [weather, forecast] = await Promise.all([
      api(qCurrent(query)),
      api(qForecast(query)),
    ]);
    const {lat,lon} = weather.coord;
    const aqi = await api(qAQI(lat,lon)).catch(()=>null);

    renderMain(weather);
    renderHourly(forecast, weather.timezone);
    renderDays(forecast);
    if(aqi) renderAQI(aqi);

    show(stWeather);
    if(query.type==='city') localStorage.setItem('sp-city', query.val);

  } catch(e){
    const s = e.status;
    if(s===404) showErr('City not found',`"${query.type==='city'?query.val:'Location'}" doesn't exist. Check the spelling.`,'🔍');
    else if(s===401) showErr('Invalid API key','Your key was rejected. New keys take up to 2 hours to activate.','🔑');
    else if(s===429) showErr('Rate limit hit','Too many requests. Wait a moment then try again.','⏳');
    else showErr('Connection error','Could not reach the weather service. Check your internet.','📡');
  }
}

/* ── GEO ─────────────────────────────────────────────── */
function geoLocate(){
  if(!navigator.geolocation){
    showErr('No geolocation','Your browser does not support location detection.','📍');
    return;
  }
  locateBtn.classList.add('pulsing');
  locateBtn.disabled = true;
  navigator.geolocation.getCurrentPosition(
    pos => {
      locateBtn.classList.remove('pulsing');
      locateBtn.disabled = false;
      load({type:'coords', val:{lat:pos.coords.latitude, lon:pos.coords.longitude}});
    },
    err => {
      locateBtn.classList.remove('pulsing');
      locateBtn.disabled = false;
      const msgs = {
        1:'Location permission denied. Allow it in browser settings or search manually.',
        2:'Location unavailable. Try searching by city name.',
        3:'Location timed out. Try again or search by city.',
      };
      showErr('Location error', msgs[err.code]||'Could not get location.','📍');
    },
    {timeout:10000,maximumAge:300000}
  );
}

/* ── EVENTS ──────────────────────────────────────────── */
locateBtn.addEventListener('click', geoLocate);
searchBtn.addEventListener('click', doSearch);
searchInput.addEventListener('keydown', e => e.key==='Enter' && doSearch());
retryBtn.addEventListener('click', () => lastQuery ? load(lastQuery) : show(stWelcome));

function doSearch(){
  const city = searchInput.value.trim();
  if(city) load({type:'city', val:city});
}

/* ── INIT ────────────────────────────────────────────── */
initTheme();
const saved = localStorage.getItem('sp-city');
if(saved){
  searchInput.value = saved;
  load({type:'city', val:saved});
} else {
  show(stWelcome);
  geoLocate();
}