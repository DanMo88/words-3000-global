(() => {
'use strict';
/* English 3000 Words — multilingual build.
   UI strings: i18n/<lang>.json · word meanings: data/meanings/<lang>/<LEVEL>.json · languages: i18n/langs.json
   Adding a native language = adding those files (no code change). */
const DAY = 86400000, INTERVALS = [1, 3, 7, 21], NEED = 3, PER_PAGE = 20, ROUNDS = 3;
const LEVEL_IDS = ['A1', 'A2', 'B1', 'B2'];
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const $app = document.getElementById('app');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.random() * a.length | 0];
// visual length: CJK/Hangul glyphs are ~2x as wide as Arabic/Latin letters
const vlen = x => [...x.replace(/\u200c/g, '')].reduce((s, ch) => s + (ch.codePointAt(0) >= 0x1100 && !/[\u0E00-\u0E7F]/.test(ch) ? 1.9 : 1), 0);
const fitM = t => { const m = Math.max(...t.split(/[\s،؛,;/，、；]+/).map(vlen)); return m > 7 ? ` style="font-size:min(var(--fs),${(130 / m).toFixed(1)}vw)"` : ''; };
const fitO = t => t.length > 9 ? ` style="font-size:min(var(--fs),${(66 / t.length).toFixed(1)}vw)"` : '';
const fitW = t => t.length > 8 ? ` style="font-size:min(var(--fs),${(128 / t.length).toFixed(1)}vw)"` : '';

/* ---------- i18n ---------- */
let LANGS = [], ALIASES = {}, LANG = null, L10N = {}, NAMES = null, COLL = new Intl.Collator('en'), NF = new Intl.NumberFormat('en'), PR = new Intl.PluralRules('en');
const M = {};            // id -> meaning in the current native language
const N = n => NF.format(n);
function t(key, vars) {
  let s = L10N[key];
  if (s == null) { if (DEBUG) console.warn('missing string', LANG, key); s = key; }
  if (typeof s === 'object') s = s[PR.select(vars && vars.n != null ? vars.n : 0)] || s.other;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => vars[k] == null ? m : (typeof vars[k] === 'number' ? N(vars[k]) : vars[k]));
  return s;
}
const langInfo = code => LANGS.find(l => l.code === code);
const has = id => M[id] != null;
const mean = id => M[id];

/* ---------- access: free lessons, then Premium (one-time $5 "lifetime" via Lemon Squeezy on the web; see LS below) ----------
   FREE.per = 'app': the first FREE.lessons lessons completed anywhere in the app (all levels, all language courses) are free.
   Signed in, lessons sync, so the count is per account; as a guest it is per device. Set per: 'level' for FREE.lessons per level.
   Lessons already completed always stay open. Premium comes only from the server (profiles.premium, set by the lemonsqueezy-webhook
   Edge Function) and opens only on the account's one active device (premium-device Edge Function; R.dev caches the answer 5 days offline). */
const FREE = { lessons: 5, per: 'app' };
const DEV_CACHE = 5 * 864e5, DEV_EVERY = 10 * 6e4;   // device answer valid offline 5 days; re-checked every 10 min while open
const ACCESS = {
  paywall: true, FREE,
  owned: () => !!(R && R.premium && R.acct && R.acct.uid) && (!R.premiumUntil || Date.parse(R.premiumUntil) + 3 * 864e5 > Date.now()),
  devOk: () => !!(R && R.dev && R.dev.active && R.dev.uid === (R.acct && R.acct.uid) && Date.now() - (R.dev.at || 0) < DEV_CACHE),
  isPremium() { return this.owned() && this.devOk(); },
  used(lv) {
    let n = 0;
    Object.keys(R.courses || {}).forEach(c => { const ls = R.courses[c].lessons || {};
      Object.keys(ls).forEach(k => { if (ls[k] && ls[k].done && (FREE.per === 'app' || (c === R.cur && k.split('-')[0] === lv))) n++; }); });
    return n;
  },
  left(lv) { return Math.max(0, FREE.lessons - this.used(lv)); },
  canOpen(lv, i) { return !this.paywall || this.isPremium() || lessonDone(lv, i) || this.used(lv) < FREE.lessons; }
};

const W = {};            // id -> {id,w,ex,img,level,li}
const LV = {};           // level -> {id,lessons:[[ids]], count, available}
let TOTAL = 0;
const timers = new Set();
const later = (fn, ms) => { const tm = setTimeout(() => { timers.delete(tm); fn(); }, ms); timers.add(tm); return tm; };
const clearTimers = () => { timers.forEach(clearTimeout); timers.clear(); };

/* ---------- storage ----------
   w3g-v2 = { v:2, lang (native/UI), cur (target course), courses: { <target>: {words, lessons, streak, best60, placement, onboarded, added} } }
   S = the current course, so all learning code below stays per target language.
   Old w3g-v1 (single English course) is migrated into courses.en once and left in place untouched as a backup. */
const KEY = 'w3g-v2', OLD_KEY = 'w3g-v1';
// target languages with content; every other language in langs.json is listed as "coming soon"
const COURSES = { en: { flag: 'flags/us.svg' } };
const initCourse = c => { c.words = c.words || {}; c.lessons = c.lessons || {}; c.streak = c.streak || { count: 0, last: null }; c.best60 = c.best60 || 0; return c; };
let R = null, S;
try { R = JSON.parse(localStorage.getItem(KEY)); } catch (e) { R = null; }
if (!R || typeof R !== 'object' || !R.courses || typeof R.courses !== 'object') {
  R = { v: 2, lang: null, cur: null, courses: {} };
  let o = null; try { o = JSON.parse(localStorage.getItem(OLD_KEY)); } catch (e) { o = null; }
  if (o && typeof o === 'object') {
    if (o.lang) R.lang = o.lang;
    if (o.premium) R.premium = o.premium;
    const used = o.lang || o.onboarded || o.placement || Object.keys(o.words || {}).length || Object.keys(o.lessons || {}).length;
    if (used) { const c = Object.assign({}, o); delete c.lang; delete c.premium; c.added = c.added || Date.now(); R.courses.en = c; R.cur = 'en'; R.migrated = OLD_KEY; }
  }
}
Object.keys(R.courses).forEach(k => { if (!COURSES[k]) delete R.courses[k]; else initCourse(R.courses[k]); });
if (!R.courses[R.cur]) R.cur = Object.keys(R.courses)[0] || null;
S = R.cur ? R.courses[R.cur] : initCourse({});   // placeholder until a course is chosen (not saved)
const saveLocal = () => { try { localStorage.setItem(KEY, JSON.stringify(R)); } catch (e) {} };
const save = () => { saveLocal(); if (R.acct && R.acct.uid) scheduleSync(); };   // signed in: push changes a few seconds after the last save
saveLocal();
function setCourse(code) {
  if (!COURSES[code]) return false;
  if (!R.courses[code]) R.courses[code] = initCourse({ added: Date.now() });
  R.cur = code; S = R.courses[code]; save(); return true;
}
const ws = id => { const s = (S.words[id] = S.words[id] || { miss: 0 }); s.t = Date.now(); return s; };   // t = last change (sync merge)
const dkey = d => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
function touchStreak() {
  const td = dkey(new Date()); if (S.streak.last === td) return;
  const y = dkey(new Date(Date.now() - DAY));
  S.streak.count = S.streak.last === y ? S.streak.count + 1 : 1; S.streak.last = td; save();
}
function streakOf(c) { const td = dkey(new Date()), y = dkey(new Date(Date.now() - DAY)); return (c.streak.last === td || c.streak.last === y) ? c.streak.count : 0; }
const streakNow = () => streakOf(S);
const learnedIds = () => Object.keys(S.words).filter(id => S.words[id].learnedAt && W[id] && has(id));
const dueIds = () => learnedIds().filter(id => S.words[id].due && S.words[id].due <= Date.now()).sort((a, b) => S.words[a].due - S.words[b].due);
const hardIds = () => Object.keys(S.words).filter(id => W[id] && has(id) && S.words[id].miss >= 2).sort((a, b) => S.words[b].miss - S.words[a].miss);
const lessonDone = (lv, i) => !!(S.lessons[lv + '-' + (i + 1)] && S.lessons[lv + '-' + (i + 1)].done);
const lessonReady = (lv, i) => LV[lv].lessons[i].every(has);   // meanings exist in the current language
const nextLessonIdx = lv => { const n = LV[lv].lessons.length; for (let i = 0; i < n; i++) if (!lessonDone(lv, i)) return i; return n; };
const unlocked = (lv, i) => i === 0 || lessonDone(lv, i - 1) || lessonDone(lv, i);
const learnedIn = lv => learnedIds().filter(id => W[id].level === lv).length;
function nextDueText() {
  const ds = learnedIds().map(id => S.words[id].due).filter(Boolean).sort((a, b) => a - b);
  if (!ds.length) return '';
  const days = Math.max(1, Math.ceil((ds[0] - Date.now()) / DAY));
  return days === 1 ? t('nextDueTomorrow') : t('nextDueDays', { n: days });
}
// meanings overlap -> never offer as distractor
const toks = m => m.replace(/\(.*?\)|（.*?）/g, '').split(/[،؛,;，、；]/).map(s => s.trim()).filter(Boolean);
const clash = (a, b) => { const ta = toks(M[a]), tb = toks(M[b]); return M[a] === M[b] || ta.some(x => tb.includes(x)) || W[a].w.toLowerCase() === W[b].w.toLowerCase(); };

/* ---------- audio (one element = reliable on iPhone) ---------- */
const au = new Audio(); au.preload = 'auto';
let aq = [], aToken = 0, aCb = null;
function playSeq(srcs, cb) {
  const tok = ++aToken; aq = srcs.slice(); aCb = cb || null;
  const step = () => {
    if (tok !== aToken) return;
    if (!aq.length) { setPlaying(false); const c = aCb; aCb = null; c && c(); return; }
    au.src = aq.shift();
    const p = au.play(); setPlaying(true);
    if (p && p.catch) p.catch(() => { if (tok === aToken) { aq = []; step(); } });
  };
  au.onended = step; au.onerror = step; step();
}
function stopAudio() { aToken++; aq = []; aCb = null; try { au.pause(); } catch (e) {} setPlaying(false); }
function setPlaying(on) { document.querySelectorAll('.spk').forEach(b => b.classList.toggle('playing', on)); }
const A = id => 'audio/' + id + '.mp3', AX = id => 'audio/' + id + '-ex.mp3', IMG = id => 'img/' + id + '.webp';
const vibrate = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
function prefetchLesson(ids) { ids.forEach(id => { [A(id), AX(id)].concat(W[id].img ? [IMG(id)] : []).forEach(u => fetch(u).catch(() => {})); }); }

/* ---------- helpers ---------- */
function screen(html) { clearTimers(); document.querySelectorAll('.toast').forEach(x => x.remove()); $app.innerHTML = '<div class="screen">' + html + '</div>'; }
function bindX(fn) { const x = $app.querySelector('.x'); if (x) x.onclick = fn; }
const exHtml = w => { const re = new RegExp('\\b(' + w.w.replace(/[^A-Za-z ]/g, '.').split(' ')[0].slice(0, Math.max(3, w.w.length - 2)) + '[a-z]*)', 'i'); return esc(w.ex).replace(re, '<mark>$1</mark>'); };
const lvName = lv => t('lv' + lv);
const tag = lv => `<span class="lvtag ${lv}">${lv}</span>`;
function toast(msg) {
  document.querySelectorAll('.toast').forEach(x => x.remove());
  const d = document.createElement('div'); d.className = 'toast'; d.innerHTML = msg; document.body.appendChild(d);
  setTimeout(() => d.remove(), 2800);
}

