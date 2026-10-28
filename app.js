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
let LANGS = [], ALIASES = {}, LANG = null, L10N = {}, NF = new Intl.NumberFormat('en'), PR = new Intl.PluralRules('en');
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

/* ---------- access (paywall-ready; OFF in this build) ---------- */
// Plan: first FREE_LESSONS lessons free, then a $4/month Google Play subscription.
// When billing is added, set ACCESS.paywall = true and implement ACCESS.isPremium() + paywallScreen().
const ACCESS = {
  paywall: false, freeLessons: 5,
  isPremium: () => !!(S && S.premium),
  freeIndex: (lv, i) => LEVEL_IDS.slice(0, LEVEL_IDS.indexOf(lv)).reduce((s, l) => s + (LV[l] ? LV[l].lessons.length : 0), 0) + i,
  canOpen(lv, i) { return !this.paywall || this.isPremium() || this.freeIndex(lv, i) < this.freeLessons; }
};

const W = {};            // id -> {id,w,ex,img,level,li}
const LV = {};           // level -> {id,lessons:[[ids]], count, available}
let TOTAL = 0;
const timers = new Set();
const later = (fn, ms) => { const tm = setTimeout(() => { timers.delete(tm); fn(); }, ms); timers.add(tm); return tm; };
const clearTimers = () => { timers.forEach(clearTimeout); timers.clear(); };

