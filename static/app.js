// Agent City — turns live Cominty agent events into city life.
import * as THREE from 'three';
import { City, BUILDINGS } from './city.js';

const $ = (s) => document.querySelector(s);
const city = new City($('#city'));
const applyShift = () => city.setShift(window.innerWidth > 900 ? 202 : 0);
applyShift();
window.addEventListener('resize', applyShift);
window.city = city; // handy for debugging in the console

const EXAMPLES = {
  planner: [
    "I'm moving to Rouen in January for NEOMA. Compare 3 neighbourhoods and write the email to landlords.",
    'I just arrived in France as an international student. Make my first-month admin plan: bank account, CAF housing aid, health insurance and residence permit, with deadlines.',
    'Plan my first weekend in Rouen on a €50 student budget and make a one-page visual guide.',
  ],
  analyst: [
    'Which Rouen neighbourhood fits a €600 studio budget? Use official rent data and chart rent per m² by area.',
    'Compare the monthly cost of living for a student in Rouen, Lyon and Paris, and chart it.',
    'How much housing aid (APL) could a student get for a €550 studio in Rouen? Show the calculation.',
  ],
};
const AGENT_LABEL = { planner: 'City Planner', analyst: 'Data Analyst' };

// Who does what: tool name → role, building, colour.
const ROLES = {
  Researcher: { color: 0x4dd0e1, icon: '🧭' },
  Reviewer:   { color: 0xc792ea, icon: '⚖️' },
  Scout:      { color: 0x5fb4ff, icon: '🔎' },
  Artist:     { color: 0xff8a65, icon: '🎨' },
  Producer:   { color: 0xff6fa8, icon: '🎬' },
  Writer:     { color: 0xffd166, icon: '✍️' },
  Clerk:      { color: 0x8bd3c7, icon: '🗂️' },
  Keeper:     { color: 0x6be3bf, icon: '🧠' },
  Courier:    { color: 0xf2a65a, icon: '📦' },
  Operator:   { color: 0x9aa5b1, icon: '🛠️' },
  Analyst:    { color: 0x3fc1d9, icon: '📊' },
};

function classify(tool = '', text = '') {
  const t = tool.toLowerCase();
  const s = `${t} ${text.toLowerCase()}`;
  if (/sub.?agent|delegat|spawn|handoff|workflow|phase|second.?opinion|^task$|^agent/.test(t) || /^(researcher|reviewer)\b/i.test(text)) {
    if (/review|check|verif|opinion|critic|audit/.test(s)) return { role: 'Reviewer', building: 'townhall', sub: true };
    if (/calendar|event|invite|notion|slack|integration/.test(s)) return { role: 'Operator', building: 'workshop', sub: true };
    if (/analy|compute|calculat|statistic|dataset|chart/.test(s)) return { role: 'Analyst', building: 'observatory', sub: true };
    return { role: 'Researcher', building: 'library', sub: true };
  }
  if (/python|code|execute|sandbox|bash|shell|analy|compute|chart|plot|pandas|sql|query|datagouv|data_gouv|dataset|csv/.test(t)) return { role: 'Analyst', building: 'observatory' };
  if (/calendar|event|invite|notion|slack|gamma|mcp|integration/.test(s) && !/search_web/.test(t)) return { role: 'Operator', building: 'workshop' };
  if (/present|deliver|share|export|send_file|attach/.test(t)) return { role: 'Courier', building: 'home' };
  if (/image|draw|paint|picture|illustr/.test(t)) return { role: 'Artist', building: 'studio' };
  if (/video|music|audio|sound/.test(t)) return { role: 'Producer', building: 'studio' };
  if (/memory|remember|recall/.test(t)) return { role: 'Keeper', building: 'vault' };
  if (/search|web|browse|fetch|scrape|crawl|url/.test(t)) return { role: 'Scout', building: 'library' };
  if (/write|edit|create|save|append|draft|patch|replace|update|insert/.test(t)) return { role: 'Writer', building: 'writers' };
  if (/review|check|verif/.test(t)) return { role: 'Reviewer', building: 'townhall' };
  if (/read|open|view|inspect|list|document|retriev|index|grep|glob/.test(t)) return { role: 'Clerk', building: 'archive' };
  if (/mcp|integration|notion|slack|gmail|linear|calendar|drive/.test(s)) return { role: 'Operator', building: 'workshop' };
  // unknown tool name: fall back on the description
  if (/image|poster|picture/.test(s)) return { role: 'Artist', building: 'studio' };
  if (/search|web/.test(s)) return { role: 'Scout', building: 'library' };
  return { role: 'Operator', building: 'workshop' };
}