/* ---------- language picker (first run) + settings ---------- */
let langTok = 0;   // a quick switch A→B must not let A's late response overwrite B's strings
function applyLang(code) {
  const li = langInfo(code) || LANGS[0]; LANG = li.code; const tok = ++langTok;
  const de = document.documentElement; de.lang = LANG; de.dir = li.dir;
  NF = new Intl.NumberFormat(li.num || LANG); PR = new Intl.PluralRules(LANG); try { COLL = new Intl.Collator(LANG); } catch (e) { COLL = new Intl.Collator('en'); }
  return Promise.all([
    fetch('i18n/' + LANG + '.json?v=' + VERSION).then(r => r.json()).then(j => { if (tok === langTok) L10N = j; }),
    Promise.all(LEVEL_IDS.filter(lv => LV[lv] && LV[lv].available && (!li.meanings || li.meanings.includes(lv))).map(lv => fetch('data/meanings/' + LANG + '/' + lv + '.json?v=' + VERSION).then(r => r.ok ? r.json() : {}).catch(() => ({})))).then(arr => {
      if (tok !== langTok) return;
      Object.keys(M).forEach(k => delete M[k]); arr.forEach(o => Object.assign(M, o));
    })
  ]).then(() => {
    document.title = t('docTitle') + ' · English 3000 Words';
    const mt = document.querySelector('meta[name="apple-mobile-web-app-title"]'); if (mt) mt.content = '3000 Words';
  });
}
const fold = x => String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function langGrid(sel) {
  return `<div class="lsearch"><span>🔍</span><input id="lq" type="search" autocomplete="off" spellcheck="false" placeholder="${esc(L10N.search || 'Search…')}" aria-label="${esc(L10N.search || 'Search')}"></div>
    <div class="langs" id="langs">${LANGS.map(l => `<button class="lang ${l.code === sel ? 'sel' : ''}" data-code="${l.code}" data-q="${esc(fold(l.name + ' ' + l.en + ' ' + l.code))}">
      <img class="flag" src="${l.flag}" alt="" width="40" height="30" loading="lazy" decoding="async">
      <span class="lt2"><b lang="${l.code}" dir="${l.dir}"${!/\s/.test(l.name) && vlen(l.name) > 8 ? ' class="lg"' : ''}>${esc(l.name)}</b><small class="en">${esc(l.en)}</small></span>${l.code === sel ? '<i>✓</i>' : ''}</button>`).join('')}</div>`;
}
function bindLangGrid(onPick) {
  const q = document.getElementById('lq'), box = document.getElementById('langs');
  q.oninput = () => { const v = fold(q.value.trim()); box.querySelectorAll('.lang').forEach(b => { b.hidden = !!v && !b.dataset.q.includes(v); }); };
  box.querySelectorAll('.lang').forEach(b => b.onclick = () => onPick(b.dataset.code));
  const cur = box.querySelector('.lang.sel'); if (cur) { const top = cur.offsetTop - box.offsetTop - box.clientHeight / 2 + cur.offsetHeight / 2; box.scrollTop = Math.max(0, top); }
}
function guessLang() {
  const prefs = (navigator.languages || [navigator.language || '']).map(x => String(x).toLowerCase());
  for (const p of prefs) {
    const base = p.split('-')[0];
    for (const c of [ALIASES[p], ALIASES[base], p, base]) if (c && langInfo(c)) return c;
  }
  return null;
}
function langPicker(onDone) {
  stopAudio();
  let sel = R.lang || guessLang();
  const draw = () => {
    const li = langInfo(sel);
    document.documentElement.dir = li ? li.dir : 'ltr'; document.documentElement.lang = sel || 'en';
    screen(`<div class="picker-head"><h1><span class="globe">🌐</span> <span class="en">Choose your language</span></h1>
      ${li ? `<p lang="${li.code}" dir="${li.dir}">${esc(li.pick)}</p>` : '<p class="en">English 3000 Words · American English</p>'}</div>
      ${langGrid(sel)}
      <button class="btn" id="go" ${sel ? '' : 'disabled'}>${sel ? esc(L10N._lang === sel ? t('continue') : '…') : '→'}</button>`);
    bindLangGrid(code => { sel = code; applyLang(sel).then(draw); });
    document.getElementById('go').onclick = () => { if (!sel) return; R.lang = sel; save(); applyLang(sel).then(onDone); };
  };
  if (sel) applyLang(sel).then(draw); else draw();
}
function settingsScreen() {
  stopAudio();
  screen(`<div class="top"><button class="x" aria-label="${esc(t('back'))}">✕</button><div class="h2">⚙️ ${t('settings')}</div></div>
    <div class="remrow"><label class="sw"><input type="checkbox" id="remOn" ${REM().on ? 'checked' : ''}><i></i><span>⏰ ${t('reminder')}</span></label>
      <label class="rtime"><span class="vh">${t('remTime')}</span><input type="time" id="remTime" value="${esc(REM().time)}" ${REM().on ? '' : 'disabled'}></label></div>
    <div class="remnote" id="remNote">${REM().on ? remNote() : ''}</div>
    <div class="sect">${t('appLanguage')}</div>
    ${langGrid(LANG)}
    <div class="foot">${t('settingsNote')}</div>
    <button class="btn" id="home">${t('backHome')}</button>
    <div class="legal">${legalLinks()}</div>`);
  bindX(home); document.getElementById('home').onclick = home;
  bindLangGrid(code => { R.lang = code; save(); applyLang(R.lang).then(settingsScreen); });
  const on = document.getElementById('remOn'), tm = document.getElementById('remTime');
  on.onchange = () => setReminder(on.checked, tm.value);
  tm.onchange = () => { if (on.checked && tm.value) setReminder(true, tm.value); };
}

/* ---------- daily reminder ----------
   Honest + simple, no push server: the time lives only on this device (R.reminder).
   - Notification Triggers (TimestampTrigger, only some Chromium builds) → real notifications scheduled for the next 7 days.
   - Otherwise → an in-app reminder banner when the app is opened/resumed after the chosen time on a day without a lesson.
   Reliable notifications at an exact time need the Android app (native/TWA scheduling) or Web Push with a server. */
const REM = () => (R.reminder = Object.assign({ on: false, time: '19:00', shown: null }, R.reminder || {}));
const hasTriggers = () => 'Notification' in window && 'showTrigger' in Notification.prototype && 'TimestampTrigger' in window;
const remAt = (time, d) => { const [h, m] = String(time || '19:00').split(':').map(Number), x = new Date(d || Date.now()); x.setHours(h || 0, m || 0, 0, 0); return x; };
const fmtTime = time => { try { return new Intl.DateTimeFormat(LANG, { hour: 'numeric', minute: '2-digit' }).format(remAt(time)); } catch (e) { return time; } };
const remNote = () => ('Notification' in window && Notification.permission === 'denied') ? t('remDenied') : t(hasTriggers() ? 'remTrig' : 'remWeb');
async function scheduleReminders() {
  if (!hasTriggers() || !('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    (await reg.getNotifications({ tag: 'w3g-rem', includeTriggered: true })).forEach(n => n.close());
    if (!REM().on || Notification.permission !== 'granted') return false;
    for (let k = 0; k < 7; k++) {
      const at = remAt(REM().time, Date.now() + k * DAY); if (at.getTime() <= Date.now()) continue;
      await reg.showNotification(t('remTitle'), { body: t('remBody'), tag: 'w3g-rem', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: './' }, showTrigger: new window.TimestampTrigger(at.getTime()) });
    }
    return true;
  } catch (e) { return false; }
}
async function setReminder(on, time) {
  const r = REM(); r.on = !!on; if (time) r.time = time; r.shown = on ? dkey(new Date()) : r.shown; save();
  const tm = document.getElementById('remTime'); if (tm) tm.disabled = !on;
  if (on && 'Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (e) {} }
  await scheduleReminders();
  const n = document.getElementById('remNote'); if (n) n.textContent = on ? remNote() : '';
  toast(esc(on ? t('remSet', { time: fmtTime(r.time) }) : t('remOff')));
}
function checkReminder() {
  const r = REM(); if (!r.on || !R.cur) return;
  scheduleReminders();
  const td = dkey(new Date());
  if (r.shown === td || S.streak.last === td || Date.now() < remAt(r.time).getTime()) return;
  r.shown = td; saveLocal();
  document.querySelectorAll('.rembar').forEach(x => x.remove());
  const b = document.createElement('button'); b.className = 'rembar'; b.setAttribute('role', 'status');
  b.innerHTML = `<b>⏰ ${esc(t('remTitle'))}</b><span>${esc(t('remBody'))}</span>`;
  b.onclick = () => b.remove(); document.body.appendChild(b); setTimeout(() => b.remove(), 9000);
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && window.__app && window.__app.ready) checkReminder(); });

/* ---------- target language (course) picker + switcher ---------- */
const loadNames = () => NAMES ? Promise.resolve(NAMES) : fetch('i18n/names.json?v=' + VERSION).then(r => r.json()).then(j => (NAMES = j)).catch(() => (NAMES = {}));
const courseName = code => code === 'en' ? t('langEnglishUS') : ((NAMES && NAMES[LANG] && NAMES[LANG][code]) || (langInfo(code) || {}).en || code);
const courseFlag = code => COURSES[code] ? COURSES[code].flag : (langInfo(code) || {}).flag;
const flagImg = (code, cls) => `<img class="${cls || 'flag'}" src="${courseFlag(code)}" alt="" width="40" height="30" decoding="async">`;
function targetList() {
  const rest = LANGS.filter(l => l.code !== LANG && !COURSES[l.code]).map(l => l.code).sort((a, b) => COLL.compare(courseName(a), courseName(b)));
  return Object.keys(COURSES).filter(c => c !== LANG).concat(rest);
}
/* first: onboarding step after the native language (back = native picker); otherwise "add a language" from the switcher */
function targetPicker(first, back) {
  stopAudio();
  loadNames().then(() => {
    let sel = null;
    const list = targetList();
    const tile = code => { const ok = !!COURSES[code], mine = !!R.courses[code], li = langInfo(code), nm = courseName(code);
      return `<button class="lang tgt ${ok ? '' : 'soonl'}" data-code="${code}" data-q="${esc(fold(nm + ' ' + (li ? li.name + ' ' + li.en : 'English American') + ' ' + code))}">
        ${flagImg(code)}<span class="lt2"><b${!/\s/.test(nm) && vlen(nm) > 9 ? ' class="lg"' : ''}>${esc(nm)}</b>${ok ? `<small>${t('nWords', { n: TOTAL })}</small>` : `<small class="soonb">${t('soon')}</small>`}</span>${mine ? '<i>✓</i>' : ''}</button>`; };
    screen(`<div class="top"><button class="x" aria-label="${esc(t('back'))}">✕</button><div class="h2">${first ? '🎯' : '➕'} ${t(first ? 'learnTitle' : 'addLanguage')}</div></div>
      ${first ? `<p class="tsub">${t('learnSub')}</p>` : ''}
      <div class="lsearch"><span>🔍</span><input id="lq" type="search" autocomplete="off" spellcheck="false" placeholder="${esc(t('search'))}" aria-label="${esc(t('search'))}"></div>
      <div class="langs" id="langs">${list.map(tile).join('')}</div>
      <button class="btn" id="go" disabled>${t('continue')}</button>`);
    bindX(first ? () => langPicker(afterLang) : (back || courseSwitcher));
    const box = document.getElementById('langs'), go = document.getElementById('go'), q = document.getElementById('lq');
    q.oninput = () => { const v = fold(q.value.trim()); box.querySelectorAll('.lang').forEach(b => { b.hidden = !!v && !b.dataset.q.includes(v); }); };
    box.querySelectorAll('.lang').forEach(b => b.onclick = () => {
      const code = b.dataset.code;
      if (!COURSES[code]) { toast(esc(t('comingSoonMsg', { lang: courseName(code) }))); return; }
      sel = code; box.querySelectorAll('.lang').forEach(x => x.classList.toggle('sel', x === b)); go.disabled = false;
    });
    go.onclick = () => { if (!sel || !setCourse(sel)) return; first ? start() : home(); };
  });
}
function courseSwitcher() {
  stopAudio();
  const codes = Object.keys(R.courses).sort((a, b) => (R.courses[a].added || 0) - (R.courses[b].added || 0));
  screen(`<div class="top"><button class="x" aria-label="${esc(t('back'))}">✕</button><div class="h2">${t('myCourses')}</div></div>
    <div class="courses">${codes.map(code => { const c = R.courses[code], n = Object.keys(c.words).filter(id => c.words[id].learnedAt).length;
      return `<button class="lang course ${code === R.cur ? 'sel' : ''}" data-code="${code}">${flagImg(code)}<span class="lt2"><b>${esc(courseName(code))}</b><small>${t('wordsOfTotal', { a: n, b: TOTAL })} · 🔥 ${N(streakOf(c))}</small></span>${code === R.cur ? '<i>✓</i>' : ''}</button>`; }).join('')}</div>
    <button class="btn" id="add">➕ ${t('addLanguage')}</button>`);
  bindX(home);
  $app.querySelectorAll('.course').forEach(b => b.onclick = () => { setCourse(b.dataset.code); home(); });
  document.getElementById('add').onclick = () => targetPicker(false);
}