/* ---------- storage ---------- */
const KEY = 'w3g-v1';
let S;
try { S = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { S = {}; }
S.words = S.words || {}; S.lessons = S.lessons || {}; S.streak = S.streak || { count: 0, last: null }; S.best60 = S.best60 || 0;
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
save();
const ws = id => (S.words[id] = S.words[id] || { miss: 0 });
const dkey = d => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
function touchStreak() {
  const td = dkey(new Date()); if (S.streak.last === td) return;
  const y = dkey(new Date(Date.now() - DAY));
  S.streak.count = S.streak.last === y ? S.streak.count + 1 : 1; S.streak.last = td; save();
}
function streakNow() { const td = dkey(new Date()), y = dkey(new Date(Date.now() - DAY)); return (S.streak.last === td || S.streak.last === y) ? S.streak.count : 0; }
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
function applyLang(code) {
  const li = langInfo(code) || LANGS[0]; LANG = li.code;
  const de = document.documentElement; de.lang = LANG; de.dir = li.dir;
  NF = new Intl.NumberFormat(li.num || LANG); PR = new Intl.PluralRules(LANG);
  return Promise.all([
    fetch('i18n/' + LANG + '.json?v=' + VERSION).then(r => r.json()).then(j => { L10N = j; }),
    Promise.all(LEVEL_IDS.filter(lv => LV[lv] && LV[lv].available && (!li.meanings || li.meanings.includes(lv))).map(lv => fetch('data/meanings/' + LANG + '/' + lv + '.json?v=' + VERSION).then(r => r.ok ? r.json() : {}).catch(() => ({})))).then(arr => {
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
  let sel = S.lang || guessLang();
  const draw = () => {
    const li = langInfo(sel);
    document.documentElement.dir = li ? li.dir : 'ltr'; document.documentElement.lang = sel || 'en';
    screen(`<div class="picker-head"><h1><span class="globe">🌐</span> <span class="en">Choose your language</span></h1>
      ${li ? `<p lang="${li.code}" dir="${li.dir}">${esc(li.pick)}</p>` : '<p class="en">English 3000 Words · American English</p>'}</div>
      ${langGrid(sel)}
      <button class="btn" id="go" ${sel ? '' : 'disabled'}>${sel ? esc(L10N._lang === sel ? t('continue') : '…') : '→'}</button>`);
    bindLangGrid(code => { sel = code; applyLang(sel).then(draw); });
    document.getElementById('go').onclick = () => { if (!sel) return; S.lang = sel; save(); applyLang(sel).then(onDone); };
  };
  if (sel) applyLang(sel).then(draw); else draw();
}
function settingsScreen() {
  stopAudio();
  screen(`<div class="top"><button class="x" aria-label="${esc(t('back'))}">✕</button><div class="h2">⚙️ ${t('settings')}</div></div>
    <div class="sect">${t('appLanguage')}</div>
    ${langGrid(LANG)}
    <div class="foot">${t('settingsNote')}</div>
    <button class="btn" id="home">${t('backHome')}</button>`);
  bindX(home); document.getElementById('home').onclick = home;
  bindLangGrid(code => { S.lang = code; save(); applyLang(S.lang).then(settingsScreen); });
}

/* ---------- home ---------- */
function home() {
  stopAudio();
  const learned = learnedIds().length, due = dueIds().length, hard = hardIds().length;
  const rec = S.placement && S.placement.level;
  screen(`
    <div class="home-head"><div class="logo">${t('appName')}<small>${t('appSub')}</small></div>
      <div class="hd-r"><button class="inst pwa-install" data-install title="${esc(t('installTitle'))}"><span class="ii">📲</span><span class="it">${t('install').replace(/^📲\s*/u, '')}</span></button><div class="streak" title="${esc(t('streakTitle'))}">🔥 ${N(streakNow())}</div><button class="gear" id="tSet" aria-label="${esc(t('settings'))}">⚙️</button></div></div>
    <div class="prog"><div class="row"><span>${t('totalProgress')}</span><b>${t('wordsOfTotal', { a: learned, b: TOTAL })}</b></div>
      <div class="bar"><i style="width:${Math.max(learned / TOTAL * 100, learned ? 1 : 0)}%"></i></div></div>
    <div class="levels">${LEVEL_IDS.map(lv => { const L = LV[lv]; const n = L ? L.count : 0, done = L ? learnedIn(lv) : 0, ok = L && L.available;
      const lw = Math.max(...lvName(lv).split(/[\s-]+/).map(vlen)), long = lw > 7;
      return `<button class="lvl ${lv} ${rec === lv ? 'rec' : ''} ${ok ? '' : 'soon'} ${long ? 'long' : ''}" data-lv="${lv}">
        <div class="lt"><span class="code">${lv}</span><span class="nm"${lw > 12 ? ` style="font-size:min(clamp(13px,2dvh,18px),${(58 / lw).toFixed(2)}vw)"` : ''}>${lvName(lv)}${rec === lv ? '<br>' + t('recommended') : ''}</span></div>
        <div><div class="meta"><span>${ok ? t('nLessons', { n: L.lessons.length }) : t('soon')}</span><span>${N(done)}/${N(n)}</span></div>
        <div class="bar"><i style="width:${n ? Math.max(done / n * 100, done ? 2 : 0) : 0}%"></i></div></div></button>`; }).join('')}</div>
    <div class="tools">
      <button class="tool ${due ? 'due' : ''}" id="tReview"><span class="badge">${N(due)}</span><span class="ic">🔁</span><b>${t('toolReview')}</b></button>
      <button class="tool" id="tHard"><span class="badge">${N(hard)}</span><span class="ic">💪</span><b>${t('toolHard')}</b></button>
      <button class="tool" id="tQuick"><span class="ic">⚡</span><b>${t('toolQuick')}</b></button>
    </div>
    <button class="place" id="tPlace">${t('placeBtn')}${rec ? t('placeResult', { lv: '<span class="en">' + rec + '</span>' }) : t('placeDuration')}</button>
    ${DEBUG ? `<div class="dbg"><button id="dDue">debug: due now</button><button id="dLearn">debug: learn A1-1..3</button><button id="dReset">debug: reset</button></div>` : ''}`);
  $app.querySelectorAll('.lvl').forEach(b => b.onclick = () => { const lv = b.dataset.lv; if (LV[lv] && LV[lv].available) levelScreen(lv); });
  document.getElementById('tReview').onclick = reviewScreen;
  document.getElementById('tHard').onclick = hardScreen;
  document.getElementById('tQuick').onclick = quickIntro;
  document.getElementById('tPlace').onclick = () => placementIntro();
  document.getElementById('tSet').onclick = settingsScreen;
  if (DEBUG) {
    document.getElementById('dDue').onclick = () => { learnedIds().forEach(id => { if (!S.words[id].mastered) S.words[id].due = Date.now() - 1000; }); save(); home(); };
    document.getElementById('dLearn').onclick = () => { [0, 1, 2].forEach(i => finishLessonState(lessonObj('A1', i))); home(); };
    document.getElementById('dReset').onclick = () => { localStorage.removeItem(KEY); location.reload(); };
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
    cells += `<button class="ls ${d ? 'done' : c ? 'cur' : u ? '' : 'lock'}" data-i="${i}" ${u ? '' : 'aria-disabled="true"'}>${d ? '✓' : u ? N(i + 1) : '🔒'}<small>${d || !u ? t('lessonN', { n: i + 1 }) : c ? t('start') : ''}</small></button>`;
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
function paywallScreen(lv) { /* placeholder: Google Play subscription screen goes here */ levelScreen(lv); }
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
    ${chips && chips.length ? `<div class="chips">${chips.slice(0, 12).map(id => `<span class="chip"><span class="en">${esc(W[id].w)}</span> · <bdi>${esc(mean(id))}</bdi></span>`).join('')}</div>` : ''}
    </div>
    <div class="btns">${extraBtn ? `<button class="btn" id="extra">${extraBtn[0]}</button>` : ''}<button class="btn ${extraBtn ? 'ghost' : ''}" id="home">${back ? t('backToLessons') : t('backHome')}</button></div>`);
  document.getElementById('home').onclick = back || home;
  if (extraBtn) document.getElementById('extra').onclick = extraBtn[1];
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

/* ---------- boot ---------- */
let VERSION = 1;
window.__app = { get S() { return S; }, W, LV, M, home, DEBUG, levelScreen, lessonObj, settingsScreen, langPicker, ACCESS,
  get lang() { return LANG; }, setLang: c => { S.lang = c; save(); return applyLang(c); }, t,
  cardFor: id => { const w = W[id]; learnCard({ L: lessonObj(w.level, w.li), seq: [w], i: 0, t0: 0 }); stopAudio(); },
  quizFor: (id, type) => { let n = 0; runQuiz({ mode: 'lesson', targets: [id], need: 1, pool: LV[W[id].level].lessons[W[id].li], next: () => n++ ? null : { id, type }, onDone: () => {} }); stopAudio(); clearTimers(); } };
window.__t = (k, v) => t(k, v);   // used by install.js
const start = () => { window.__app.ready = true; if (!S.onboarded && !learnedIds().length) placementIntro(true); else { S.onboarded = true; save(); home(); } };
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
  if (forced && langInfo(forced)) { S.lang = forced; save(); }
  if (S.lang && langInfo(S.lang)) return applyLang(S.lang).then(start);
  langPicker(start);
}).catch(e => { $app.innerHTML = '<div class="empty">⚠️ ' + (L10N.loadError || 'Loading error · خطا در بارگذاری · خطأ في التحميل · Erreur de chargement') + '</div>'; console.error(e); });
})();