const TAG_ICON = { PLAN: '🗺️', RESEARCH: '🔎', WRITE: '✍️', IMAGE: '🎨', REVIEW: '⚖️', ASK: '📋', DATA: '🗄️', ANALYSE: '📊', CHART: '📈' };
const TAG_BUILDING = { RESEARCH: 'library', WRITE: 'writers', IMAGE: 'studio', REVIEW: 'townhall', ASK: 'home', DATA: 'observatory', ANALYSE: 'observatory', CHART: 'observatory' };

function short(text = '', n = 72) {
  let t = String(text).replace(/^Search the web for\s+/i, '').replace(/^Search\s+/i, '').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

// ------------------------------------------------------------------ state
const S = {
  mode: 'mock', threadId: null, running: false, replay: null,
  t0: 0, elapsed: 0, agentsOut: 0, tools: 0, searches: 0, files: 0,
  roleCount: {}, workers: new Map(), delivered: new Set(), lastFocus: 0, es: null,
};

function stats() {
  $('#st-agents').textContent = S.agentsOut;
  $('#st-tools').textContent = S.tools;
  $('#st-search').textContent = S.searches;
  $('#st-files').textContent = S.files;
}
setInterval(() => {
  const sec = Math.floor((S.elapsed + (S.running ? Date.now() - S.t0 : 0)) / 1000);
  $('#st-time').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}, 250);

function caption(text, tag = '', kind = '') {
  const c = $('#caption');
  c.querySelector('.cap-text').textContent = text;
  c.querySelector('.cap-tag').textContent = tag;
  c.className = 'caption flash ' + kind;
  clearTimeout(caption.t);
  caption.t = setTimeout(() => c.classList.remove('flash'), 600);
}

function log(icon, html, small = '', cls = '', color = null) {
  const li = document.createElement('li');
  li.className = cls;
  if (color != null) li.style.setProperty('--c', '#' + new THREE.Color(color).getHexString());
  li.innerHTML = `<span class="ic">${icon}</span><div>${html}${small ? `<small>${small}</small>` : ''}</div>`;
  const ol = $('#log');
  ol.appendChild(li);
  while (ol.children.length > 300) ol.firstChild.remove();
  ol.parentElement.scrollTop = ol.parentElement.scrollHeight;
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function renderCrew() {
  const box = $('#crew');
  const active = [...S.workers.values()].filter((r) => !r.done);
  $('#crew-n').textContent = active.length ? `${active.length}` : '';
  if (!active.length) { box.innerHTML = '<span class="crew-rest">All agents are resting at the Eiffel Tower.</span>'; return; }
  box.innerHTML = '';
  for (const r of active.slice(-12)) {
    const c = document.createElement('span');
    c.className = 'crew-chip';
    c.style.setProperty('--c', '#' + new THREE.Color(ROLES[r.cls.role].color).getHexString());
    c.innerHTML = `<i>${ROLES[r.cls.role].icon}</i>${esc(r.label)}<em>${r.arrived ? 'working' : 'walking'}</em>`;
    box.appendChild(c);
  }
}

function focus(key, force = false) {
  const now = performance.now();
  if (!force && now - S.lastFocus < 3500) return;
  S.lastFocus = now;
  city.focus(S.agentsOut > 2 ? 'overview' : key);
}

function tab(name) {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.id === 'tab-' + name));
}
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => tab(b.dataset.tab)));

// ------------------------------------------------------------------ workers
function startWorker(ev) {
  const cls = classify(ev.tool, ev.text);
  const role = ROLES[cls.role];
  const n = (S.roleCount[cls.role] = (S.roleCount[cls.role] || 0) + 1);
  const label = `${cls.role} #${n}`;
  const w = city.spawn({ label, color: role.color, size: cls.sub ? 1.25 : 0.95, toward: cls.building, role: cls.role });
  w.setStatus(`${role.icon} ${short(ev.text, 60)}`);
  const rec = { w, cls, label, arrived: false, result: null, startedAt: performance.now() };
  S.workers.set(`${S.turn}:${ev.cid}`, rec);
  S.agentsOut++; S.tools++;
  if (cls.role === 'Scout') S.searches++;
  stats(); renderCrew();

  const b = BUILDINGS[cls.building];
  if (cls.sub) {
    caption(`${label} sets off to the ${b.name}: “${short(ev.text, 80)}”`, 'SUBAGENT');
    log('🧭', `<span class="dot"></span><b>${esc(label)}</b> spawned — ${esc(short(ev.text, 120))}`, `subagent · own context`, '', role.color);
  } else if (cls.building !== 'home') {
    caption(`${label} → ${b.name}: “${short(ev.text, 80)}”`, cls.role.toUpperCase());
    log(role.icon, `<span class="dot"></span><b>${esc(label)}</b> at the ${esc(b.name)} — ${esc(short(ev.text, 120))}`, ev.tool, '', role.color);
  }
  focus(cls.building);

  city.goTo(w, cls.building).then(() => {
    rec.arrived = true;
    rec.arrivedAt = performance.now();
    city.enter(cls.building);
    w.working = true;
    renderCrew();
    if (rec.result) setTimeout(() => complete(rec), 700);
  });
}