/* ---------- home ---------- */
/* header: if the install label + streak + account + settings don't fit next to the title, show the install button as an icon only */
function fitHead() {
  const h = $app.querySelector('.home-head'), r = h && h.querySelector('.hd-r'); if (!r) return;
  r.classList.remove('compact');
  const b = r.getBoundingClientRect(), over = h.scrollWidth > h.clientWidth + 1 || b.right > innerWidth + .5 || b.left < -.5;
  if (over) r.classList.add('compact');
}
addEventListener('resize', fitHead);
if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', fitHead);
function home() {
  if (!R.cur) return targetPicker(true);
  stopAudio();
  const learned = learnedIds().length, due = dueIds().length, hard = hardIds().length;
  const rec = S.placement && S.placement.level;
  screen(`
    <div class="home-head"><div class="logo">${t('appName')}<small>${t('appSub')}</small></div>
      <div class="hd-r"><button class="inst pwa-install" data-install title="${esc(t('installTitle'))}"><span class="ii">📲</span><span class="it">${t('install').replace(/^📲\s*/u, '')}</span></button><div class="streak" title="${esc(t('streakTitle'))}">🔥 ${N(streakNow())}</div><button class="gear acct ${!signedIn() && learnedIds().length ? 'dot' : ''}" id="tAcct" aria-label="${esc(t('acct'))}">👤</button><button class="gear" id="tSet" aria-label="${esc(t('settings'))}">⚙️</button></div></div>
    <div class="cbar"><button class="ccur" id="tCourse" aria-label="${esc(t('myCourses'))}">${flagImg(R.cur)}<b>${esc(courseName(R.cur))}</b><span class="car">▾</span></button><button class="cadd" id="tAdd">➕ ${t('newLanguage')}</button></div>
    <div class="prog"><div class="row"><span>${t('totalProgress')}</span><b>${t('wordsOfTotal', { a: learned, b: TOTAL })}</b></div>
      <div class="bar"><i style="width:${Math.max(learned / TOTAL * 100, learned ? 1 : 0)}%"></i></div></div>
    <div class="levels">${LEVEL_IDS.map(lv => { const L = LV[lv]; const n = L ? L.count : 0, done = L ? learnedIn(lv) : 0, ok = L && L.available;
      const lw = Math.max(...lvName(lv).split(/[\s-]+/).map(vlen), rec === lv ? vlen(t('recommended')) - 1 : 0), long = lw > 7;   // the 'recommended' line must fit too
      return `<button class="lvl ${lv} ${rec === lv ? 'rec' : ''} ${ok ? '' : 'soon'} ${long ? 'long' : ''}" data-lv="${lv}">
        <div class="lt"><span class="code">${lv}</span><span class="nm"${lw > 12 ? ` style="font-size:min(clamp(13px,2dvh,18px),${(58 / lw).toFixed(2)}vw)"` : ''}>${lvName(lv)}${rec === lv ? '<br><small class="rect">' + t('recommended') + '</small>' : ''}</span></div>
        <div><div class="meta"><span>${ok ? t('nLessons', { n: L.lessons.length }) : t('soon')}</span><span>${N(done)}/${N(n)}</span></div>
        <div class="bar"><i style="width:${n ? Math.max(done / n * 100, done ? 2 : 0) : 0}%"></i></div></div></button>`; }).join('')}</div>
    <div class="tools">
      <button class="tool ${due ? 'due' : ''}" id="tReview"><span class="badge">${N(due)}</span><span class="ic">🔁</span><b>${t('toolReview')}</b></button>
      <button class="tool" id="tHard"><span class="badge">${N(hard)}</span><span class="ic">💪</span><b>${t('toolHard')}</b></button>
      <button class="tool" id="tQuick"><span class="ic">⚡</span><b>${t('toolQuick')}</b></button>
    </div>
    <button class="place" id="tPlace">${t('placeBtn')}${rec ? t('placeResult', { lv: '<span class="en">' + rec + '</span>' }) : t('placeDuration')}</button>
    ${DEBUG ? `<div class="dbg"><button id="dDue">debug: due now</button><button id="dLearn">debug: learn A1-1..3</button><button id="dReset">debug: reset</button></div>` : ''}`);
  fitHead(); requestAnimationFrame(fitHead); if (document.fonts) document.fonts.ready.then(fitHead);
  $app.querySelectorAll('.lvl').forEach(b => b.onclick = () => { const lv = b.dataset.lv; if (LV[lv] && LV[lv].available) levelScreen(lv); });
  document.getElementById('tReview').onclick = reviewScreen;
  document.getElementById('tHard').onclick = hardScreen;
  document.getElementById('tQuick').onclick = quickIntro;
  document.getElementById('tPlace').onclick = () => placementIntro();
  document.getElementById('tSet').onclick = settingsScreen;
  document.getElementById('tAcct').onclick = acctOpen;
  document.getElementById('tCourse').onclick = courseSwitcher;
  document.getElementById('tAdd').onclick = () => targetPicker(false, home);
  if (DEBUG) {
    document.getElementById('dDue').onclick = () => { learnedIds().forEach(id => { if (!S.words[id].mastered) S.words[id].due = Date.now() - 1000; }); save(); home(); };
    document.getElementById('dLearn').onclick = () => { [0, 1, 2].forEach(i => finishLessonState(lessonObj('A1', i))); home(); };
    document.getElementById('dReset').onclick = () => { localStorage.removeItem(KEY); localStorage.removeItem(OLD_KEY); location.reload(); };
  }
}

/* ---------- level: lesson list (paged grid, no scrolling) ---------- */
function levelScreen(lv, page) {
  stopAudio();
  const L = LV[lv], n = L.lessons.length, pages = Math.ceil(n / PER_PAGE), cur = nextLessonIdx(lv);
  if (page == null) page = Math.min(pages - 1, Math.floor(Math.min(cur, n - 1) / PER_PAGE));
  const from = page * PER_PAGE, to = Math.min(n, from + PER_PAGE);
  let cells = '';
  for (let i = from; i < to; i++) {
    const d = lessonDone(lv, i), u = unlocked(lv, i), c = i === cur, r = lessonReady(lv, i);
    if (u && !d && !r) { cells += `<button class="ls tr" data-i="${i}">🌐<small>${t('lessonN', { n: i + 1 })}</small></button>`; continue; }
    const pay = u && !d && !ACCESS.canOpen(lv, i);
    cells += `<button class="ls ${d ? 'done' : c ? 'cur' : u ? '' : 'lock'}${pay ? ' pay' : ''}" data-i="${i}" ${u ? '' : 'aria-disabled="true"'}>${pay ? '<i class="gem">💎</i>' : ''}${d ? '✓' : u ? N(i + 1) : '🔒'}<small>${d || !u ? t('lessonN', { n: i + 1 }) : c ? t('start') : ''}</small></button>`;
  }
  for (let i = to; i < from + PER_PAGE; i++) cells += '<span></span>';
  screen(`<div class="top"><button class="x" aria-label="${esc(t('back'))}">✕</button><div class="h2">${tag(lv)} ${lvName(lv)}</div><span class="pill">${t('lessonsProgress', { a: Math.min(cur, n), b: n })}</span></div>
    <div class="lgrid">${cells}</div>
    <div class="pager"><button id="pPrev" ${page > 0 ? '' : 'disabled'}>${t('pagerPrev')}</button><span>${t('pageOf', { a: page + 1, b: pages })}</span><button id="pNext" ${page < pages - 1 ? '' : 'disabled'}>${t('pagerNext')}</button></div>`);
  bindX(home);
  document.getElementById('pPrev').onclick = () => levelScreen(lv, page - 1);
  document.getElementById('pNext').onclick = () => levelScreen(lv, page + 1);
  $app.querySelectorAll('.ls[data-i]').forEach(b => b.onclick = () => {
    const i = +b.dataset.i;
    if (!unlocked(lv, i)) { b.classList.add('shake'); vibrate(60); later(() => b.classList.remove('shake'), 400); return; }
    if (!lessonReady(lv, i)) { toast(t('notTranslatedMsg', { lang: L10N._meaningLang || LANG })); return; }
    if (!ACCESS.canOpen(lv, i)) return paywallScreen(lv, i);
    startLesson(lessonObj(lv, i));
  });
}
/* paywall: features, "$5 once" (Lemon Squeezy checkout), "I already bought", one-device note, legal links.
   Not configured (LS.checkoutUrl empty) → "coming soon", nothing can be paid. Owned on another phone → deviceScreen. */