function finishWorker(ev) {
  const rec = S.workers.get(`${S.turn}:${ev.cid}`);
  if (!rec || rec.result) return;
  rec.result = ev;
  if (rec.arrived) {
    const waited = performance.now() - rec.arrivedAt;
    setTimeout(() => complete(rec), Math.max(0, 900 - waited));
  }
}

async function complete(rec) {
  if (rec.done) return;
  rec.done = true;
  const { w, cls, result } = rec;
  w.working = false;
  city.leave(cls.building);
  S.agentsOut = Math.max(0, S.agentsOut - 1);
  stats(); renderCrew();
  const ok = result.status !== 'error';
  w.setStatus(ok ? `✓ ${short(result.detail || 'done', 50)}` : `✗ ${short(result.detail || 'failed', 50)}`, ok ? 'ok' : 'err');
  if (!ok) log('⚠️', `<b>${esc(rec.label)}</b> hit a problem`, esc(short(result.detail, 140)), 'err');
  if (cls.sub && ok) log('📄', `<b>${esc(rec.label)}</b> reported back to the Planner`, esc(short(result.detail || '', 140)));
  city.flash(cls.building);
  if (cls.building === 'home') {
    setTimeout(() => city.dismiss(w), 1200);
    return;
  }
  await new Promise((r) => setTimeout(r, 700));
  w.setStatus(cls.sub ? '📄 bringing the report' : '');
  await city.goHQ(w);
  if (cls.sub) {
    await city.packet(w.group.position, new THREE.Vector3(0, 6, 0), ROLES[cls.role].color);
    city.planner.setStatus(`Got ${rec.label}'s report`, 'think');
    setTimeout(() => { if (!S.thinking) city.planner.setStatus(''); }, 2500);
  }
  city.dismiss(w);
}

// ------------------------------------------------------------------ results
function fileKind(f) {
  const n = (f.name || '').toLowerCase();
  if ((f.mimetype || '').startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/.test(n)) return 'image';
  if (/email|mail|message|letter/.test(n)) return 'email';
  if (/plan|schedule|timeline/.test(n)) return 'plan';
  if ((f.mimetype || '').startsWith('video/')) return 'video';
  if (/\.csv$/.test(n) || (f.mimetype || '').includes('csv')) return 'data';
  if (/analys|report/.test(n)) return 'report';
  return 'file';
}
const KIND_COLOR = { image: 0xff8a65, email: 0xffd166, plan: 0x6be3bf, video: 0xff6fa8, file: 0xfff1d6, data: 0x3fc1d9, report: 0x3fc1d9 };