function paywallScreen(lv) {
  stopAudio();
  if (ACCESS.owned() && !ACCESS.devOk()) return deviceScreen(lv);
  const back = () => (lv && LV[lv] ? levelScreen(lv) : home()), prem = ACCESS.isPremium(), ready = !!LS.checkoutUrl;
  document.body.dataset.billing = ready ? 'lemonsqueezy' : 'none';
  screen(`<div class="top"><button class="x" aria-label="${esc(t('back'))}">✕</button><div class="h2">💎 ${t('premium')}</div></div>
    <div class="scroll"><div class="pw">
      <div class="pwhero">💎</div><h1>${t(prem ? 'pwActive' : 'pwTitle')}</h1>${prem ? '' : `<p class="tsub">${t('pwText')}</p>`}
      <div class="amsg ${ready || prem ? '' : 'info'}" id="pwMsg" role="status">${ready || prem ? '' : t('pwSoon')}</div>
      <ul class="pwf">${['pwF1', 'pwF2', 'pwF3', 'pwF4'].map(k => `<li><i>✓</i><span>${t(k)}</span></li>`).join('')}</ul>
      <div class="pwprice"><b id="pwPrice">${esc(t('pwOnce', { price: lsPrice() }))}</b><small>${t('pwLifetime')}</small><small class="pwdev">📱 ${t('pwDevNote')}</small></div>
    </div></div>
    <div class="btns pwb"><button class="btn" id="pwBuy" ${prem ? 'hidden' : ''} ${ready ? '' : 'disabled'}>${ready ? esc(t('pwBuyOnce', { price: lsPrice() })) : t('pwSoonBtn')}</button><button class="lnk" id="pwRestore" ${prem ? 'hidden' : ''}>${t('pwHave')}</button>
      <div class="legal">${legalLinks()}</div></div>`);
  bindX(back);
  const g = id => document.getElementById(id), say = (k, ok, v) => { const m = g('pwMsg'); if (m) { m.className = 'amsg' + (ok ? ' ok' : ''); m.textContent = t(k, v); } };
  const done = () => { toast(esc(t('pwActive'))); later(back, 900); };
  g('pwBuy').onclick = async () => {
    if (!ready) return;
    if (!signedIn()) return authScreen('up', { text: t('pwSignInFirst') });
    const btn = g('pwBuy'); busy(btn, true);
    try {
      if (!navigator.onLine) throw new Error('offline');
      await loadSB(); const { data } = await sb.auth.getSession(); if (!data.session) { busy(btn, false); return authScreen('in', { text: t('pwSignInFirst') }); }
      await openCheckout(data.session.user, () => { say('pwWait', true); waitPremium().then(ok => { if (!g('pwMsg')) return; if (ok) return done(); say('pwPending'); }); });
      busy(btn, false);
    } catch (e) { busy(btn, false); say(payErr(e)); }
  };
  g('pwRestore').onclick = async () => {
    if (!signedIn()) return authScreen('in', { text: t('pwSignInFirst') });
    const btn = g('pwRestore'); busy(btn, true);
    try { await restorePremium(); busy(btn, false);
      if (ACCESS.isPremium()) return done();
      if (ACCESS.owned()) return deviceScreen(lv);
      say('pwNone');
    } catch (e) { busy(btn, false); say(payErr(e)); }
  };
}
/* "Premium is on another phone": move it here (server allows once per 30 days). Free lessons + sync keep working. */
function deviceScreen(lv, fromProfile) {
  stopAudio();
  const back = fromProfile ? profileScreen : () => (lv && LV[lv] ? levelScreen(lv) : home());
  const d = R.dev || {}, here = ACCESS.isPremium(), fresh = d.uid === (R.acct && R.acct.uid) && d.at;
  const lbl = `<bdi>${esc((d.other && d.other.label) || t('devUnknown'))}</bdi>`, seen = d.other && d.other.last_seen ? `<bdi>${esc(fmtWhen(d.other.last_seen))}</bdi>` : '–';
  const moveOk = !here && d.other && d.canMove, wait = !here && d.other && !d.canMove && d.nextMove;
  screen(`<div class="top"><button class="x" aria-label="${esc(t('back'))}">✕</button><div class="h2">📱 ${t(fromProfile ? 'devManage' : 'premium')}</div></div>
    <div class="scroll"><div class="pw dev">
      <div class="pwhero">${here ? '💎' : '📱'}</div><h1>${t(here ? 'devThis' : fresh && d.other ? 'devTitle' : 'devManage')}</h1>
      ${here ? `<p class="tsub dlab"><bdi>${esc(deviceLabel())}</bdi></p>` : d.other ? `<p class="tsub" id="devOther">${t('devOther', { label: lbl, time: seen })}</p>` : ''}
      <p class="pwdev">📱 ${t('pwDevNote')}</p>${here ? '' : `<p class="pwdev">✓ ${t('devFree')}</p>`}
      <div class="amsg ${wait ? 'info' : ''}" id="devMsg" role="status">${wait ? t('devWait', { date: `<bdi>${esc(fmtDate(d.nextMove))}</bdi>` }) : (!fresh && !here ? t('devOffline') : '')}</div>
    </div></div>
    <div class="btns">${moveOk ? `<button class="btn" id="devMove">${t('devMove')}</button>` : ''}<button class="btn ghost" id="devCheck">${t('devCheck')}</button>
      ${moveOk ? `<button class="lnk mut" id="devNow">${t('devNow')}</button>` : ''}</div>`);
  bindX(back);
  const g = id => document.getElementById(id), say = (k, ok) => { const m = g('devMsg'); if (m) { m.className = 'amsg' + (ok ? ' ok' : ''); m.textContent = t(k); } };
  if (g('devNow')) g('devNow').onclick = back;
  g('devCheck').onclick = async () => { const btn = g('devCheck'); busy(btn, true);
    try { await deviceCheck(); deviceScreen(lv, fromProfile); } catch (e) { busy(btn, false); say(navigator.onLine ? 'pwFail' : 'devOffline'); } };
  if (g('devMove')) g('devMove').onclick = async () => { const btn = g('devMove'); busy(btn, true);
    try { await deviceCheck(true); busy(btn, false);
      if (ACCESS.isPremium()) { toast(esc(t('devMoved'))); return fromProfile ? deviceScreen(lv, true) : later(back, 700); }
      deviceScreen(lv, fromProfile);
    } catch (e) { busy(btn, false); say(navigator.onLine ? 'pwFail' : 'devOffline'); } };
}
const fmtDate = v => { try { return new Intl.DateTimeFormat(LANG, { dateStyle: 'medium' }).format(new Date(v)); } catch (e) { return String(v).slice(0, 10); } };
const fmtWhen = v => { try { return new Intl.DateTimeFormat(LANG, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v)); } catch (e) { return String(v).slice(0, 16); } };
const legalLinks = () => `<a href="privacy.html" target="_blank" rel="noopener">${t('privacy')}</a><span aria-hidden="true"> · </span><a href="terms.html" target="_blank" rel="noopener">${t('terms')}</a>`;
const lessonObj = (lv, i) => ({ id: lv + '-' + (i + 1), lv, i, title: lv + ' · ' + t('lessonN', { n: i + 1 }), words: LV[lv].lessons[i].map(id => W[id]) });

/* ---------- learning phase ---------- */
function startLesson(L) {
  const base = L.words; prefetchLesson(base.map(w => w.id));
  const notAfter = (arr, prev) => { let r = shuffle(arr), k = 0; while (base.length > 1 && r[0].id === prev.id && k++ < 20) r = shuffle(arr); return r; };
  const r2 = notAfter(base, base[base.length - 1]), r3 = notAfter(base, r2[r2.length - 1]);
  learnCard({ L, seq: base.concat(r2, r3), i: 0, t0: Date.now() });
}
function learnCard(run) {
  const w = run.seq[run.i], n = run.seq.length, per = run.L.words.length, round = Math.floor(run.i / per) + 1, last = run.i === n - 1;
  screen(`
    <div class="top"><button class="x" aria-label="${esc(t('exit'))}">✕</button><div class="bar"><i style="width:${(run.i + 1) / n * 100}%"></i></div><span class="pill">${N(run.i + 1)}/${N(n)}</span></div>
    <div class="card ${w.img ? '' : 'noimg'}">
      <div class="pic">${w.img ? `<img src="${IMG(w.id)}" alt="">` : ''}</div>
      <div class="word en"${fitW(w.w)}>${esc(w.w)}</div>
      <div class="mn">${esc(mean(w.id))}</div>
      <div class="ex en">${exHtml(w)}</div>
      <button class="spk" id="spk" aria-label="${esc(t('replay'))}">🔊</button>
    </div>
    <div class="round">${tag(run.L.lv)} ${t('roundInfo', { n: run.L.i + 1, r: round, t: ROUNDS })} ${round === 1 ? t('inOrder') : t('shuffled')}</div>
    <button class="btn" id="next">${last ? t('startQuiz') : t('next')}</button>`);
  bindX(() => { if (confirm(t('confirmExit'))) levelScreen(run.L.lv); });
  const say = () => playSeq([A(w.id), AX(w.id)]);
  document.getElementById('spk').onclick = say;
  document.getElementById('next').onclick = () => { if (last) startLessonQuiz(run); else { run.i++; learnCard(run); } };
  say();
}