// ---- CSV → chart (the Analyst's results.csv is drawn as a bar chart)
function parseCSV(text) {
  const rows = [];
  for (const line of text.replace(/\r/g, '').split('\n')) {
    if (!line.trim()) continue;
    const cells = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ',' || ch === ';') { cells.push(cur.trim()); cur = ''; } else cur += ch;
    }
    cells.push(cur.trim()); rows.push(cells);
  }
  return rows;
}
const toNum = (v) => { const x = Number(String(v).replace(/[^0-9.,-]/g, '').replace(',', '.')); return Number.isFinite(x) && /\d/.test(String(v)) ? x : null; };
function chartFromCSV(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return null;
  const head = rows[0], body = rows.slice(1);
  let vc = -1;
  for (let c = 1; c < head.length && vc < 0; c++) if (body.filter((r) => toNum(r[c]) !== null).length >= Math.max(1, body.length * 0.6)) vc = c;
  if (vc < 0) return null;
  const unitCol = head.findIndex((h) => /unit/i.test(h));
  let data = body.filter((r) => toNum(r[vc]) !== null).map((r) => ({ label: String(r[0]).replace(/_/g, ' '), value: toNum(r[vc]), unit: unitCol >= 0 ? r[unitCol] : '' }));
  // Mixed units (e.g. €/m² and €/month) can't share one axis: keep the largest unit group, first-listed on ties.
  const groups = [];
  for (const d of data) { let g = groups.find((x) => x.unit === d.unit); if (!g) groups.push(g = { unit: d.unit, rows: [] }); g.rows.push(d); }
  if (groups.length > 1) data = groups.reduce((a, b) => (b.rows.length > a.rows.length ? b : a)).rows;
  data = data.sort((a, b) => b.value - a.value).slice(0, 14);
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.value)) || 1;
  const W = 520, lab = 150, rowH = 28, H = data.length * rowH + 30, bw = W - lab - 70;
  const unit = String(data[0].unit || head[vc]).replace(/EUR\s*/gi, '€').replace(/m2\b/g, 'm²');
  const bars = data.map((d, i) => {
    const y = 10 + i * rowH, w = Math.max(2, (d.value / max) * bw);
    return `<text x="${lab - 8}" y="${y + 17}" text-anchor="end" class="ch-l">${esc(d.label).slice(0, 22)}</text>
      <rect x="${lab}" y="${y + 4}" width="${w}" height="${rowH - 10}" rx="5" class="${i === 0 ? 'ch-b top' : 'ch-b'}"/>
      <text x="${lab + w + 6}" y="${y + 17}" class="ch-v">${d.value.toLocaleString('en-GB', { maximumFractionDigits: 2 })}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(head[vc])} by ${esc(head[0])}">${bars}<text x="${lab}" y="${H - 4}" class="ch-u">${esc(unit)}</text></svg>`;
}

async function addFile(f) {
  const kind = fileKind(f);
  const card = document.createElement('div');
  card.className = 'file';
  card.innerHTML = `${kind === 'image' && f.url ? `<img src="${esc(f.url)}" alt="">` : ''}${kind === 'data' ? '<div class="chart-wrap"></div>' : ''}
    <div class="meta"><span class="k">${kind}</span><b>${esc(f.name)}</b></div>${kind !== 'image' && kind !== 'data' ? '<div class="peek"></div>' : ''}`;
  card.addEventListener('click', () => openFile(f, kind));
  $('#desk').prepend(card);
  $('#desk-empty').hidden = true;
  if (kind === 'data' && f.url) {
    try { const svg = chartFromCSV(await (await fetch(f.url)).text()); if (svg) card.querySelector('.chart-wrap').innerHTML = svg; else card.querySelector('.chart-wrap').remove(); } catch { /* ignore */ }
    return;
  }
  if (kind !== 'image' && f.url && /\.(md|txt|csv|json|html?)$/i.test(f.name)) {
    try { card.querySelector('.peek').textContent = (await (await fetch(f.url)).text()).slice(0, 260); } catch { /* ignore */ }
  }
}

async function openFile(f, kind) {
  $('#viewer-title').textContent = f.name;
  const dl = $('#viewer-dl');
  dl.href = f.url || '#'; dl.setAttribute('download', f.name);
  const body = $('#viewer-body');
  body.innerHTML = '';
  if (!f.url) body.textContent = f.error || 'File unavailable.';
  else if (kind === 'image') body.innerHTML = `<img src="${esc(f.url)}" alt="">`;
  else if ((f.mimetype || '').includes('pdf') || /\.pdf$/i.test(f.name)) body.innerHTML = `<iframe src="${esc(f.url)}" style="width:100%;height:70vh;border:0"></iframe>`;
  else {
    const txt = await (await fetch(f.url)).text();
    if (kind === 'data') {
      const svg = chartFromCSV(txt);
      const rows = parseCSV(txt);
      body.innerHTML = (svg ? `<div class="chart-wrap big">${svg}</div>` : '') + '<table>' + rows.map((r, i) => '<tr>' + r.map((c) => i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`).join('') + '</tr>').join('') + '</table>';
    } else if (/\.md$/i.test(f.name) && window.marked) body.innerHTML = window.marked.parse(txt);
    else { const pre = document.createElement('pre'); pre.style.whiteSpace = 'pre-wrap'; pre.textContent = txt; body.appendChild(pre); }
  }
  $('#viewer').hidden = false;
}
$('#viewer-close').onclick = () => { $('#viewer').hidden = true; };
$('#viewer').onclick = (e) => { if (e.target.id === 'viewer') $('#viewer').hidden = true; };

async function deliver(files) {
  const fresh = files.filter((f) => !S.delivered.has(f.id || f.name));
  if (!fresh.length) return;
  city.focus('overview'); S.lastFocus = performance.now();
  caption(`${fresh.length} deliverable${fresh.length > 1 ? 's' : ''} arriving at your desk`, 'DELIVERED');
  tab('desk');
  for (const f of fresh) {
    S.delivered.add(f.id || f.name);
    const color = KIND_COLOR[fileKind(f)];
    await city.packet(new THREE.Vector3(0, 0, 5), 'home', color);
    city.addDeskItem(color);
    S.files++; stats();
    $('#desk-count').textContent = `${S.files}`;
    addFile(f);
    log('📦', `<b>${esc(f.name)}</b> delivered to your desk`, fileKind(f));
    await new Promise((r) => setTimeout(r, 250));
  }
}

async function askUser(questions, replayNext) {
  const role = ROLES.Courier;
  const w = city.spawn({ label: 'Courier', color: role.color, toward: 'home', role: 'Courier-ask' });
  w.setStatus(`📋 ${questions.length} question${questions.length > 1 ? 's' : ''} for you`);
  caption('The City Planner needs a few answers — a courier is on the way to your desk.', 'ASK');
  city.focus('home', 34); S.lastFocus = performance.now();
  await city.goTo(w, 'home');
  city.flash('home');
  showAsk(questions, replayNext, w);
}

function showAsk(questions, replayNext, courier) {
  const box = $('#ask-qs');
  box.innerHTML = '';
  const answers = questions.map(() => ({ pick: null, extra: '' }));
  questions.forEach((q, i) => {
    const d = document.createElement('div');
    d.className = 'q';
    d.innerHTML = `<p></p><div class="opts"></div><input placeholder="Other / add a detail…">`;
    d.querySelector('p').textContent = q.prompt;
    for (const o of q.options || []) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = o;
      b.onclick = () => { answers[i].pick = o; d.querySelectorAll('.opts button').forEach((x) => x.classList.toggle('on', x === b)); };
      d.querySelector('.opts').appendChild(b);
    }
    d.querySelector('input').oninput = (e) => { answers[i].extra = e.target.value; };
    box.appendChild(d);
  });
  if (replayNext) {
    const d = document.createElement('div');
    d.className = 'q';
    d.innerHTML = `<p>Recorded answer</p><input disabled>`;
    d.querySelector('input').value = replayNext.message;
    box.appendChild(d);
  }
  $('#composer').style.display = 'none';
  $('#ask').hidden = false;
  $('#ask-send').onclick = () => {
    $('#ask').hidden = true;
    $('#composer').style.display = '';
    courier?.setStatus('✓ answers', 'ok');
    if (courier) city.goHQ(courier).then(() => city.dismiss(courier));
    if (replayNext) {
      log('🧑', `<b>You:</b> ${esc(replayNext.message)}`, '', 'user');
      startReplay(S.replay.session, replayNext.turn);
      return;
    }
    const msg = questions.map((q, i) => {
      const a = [answers[i].pick, answers[i].extra].filter(Boolean).join(' — ') || 'No preference';
      return `${q.prompt} ${a}`;
    }).join('\n');
    send(msg);
  };
}

// ------------------------------------------------------------------ mission tracker
const STEPS = ['understand', 'research', 'create', 'review', 'deliver'];
const ROLE_STEP = { Scout: 'research', Researcher: 'research', Clerk: 'research', Writer: 'create', Artist: 'create', Producer: 'create', Reviewer: 'review', Courier: 'deliver', Operator: 'deliver', Analyst: 'create' };
const TAG_STEP = { PLAN: 'understand', ASK: 'understand', RESEARCH: 'research', DATA: 'research', WRITE: 'create', IMAGE: 'create', ANALYSE: 'create', CHART: 'create', REVIEW: 'review' };
const STATUS_TEXT = { idle: 'Idle', working: 'Working', waiting: 'Needs your input', done: 'Completed', error: 'Error' };
function setMission(goal) {
  const el = $('#mission-goal');
  el.textContent = goal || 'No mission yet. Pick an example below or write your own.';
  el.classList.toggle('muted', !goal);
}
function setStatus(state) {
  const el = $('#mission-status');
  el.className = 'status ' + state;
  el.textContent = STATUS_TEXT[state] || state;
}
function setStep(key, { wait = false, all = false } = {}) {
  const ix = all ? STEPS.length : Math.max(S.stepIx ?? -1, STEPS.indexOf(key));
  if (ix < 0) return;
  S.stepIx = ix;
  document.querySelectorAll('#steps li').forEach((li, i) => {
    li.classList.toggle('done', i < ix);
    li.classList.toggle('active', i === ix && !wait);
    li.classList.toggle('wait', i === ix && wait);
  });
}
function resetSteps() { S.stepIx = -1; document.querySelectorAll('#steps li').forEach((li) => li.classList.remove('done', 'active', 'wait')); }

// legend: what each landmark means
(() => {
  const ul = $('#legend-list');
  const items = [['⭐', 'Eiffel Tower', 'City Planner (lead agent)', 0x2fd5b5],
    ...['library', 'archive', 'observatory', 'workshop', 'writers', 'studio', 'townhall', 'vault', 'home'].map((k) => [BUILDINGS[k].icon, BUILDINGS[k].name, BUILDINGS[k].cap === 'You' ? 'Questions & deliveries' : BUILDINGS[k].cap, BUILDINGS[k].color])];
  for (const [icon, name, cap, color] of items) {
    const li = document.createElement('li');
    li.style.setProperty('--c', '#' + new THREE.Color(color).getHexString());
    li.innerHTML = `<i>${icon}</i><div><b></b> <span></span></div>`;
    li.querySelector('b').textContent = name;
    li.querySelector('span').textContent = '· ' + cap;
    ul.appendChild(li);
  }
  try { if (localStorage.getItem('agentcity-legend') === 'closed') $('#legend').open = false; } catch { /* ignore */ }
  $('#legend').addEventListener('toggle', () => { try { localStorage.setItem('agentcity-legend', $('#legend').open ? 'open' : 'closed'); } catch { /* ignore */ } });
})();

// ------------------------------------------------------------------ event router
function handle(ev) {
  switch (ev.type) {
    case 'run_started':
      S.turn = (S.turn || 0) + 1; // Cominty restarts step ids every turn
      if (ev.agent) {
        setLeadLabel(ev.agent);
        if (AGENT_LABEL[ev.agent] && S.agent !== ev.agent) { // follow-ups go to the agent that ran this thread
          S.agent = ev.agent;
          document.querySelectorAll('#agent-pick button').forEach((b) => b.classList.toggle('on', b.dataset.agent === ev.agent));
          renderChips();
        }
      }
      S.threadId = ev.thread_id;
      setMode(ev.mode);
      setStatus('working'); setStep('understand');
      city.planner.setStatus('Reading your goal…', 'think');
      city.setThinking(true);
      break;
    case 'waiting':
      caption('Waiting for a free agent…', 'QUEUE');
      break;
    case 'sandbox':
      if (ev.status === 'running') { caption('The City Planner is setting up its sandbox.', 'START'); log('⚙️', 'Sandbox ready for the City Planner', 'Cominty managed runtime'); }
      break;
    case 'thinking':
      if (ev.status === 'running') {
        S.thinking = true;
        city.setThinking(true);
        const t = ev.text && ev.text !== 'Reasoning' ? ev.text : 'Thinking…';
        city.planner.setStatus(`💭 ${short(t, 60)}`, 'think');
        if (S.agentsOut === 0) caption(`City Planner: ${t}`, 'THINK');
      } else {
        S.thinking = false;
        city.setThinking(false);
        city.planner.setStatus('');
      }
      break;
    case 'update': {
      const m = /^\s*\[([A-Z]+)\]\s*(.*)$/s.exec(ev.text || '');
      const tag = m ? m[1] : '';
      const text = m ? m[2] : ev.text;
      caption(text, tag || 'UPDATE');
      if (TAG_STEP[tag]) setStep(TAG_STEP[tag]);
      log(TAG_ICON[tag] || '💬', esc(text), tag ? `[${tag}]` : '');
      city.planner.setStatus(short(text, 70));
      if (TAG_BUILDING[tag]) { city.flash(TAG_BUILDING[tag]); focus(TAG_BUILDING[tag]); }
      break;
    }
    case 'tool':
      if (ev.status === 'running') { startWorker(ev); const st = ROLE_STEP[classify(ev.tool, ev.text).role]; if (st) setStep(st); }
      else finishWorker(ev);
      break;
    case 'upload':
      log('⬆️', `Uploading ${esc(ev.text)}`);
      break;
    case 'result': {
      S.thinking = false;
      city.setThinking(false);
      city.planner.setStatus('');
      if (ev.cost) log('🧾', 'Turn finished', `cost €${Number(ev.cost).toFixed(3)}`);
      const hasQ = ev.questions && ev.questions.length;
      if (ev.reply && !hasQ && window.marked) $('#reply').innerHTML = window.marked.parse(ev.reply);
      if (ev.reply && hasQ) log('📋', esc(short(ev.reply.split('\n')[0], 220)), 'City Planner');
      const chain = deliver(ev.files || []);
      if (hasQ) { setStatus('waiting'); setStep(STEPS[Math.max(0, S.stepIx)], { wait: true }); chain.then(() => askUser(ev.questions, ev.replay_next)); }
      else if (ev.status === 'success' || !ev.status) {
        chain.then(() => {
          caption(`Done. ${S.files} deliverable${S.files === 1 ? '' : 's'} on your desk — open them on the right.`, 'DONE');
          log('✅', '<b>Mission complete</b>', 'everything prepared — the agents only act after you confirm');
          setStatus('done'); setStep(null, { all: true });
        });
      }
      break;
    }
    case 'memory': {
      const ul = $('#memory');
      ul.innerHTML = '';
      for (const it of ev.items || []) {
        const li = document.createElement('li');
        li.innerHTML = `<code></code><span></span>`;
        li.querySelector('code').textContent = it.path;
        li.querySelector('span').textContent = it.purpose || '';
        ul.appendChild(li);
      }
      $('#mem-empty').hidden = !!(ev.items || []).length;
      if ((ev.items || []).length) {
        city.packet(new THREE.Vector3(0, 0, 5), 'vault', 0x6be3bf).then(() => city.flash('vault'));
        log('🧠', `Memory vault holds <b>${ev.items.length}</b> note${ev.items.length > 1 ? 's' : ''} about you`, `namespace ${esc(ev.namespace)}`);
      }
      break;
    }
    case 'other':
      log('•', esc(ev.name), esc(JSON.stringify(ev.data || '').slice(0, 120)));
      break;
    case 'error':
      caption(ev.message, 'ERROR', 'error');
      setStatus('error');
      log('⛔', esc(ev.message), '', 'err');
      break;
    case 'done':
      endRun();
      break;
  }
}

// ------------------------------------------------------------------ runs
function listen(runId) {
  let count = 0;
  const open = () => {
    const es = new EventSource(`/api/runs/${runId}/events?offset=${count}`);
    S.es = es;
    es.onmessage = (e) => {
      count++;
      const ev = JSON.parse(e.data);
      try { handle(ev); } catch (err) { console.error(err, ev); }
      if (ev.type === 'done') es.close();
    };
    es.onerror = () => {
      es.close();
      if (S.running) setTimeout(open, 1000);
    };
  };
  open();
}

function beginRun() {
  S.running = true;
  S.t0 = Date.now();
  $('#composer').classList.add('busy');
  $('#go').disabled = true;
}
function endRun() {
  if (!S.running) return;
  S.running = false;
  S.elapsed += Date.now() - S.t0;
  $('#composer').classList.remove('busy');
  $('#go').disabled = false;
  $('#goal').placeholder = 'Follow up on this mission… (or start a New mission)';
}

const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* ignore */ } },
};

async function send(message) {
  if (S.running) return;
  let passcode = store.get('agentcity-pass');
  if (S.locked && !passcode) {
    passcode = window.prompt('Live runs use real Cominty credits, so they are passcode-protected.\nEnter the passcode, or press Cancel and use “▶ Play” to watch a recorded real run.');
    if (!passcode) { caption('Press ▶ Play (bottom left) to watch a real recorded run.', 'REPLAY'); return; }
    store.set('agentcity-pass', passcode);
  }
  if (!S.threadId) { setMission(message); resetSteps(); }
  log('🧑', `<b>You:</b> ${esc(message).replace(/\n/g, '<br>')}`, '', 'user');
  $('#composer').classList.add('used');
  beginRun();
  caption('Sending your goal to the City Planner…', 'GOAL');
  city.focus('hq', 52); S.lastFocus = performance.now();
  try {
    const r = await fetch('/api/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, thread_id: S.threadId, passcode, agent: S.agent }) });
    const j = await r.json();
    if (r.status === 403) { store.set('agentcity-pass', null); throw new Error('Wrong passcode. Live runs are protected; press ▶ Play to watch a recorded run.'); }
    if (!r.ok) throw new Error(j.detail || j.error || r.statusText);
    listen(j.run_id);
  } catch (e) {
    handle({ type: 'error', message: String(e.message || e) });
    endRun();
  }
}

async function startReplay(session, turn = 0) {
  if (turn === 0) reset();
  S.replay = { session, turn };
  setMode('replay');
  beginRun();
  const r = await fetch('/api/replay', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session, turn, speed: Number($('#speed').value) }) });
  const j = await r.json();
  if (!r.ok) { handle({ type: 'error', message: j.detail || 'replay failed' }); endRun(); return; }
  if (turn === 0) {
    const rec = S.recordings.find((x) => x.id === session);
    log('🧑', `<b>You:</b> ${esc(rec?.title || session)}`, 'recorded run', 'user');
    setMission(rec?.goal || rec?.title || session); resetSteps();
  }
  listen(j.run_id);
}

function reset() {
  S.threadId = null; S.replay = null; S.elapsed = 0; S.agentsOut = 0; S.tools = 0; S.searches = 0; S.files = 0;
  S.roleCount = {}; S.delivered.clear();
  for (const rec of S.workers.values()) city.dismiss(rec.w);
  S.workers.clear();
  renderCrew();
  city.clearDesk();
  $('#log').innerHTML = ''; $('#desk').innerHTML = ''; $('#reply').innerHTML = ''; $('#desk-count').textContent = '';
  $('#desk-empty').hidden = false; $('#ask').hidden = true; $('#composer').style.display = '';
  $('#goal').placeholder = 'Describe your mission — e.g. “Compare 3 neighbourhoods near my school and write to landlords.”';
  setMission(''); setStatus('idle'); resetSteps(); setLeadLabel(S.agent || 'planner');
  $('#composer').classList.remove('used');
  stats(); tab('log'); city.focus('overview');
  caption('Give the agents a mission. Watch them get it done.');
  setMode(S.mode);
}

function setMode(m) {
  const pill = $('#mode');
  const labels = { live: 'Live · Cominty', mock: 'Mock mode · no API key', replay: 'Replay · recorded run' };
  pill.textContent = labels[m] || m;
  pill.className = 'pill ' + m;
}

// ------------------------------------------------------------------ UI wiring
$('#composer').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('#goal').value.trim();
  if (!v || S.running) return;
  if (S.replay) reset();
  $('#goal').value = '';
  send(v);
});
$('#goal').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#composer').requestSubmit(); }
});
$('#goal').addEventListener('input', (e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(140, e.target.scrollHeight) + 'px'; });
S.agent = 'planner';
function setLeadLabel(key) {
  const el = city.planner.el.querySelector('.wl-name');
  if (el) el.textContent = AGENT_LABEL[key] || 'City Planner';
}
function renderChips() {
  const box = $('#chips');
  box.innerHTML = '';
  for (const ex of EXAMPLES[S.agent] || EXAMPLES.planner) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = ex.length > 64 ? ex.slice(0, 62) + '…' : ex; b.title = ex;
    b.onclick = () => { $('#goal').value = ex; $('#goal').focus(); };
    box.appendChild(b);
  }
}
function setAgent(key) {
  if (S.running) return;
  if (S.agent !== key) { S.threadId = null; }
  S.agent = key;
  document.querySelectorAll('#agent-pick button').forEach((b) => b.classList.toggle('on', b.dataset.agent === key));
  setLeadLabel(key);
  renderChips();
  $('#goal').placeholder = key === 'analyst'
    ? 'Ask a data question, e.g. “Which Rouen area fits a €600 studio? Chart rent per m².”'
    : 'Describe your mission, e.g. “Compare 3 neighbourhoods near my school and write to landlords.”';
}
document.querySelectorAll('#agent-pick button').forEach((b) => b.addEventListener('click', () => setAgent(b.dataset.agent)));
renderChips();
$('#btn-director').onclick = (e) => { city.director = !city.director; e.currentTarget.classList.toggle('on', city.director); };
$('#btn-overview').onclick = () => { city.userUntil = 0; city.focus('overview'); };
const TIMES_ORDER = ['golden', 'night', 'day'];
let timeIx = 0;
$('#btn-time').onclick = (e) => { timeIx = (timeIx + 1) % 3; e.currentTarget.querySelector('span').textContent = city.setTime(TIMES_ORDER[timeIx]).replace(/^\S+\s/, ''); };
$('#btn-new').onclick = () => { if (!S.running) reset(); };
$('#play').onclick = () => { if (!S.running && $('#rec').value) startReplay($('#rec').value, 0); };

(async () => {
  try {
    const cfg = await (await fetch('/api/config')).json();
    S.mode = cfg.mode;
    for (const a of cfg.agents || []) {
      const b = document.querySelector(`#agent-pick button[data-agent="${a.key}"]`);
      if (b && !a.available) { b.disabled = true; b.title = `${a.name} is not connected yet: add its agent id to .env`; }
    }
    S.locked = !!cfg.locked;
    S.recordings = cfg.recordings || [];
    setMode(cfg.mode);
    const sel = $('#rec');
    for (const r of S.recordings) {
      const o = document.createElement('option');
      o.value = r.id; o.textContent = `${r.agent === 'analyst' ? 'Analyst · ' : ''}${r.title}`;
      sel.appendChild(o);
    }
    $('#replaybar').hidden = !S.recordings.length;
    if (cfg.mode === 'mock') log('🧪', 'Running in <b>mock mode</b> — scripted sample agent.', 'add your Cominty key in .env for real agents');
    else log('🟢', 'Connected to a live <b>Cominty</b> managed agent.', S.locked ? 'live runs are passcode-protected' : cfg.agent_id);
    if (S.recordings.length) {
      log('🎬', 'Use <b>Watch a real recorded run</b> (bottom left) to replay a live Cominty session.', 'recorded from a live Cominty session');
      if (S.locked) caption('Press Play (bottom left) to watch the agents do a real task.', 'START');
    }
  } catch (e) {
    setMode('offline');
  }
})();