/* ---------- quiz engine ---------- */
const TYPES = [['en2m', .4], ['m2en', .3], ['listen', .3]];
function pickType() { let r = Math.random(); for (const [ty, p] of TYPES) { if ((r -= p) < 0) return ty; } return 'en2m'; }
function distractorPool(targetIds) {
  const set = new Set(targetIds);
  learnedIds().forEach(id => set.add(id));
  targetIds.forEach(id => { const w = W[id]; LV[w.level].lessons[w.li].forEach(x => has(x) && set.add(x)); });
  return [...set];
}
function makeOptions(id, pool) {
  let cand = shuffle(pool.filter(x => x !== id && W[x] && has(x) && !clash(x, id)));
  const opts = [];
  for (const x of cand) { if (opts.length === 3) break; if (!opts.some(o => clash(o, x))) opts.push(x); }
  if (opts.length < 3) { // top up from the same level (only words translated into the current language)
    for (const x of shuffle(Object.keys(W).filter(k => W[k].level === W[id].level && has(k)))) { if (opts.length === 3) break; if (x !== id && !clash(x, id) && !opts.some(o => o === x || clash(o, x))) opts.push(x); }
  }
  if (opts.length < 3) { for (const x of shuffle(Object.keys(W).filter(has))) { if (opts.length === 3) break; if (x !== id && !clash(x, id) && !opts.some(o => o === x || clash(o, x))) opts.push(x); } }
  return shuffle([id].concat(opts));
}
/* o: {mode, targets, need, pool, onAnswer, onDone, deadline, next(st)->{id,type}|null, noMiss, onQuit} */
function runQuiz(o) {
  const st = { correct: {}, wrong: 0, right: 0, asked: 0, last: null, t0: Date.now(), firstTry: {} };
  (o.targets || []).forEach(id => st.correct[id] = 0);
  const total = (o.targets || []).length * (o.need || 0);
  let q = null, locked = false;
  const progress = () => o.targets.reduce((s, id) => s + Math.min(st.correct[id], o.need), 0);
  function defaultNext() {
    let active = o.mode === 'quick' ? o.targets.slice() : o.targets.filter(id => st.correct[id] < o.need);
    if (!active.length) return null;
    const cand = active.length > 1 ? active.filter(id => id !== st.last) : active;
    return { id: pick(cand), type: pickType() };
  }
  function nextQ() {
    if (o.deadline && Date.now() >= o.deadline) return o.onDone(st);
    const nx = (o.next || defaultNext)(st);
    if (!nx) return o.onDone(st);
    const optIds = makeOptions(nx.id, o.pool || distractorPool([nx.id]));
    q = { id: nx.id, type: nx.type, optIds, correctIdx: optIds.indexOf(nx.id), limit: nx.type === 'listen' ? 7000 : 5000 };
    st.last = nx.id; st.asked++; locked = false;
    render();
  }
  function render() {
    const w = W[q.id], showM = q.type !== 'm2en';
    const label = { en2m: t('qMeaning'), m2en: t('qEnglish'), listen: t('qListen') }[q.type];
    let head;
    if (o.mode === 'quick') head = `<div class="h2">${t('score')} <span id="score">${N(st.right)}</span></div><span class="clock" id="clock"></span>`;
    else if (o.mode === 'placement') head = `<div class="h2">${t('placementHead')} ${tag(w.level)}</div><span class="pill">${N(st.asked)}</span>`;
    else head = `<div class="bar"><i style="width:${progress() / total * 100}%"></i></div><span class="pill">${t('correctOf', { a: progress(), b: total })}</span>`;
    let mid;
    if (q.type === 'en2m') mid = `<div class="qword en"${fitW(w.w)}>${esc(w.w)}</div>`;
    else if (q.type === 'm2en') mid = `<div class="qword mn"${fitM(mean(w.id))}>${esc(mean(w.id))}</div>`;
    else mid = `<button class="spk big" id="spk" aria-label="${esc(t('replay'))}">🔊</button>`;
    screen(`
      <div class="top"><button class="x" aria-label="${esc(t('exit'))}">✕</button>${head}</div>
      <div class="timer"><i id="tbar"></i></div>
      <div class="prompt" id="prompt" data-type="${q.type}"><div class="qlabel">${label}</div>${mid}</div>
      <div class="opts">${q.optIds.map((oid, i) => `<button class="opt ${showM ? '' : 'en'}" data-i="${i}"${showM ? '' : fitO(W[oid].w)}>${esc(showM ? mean(oid) : W[oid].w)}</button>`).join('')}</div>`);
    bindX(() => { stopAudio(); clearTimers(); (o.onQuit || home)(); });
    $app.querySelectorAll('.opt').forEach(b => b.onclick = () => answer(+b.dataset.i));
    const spk = document.getElementById('spk'); if (spk) spk.onclick = () => playSeq([A(w.id)]);
    if (q.type !== 'm2en') playSeq([A(w.id)]); else stopAudio();
    const tb = document.getElementById('tbar');
    tb.style.transition = 'none'; tb.style.transform = 'scaleX(1)';
    requestAnimationFrame(() => requestAnimationFrame(() => { tb.style.transition = `transform ${q.limit}ms linear, background ${q.limit}ms`; tb.style.transform = 'scaleX(0)'; tb.style.background = '#ef4444'; }));
    q.t = later(() => answer(null), q.limit);
    if (o.mode === 'quick') tickClock();
  }
  function tickClock() {
    const c = document.getElementById('clock'); if (!c) return;
    const left = Math.max(0, Math.ceil((o.deadline - Date.now()) / 1000));
    c.textContent = t('seconds', { n: left });
    if (left <= 0 && !locked) { answer(null, true); return; }
    later(tickClock, 250);
  }
  function answer(i, timeUp) {
    if (locked) return; locked = true;
    clearTimers();
    const w = W[q.id], ok = i === q.correctIdx, timeout = i === null;
    $app.querySelectorAll('.opt').forEach((b, k) => { b.disabled = true; if (k === q.correctIdx) b.classList.add('ok'); else if (k === i) b.classList.add('bad'); else b.classList.add('dim'); });
    const tb = document.getElementById('tbar'); if (tb) { const cs = getComputedStyle(tb), m = cs.transform, bg = cs.backgroundColor; tb.style.transition = 'none'; tb.style.transform = m; tb.style.background = bg; }
    const first = !Object.prototype.hasOwnProperty.call(st.firstTry, q.id); if (first) st.firstTry[q.id] = ok;
    if (ok) { st.correct[q.id] = (st.correct[q.id] || 0) + 1; st.right++; }
    else { st.wrong++; if (!o.noMiss) { ws(q.id).miss = (ws(q.id).miss || 0) + 1; save(); } vibrate(timeout ? [80, 60, 80] : 200); const p = document.getElementById('prompt'); p && p.classList.add('shake'); }
    o.onAnswer && o.onAnswer(q.id, ok, first);
    const prompt = document.getElementById('prompt');
    if (prompt) prompt.insertAdjacentHTML('beforeend', `<div class="fb ${ok ? 'ok' : 'bad'}">${ok ? t('fbOk') : (timeout ? t('fbTimeout') : t('fbWrong'))}<span class="en">${esc(w.w)}</span> = <bdi>${esc(mean(w.id))}</bdi></div>`);
    if (o.mode === 'quick') { const sc = document.getElementById('score'); if (sc) sc.textContent = N(st.right); }
    playSeq([ok ? 'audio/sfx-correct.mp3' : 'audio/sfx-wrong.mp3', A(w.id)]);
    if (timeUp) return later(() => o.onDone(st), 900);
    later(nextQ, (o.mode === 'quick' || o.mode === 'placement') ? (ok ? 750 : 1300) : (ok ? 1150 : 1700));
  }
  window.__app.quiz = { get q() { return q; }, get locked() { return locked; }, st, answer: i => answer(i) };
  nextQ();
}

/* ---------- lesson quiz + completion ---------- */
function finishLessonState(L) {
  const now = Date.now();
  L.words.forEach(w => { const s = ws(w.id); if (!s.learnedAt) { s.learnedAt = now; s.stage = 0; s.due = now + INTERVALS[0] * DAY; } });
  S.lessons[L.id] = { done: true, at: now }; touchStreak(); save();
}
function startLessonQuiz(run) {
  const ids = run.L.words.map(w => w.id);
  runQuiz({ mode: 'lesson', targets: ids, need: NEED, pool: ids, onQuit: () => levelScreen(run.L.lv), onDone: st => {
    finishLessonState(run.L);
    const acc = Math.round(st.right / Math.max(1, st.right + st.wrong) * 100);
    const mins = Math.max(1, Math.round((Date.now() - run.t0) / 60000));
    const lv = run.L.lv, ni = run.L.i + 1, hasNext = ni < LV[lv].lessons.length && lessonReady(lv, ni);
    doneScreen('🎉', t('lessonDone', { title: esc(run.L.title) }), t('lessonDoneText'),
      [[t('percent', { n: acc }), t('statAccuracy')], [N(st.wrong), t('statWrong')], [N(mins), t('statMinutes')]], ids,
      hasNext ? [t('nextLesson'), () => ACCESS.canOpen(lv, ni) ? startLesson(lessonObj(lv, ni)) : paywallScreen(lv, ni)] : null, () => levelScreen(lv));
  }});
}
function doneScreen(icon, title, text, stats, chips, extraBtn, back) {
  stopAudio();
  screen(`<div class="done"><div class="big">${icon}</div><h1>${title}</h1><p>${text}</p>
    ${stats ? `<div class="stats">${stats.map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('')}</div>` : ''}
    ${!signedIn() && chips && chips.length ? `<button class="savep" id="saveP">${t('savePrompt')}</button>` : ''}
    ${chips && chips.length ? `<div class="chips">${chips.slice(0, 12).map(id => `<span class="chip"><span class="en">${esc(W[id].w)}</span> · <bdi>${esc(mean(id))}</bdi></span>`).join('')}</div>` : ''}
    </div>
    <div class="btns">${extraBtn ? `<button class="btn" id="extra">${extraBtn[0]}</button>` : ''}<button class="btn ${extraBtn ? 'ghost' : ''}" id="home">${back ? t('backToLessons') : t('backHome')}</button></div>`);
  document.getElementById('home').onclick = back || home;
  if (extraBtn) document.getElementById('extra').onclick = extraBtn[1];
  const sp = document.getElementById('saveP'); if (sp) sp.onclick = () => authScreen('up');
  touchStreak();
}

/* ---------- spaced review ---------- */
function emptyScreen(title, icon, text) {
  screen(`<div class="top"><button class="x" aria-label="${esc(t('back'))}">✕</button><div class="h2">${title}</div></div>
    <div class="empty"><div class="big">${icon}</div><div>${text}</div></div><button class="btn" id="home">${t('back')}</button>`);
  bindX(home); document.getElementById('home').onclick = home;
}
function reviewScreen() {
  stopAudio();
  const due = dueIds();
  if (!due.length) return emptyScreen(t('reviewTitle'), '🌙', learnedIds().length ? t('reviewNoneToday') + '<br>' + nextDueText() : t('reviewNoneYet'));
  const batch = due.slice(0, 30);
  screen(`<div class="top"><button class="x" aria-label="${esc(t('back'))}">✕</button><div class="h2">${t('reviewTitle')}</div><span class="pill">${t('nWords', { n: due.length })}</span></div>
    <div class="empty" style="justify-content:flex-start;gap:1.6dvh"><div>${t('reviewList', { more: due.length > 30 ? t('reviewFirst30') : '' })}</div>
    <div class="chips" style="max-height:none">${batch.slice(0, 18).map(id => `<span class="chip"><span class="en">${esc(W[id].w)}</span></span>`).join('')}${batch.length > 18 ? '<span class="chip">…</span>' : ''}</div></div>
    <button class="btn" id="go">${t('reviewStart')}</button>`);
  bindX(home);
  document.getElementById('go').onclick = () => {
    prefetchLesson(batch);
    runQuiz({ mode: 'review', targets: batch, need: 1, pool: distractorPool(batch),
      onAnswer: (id, ok, first) => { if (!first) return; const s = ws(id);
        if (ok) { s.stage = (s.stage || 0) + 1; if (s.stage >= INTERVALS.length) { s.mastered = true; s.due = null; } else s.due = Date.now() + INTERVALS[s.stage] * DAY; }
        else { s.stage = 0; s.due = Date.now() + INTERVALS[0] * DAY; }
        save(); },
      onDone: st => { const good = Object.values(st.firstTry).filter(Boolean).length;
        doneScreen('✅', t('reviewDone'), t('reviewDoneText'), [[N(good), t('statFirstTry')], [N(batch.length - good), t('statNeedPractice')]], batch); } });
  };
}

/* ---------- hard words ---------- */
function hardScreen() {
  stopAudio();
  const hard = hardIds();
  if (!hard.length) return emptyScreen(t('hardTitle'), '🏆', t('hardEmpty'));
  const batch = hard.slice(0, 12);
  screen(`<div class="top"><button class="x" aria-label="${esc(t('back'))}">✕</button><div class="h2">${t('hardTitle')}</div><span class="pill">${N(hard.length)}</span></div>
    <div class="hl">${batch.map(id => `<div class="hw"><div><div class="en">${esc(W[id].w)}</div><span>${esc(mean(id))}</span></div><small>✗${N(S.words[id].miss)}</small></div>`).join('')}</div>
    <button class="btn" id="go">${t('hardPractice')}</button>`);
  bindX(home);
  document.getElementById('go').onclick = () => {
    prefetchLesson(batch);
    runQuiz({ mode: 'hard', targets: batch, need: 2, pool: distractorPool(batch),
      onAnswer: (id, ok) => { if (ok) { const s = ws(id); s.miss = Math.max(0, (s.miss || 0) - 1); save(); } },
      onDone: st => doneScreen('💪', t('hardDone'), t('hardDoneText'), [[N(st.right), t('statRight')], [N(st.wrong), t('statWrong')], [N(hardIds().length), t('statStillHard')]], null, [t('practiceAgain'), hardScreen]) });
  };
}

/* ---------- 60-second quick review ---------- */
function quickIntro() {
  stopAudio();
  const ids = learnedIds();
  if (ids.length < 4) return emptyScreen(t('quickTitle'), '⚡', t('quickEmpty'));
  screen(`<div class="top"><button class="x" aria-label="${esc(t('back'))}">✕</button><div class="h2">${t('quickTitleLong')}</div></div>
    <div class="empty"><div class="big">⏱</div><div>${t('quickIntro')}<br>${S.best60 ? t('quickRecord', { n: S.best60 }) : ''}</div></div>
    <button class="btn" id="go">${t('quickGo')}</button>`);
  bindX(home);
  document.getElementById('go').onclick = () => {
    const deadline = Date.now() + 60000;
    runQuiz({ mode: 'quick', targets: ids, need: Infinity, pool: distractorPool(ids), deadline,
      onDone: st => { const rec = st.right > S.best60; if (rec) { S.best60 = st.right; save(); }
        doneScreen(rec ? '🏆' : '⚡', rec ? t('newRecord') : t('timeUp'), t('quickResult', { n: st.right }), [[N(st.right), t('statRight')], [N(st.wrong), t('statWrong')], [N(S.best60), t('statRecord')]], null, [t('again'), quickIntro]); } });
  };
}

/* ---------- placement test (stepwise, ~2 min, does NOT mark words learned) ---------- */
const PQ = 8, PASS = 6;
function placementIntro(first) {
  stopAudio();
  screen(`<div class="top">${first ? '' : `<button class="x" aria-label="${esc(t('back'))}">✕</button>`}<div class="h2">${t('placeTitle')}</div>${first ? `<button class="inst pwa-install" data-install>${t('install')}</button>` : ''}</div>
    <div class="empty"><div class="big">🎯</div><div>${first ? t('welcome') + '<br>' : ''}${t('placeIntro')}</div></div>
    <div class="btns"><button class="btn" id="go">${t('placeStart')}</button><button class="btn ghost" id="skip">${first ? t('placeSkip') : t('back')}</button></div>`);
  bindX(home);
  document.getElementById('skip').onclick = () => { S.onboarded = true; save(); home(); };
  document.getElementById('go').onclick = () => { S.onboarded = true; save(); runPlacement(); };
}
function runPlacement() {
  // only levels with enough words translated into the current language take part
  const avail = LEVEL_IDS.filter(lv => LV[lv] && LV[lv].available && Object.keys(W).filter(id => W[id].level === lv && has(id)).length >= PQ);
  if (!avail.length) { home(); toast(t('notTranslatedMsg', { lang: L10N._meaningLang || LANG })); return; }
  const per = {}; avail.forEach(lv => per[lv] = { asked: 0, right: 0, ids: shuffle(Object.keys(W).filter(id => W[id].level === lv && has(id))).slice(0, PQ) });
  let li = 0, lastId = null, result = null;
  runQuiz({ mode: 'placement', noMiss: true, pool: [],
    next: st => {
      if (lastId) { const lv = avail[li]; per[lv].asked++; if (st.firstTry[lastId]) per[lv].right++;
        const p = per[lv], left = PQ - p.asked;
        if (p.right >= PASS || p.right + left < PASS || left === 0) {
          if (p.right >= PASS && li < avail.length - 1) li++;
          else { result = avail[li]; return null; }
        } }
      const lv = avail[li], id = per[lv].ids[per[lv].asked]; lastId = id;
      return { id, type: 'en2m' };
    },
    onDone: () => {
      const rec = result || avail[li];
      S.placement = { level: rec, at: Date.now(), scores: Object.fromEntries(avail.map(lv => [lv, [per[lv].right, per[lv].asked]])) }; save();
      stopAudio();
      screen(`<div class="done"><div class="big">🎯</div><h1>${t('placeLevel')} <span class="lvtag ${rec}" style="font-size:1em">${rec}</span></h1>
        <p>${t('placeLevelText', { name: lvName(rec) })}</p>
        <div class="stats">${avail.filter(lv => per[lv].asked).map(lv => `<div class="stat"><b>${N(per[lv].right)}/${N(per[lv].asked)}</b><span class="en">${lv}</span></div>`).join('')}</div></div>
        <div class="btns"><button class="btn" id="goLv">${t('goLevel', { lv: rec })}</button><button class="btn ghost" id="home">${t('backHome')}</button></div>`);
      document.getElementById('goLv').onclick = () => levelScreen(rec);
      document.getElementById('home').onclick = home;
    } });
}

/* ---------- accounts + sync (Supabase) ----------
   Guests: everything works offline in localStorage (w3g-v2). Signed in: each course is a row in public.progress
   (user_id, course, data jsonb); sync = pull all rows, merge with local per course, push what changed.
   supabase-js is vendored and loaded only when needed (signed in, auth link in the URL, or account screens). */
const SB = { url: 'https://acwkuhudvmarssthibzf.supabase.co', key: 'sb_publishable_L-R_EwjjZHj0tBxbjqFkPg_XfXNIHvh',
  lib: 'vendor/supabase-2.118.0.js', google: false,   // google: set true once the Google provider is enabled in Supabase
  store: 'sb-acwkuhudvmarssthibzf-auth-token' };
const APP_URL = /github\.io$/.test(location.hostname) ? 'https://danmo88.github.io/words-3000-global/' : location.origin + location.pathname.replace(/index\.html$/, '');
let sb = null, sbLoading = null, user = null, recovery = false, syncTimer = null, syncing = null;
const hasSession = () => { try { return !!localStorage.getItem(SB.store); } catch (e) { return false; } };
const signedIn = () => !!user || (hasSession() && !!(R.acct && R.acct.email));
function loadSB() {
  if (sb) return Promise.resolve(sb);
  if (!sbLoading) sbLoading = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = SB.lib; s.async = true;
    s.onload = () => {
      sb = window.supabase.createClient(SB.url, SB.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit', storageKey: SB.store } });
      sb.auth.onAuthStateChange((ev, session) => { user = session ? session.user : null; if (ev === 'PASSWORD_RECOVERY') recovery = true; });
      res(sb);
    };
    s.onerror = () => { sbLoading = null; s.remove(); rej(new Error('offline')); };
    document.head.appendChild(s);
  });
  return sbLoading;
}
const stable = o => JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((a, x) => (a[x] = v[x], a), {}) : v);
const dval = s => { if (!s) return 0; const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
/* merge two copies of one course: union of words/lessons; per word the newer copy (t) wins but learnedAt stays the earliest;
   streak from the copy with the later day (consecutive days chain up), best60 = max, newest placement */
function mergeCourse(a, b) {
  a = a || {}; b = b || {};
  const m = Object.assign({}, b, a), wa = a.words || {}, wb = b.words || {};
  m.words = {};
  new Set([...Object.keys(wa), ...Object.keys(wb)]).forEach(id => {
    const x = wa[id], y = wb[id];
    if (!x || !y) { m.words[id] = Object.assign({}, x || y); return; }
    const nx = (x.t || 0) >= (y.t || 0), w = Object.assign({}, nx ? y : x, nx ? x : y);
    const la = [x.learnedAt, y.learnedAt].filter(Boolean); if (la.length) w.learnedAt = Math.min(...la);
    m.words[id] = w;
  });
  const la = a.lessons || {}, lb = b.lessons || {}; m.lessons = {};
  new Set([...Object.keys(la), ...Object.keys(lb)]).forEach(k => {
    const x = la[k], y = lb[k]; if (!x || !y) { m.lessons[k] = Object.assign({}, x || y); return; }
    m.lessons[k] = Object.assign({}, y, x, { done: !!(x.done || y.done) }); const at = [x.at, y.at].filter(Boolean); if (at.length) m.lessons[k].at = Math.min(...at);
  });
  const sa = a.streak || { count: 0, last: null }, sbb = b.streak || { count: 0, last: null };
  const [hi, lo] = dval(sa.last) >= dval(sbb.last) ? [sa, sbb] : [sbb, sa];
  let cnt = hi.count || 0;
  if (dval(hi.last) === dval(lo.last)) cnt = Math.max(cnt, lo.count || 0);
  else if (lo.last && dval(hi.last) - dval(lo.last) < DAY * 1.5) cnt = Math.max(cnt, (lo.count || 0) + 1);
  m.streak = { count: cnt, last: hi.last || null };
  m.best60 = Math.max(a.best60 || 0, b.best60 || 0);
  const pa = a.placement, pb = b.placement; if (pa || pb) m.placement = (!pb || (pa && (pa.at || 0) >= (pb.at || 0))) ? pa : pb;
  m.onboarded = !!(a.onboarded || b.onboarded) || undefined; if (!m.onboarded) delete m.onboarded;
  const ad = [a.added, b.added].filter(Boolean); if (ad.length) m.added = Math.min(...ad);
  return m;
}
function scheduleSync(ms) {
  if (!signedIn()) return;
  R.acct = R.acct || {}; R.acct.dirty = true;
  clearTimeout(syncTimer); syncTimer = setTimeout(() => syncAll().catch(() => {}), ms == null ? 4000 : ms);
}
function syncAll() {
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      await loadSB();
      if (!user) { const { data } = await sb.auth.getSession(); user = data.session ? data.session.user : null; }
      if (!user) return null;   // no valid session (expired/revoked)
      const { data: rows, error } = await sb.from('progress').select('course,data');
      if (error) throw error;
      const remote = {}; (rows || []).forEach(r => { remote[r.course] = r.data || {}; });
      const codes = new Set([...Object.keys(R.courses), ...Object.keys(remote).filter(c => COURSES[c])]);
      const ups = []; let changed = false;
      codes.forEach(c => {
        const loc = R.courses[c], rem = remote[c], m = mergeCourse(loc, rem), ms = stable(m);
        if (!loc) { R.courses[c] = initCourse(m); changed = true; }
        else if (ms !== stable(loc)) { Object.keys(loc).forEach(k => delete loc[k]); Object.assign(loc, m); initCourse(loc); changed = true; }
        if (!rem || ms !== stable(rem)) ups.push({ user_id: user.id, course: c, data: m });
      });
      if (ups.length) { const { error: e2 } = await sb.from('progress').upsert(ups); if (e2) throw e2; }
      if (!R.cur || !R.courses[R.cur]) { R.cur = Object.keys(R.courses)[0] || null; changed = true; }
      if (R.cur) S = R.courses[R.cur];
      R.acct = Object.assign(R.acct || {}, { email: user.email, uid: user.id, lastSync: Date.now(), dirty: false });
      saveLocal();
      return changed;
    } catch (e) { if (R.acct) { R.acct.dirty = true; saveLocal(); } throw e; }
    finally { syncing = null; }
  })();
  return syncing;
}
async function loadProfile() {
  const { data, error } = await sb.from('profiles').select('display_name,native_lang,premium,premium_until').eq('id', user.id).maybeSingle();
  if (error) throw error;
  if (data) {
    R.acct = Object.assign(R.acct || {}, { name: data.display_name || '' }); R.premium = !!data.premium; R.premiumUntil = data.premium_until || null;
    if (R.lang && data.native_lang !== R.lang) await sb.from('profiles').update({ native_lang: R.lang }).eq('id', user.id);
    saveLocal();
  }
  return data;
}
function errText(e) {
  if (!navigator.onLine || (e && /fetch|network|offline|Load failed/i.test(e.message || ''))) return t('errOffline');
  const c = (e && (e.code || e.error_code)) || '', m = (e && e.message) || '';
  if (c === 'invalid_credentials' || /invalid login/i.test(m)) return t('errCreds');
  if (c === 'user_already_exists' || c === 'email_exists' || /already registered/i.test(m)) return t('errEmailTaken');
  if (c === 'weak_password' || /password should be/i.test(m)) return t('errWeakPw');
  if (c === 'email_address_invalid' || c === 'validation_failed' || /invalid format|is invalid/i.test(m)) return t('errEmailInvalid');
  if (c === 'email_not_confirmed' || /not confirmed/i.test(m)) return t('errNotConfirmed');
  if (/rate_limit|too many/i.test(c + m) || (e && e.status === 429)) return t('errRate');
  return t('errGeneric');
}
const field = (id, label, type, ac, extra) => `<label class="fld"><span>${label}</span><input id="${id}" type="${type}" autocomplete="${ac}" ${type === 'text' ? 'dir="auto"' : 'dir="ltr"'} spellcheck="false" autocapitalize="off" ${extra || ''}></label>`;
function busy(btn, on) { if (btn) { btn.disabled = on; btn.classList.toggle('busy', on); } }
/* sign in / sign up / forgot password (mode: in | up | reset | newpw) */
function authScreen(mode, msg) {
  stopAudio(); mode = mode || 'in';
  const tabs = mode === 'in' || mode === 'up';
  screen(`<div class="top"><button class="x" aria-label="${esc(t('back'))}">✕</button><div class="h2">${mode === 'reset' || mode === 'newpw' ? '🔑 ' + t('resetTitle') : '👤 ' + t('acct')}</div></div>
    <div class="scroll"><form class="aform" id="af" novalidate>
      ${tabs ? `<p class="tsub">${t('acctGuestText')}</p>
      <div class="seg"><button type="button" class="${mode === 'in' ? 'on' : ''}" data-m="in">${t('signIn')}</button><button type="button" class="${mode === 'up' ? 'on' : ''}" data-m="up">${t('signUp')}</button></div>` : ''}
      ${mode === 'reset' ? `<p class="tsub">${t('resetText')}</p>` : ''}
      ${mode === 'up' ? field('fName', t('nameLabel'), 'text', 'name', 'maxlength="80"') : ''}
      ${mode !== 'newpw' ? field('fEmail', t('email'), 'email', 'email', 'inputmode="email" maxlength="254"') : ''}
      ${mode !== 'reset' ? field('fPw', t('password'), 'password', mode === 'in' ? 'current-password' : 'new-password', 'minlength="8" maxlength="72"') + (mode !== 'in' ? `<small class="hint">${t('pwHint')}</small>` : '') : ''}
      <div class="amsg ${msg && msg.ok ? 'ok' : ''}" id="amsg" role="status">${msg ? esc(msg.text) : ''}</div>
      <button class="btn" id="aGo" type="submit">${{ in: t('signIn'), up: t('signUp'), reset: t('resetSend'), newpw: t('newPwSave') }[mode]}</button>
      ${mode === 'in' ? `<button type="button" class="lnk" id="aForgot">${t('forgotPw')}</button>` : ''}
      ${tabs && SB.google ? `<div class="or"><span></span></div><button type="button" class="btn ghost gbtn" id="aGoogle"><b class="g">G</b> ${t('googleBtn')}</button>` : ''}
      ${tabs ? `<button type="button" class="lnk mut" id="aGuest">${t('guestContinue')}</button>` : ''}
      ${mode === 'reset' ? `<button type="button" class="lnk" id="aBack">${t('signIn')}</button>` : ''}
    </form></div>`);
  bindX(mode === 'reset' ? () => authScreen('in') : home);
  $app.querySelectorAll('.seg button').forEach(b => b.onclick = () => authScreen(b.dataset.m));
  const g = id => document.getElementById(id), say = (text, ok) => { const m = g('amsg'); m.textContent = text; m.classList.toggle('ok', !!ok); };
  if (g('aForgot')) g('aForgot').onclick = () => authScreen('reset');
  if (g('aBack')) g('aBack').onclick = () => authScreen('in');
  if (g('aGuest')) g('aGuest').onclick = home;
  if (g('aGoogle')) g('aGoogle').onclick = async () => { try { await loadSB(); const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: APP_URL } }); if (error) throw error; } catch (e) { say(errText(e)); } };
  g('af').onsubmit = async ev => {
    ev.preventDefault();
    const btn = g('aGo'), email = g('fEmail') ? g('fEmail').value.trim() : '', pw = g('fPw') ? g('fPw').value : '';
    if (g('fEmail') && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return say(t('errEmailInvalid'));
    if (mode !== 'reset' && mode !== 'in' && pw.length < 8) return say(t('errWeakPw'));
    if (mode === 'in' && !pw) return say(t('errCreds'));
    if (!navigator.onLine) return say(t('errOffline'));
    busy(btn, true); say('');
    try {
      await loadSB();
      if (mode === 'in') {
        const { data, error } = await sb.auth.signInWithPassword({ email, password: pw }); if (error) throw error;
        user = data.user; await afterSignIn();
      } else if (mode === 'up') {
        const name = (g('fName').value || '').trim().slice(0, 80);
        const { data, error } = await sb.auth.signUp({ email, password: pw, options: { emailRedirectTo: APP_URL, data: { display_name: name || null, native_lang: R.lang } } });
        if (error) throw error;
        if (data.user && Array.isArray(data.user.identities) && !data.user.identities.length) throw { code: 'user_already_exists' };
        if (data.session) { user = data.user; await afterSignIn(); }
        else { busy(btn, false); say(t('checkEmail', { email }), true); }
      } else if (mode === 'reset') {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: APP_URL }); if (error) throw error;
        busy(btn, false); say(t('resetSent'), true);
      } else if (mode === 'newpw') {
        const { error } = await sb.auth.updateUser({ password: pw }); if (error) throw error;
        recovery = false; toast(esc(t('pwSaved'))); await afterSignIn(true);
      }
    } catch (e) { busy(btn, false); say(errText(e)); }
  };
}
async function afterSignIn(quiet) {
  const { data } = await sb.auth.getSession(); user = data.session ? data.session.user : user;
  R.acct = Object.assign(R.acct || {}, { email: user.email, uid: user.id }); saveLocal();
  try { await syncAll(); await loadProfile(); } catch (e) { /* offline: stays dirty, retried later */ }
  try { await deviceCheck(); } catch (e) {}
  if (!quiet) toast(esc(t('signedInMsg')));
  profileScreen();
}
function profileScreen() {
  stopAudio();
  if (!signedIn()) return authScreen('in');
  const a = R.acct || {}, codes = Object.keys(R.courses).sort((x, y) => (R.courses[x].added || 0) - (R.courses[y].added || 0));
  let when = '';
  try { when = a.lastSync ? new Intl.DateTimeFormat(LANG, { dateStyle: 'short', timeStyle: 'short' }).format(a.lastSync) : ''; } catch (e) { when = ''; }
  screen(`<div class="top"><button class="x" aria-label="${esc(t('back'))}">✕</button><div class="h2">👤 ${t('acct')}</div></div>
    <div class="scroll">
      <div class="pcard"><div class="av">${esc(((a.name || a.email || '?').trim()[0] || '?').toUpperCase())}</div>
        <div class="pinfo"><label class="fld nm"><span>${t('nameLabel')}</span><span class="nrow"><input id="pName" type="text" dir="auto" maxlength="80" autocomplete="name" value="${esc(a.name || '')}"><button class="sbtn" id="pSave">${t('save')}</button></span></label>
        <div class="pmail" dir="ltr">${esc(a.email || '')}</div>
        ${ACCESS.owned() ? `<div class="pprem">💎 ${t('premium')}${ACCESS.devOk() ? '' : ' · 📱'}</div>` : ''}
        <div class="psync ${a.dirty ? 'pend' : ''}" id="psync">${a.dirty ? '⏳ ' + t('syncPending') : (when ? '☁️ ' + t('syncedAt', { time: when }) : '')}</div></div></div>
      <div class="sect">${t('myCourses')}</div>
      <div class="plist">${codes.map(code => { const c = R.courses[code], n = Object.keys(c.words).filter(id => c.words[id].learnedAt).length;
        return `<div class="lang course pc">${flagImg(code)}<span class="lt2"><b>${esc(courseName(code))}</b><small>${t('wordsOfTotal', { a: n, b: TOTAL })} · 🔥 ${N(streakOf(c))} · ⚡ ${N(c.best60 || 0)}</small></span></div>`; }).join('')}</div>
    </div>
    <div class="btns">${ACCESS.owned() ? `<button class="btn ghost" id="pDev">📱 ${t('devManage')}</button>` : `<button class="lnk" id="pHave">💎 ${t('pwHave')}</button>`}<button class="btn ghost" id="pOut">${t('signOut')}</button><button class="lnk danger" id="pDel">${t('deleteAcct')}</button><div class="legal">${legalLinks()}</div></div>`);
  bindX(home);
  const g = id => document.getElementById(id);
  g('pSave').onclick = async () => {
    const name = g('pName').value.trim().slice(0, 80), btn = g('pSave'); busy(btn, true);
    try { await loadSB(); const { error } = await sb.from('profiles').update({ display_name: name || null }).eq('id', user.id); if (error) throw error;
      R.acct.name = name; saveLocal(); toast('✓'); profileScreen(); } catch (e) { busy(btn, false); toast(esc(errText(e))); }
  };
  g('pOut').onclick = async () => {
    const btn = g('pOut'); busy(btn, true);
    let r; try { r = await syncAll(); } catch (e) { busy(btn, false); toast(esc(t('errOffline'))); return; }
    try { await sb.auth.signOut({ scope: 'local' }); } catch (e) {}
    user = null; R.acct = null; R.premium = false; R.premiumUntil = null; R.dev = null;
    if (r !== null) { R.courses = {}; R.cur = null; S = initCourse({}); }   // progress is safe in the cloud; if the session had expired, keep it locally
    saveLocal();
    afterLang();
  };
  g('pDel').onclick = deleteConfirm;
  if (g('pDev')) g('pDev').onclick = () => { deviceScreen(null, true); if (navigator.onLine) deviceCheck().then(() => { if (document.getElementById('devCheck')) deviceScreen(null, true); }).catch(() => {}); };
  if (g('pHave')) g('pHave').onclick = async () => { const btn = g('pHave'); busy(btn, true);
    try { await restorePremium(); busy(btn, false); if (ACCESS.owned()) return ACCESS.devOk() ? (toast(esc(t('pwActive'))), profileScreen()) : deviceScreen(null, true); toast(esc(t('pwNone'))); }
    catch (e) { busy(btn, false); toast(esc(t(payErr(e)))); } };
  if (navigator.onLine && (a.dirty || !a.lastSync || Date.now() - a.lastSync > 60000)) syncAll().then(r => { if (r !== null && document.getElementById('psync')) profileScreen(); }).catch(() => {});
}
function deleteConfirm() {
  stopAudio();
  screen(`<div class="top"><button class="x" aria-label="${esc(t('back'))}">✕</button><div class="h2">${t('deleteAcct')}</div></div>
    <div class="done"><div class="big">⚠️</div><h1>${t('delTitle')}</h1><p>${t('delText')}</p><p class="pmail" dir="ltr">${esc((R.acct && R.acct.email) || '')}</p></div>
    <div class="btns"><button class="btn danger" id="dYes">${t('delConfirm')}</button><button class="btn ghost" id="dNo">${t('cancel')}</button></div>`);
  bindX(profileScreen); document.getElementById('dNo').onclick = profileScreen;
  document.getElementById('dYes').onclick = async () => {
    const btn = document.getElementById('dYes'); busy(btn, true);
    try {
      if (!navigator.onLine) throw new Error('offline');
      await loadSB(); const { data } = await sb.auth.getSession(); if (!data.session) throw { code: 'no_session' };
      const r = await fetch(SB.url + '/functions/v1/delete-account', { method: 'POST', headers: { Authorization: 'Bearer ' + data.session.access_token, apikey: SB.key } });
      if (!r.ok) throw { status: r.status };
      try { await sb.auth.signOut({ scope: 'local' }); } catch (e) {}
      try { localStorage.removeItem(SB.store); } catch (e) {}
      user = null; R.acct = null; R.premium = false; R.premiumUntil = null; R.dev = null; saveLocal();
      home(); toast(esc(t('deleted')));
    } catch (e) { busy(btn, false); toast(esc(errText(e))); }
  };
}
/* ---------- web purchase: Lemon Squeezy (merchant of record) one-time "$5 lifetime" ----------
   LS.checkoutUrl = the product's checkout link from Lemon Squeezy (Products → Share → checkout URL, e.g.
   https://STORE.lemonsqueezy.com/buy/VARIANT-UUID). Empty = payments not live: the paywall says "coming soon".
   The checkout gets checkout[custom][user_id] + checkout[email]; the lemonsqueezy-webhook Edge Function verifies the signed
   order_created / order_refunded webhooks and alone sets profiles.premium. The client never decides premium. */
const LS = { checkoutUrl: '', usd: 5 };
const lsPrice = () => { try { return new Intl.NumberFormat(LANG, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(LS.usd); } catch (e) { return '$' + LS.usd; } };
let lemonP = null;
function loadLemon() {
  if (!lemonP) lemonP = new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'https://app.lemonsqueezy.com/js/lemon.js'; sc.defer = true;
    sc.onload = () => { try { window.createLemonSqueezy && window.createLemonSqueezy(); } catch (e) {} window.LemonSqueezy ? ok(window.LemonSqueezy) : no(new Error('lemon')); };
    sc.onerror = () => { lemonP = null; no(new Error('lemon')); }; document.head.appendChild(sc); });
  return lemonP;
}
function checkoutLink(u, embed) {
  const q = new URLSearchParams(); q.set('checkout[custom][user_id]', u.id); if (u.email) q.set('checkout[email]', u.email);
  q.set('checkout[custom][lang]', LANG || ''); if (embed) q.set('embed', '1');
  return LS.checkoutUrl + (LS.checkoutUrl.includes('?') ? '&' : '?') + q.toString();
}
async function openCheckout(u, onPaid) {
  let fired = false; const paid = () => { if (!fired) { fired = true; onPaid(); } };
  try {
    const L = await loadLemon();
    L.Setup({ eventHandler: e => { if (e && e.event === 'Checkout.Success') paid(); } });
    L.Url.Open(checkoutLink(u, true));
  } catch (e) {   // lemon.js blocked → hosted checkout in a new tab; check again when the user comes back
    window.open(checkoutLink(u, false), '_blank', 'noopener');
    const vis = () => { if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', vis); paid(); } };
    document.addEventListener('visibilitychange', vis);
  }
}
/* after checkout: the webhook usually lands within seconds; poll the server ~90 s */
async function waitPremium() {
  for (let i = 0; i < 30; i++) {
    try { await deviceCheck(); if (ACCESS.owned()) return true; } catch (e) {}
    await new Promise(r => setTimeout(r, 3000));
  }
  return false;
}
/* one active device per account; the device id is a random UUID kept on this device */
function deviceId() {
  let id = null; try { id = localStorage.getItem('w3g-device'); } catch (e) {}
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) {
    id = (crypto.randomUUID && crypto.randomUUID()) || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15; return (c === 'x' ? r : (r & 3) | 8).toString(16); });
    try { localStorage.setItem('w3g-device', id); } catch (e) {}
  }
  return id;
}
function deviceLabel() {
  const ua = navigator.userAgent || '';
  const os = /Android/i.test(ua) ? 'Android' : /iPhone/i.test(ua) ? 'iPhone' : /iPad/i.test(ua) ? 'iPad' : /Windows/i.test(ua) ? 'Windows' : /Mac OS X|Macintosh/i.test(ua) ? 'Mac' : /CrOS/i.test(ua) ? 'ChromeOS' : /Linux/i.test(ua) ? 'Linux' : '';
  const m = /Android[^;)]*;\s*([^;)]+?)(?:\sBuild|\))/i.exec(ua), model = m && !/^(K|wv|Linux)$/i.test(m[1].trim()) ? m[1].trim() : '';
  const br = /SamsungBrowser/i.test(ua) ? 'Samsung Internet' : /EdgA?\//i.test(ua) ? 'Edge' : /OPR\//i.test(ua) ? 'Opera' : /Firefox|FxiOS/i.test(ua) ? 'Firefox' : /CriOS|Chrome/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : '';
  return [model || os, br].filter(Boolean).join(' · ').slice(0, 80) || 'Browser';
}
let devChecking = null;
function deviceCheck(claim) {
  if (devChecking && !claim) return devChecking;
  const run = (async () => {
    await loadSB(); const { data } = await sb.auth.getSession(); if (!data.session) throw { code: 'no_session' };
    const r = await fetch(SB.url + '/functions/v1/premium-device', { method: 'POST', headers: { Authorization: 'Bearer ' + data.session.access_token, apikey: SB.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId(), label: deviceLabel(), claim: !!claim }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok && r.status !== 429) throw { code: j.error || 'device_failed', status: r.status };
    R.premium = !!j.premium; R.premiumUntil = j.premium_until || null;
    R.dev = { uid: data.session.user.id, active: !!j.active, at: Date.now(), other: j.other || null, canMove: !!j.can_move, nextMove: j.next_move_at || null };
    saveLocal(); return j;
  })();
  if (!claim) { devChecking = run; run.finally(() => { devChecking = null; }).catch(() => {}); }
  return run;
}
const devStale = () => !R.dev || R.dev.uid !== (R.acct && R.acct.uid) || Date.now() - (R.dev.at || 0) > DEV_EVERY;
function devTick() { if (signedIn() && navigator.onLine && document.visibilityState === 'visible' && devStale()) deviceCheck().catch(() => {}); }
setInterval(devTick, DEV_EVERY);
document.addEventListener('visibilitychange', devTick);
async function restorePremium() { await loadSB(); await loadProfile(); await deviceCheck(); return ACCESS.isPremium(); }
const payErr = e => (!navigator.onLine || (e && /offline/.test(e.message || ''))) ? 'errOffline' : 'pwFail';

/* ---------- Google Play Billing: DORMANT (kept for a possible Android/TWA build; PLAY.enabled = false → billing() is null) ----------
   Digital Goods API + Payment Request, verified server-side by the verify-purchase Edge Function (501 until configured). */
const PLAY = { enabled: false, method: 'https://play.google.com/billing', product: 'premium_monthly', usd: 4 };
let dgs = null, dgsTried = null;
function billing() {
  if (!PLAY.enabled) return Promise.resolve(null);
  if (!dgsTried) dgsTried = (async () => {
    try { if ('getDigitalGoodsService' in window && 'PaymentRequest' in window) dgs = await window.getDigitalGoodsService(PLAY.method); } catch (e) { dgs = null; }
    return dgs || null;
  })();
  return dgsTried;
}
async function verifyPurchase(token) {
  await loadSB(); const { data } = await sb.auth.getSession(); if (!data.session) throw { code: 'no_session' };
  const r = await fetch(SB.url + '/functions/v1/verify-purchase', { method: 'POST', headers: { Authorization: 'Bearer ' + data.session.access_token, apikey: SB.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ purchaseToken: token, productId: PLAY.product }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw { code: j.error || 'verify_failed', status: r.status };
  R.premium = !!j.premium; R.premiumUntil = j.expires_at || null; saveLocal();
  return ACCESS.owned();
}
const acctOpen = () => signedIn() ? profileScreen() : authScreen('up');
/* app open: restore session, handle auth links (email confirm / password recovery / OAuth), then sync */
function acctBoot() {
  const linked = /access_token=|error_description=|type=recovery/.test(location.hash);
  const isRec = /type=recovery/.test(location.hash);
  if (!linked && !hasSession()) return;
  loadSB().then(() => sb.auth.getSession()).then(({ data }) => {
    user = data.session ? data.session.user : null;
    if (linked) { const err = /error_description=([^&]+)/.exec(location.hash); history.replaceState(null, '', location.pathname + location.search); if (err && !user) { authScreen('in', { text: decodeURIComponent(err[1].replace(/\+/g, ' ')) }); return; } }
    if (recovery || isRec) { recovery = true; return authScreen('newpw'); }
    if (!user) { if (R.acct) { R.acct = null; saveLocal(); } return; }
    const first = !(R.acct && R.acct.uid === user.id);
    R.acct = Object.assign(R.acct || {}, { email: user.email, uid: user.id }); saveLocal();
    return syncAll().then(ch => { loadProfile().then(() => deviceCheck()).catch(() => {}); if (first && linked) { toast(esc(t('signedInMsg'))); } if (ch && $app.querySelector('.levels')) home(); });
  }).catch(() => {});
}
window.addEventListener('online', () => { if (R.acct && R.acct.dirty) syncAll().catch(() => {}); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && R.acct && R.acct.dirty && user) { clearTimeout(syncTimer); syncAll().catch(() => {}); } });

/* ---------- boot ---------- */
let VERSION = 1;
window.__app = { get S() { return S; }, get R() { return R; }, W, LV, M, home, DEBUG, levelScreen, lessonObj, settingsScreen, langPicker, ACCESS,
  targetPicker, courseSwitcher, setCourse, COURSES, FREE, paywallScreen, deviceScreen, billing, PLAY, LS, deviceCheck, deviceId, deviceLabel, checkoutLink, checkReminder, setReminder, REM,
  save, acct: { SB, authScreen, profileScreen, deleteConfirm, syncAll, mergeCourse, loadSB, get user() { return user; }, get sb() { return sb; } },
  get lang() { return LANG; }, setLang: c => { R.lang = c; save(); return applyLang(c); }, t,
  cardFor: id => { const w = W[id]; learnCard({ L: lessonObj(w.level, w.li), seq: [w], i: 0, t0: 0 }); stopAudio(); },
  quizFor: (id, type) => { let n = 0; runQuiz({ mode: 'lesson', targets: [id], need: 1, pool: LV[W[id].level].lessons[W[id].li], next: () => n++ ? null : { id, type }, onDone: () => {} }); stopAudio(); clearTimers(); } };
window.__t = (k, v) => t(k, v);   // used by install.js
const afterLang = () => R.cur && R.courses[R.cur] ? start() : targetPicker(true);
const start = () => { window.__app.ready = true; if (!S.onboarded && !learnedIds().length) placementIntro(true); else { S.onboarded = true; save(); home(); } setTimeout(checkReminder, 1200); };
fetch('data/index.json').then(r => r.json()).then(ix => {
  TOTAL = ix.total; VERSION = ix.version;
  ix.levels.forEach(l => LV[l.id] = { id: l.id, count: l.count, available: false, lessons: [] });
  return Promise.all([
    fetch('i18n/langs.json?v=' + ix.version).then(r => r.json()).then(j => { LANGS = j.languages; ALIASES = j.aliases || {}; }),
    ...ix.levels.filter(l => l.available).map(l => fetch('data/' + l.id + '.json?v=' + ix.version).then(r => r.json()).then(d => {
      const L = LV[l.id]; L.available = true; L.lessons = d.lessons.map((ls, li) => ls.map(([id, w, ex, img]) => { W[id] = { id, w, ex, img: !!img, level: l.id, li }; return id; }));
    }))]);
}).then(() => {
  const forced = params.get('lang');
  if (forced && langInfo(forced)) { R.lang = forced; save(); }
  if (R.lang && langInfo(R.lang)) return applyLang(R.lang).then(afterLang).then(acctBoot);
  langPicker(afterLang); acctBoot();
}).catch(e => { $app.innerHTML = '<div class="empty">⚠️ ' + (L10N.loadError || 'Loading error · خطا در بارگذاری · خطأ في التحميل · Erreur de chargement') + '</div>'; console.error(e); });
})();
