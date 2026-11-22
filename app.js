'use strict';
/* Proyecto Local — PWA sin dependencias. Datos en localStorage (montos en centavos enteros).
   Seguridad: sin innerHTML (todo vía h()), CSP estricta en index.html, validación en formularios e importación. */

const KEY = 'proyectoLocal.v2', KEY_V1 = 'proyectoLocal.v1';
const SUBS = ['Comunitario', 'Religioso / Iglesia', 'Deportivo', 'Educativo', 'Negocio', 'Familiar', 'Evento', 'Otro'];
const NAV = [['proyectos', 'Proyectos'], ['resumen', 'Resumen'], ['miembros', 'Miembros'], ['grupos', 'Grupos'], ['conta', 'Contabilidad'], ['reportes', 'Reportes']];
const ICONS = {
  proyectos: [['path', { d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }]],
  resumen: [['path', { d: 'M5 20V11M12 20V4M19 20v-6' }]],
  miembros: [['circle', { cx: 12, cy: 8, r: 4 }], ['path', { d: 'M4 21a8 8 0 0 1 16 0' }]],
  grupos: [['circle', { cx: 9, cy: 8, r: 3.5 }], ['path', { d: 'M2.5 20a6.5 6.5 0 0 1 13 0' }], ['circle', { cx: 17, cy: 9, r: 2.5 }], ['path', { d: 'M17 14.5a5 5 0 0 1 4.5 5' }]],
  conta: [['path', { d: 'M12 3v18' }], ['path', { d: 'M16.5 7.5C16.5 5.8 14.5 4.5 12 4.5S7.5 5.8 7.5 7.5 9.5 10.4 12 10.8s4.5 1.2 4.5 3.2-2 3.5-4.5 3.5-4.5-1.3-4.5-3' }]],
  reportes: [['path', { d: 'M7 3h7l5 5v13H7z' }], ['path', { d: 'M14 3v5h5M10 13h6M10 17h6' }]]
};
function icon(name) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  const base = { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' };
  for (const [k, v] of Object.entries(base)) svg.setAttribute(k, v);
  for (const [tag, attrs] of ICONS[name]) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.append(el);
  }
  return svg;
}
const CATS = ['Reparación de calles', 'Ornamentación', 'Limpieza', 'Seguridad', 'Evento', 'Otro'];
const catList = () => [...new Set([...CATS, ...db.identities.flatMap(i => i.projects).map(x => x.cat).filter(Boolean)])];
const STATES = [['pendiente', 'Pendiente'], ['curso', 'En curso'], ['hecha', 'Hecha']];
const subList = () => [...new Set([...SUBS, ...db.identities.flatMap(i => i.projects).map(x => x.sub).filter(Boolean)])];

/* ---------- utilidades ---------- */
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const today = () => new Date().toLocaleDateString('en-CA');
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const fmtDate = s => (isDate(s) ? s.split('-').reverse().join('/') : '');
const usd = c => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const plain = c => (c / 100).toFixed(2);
function toCents(str) {
  const s = String(str).replace(/[\s$,]/g, '');
  const m = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  return parseInt(m[1], 10) * 100 + parseInt(((m[2] || '') + '00').slice(0, 2), 10);
}
const sum = a => a.reduce((t, x) => t + x, 0);
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- datos ---------- */
const ATT_MAX = 1500000; // bytes máx. por comprobante (localStorage ~5 MB en total)
const ATT_RE = /^data:((?:image\/(?:jpeg|png|webp|gif))|application\/pdf|text\/plain|application\/msword|application\/vnd\.openxmlformats-officedocument\.(?:wordprocessingml\.document|spreadsheetml\.sheet)|application\/vnd\.ms-excel);base64,[A-Za-z0-9+/]+=*$/;
function cleanAtt(a) {
  if (!a || typeof a.data !== 'string' || a.data.length > ATT_MAX * 1.4 || !ATT_RE.test(a.data)) return null;
  return { name: (typeof a.name === 'string' ? a.name : 'comprobante').slice(0, 120), data: a.data };
}
const arr = a => (Array.isArray(a) ? a : []);
// v1 (proyectos con grupos/miembros propios) → v2: una identidad "Mi comunidad" que fusiona grupos y miembros por nombre
function migrateV1(projects) {
  const key = v => String(v || '').trim().toLowerCase();
  const idn = { id: uid(), name: 'Mi comunidad', desc: '', groups: [], members: [], projects: [] };
  const gByName = new Map(), mByName = new Map();
  for (const p of projects) {
    const gmap = new Map(), mmap = new Map();
    for (const g of arr(p && p.groups)) {
      const k = key(g.name); if (!k) continue;
      if (!gByName.has(k)) { gByName.set(k, g.id); idn.groups.push(g); }
      gmap.set(g.id, gByName.get(k));
    }
    for (const m of arr(p && p.members)) {
      const k = key(m.name); if (!k) continue;
      if (!mByName.has(k)) { mByName.set(k, m.id); idn.members.push({ ...m, gid: gmap.get(m.gid) || '' }); }
      mmap.set(m.id, mByName.get(k));
    }
    idn.projects.push({ ...p, entries: arr(p && p.entries).map(e => ({ ...e, mid: mmap.get(e.mid) || '' })) });
  }
  return idn;
}
function sanitize(d) {
  const s = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  const id = v => (typeof v === 'string' && v ? v.slice(0, 64) : uid());
  const cents = v => (Number.isSafeInteger(v) && v >= 0 && v < 1e14 ? v : 0);
  const src = d && Array.isArray(d.identities) ? d.identities : (d && arr(d.projects).length ? [migrateV1(d.projects)] : []);
  const out = { v: 2, identities: [] };
  for (const i of src) {
    const groups = arr(i.groups).map(g => ({ id: id(g.id), name: s(g.name, 80), desc: s(g.desc, 500) }));
    const gids = new Set(groups.map(g => g.id));
    const members = arr(i.members).map(m => ({
      id: id(m.id), name: s(m.name, 80), phone: s(m.phone, 20), notes: s(m.notes, 1000),
      gid: gids.has(m.gid) ? m.gid : '', active: m.active !== false
    }));
    const mids = new Set(members.map(m => m.id));
    const ca = o => ({ gids: arr(o && o.gids).filter(x => gids.has(x)), pids: arr(o && o.pids).filter(x => mids.has(x)) });
    const projects = arr(i.projects).map(p => {
      const tasks = arr(p.tasks).slice(0, 200).map(k => ({ id: id(k && k.id), name: s(k && k.name, 120) || 'Tarea', state: STATES.some(x => x[0] === (k && k.state)) ? k.state : 'pendiente', budget: cents(k && k.budget), ...ca(k) }));
      const tids = new Set(tasks.map(k => k.id));
      return {
        id: id(p.id), name: s(p.name, 80) || 'Sin nombre', sub: s(p.sub, 60), desc: s(p.desc, 2000), cat: s(p.cat, 60),
        start: isDate(p.start) ? p.start : '', end: isDate(p.end) ? p.end : '', quota: cents(p.quota),
        assign: ca(p.assign), tasks,
        entries: arr(p.entries).map(e => ({
          id: id(e.id), date: isDate(e.date) ? e.date : today(), type: e.type === 'gasto' ? 'gasto' : 'ingreso',
          kind: e.type !== 'gasto' && (e.kind === 'especie' || e.kind === 'trabajo') ? e.kind : 'dinero',
          concept: s(e.concept, 120), cid: s(e.cid, 64), amount: cents(e.amount), mid: mids.has(e.mid) ? e.mid : '',
          tid: tids.has(e.tid) ? e.tid : '', notes: s(e.notes, 1000),
          lines: arr(e.lines).slice(0, 100).map(l => ({ d: s(l && l.d, 120), a: cents(l && l.a), tid: tids.has(l && l.tid) ? l.tid : '' })),
          att: cleanAtt(e.att)
        }))
      };
    });
    // conceptos guardados: si la identidad no los tenía, se derivan de los registros existentes
    const derive = !Array.isArray(i.concepts);
    const concepts = derive ? [] : i.concepts.map(c => ({ id: id(c && c.id), name: s(c && c.name, 120), type: c && c.type === 'gasto' ? 'gasto' : 'ingreso' })).filter(c => c.name);
    const cById = new Map(concepts.map(c => [c.id, c])), cByKey = new Map(concepts.map(c => [c.type + '|' + c.name.toLowerCase(), c]));
    for (const p of projects) for (const e of p.entries) {
      if (cById.has(e.cid)) continue;
      e.cid = '';
      if (!derive || !e.concept) continue;
      const k = e.type + '|' + e.concept.toLowerCase();
      let c = cByKey.get(k);
      if (!c) { c = { id: uid(), name: e.concept, type: e.type }; concepts.push(c); cByKey.set(k, c); cById.set(c.id, c); }
      e.cid = c.id;
    }
    out.identities.push({ id: id(i.id), name: s(i.name, 80) || 'Sin nombre', desc: s(i.desc, 2000), groups, members, concepts, projects });
  }
  for (const i of out.identities) i.projects.forEach(p => linkProject(p, i));
  return out;
}
// Cada proyecto ve los grupos/miembros activos de su identidad (propiedades no enumerables: no se guardan en JSON)
function linkProject(p, i) {
  Object.defineProperties(p, {
    idn: { value: i, configurable: true, writable: true },
    members: { get: () => i.members.filter(m => m.active !== false), configurable: true },
    groups: { get: () => i.groups, configurable: true }
  });
  return p;
}
function load() {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem(KEY_V1); // v1 se conserva intacto como respaldo
    return sanitize(JSON.parse(raw));
  } catch { return sanitize(null); }
}
let db = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch { toast('No se pudo guardar: almacenamiento lleno o bloqueado'); }
}
const ui = { iid: null, pid: null, tab: 'proyectos', lastTab: '', ftype: '', q: '', rep: { kind: 'conta', from: '', to: '', act: '' } };
const ident = () => db.identities.find(i => i.id === ui.iid);
const proj = () => { const i = ident(); return i ? i.projects.find(p => p.id === ui.pid) : undefined; };
function identityView(i) { // vista sin proyecto: solo para gestionar personas/grupos de una identidad vacía
  return linkProject({ virtual: true, name: i.name, sub: '', desc: '', entries: [], tasks: [], assign: { gids: [], pids: [] }, quota: 0 }, i);
}
const isCash = e => e.kind !== 'especie' && e.kind !== 'trabajo'; // aportes en especie/trabajo no entran a caja
const totals = (entries) => {
  const cash = entries.filter(isCash);
  const i = sum(cash.filter(e => e.type === 'ingreso').map(e => e.amount));
  const g = sum(cash.filter(e => e.type === 'gasto').map(e => e.amount));
  return { i, g, b: i - g };
};
const memberTotal = (p, mid, from, to) => sum(inRange(p.entries, from, to).filter(e => e.mid === mid && e.type === 'ingreso' && isCash(e)).map(e => e.amount));
const inRange = (list, from, to) => list.filter(e => (!from || e.date >= from) && (!to || e.date <= to));

/* ---------- widgets de formulario: líneas de gasto y comprobante ---------- */
function linesWidget(init, inputs, tasks) {
  const box = h('div', { class: 'lines' });
  const total = h('div', { class: 'mute' });
  const rows = [];
  const sync = () => {
    const used = rows.filter(r => r.d.value.trim() || r.a.value.trim());
    const t = sum(used.map(r => toCents(r.a.value.trim()) || 0));
    total.textContent = used.length ? 'Total de líneas: ' + usd(t) : '';
    const m = inputs.amount;
    if (m) { m.readOnly = used.length > 0; if (used.length) m.value = plain(t); }
  };
  const add = (l) => {
    const r = {
      d: h('input', { type: 'text', maxlength: 120, placeholder: 'Detalle', 'aria-label': 'Detalle de línea', autocomplete: 'off' }),
      a: h('input', { type: 'text', inputmode: 'decimal', maxlength: 15, placeholder: '0.00', 'aria-label': 'Monto de línea', autocomplete: 'off' })
    };
    r.t = tasks && tasks.length ? h('select', { 'aria-label': 'Actividad de la línea' }, [{ v: '', l: 'Sin tarea' }, ...tasks].map(o => h('option', { value: o.v }, o.l))) : null;
    if (l) { r.d.value = l.d; r.a.value = plain(l.a); if (r.t) r.t.value = l.tid || ''; }
    r.node = h('div', { class: 'line' }, r.d, r.a, r.t,
      h('button', { type: 'button', class: 'btn sm', 'aria-label': 'Quitar línea', onclick: () => { rows.splice(rows.indexOf(r), 1); r.node.remove(); sync(); } }, '✕'));
    r.d.addEventListener('input', sync); r.a.addEventListener('input', sync);
    rows.push(r); box.append(r.node);
  };
  (init || []).forEach(add);
  const node = h('div', null, box, total,
    h('button', { type: 'button', class: 'btn sm', onclick: () => { add(); rows[rows.length - 1].d.focus(); } }, '+ Agregar línea'));
  const get = () => {
    const val = [];
    for (const [i, r] of rows.entries()) {
      const d = r.d.value.trim(), a = r.a.value.trim();
      if (!d && !a) continue;
      const c = toCents(a);
      if (!d || c == null || c <= 0) return { err: `Línea ${i + 1}: detalle y monto válido (ej. 12.50)` };
      val.push({ d, a: c, tid: r.t ? r.t.value : '' });
    }
    return { val };
  };
  return { node, get, sync };
}
function checksWidget(f, init) {
  const sel = new Set(init || []);
  const boxes = f.options.map(o => {
    const cb = h('input', { type: 'checkbox', value: o.v }); cb.checked = sel.has(o.v);
    return h('label', { class: 'chk' }, cb, o.l);
  });
  return { node: h('div', null, boxes.length ? boxes : h('span', { class: 'mute' }, 'Sin opciones disponibles')), get: () => ({ val: boxes.map(l => l.firstChild).filter(c => c.checked).map(c => c.value) }) };
}
function fileWidget(init, err) {
  let cur = init || null;
  const info = h('div', { class: 'row' });
  const inp = h('input', { type: 'file', accept: 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt', 'aria-label': 'Comprobante' });
  const draw = () => info.replaceChildren(...(cur ? [
    h('span', { class: 'tag' }, 'Adjunto: ' + cur.name),
    h('button', { type: 'button', class: 'btn sm', onclick: () => openAtt(cur) }, 'Ver'),
    h('button', { type: 'button', class: 'btn sm danger', onclick: () => { cur = null; inp.value = ''; draw(); } }, 'Quitar')] : []));
  inp.addEventListener('change', async () => {
    err.textContent = '';
    const f = inp.files[0]; if (!f) return;
    try { cur = await readAtt(f); } catch (ex) { err.textContent = ex.message; inp.value = ''; }
    draw();
  });
  draw();
  return { node: h('div', null, inp, info), get: () => ({ val: cur }) };
}
async function readAtt(f) {
  let blob = f, type = f.type;
  if (/^image\/(jpeg|png|webp)$/.test(type)) { // reduce fotos para no llenar el almacenamiento
    try {
      const bmp = await createImageBitmap(f);
      const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
      blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.75)); type = 'image/jpeg';
    } catch { blob = f; }
  }
  if (!blob || blob.size > ATT_MAX) throw new Error('Archivo muy grande (máx. 1.5 MB)');
  const data = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(new Blob([blob], { type })); });
  const a = cleanAtt({ name: f.name, data });
  if (!a) throw new Error('Formato no admitido (use JPG, PNG, PDF, DOC/XLS o TXT)');
  return a;
}
function openAtt(a) {
  const m = /^data:([^;]+);base64,(.*)$/.exec(a.data); if (!m) return;
  const bin = atob(m[2]), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([u], { type: m[1] }));
  const view = /^image\/|\/pdf$/.test(m[1]);
  const el = h('a', { href: url, target: view ? '_blank' : null, rel: 'noopener', download: view ? null : a.name });
  document.body.append(el); el.click(); el.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* ---------- formularios (modal) ---------- */
function openForm({ title, fields, values = {}, submit = 'Guardar', onSave, onDelete, validate, onClose }) {
  const dlg = h('dialog', { class: 'modal', 'aria-label': title });
  const err = h('p', { class: 'err', role: 'alert' });
  const inputs = {};
  const form = h('form', { novalidate: true }, h('h2', null, title));
  for (const f of fields) {
    let inp;
    if (f.type === 'lines' || f.type === 'file' || f.type === 'checks') {
      inputs[f.k] = f.type === 'lines' ? linesWidget(values[f.k], inputs, f.tasks) : f.type === 'file' ? fileWidget(values[f.k], err) : checksWidget(f, values[f.k]);
      form.append(h('label', null, f.label), inputs[f.k].node);
      continue;
    }
    if (f.type === 'textarea') inp = h('textarea', { rows: 3, maxlength: f.max || 1000 });
    else if (f.type === 'select') inp = h('select', null, f.options.map(o => h('option', { value: o.v }, o.l)));
    else inp = h('input', {
      type: f.type === 'money' ? 'text' : f.type, inputmode: f.type === 'money' ? 'decimal' : null,
      maxlength: f.max || 120, placeholder: f.ph || null, autocomplete: 'off'
    });
    const v = values[f.k];
    inp.value = f.type === 'money' ? (v != null ? plain(v) : '') : (v ?? f.def ?? '');
    inputs[f.k] = inp;
    const id = 'f_' + f.k;
    inp.id = id;
    form.append(h('label', { for: id }, f.label + (f.req ? ' *' : '')), inp);
    if (f.custom) { // opción "crear nueva": muestra un campo de texto
      const inp2 = h('input', { type: 'text', maxlength: 40, hidden: true, placeholder: 'Nombre de la nueva opción', 'aria-label': 'Nueva opción', autocomplete: 'off' });
      inputs[f.k + '_new'] = inp2;
      inp.addEventListener('change', () => { inp2.hidden = inp.value !== '__new__'; if (!inp2.hidden) inp2.focus(); });
      form.append(inp2);
    }
  }
  for (const f of fields) if (inputs[f.k].sync) inputs[f.k].sync();
  const close = () => { dlg.close(); dlg.remove(); };
  form.append(err, h('div', { class: 'actions' },
    onDelete && h('button', { type: 'button', class: 'btn danger', onclick: () => { if (confirm('¿Eliminar definitivamente? No se puede deshacer.')) { close(); onDelete(); } } }, 'Eliminar'),
    h('button', { type: 'button', class: 'btn', onclick: close }, 'Cancelar'),
    h('button', { type: 'submit', class: 'btn primary' }, submit)));
  form.addEventListener('submit', ev => {
    ev.preventDefault();
    const data = {};
    for (const f of fields) {
      if (f.type === 'lines' || f.type === 'file' || f.type === 'checks') {
        const r = inputs[f.k].get();
        if (r.err) return void (err.textContent = r.err);
        data[f.k] = r.val; continue;
      }
      let v = inputs[f.k].value.trim();
      if (f.custom && v === '__new__') {
        v = inputs[f.k + '_new'].value.trim().replace(/\s+/g, ' ');
        if (!v) return void (err.textContent = 'Escriba el nombre de la nueva opción');
      }
      if (f.req && !v) return void (err.textContent = `Falta: ${f.label}`);
      if (f.type === 'money') {
        if (!f.req && v === '') { data[f.k] = 0; continue; }
        const c = toCents(v);
        if (c == null || (f.req && c <= 0)) return void (err.textContent = `${f.label}: monto inválido (ej. 25.50)`);
        v = c;
      }
      if (f.type === 'tel' && v && !/^[0-9+()\-\s.]{5,20}$/.test(v)) return void (err.textContent = 'Teléfono inválido');
      if (f.type === 'date' && (v || f.req) && !isDate(v)) return void (err.textContent = `${f.label}: fecha inválida`);
      data[f.k] = v;
    }
    const bad = validate && validate(data);
    if (bad) return void (err.textContent = bad);
    close(); onSave(data);
  });
  dlg.append(form);
  dlg.addEventListener('close', () => dlg.remove());
  if (onClose) dlg.addEventListener('close', onClose);
  document.body.append(dlg);
  dlg.showModal();
  const first = form.querySelector('input,textarea,select'); first && first.focus();
}

/* ---------- acciones ---------- */
function editProject(p) {
  const isNew = !p;
  openForm({
    title: isNew ? 'Nuevo proyecto' : 'Editar proyecto',
    fields: [
      { k: 'name', label: 'Nombre del proyecto', type: 'text', req: true, max: 80 },
      { k: 'cat', label: 'Tipo de actividad', type: 'select', custom: true, options: [{ v: '', l: '— Sin definir —' }, ...catList().map(s => ({ v: s, l: s })), { v: '__new__', l: '＋ Crear nuevo tipo…' }] },
      { k: 'sub', label: 'Subcategoría', type: 'select', custom: true, options: [...subList().map(s => ({ v: s, l: s })), { v: '__new__', l: '＋ Crear nueva subcategoría…' }] },
      { k: 'start', label: 'Fecha del proyecto', type: 'date' },
      { k: 'end', label: 'Fecha de cierre (opcional, solo si dura varios días)', type: 'date' },
      { k: 'quota', label: 'Cuota por persona asignada (USD, opcional)', type: 'money', ph: '0.00' },
      { k: 'desc', label: 'Descripción', type: 'textarea', max: 2000 }
    ],
    values: p || {},
    validate: d => (d.start && d.end && d.end < d.start ? 'La fecha de cierre es anterior a la de inicio' : ''),
    onSave: d => {
      if (isNew) { const I = ident(), n = linkProject({ id: uid(), entries: [], tasks: [], assign: { gids: [], pids: [] }, ...d }, I); I.projects.push(n); ui.pid = n.id; ui.tab = 'resumen'; }
      else Object.assign(p, d);
      save(); render();
    },
    onDelete: isNew ? null : () => { ident().projects = ident().projects.filter(x => x !== p); ui.pid = null; save(); render(); toast('Proyecto eliminado'); }
  });
}
function unassign(I, kind, id) { // quita un grupo/persona de las asignaciones de proyectos y tareas
  for (const q of I.projects) for (const o of [q.assign, ...q.tasks]) o[kind] = o[kind].filter(x => x !== id);
}
function editMember(p, m) {
  const isNew = !m;
  openForm({
    title: isNew ? 'Nuevo miembro' : 'Editar miembro',
    fields: [
      { k: 'name', label: 'Nombre', type: 'text', req: true, max: 80 },
      { k: 'phone', label: 'Teléfono', type: 'tel', max: 20 },
      { k: 'gid', label: 'Grupo asignado', type: 'select', options: [{ v: '', l: '— Sin grupo —' }, ...p.groups.map(g => ({ v: g.id, l: g.name }))] },
      { k: 'notes', label: 'Notas', type: 'textarea' }
    ],
    values: m || {},
    onSave: d => { if (isNew) p.idn.members.push({ id: uid(), active: true, ...d }); else Object.assign(m, d); save(); render(); },
    onDelete: isNew ? null : () => { unassign(p.idn, 'pids', m.id); p.idn.members = p.idn.members.filter(x => x !== m); p.idn.projects.forEach(q => q.entries.forEach(e => { if (e.mid === m.id) e.mid = ''; })); save(); render(); }
  });
}
function editGroup(p, g) {
  const isNew = !g;
  openForm({
    title: isNew ? 'Nuevo grupo' : 'Editar grupo',
    fields: [
      { k: 'name', label: 'Nombre del grupo', type: 'text', req: true, max: 80 },
      { k: 'desc', label: 'Descripción', type: 'textarea', max: 500 }
    ],
    values: g || {},
    onSave: d => { if (isNew) p.idn.groups.push({ id: uid(), ...d }); else Object.assign(g, d); save(); render(); },
    onDelete: isNew ? null : () => { unassign(p.idn, 'gids', g.id); p.idn.groups = p.idn.groups.filter(x => x !== g); p.idn.members.forEach(m => { if (m.gid === g.id) m.gid = ''; }); save(); render(); }
  });
}
function editEntry(p, e, type, mid) {
  const isNew = !e;
  type = e ? e.type : type;
  const I = p.idn;
  const names = I.concepts.filter(c => c.type === type).map(c => c.name).sort((a, b) => a.localeCompare(b, 'es'));
  const cur = e ? e.concept : (mid ? 'Aportación' : '');
  if (cur && !names.includes(cur)) names.push(cur);
  const taskOpts = p.tasks.map(k => ({ v: k.id, l: k.name }));
  const fields = [
    { k: 'date', label: 'Fecha', type: 'date', req: true },
    { k: 'concept', label: 'Concepto (elija de la lista o cree uno nuevo)', type: 'select', custom: true, req: true, options: [{ v: '', l: '— Elegir concepto —' }, ...names.map(n => ({ v: n, l: n })), { v: '__new__', l: '＋ Crear nuevo concepto…' }] },
    { k: 'amount', label: type === 'ingreso' ? 'Monto / valor estimado (USD)' : 'Monto (USD)', type: 'money', ph: '0.00' }
  ];
  if (type === 'ingreso') fields.push(
    { k: 'kind', label: 'Tipo de aporte', type: 'select', options: [{ v: 'dinero', l: 'Dinero' }, { v: 'especie', l: 'En especie (materiales)' }, { v: 'trabajo', l: 'Trabajo / mano de obra' }] },
    { k: 'mid', label: 'Miembro (aportación)', type: 'select', options: [{ v: '', l: '— Ninguno —' }, ...p.members.map(m => ({ v: m.id, l: m.name }))] });
  if (taskOpts.length) fields.push({ k: 'tid', label: 'Actividad (tarea del proyecto)', type: 'select', options: [{ v: '', l: '— Sin tarea (general) —' }, ...taskOpts] });
  if (type === 'gasto') fields.push({ k: 'lines', label: 'Desglose de la factura (opcional: si agrega líneas, el monto es la suma)', type: 'lines', tasks: taskOpts });
  fields.push({ k: 'notes', label: 'Notas', type: 'textarea', max: 1000 });
  if (type === 'gasto') fields.push({ k: 'att', label: 'Comprobante (JPG, PNG, PDF u otro; máx. 1.5 MB)', type: 'file' });
  openForm({
    title: (isNew ? 'Nuevo ' : 'Editar ') + type,
    fields,
    values: e || { date: today(), mid: mid || '', concept: mid ? 'Aportación' : '', kind: 'dinero', tid: '' },
    validate: d => ((d.lines && d.lines.length) || (d.kind && d.kind !== 'dinero') || d.amount > 0 ? '' : 'Monto: debe ser mayor que 0'),
    onSave: d => {
      d.type = type;
      if (type === 'gasto') { d.mid = ''; d.kind = 'dinero'; } else { d.lines = []; d.att = null; }
      if (d.lines.length) d.amount = sum(d.lines.map(l => l.a));
      if (d.tid === undefined) d.tid = e ? e.tid : '';
      let c = I.concepts.find(x => x.type === type && x.name.toLowerCase() === d.concept.toLowerCase());
      if (!c) { c = { id: uid(), name: d.concept, type }; I.concepts.push(c); }
      d.concept = c.name; d.cid = c.id;
      if (isNew) p.entries.push({ id: uid(), ...d }); else Object.assign(e, d);
      save(); render();
      if ((p.start && d.date < p.start) || (p.end && d.date > p.end)) toast('Aviso: la fecha está fuera del período del proyecto');
    },
    onDelete: isNew ? null : () => { p.entries = p.entries.filter(x => x !== e); save(); render(); }
  });
}
const conceptUses = (I, c) => sum(I.projects.map(q => q.entries.filter(e => e.cid === c.id).length));
function manageConcepts(I) {
  const dlg = h('dialog', { class: 'modal', 'aria-label': 'Conceptos' });
  const close = () => { dlg.close(); dlg.remove(); };
  const edit = (c, type) => { close(); editConcept(I, c, type); };
  const sec = (type, label) => h('div', null, h('h3', null, label),
    I.concepts.filter(c => c.type === type).sort((a, b) => a.name.localeCompare(b.name, 'es')).map(c =>
      h('div', { class: 'item' }, h('span', { class: 'grow' }, c.name), h('span', { class: 'mute' }, conceptUses(I, c) + ' usos'), h('button', { class: 'btn sm', onclick: () => edit(c, type) }, 'Editar'))),
    !I.concepts.some(c => c.type === type) && h('p', { class: 'mute' }, 'Sin conceptos'),
    h('button', { class: 'btn sm', onclick: () => edit(null, type) }, '+ Concepto'));
  dlg.append(h('h2', null, 'Conceptos guardados'),
    h('p', { class: 'mute' }, 'Se eligen de una lista al registrar ingresos y gastos. Renombrar un concepto actualiza los registros que lo usan.'),
    sec('ingreso', 'Ingresos'), sec('gasto', 'Gastos'),
    h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: close }, 'Cerrar')));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg); dlg.showModal();
}
function editConcept(I, c, type) {
  const isNew = !c;
  openForm({
    title: (isNew ? 'Nuevo concepto de ' : 'Editar concepto de ') + type,
    fields: [{ k: 'name', label: 'Nombre del concepto', type: 'text', req: true, max: 120 }],
    values: c || {},
    onClose: () => manageConcepts(I),
    onSave: d => {
      if (I.concepts.some(x => x !== c && x.type === type && x.name.toLowerCase() === d.name.toLowerCase())) return void toast('Ya existe ese concepto');
      if (isNew) I.concepts.push({ id: uid(), name: d.name, type });
      else { c.name = d.name; I.projects.forEach(q => q.entries.forEach(e => { if (e.cid === c.id) e.concept = d.name; })); }
      save(); render();
    },
    onDelete: isNew ? null : () => { I.concepts = I.concepts.filter(x => x !== c); I.projects.forEach(q => q.entries.forEach(e => { if (e.cid === c.id) e.cid = ''; })); save(); render(); }
  });
}

/* ---------- reportes ---------- */
function buildReport(p, kind, from, to, act) {
  const period = from || to ? `Período: ${fmtDate(from) || 'inicio'} – ${fmtDate(to) || 'hoy'}` : 'Período: todo';
  const ents = inRange(p.entries, from, to).slice().sort((a, b) => a.date.localeCompare(b.date));
  const mname = id => (p.idn.members.find(m => m.id === id) || {}).name || '';
  const gname = id => (p.groups.find(g => g.id === id) || {}).name || '';
  const tname = id => (p.tasks.find(k => k.id === id) || {}).name || '';
  const t = totals(ents);
  let r;
  if (kind === 'miembros') {
    r = {
      title: 'Miembros y aportaciones', head: ['Nombre', 'Teléfono', 'Grupo', 'Aportes', 'Total'], num: [3, 4],
      rows: p.members.map(m => [m.name, m.phone, gname(m.gid), String(ents.filter(e => e.mid === m.id && e.type === 'ingreso').length), memberTotal(p, m.id, from, to)]),
      foot: ['Total aportado por miembros', '', '', '', sum(p.members.map(m => memberTotal(p, m.id, from, to)))]
    };
  } else if (kind === 'grupos') {
    r = {
      title: 'Grupos', head: ['Grupo', 'Descripción', 'Miembros', 'Total aportado'], num: [2, 3],
      rows: p.groups.map(g => { const ms = p.members.filter(m => m.gid === g.id); return [g.name, g.desc, ms.map(m => m.name).join(', ') || '—', sum(ms.map(m => memberTotal(p, m.id, from, to)))]; }),
      foot: null
    };
    r.num = [3];
  } else if (kind === 'general') {
    const I = p.idn;
    const rows = I.projects.map(q => {
      const qe = inRange(q.entries, from, to), qt = totals(qe);
      const per = q.start || q.end ? `${fmtDate(q.start) || '…'} – ${fmtDate(q.end) || '…'}` : '';
      return [q.name, q.cat || q.sub || '', per, qt.i, qt.g, qt.b, sum(qe.filter(e => !isCash(e)).map(e => e.amount))];
    });
    const all = totals(I.projects.flatMap(q => inRange(q.entries, from, to)));
    r = {
      title: 'Resumen general', head: ['Proyecto', 'Actividad', 'Período', 'Ingresos', 'Gastos', 'Balance', 'Especie/trabajo (valor)'], num: [3, 4, 5, 6],
      rows, foot: ['Total', '', '', all.i, all.g, all.b, sum(rows.map(x => x[6]))]
    };
    r.summary = [['Proyectos', String(I.projects.length)], ['Ingresos', all.i], ['Gastos', all.g], ['Balance', all.b]];
  } else if (kind === 'actividad') {
    const inc = {}, exp = {};
    const add = (o, k, v) => { o[k || ''] = (o[k || ''] || 0) + v; };
    for (const e of ents.filter(isCash)) {
      if (e.type === 'ingreso') add(inc, e.tid, e.amount);
      else if (e.lines.length) { e.lines.forEach(l => add(exp, l.tid, l.a)); add(exp, e.tid, Math.max(0, e.amount - sum(e.lines.map(l => l.a)))); }
      else add(exp, e.tid, e.amount);
    }
    const rows = p.tasks.map(k => [k.name, STATE_L[k.state], k.budget || '', inc[k.id] || 0, exp[k.id] || 0, k.budget ? k.budget - (exp[k.id] || 0) : '']);
    rows.push(['Sin tarea (general)', '', '', inc[''] || 0, exp[''] || 0, '']);
    r = {
      title: 'Por actividad / tarea', head: ['Tarea', 'Estado', 'Presupuesto', 'Ingresos', 'Gastos', 'Saldo del presupuesto'], num: [2, 3, 4, 5],
      rows, foot: ['Total', '', sum(p.tasks.map(k => k.budget)) || '', sum(rows.map(x => x[3])), sum(rows.map(x => x[4])), '']
    };
  } else if (kind === 'concepto') {
    const m = new Map();
    for (const e of ents.filter(isCash)) {
      const k = e.type + '|' + e.concept;
      const x = m.get(k) || [e.concept, e.type === 'ingreso' ? 'Ingreso' : 'Gasto', 0, 0];
      x[2]++; x[3] += e.amount; m.set(k, x);
    }
    const rows = [...m.values()].sort((a, b) => a[1].localeCompare(b[1]) || b[3] - a[3]).map(x => [x[0], x[1], String(x[2]), x[3]]);
    r = { title: 'Por concepto', head: ['Concepto', 'Tipo', 'Registros', 'Total'], num: [2, 3], rows, foot: ['Balance (ingresos − gastos)', '', '', t.b] };
  } else if (kind === 'cuotas') {
    const q = p.quota || 0;
    const owe = q ? p.members.filter(m => p.assign.pids.includes(m.id) || p.assign.gids.includes(m.gid)) : [];
    const rows = owe.map(m => { const a = memberTotal(p, m.id, from, to), pend = Math.max(0, q - a); return [m.name, gname(m.gid), q, a, pend, pend ? 'Pendiente' : 'Al día']; });
    r = {
      title: 'Cuotas pendientes' + (q ? '' : ' (defina la cuota en el proyecto y asigne personas o grupos)'), head: ['Persona', 'Grupo', 'Cuota', 'Aportado', 'Pendiente', 'Estado'], num: [2, 3, 4],
      rows, foot: ['Total', '', sum(rows.map(x => x[2])), sum(rows.map(x => x[3])), sum(rows.map(x => x[4])), '']
    };
  } else if (kind === 'participacion') {
    const paid = ents.filter(e => e.type === 'ingreso' && e.mid && (!act || e.concept === act));
    const tot = mid => sum(paid.filter(e => e.mid === mid && isCash(e)).map(e => e.amount));
    const has = mid => paid.some(e => e.mid === mid);
    const rows = []; let yes = 0, no = 0;
    const groups = [...p.groups.map(g => ({ id: g.id, name: g.name })), { id: '', name: 'Sin grupo' }];
    for (const g of groups) {
      const ms = p.members.filter(m => m.gid === g.id).sort((a, b) => a.name.localeCompare(b.name, 'es'));
      if (!ms.length && !g.id) continue;
      let ok = 0;
      for (const m of ms) { const v = tot(m.id), a = has(m.id); if (a) ok++; rows.push([g.name, m.name, a ? (v > 0 ? 'Aportó' : 'Aportó (especie/trabajo)') : 'No aportó', v]); }
      yes += ok; no += ms.length - ok;
      rows.push([g.name, 'Total del grupo', `${ok} de ${ms.length} aportaron`, sum(ms.map(m => tot(m.id)))]);
    }
    r = {
      title: 'Participación por grupos' + (act ? ' — ' + act : ''), head: ['Grupo', 'Miembro', 'Estado', 'Monto'], num: [3],
      rows, foot: ['Total', '', `${yes} aportaron / ${no} no`, sum(paid.filter(isCash).map(e => e.amount))]
    };
    r.summary = [['Aportaron', String(yes)], ['No aportaron', String(no)], ['Total aportado', sum(paid.filter(isCash).map(e => e.amount))]];
  } else {
    r = {
      title: 'Registros contables', head: ['Fecha', 'Tipo', 'Concepto', 'Actividad', 'Miembro', 'Notas', 'Monto'], num: [6],
      rows: ents.map(e => [fmtDate(e.date), e.type === 'gasto' ? 'Gasto' : (isCash(e) ? 'Ingreso' : 'Ingreso (' + e.kind + ')'),
        e.concept + (e.lines.length ? ` (${e.lines.length} líneas)` : ''), tname(e.tid), mname(e.mid), e.notes || '', e.type === 'gasto' ? -e.amount : e.amount]),
      foot: ['Balance (solo dinero)', '', '', '', '', '', t.b]
    };
  }
  if (!r.summary) r.summary = [['Ingresos', t.i], ['Gastos', t.g], ['Balance', t.b]];
  r.heading = kind === 'general' ? p.idn.name : `${p.name}${p.sub ? ' · ' + p.sub : ''}`;
  r.period = period;
  r.date = `Generado: ${fmtDate(today())}`;
  return r;
}
const cell = (v) => (typeof v === 'number' ? usd(v) : v);
function reportNode(r) {
  const tr = (cells, tag = 'td') => h('tr', null, cells.map((c, i) => h(tag, { class: r.num.includes(i) ? 'num' : null }, cell(c))));
  return h('div', null,
    h('div', { class: 'print-head' }, h('h2', null, r.heading), h('div', null, r.title), h('div', { class: 'mute' }, r.period + ' · ' + r.date)),
    h('h3', { class: 'noprint' }, r.title), h('p', { class: 'mute noprint' }, r.period),
    h('div', { class: 'stats' }, r.summary.map(([l, v]) => h('div', { class: 'stat' }, h('span', { class: 'mute' }, l), h('b', { class: v < 0 ? 'out' : null }, cell(v))))),
    h('div', { class: 'table-scroll' }, h('table', null,
      h('thead', null, h('tr', null, r.head.map((c, i) => h('th', { class: r.num.includes(i) ? 'num' : null }, c)))),
      h('tbody', null, r.rows.length ? r.rows.map(x => tr(x)) : h('tr', null, h('td', { colspan: r.head.length, class: 'mute' }, 'Sin datos en este período'))),
      r.foot && h('tfoot', null, tr(r.foot)))));
}
function reportCsv(r) {
  const esc = v => {
    let s = typeof v === 'number' ? plain(v) : String(v);
    if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = "'" + s; // evita inyección de fórmulas
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [[r.heading], [r.title], [r.period], [], r.head, ...r.rows];
  if (r.foot) lines.push(r.foot);
  return '﻿' + lines.map(l => l.map(esc).join(',')).join('\r\n');
}
function reportText(r) {
  const out = [`${r.heading}`, `${r.title} — ${r.period}`, r.summary.map(([l, v]) => `${l}: ${cell(v)}`).join(' | '), ''];
  r.rows.forEach(x => out.push('• ' + x.map(cell).filter(c => c !== '').join(' · ')));
  return out.join('\n');
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const slug = s => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'reporte';
async function shareReport(r) {
  const text = reportText(r), title = `${r.heading} — ${r.title}`;
  const file = new File([reportCsv(r)], `${slug(r.heading)}-${slug(r.title)}.csv`, { type: 'text/csv' });
  try {
    if (navigator.share) {
      const withFile = navigator.canShare && navigator.canShare({ files: [file] });
      await navigator.share(withFile ? { title, text, files: [file] } : { title, text });
      return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast('Reporte copiado. Péguelo en email o WhatsApp'); }
  catch { toast('Use "Email" o "CSV" para compartir'); }
}
function emailReport(r) {
  const body = reportText(r).slice(0, 1500);
  location.href = `mailto:?subject=${encodeURIComponent(`${r.heading} — ${r.title}`)}&body=${encodeURIComponent(body)}`;
}

/* ---------- vistas ---------- */
let installEvt = null;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;

function topBar(title, sub) {
  return h('header', { class: 'top' },
    h('div', { class: 'grow' }, h('h1', null, title), sub && h('div', { class: 'sub' }, sub)),
    ui.iid && h('button', { onclick: () => { ui.iid = null; ui.pid = null; render(); } }, '← Identidades'),
    installEvt && !standalone() && h('button', { onclick: installApp }, 'Instalar'),
    h('button', { onclick: openBackup }, 'Respaldo'));
}
async function installApp() {
  if (!installEvt) return;
  installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; render();
}
function openBackup() {
  const dlg = h('dialog', { class: 'modal', 'aria-label': 'Respaldo' });
  const file = h('input', { type: 'file', accept: 'application/json,.json' });
  file.addEventListener('change', async () => {
    const f = file.files[0]; if (!f) return;
    try {
      if (f.size > 10e6) throw new Error('size');
      const data = sanitize(JSON.parse(await f.text()));
      if (!confirm(`Reemplazar TODOS los datos actuales por ${data.identities.length} identidad(es) y ${sum(data.identities.map(i => i.projects.length))} proyecto(s) del respaldo?`)) return;
      db = data; ui.iid = null; ui.pid = null; save(); dlg.close(); dlg.remove(); render(); toast('Respaldo restaurado');
    } catch { toast('Archivo de respaldo inválido'); }
  });
  dlg.append(h('h2', null, 'Respaldo y dispositivos'),
    h('p', { class: 'mute' }, 'Los datos viven solo en este dispositivo. Para pasarlos al celular o PC: exporte aquí e importe en el otro dispositivo (envíe el archivo por email).'),
    h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => download(`proyecto-local-${today()}.json`, JSON.stringify(db, null, 1), 'application/json') }, 'Exportar respaldo')),
    h('label', { for: 'imp' }, 'Importar respaldo (.json)'), Object.assign(file, { id: 'imp' }),
    h('p', { class: 'mute' }, 'Instalar: en PC (Chrome/Edge) use el botón "Instalar" o el icono en la barra de direcciones; crea el acceso directo en el escritorio. En iPhone: Compartir → Añadir a pantalla de inicio. En Android: menú ⋮ → Instalar aplicación.'),
    h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => { dlg.close(); dlg.remove(); } }, 'Cerrar')));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg); dlg.showModal();
}

function editIdentity(i) {
  const isNew = !i;
  openForm({
    title: isNew ? 'Nueva identidad' : 'Editar identidad',
    fields: [
      { k: 'name', label: 'Nombre de la comunidad / identidad', type: 'text', req: true, max: 80 },
      { k: 'desc', label: 'Descripción', type: 'textarea', max: 2000 }
    ],
    values: i || {},
    onSave: d => {
      if (isNew) { const n = { id: uid(), groups: [], members: [], concepts: [], projects: [], ...d }; db.identities.push(n); ui.iid = n.id; ui.pid = null; ui.tab = 'proyectos'; }
      else Object.assign(i, d);
      save(); render();
    },
    onDelete: isNew || i.projects.length ? null : () => { db.identities = db.identities.filter(x => x !== i); ui.iid = null; save(); render(); toast('Identidad eliminada'); }
  });
}
function migrateMember(p, m) {
  const dests = db.identities.filter(i => i !== p.idn);
  openForm({
    title: 'Migrar a ' + m.name, submit: 'Migrar',
    fields: [{ k: 'to', label: 'Identidad destino', type: 'select', req: true, def: dests[0] && dests[0].id, options: dests.map(i => ({ v: i.id, l: i.name })) }],
    onSave: d => {
      const to = db.identities.find(i => i.id === d.to); if (!to) return;
      to.members.push({ id: uid(), name: m.name, phone: m.phone, notes: m.notes, gid: '', active: true });
      m.active = false; unassign(p.idn, 'pids', m.id); // queda archivado aquí: su historial de aportaciones no viaja
      save(); render(); toast(m.name + ' migrado a ' + to.name);
    }
  });
}
function tabIdentidades(w) {
  if (!db.identities.length) w.append(h('div', { class: 'empty card' }, h('h2', null, 'Sin identidades'), h('p', null, 'Cree la primera (por ejemplo, el nombre de su comunidad).')));
  for (const i of db.identities) {
    const go = () => { ui.iid = i.id; ui.pid = null; ui.tab = 'proyectos'; render(); };
    const t = totals(i.projects.flatMap(p => p.entries));
    w.append(h('div', { class: 'card', role: 'button', tabindex: '0', onclick: go, onkeydown: e => { if (e.key === 'Enter') go(); } },
      h('div', { class: 'row between' }, h('h2', { class: 'grow' }, i.name), h('span', { class: 'money ' + (t.b < 0 ? 'out' : 'in') }, usd(t.b))),
      h('span', { class: 'mute' }, `${i.projects.length} proyectos · ${i.members.filter(m => m.active !== false).length} personas · ${i.groups.length} grupos`)));
  }
  w.append(h('button', { class: 'btn primary fab', onclick: () => editIdentity() }, '+ Nueva identidad'));
}

function tabProyectos(w, I) {
  w.append(h('div', { class: 'card' }, h('div', { class: 'row between' }, h('p', { class: 'mute grow' }, I.desc || 'Sin descripción'),
    h('button', { class: 'btn sm', onclick: () => editIdentity(I) }, 'Editar identidad'))));
  if (!I.projects.length) w.append(h('div', { class: 'empty card' }, h('h2', null, 'Sin proyectos'), h('p', null, 'Cree el primer proyecto de esta identidad.')));
  for (const p of I.projects) {
    const t = totals(p.entries);
    w.append(h('div', { class: 'card', role: 'button', tabindex: '0', onclick: () => { ui.pid = p.id; ui.tab = 'resumen'; render(); }, onkeydown: e => { if (e.key === 'Enter') { ui.pid = p.id; ui.tab = 'resumen'; render(); } } },
      h('div', { class: 'row between' }, h('h2', { class: 'grow' }, p.name), h('span', { class: 'money ' + (t.b < 0 ? 'out' : 'in') }, usd(t.b))),
      h('div', { class: 'row' }, p.sub && h('span', { class: 'tag' }, p.sub), (p.start || p.end) && h('span', { class: 'tag' }, fmtDate(p.start) + (p.end && p.end !== p.start ? (p.start ? ' – ' : '') + fmtDate(p.end) : '')), h('span', { class: 'mute' }, `${p.members.length} miembros · ${p.groups.length} grupos`))));
  }
  w.append(h('button', { class: 'btn primary fab', onclick: () => editProject() }, '+ Nuevo proyecto'));
}

function dock() {
  return h('nav', { class: 'dock', 'aria-label': 'Secciones' }, NAV.map(([k, l]) =>
    h('button', { 'aria-label': l, title: l, 'aria-current': ui.tab === k ? 'page' : null, onclick: () => { ui.tab = k; render(); } }, icon(k), h('span', { class: 'label' }, l))));
}

const STATE_L = Object.fromEntries(STATES);
function names(p, o) {
  const g = o.gids.map(id => (p.idn.groups.find(x => x.id === id) || {}).name);
  const m = o.pids.map(id => (p.idn.members.find(x => x.id === id && x.active !== false) || {}).name);
  return [...g, ...m].filter(Boolean);
}
const assignFields = p => [
  { k: 'gids', label: 'Grupos', type: 'checks', options: p.idn.groups.map(g => ({ v: g.id, l: g.name })) },
  { k: 'pids', label: 'Personas', type: 'checks', options: p.members.map(m => ({ v: m.id, l: m.name })) }
];
function editAssign(p) {
  openForm({ title: 'Asignar al proyecto', fields: assignFields(p), values: p.assign, onSave: d => { p.assign = { gids: d.gids, pids: d.pids }; save(); render(); } });
}
function editTask(p, k) {
  const isNew = !k;
  openForm({
    title: isNew ? 'Nueva tarea' : 'Editar tarea',
    fields: [
      { k: 'name', label: 'Tarea / subproyecto', type: 'text', req: true, max: 120 },
      { k: 'state', label: 'Estado', type: 'select', options: STATES.map(([v, l]) => ({ v, l })) },
      { k: 'budget', label: 'Presupuesto (USD, opcional)', type: 'money', ph: '0.00' },
      ...assignFields(p)
    ],
    values: k || { state: 'pendiente', budget: 0 },
    onSave: d => { if (isNew) p.tasks.push({ id: uid(), ...d }); else Object.assign(k, d); save(); render(); },
    onDelete: isNew ? null : () => { p.tasks = p.tasks.filter(x => x !== k); p.entries.forEach(e => { if (e.tid === k.id) e.tid = ''; e.lines.forEach(l => { if (l.tid === k.id) l.tid = ''; }); }); save(); render(); }
  });
}
function resumenAsignados(p) {
  if (p.virtual) return null;
  const n = names(p, p.assign);
  return h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('h2', null, 'Asignados al proyecto'), h('button', { class: 'btn sm', onclick: () => editAssign(p) }, 'Editar')),
    h('div', { class: 'row' }, n.length ? n.map(x => h('span', { class: 'tag' }, x)) : h('span', { class: 'mute' }, 'Sin grupos ni personas asignadas')));
}
function resumenTareas(p) {
  if (p.virtual) return null;
  return h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('h2', null, 'Tareas'), h('button', { class: 'btn sm primary', onclick: () => editTask(p) }, '+ Tarea')),
    p.tasks.length ? p.tasks.map(k => {
      const n = names(p, k);
      return h('div', { class: 'item', role: 'button', tabindex: '0', onclick: () => editTask(p, k), onkeydown: ev => { if (ev.key === 'Enter') editTask(p, k); } },
        h('div', { class: 'grow' }, h('b', null, k.name), h('div', { class: 'mute' }, n.join(', ') || 'Sin responsables')),
        h('span', { class: 'tag' }, STATE_L[k.state]), k.budget > 0 && h('span', { class: 'mute' }, usd(k.budget)));
    }) : h('div', { class: 'mute' }, 'Sin tareas. Agregue la primera.'));
}
function tabResumen(w, p) {
  const t = totals(p.entries);
  w.append(h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('h2', null, p.name), h('button', { class: 'btn sm', onclick: () => editProject(p) }, 'Editar')),
    h('div', { class: 'row' }, p.cat && h('span', { class: 'tag' }, p.cat), p.sub && h('span', { class: 'tag' }, p.sub)),
    (p.start || p.end || p.quota > 0) && h('p', { class: 'mute' }, [(p.start || p.end) && `${p.start && p.end && p.end !== p.start ? 'Período' : 'Fecha'}: ${fmtDate(p.start) || '…'}${p.start && p.end && p.end !== p.start ? ' – ' + fmtDate(p.end) : (!p.start ? ' (cierre ' + fmtDate(p.end) + ')' : '')}`, p.quota > 0 && `Cuota: ${usd(p.quota)} por persona`].filter(Boolean).join(' · ')),
    h('p', null, p.desc || h('span', { class: 'mute' }, 'Sin descripción')),
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('span', { class: 'mute' }, 'Ingresos'), h('b', { class: 'in' }, usd(t.i))),
      h('div', { class: 'stat' }, h('span', { class: 'mute' }, 'Gastos'), h('b', { class: 'out' }, usd(t.g))),
      h('div', { class: 'stat' }, h('span', { class: 'mute' }, 'Balance'), h('b', { class: t.b < 0 ? 'out' : 'in' }, usd(t.b)))),
    h('p', { class: 'mute' }, `${p.members.length} miembros · ${p.groups.length} grupos · ${p.entries.length} registros`)),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: () => editEntry(p, null, 'ingreso') }, '+ Ingreso'),
      h('button', { class: 'btn', onclick: () => editEntry(p, null, 'gasto') }, '+ Gasto')),
    resumenAsignados(p), resumenTareas(p));
}

function tabMiembros(w, p) {
  if (!p.members.length) w.append(h('div', { class: 'empty card' }, 'Sin miembros. Agregue el primero.'));
  const gname = id => (p.groups.find(g => g.id === id) || {}).name;
  for (const m of p.members.slice().sort((a, b) => a.name.localeCompare(b.name, 'es'))) {
    const hist = p.entries.filter(e => e.mid === m.id && e.type === 'ingreso').sort((a, b) => b.date.localeCompare(a.date));
    const tel = m.phone.replace(/[^0-9+]/g, '');
    w.append(h('details', { class: 'card' },
      h('summary', null, h('div', { class: 'grow' }, h('b', null, m.name), h('div', { class: 'mute' }, [gname(m.gid), m.phone].filter(Boolean).join(' · ') || 'Sin grupo / teléfono')),
        h('span', { class: 'money in' }, usd(sum(hist.map(e => e.amount))))),
      m.phone && h('p', null, 'Tel: ', h('a', { href: 'tel:' + tel }, m.phone)),
      m.notes && h('p', null, h('span', { class: 'mute' }, 'Notas: '), m.notes),
      h('h3', null, 'Historial de aportaciones'),
      hist.length ? hist.map(e => h('div', { class: 'item' }, h('span', { class: 'date' }, fmtDate(e.date)), h('span', { class: 'grow' }, e.concept), h('span', { class: 'money in' }, usd(e.amount)))) : h('p', { class: 'mute' }, 'Sin aportaciones'),
      h('div', { class: 'actions' },
        !p.virtual && h('button', { class: 'btn sm primary', onclick: () => editEntry(p, null, 'ingreso', m.id) }, '+ Aportación'),
        db.identities.length > 1 && h('button', { class: 'btn sm', onclick: () => migrateMember(p, m) }, 'Migrar'),
        h('button', { class: 'btn sm', onclick: () => editMember(p, m) }, 'Editar'))));
  }
  w.append(h('button', { class: 'btn primary fab', onclick: () => editMember(p) }, '+ Miembro'));
}

function tabGrupos(w, p) {
  if (!p.groups.length) w.append(h('div', { class: 'empty card' }, 'Sin grupos. Cree el primero.'));
  for (const g of p.groups) {
    const ms = p.members.filter(m => m.gid === g.id);
    w.append(h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('h2', null, g.name), h('button', { class: 'btn sm', onclick: () => editGroup(p, g) }, 'Editar')),
      g.desc && h('p', { class: 'mute' }, g.desc),
      h('div', { class: 'row' }, ms.length ? ms.map(m => h('span', { class: 'tag' }, m.name)) : h('span', { class: 'mute' }, 'Sin miembros asignados (asigne desde la ficha del miembro)'))));
  }
  w.append(h('button', { class: 'btn primary fab', onclick: () => editGroup(p) }, '+ Grupo'));
}

function tabConta(w, p) {
  const tn = e => (p.tasks.find(k => k.id === e.tid) || {}).name;
  const q = ui.q.toLowerCase();
  const mname = id => (p.idn.members.find(m => m.id === id) || {}).name;
  const list = p.entries.filter(e => (!ui.ftype || e.type === ui.ftype) && (!q || (e.concept + ' ' + (mname(e.mid) || '')).toLowerCase().includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date));
  const t = totals(list);
  const search = h('input', { type: 'search', placeholder: 'Buscar concepto o miembro', 'aria-label': 'Buscar', value: ui.q });
  search.value = ui.q;
  search.addEventListener('change', () => { ui.q = search.value; render(); });
  const sel = h('select', { 'aria-label': 'Filtrar tipo' }, [['', 'Todos'], ['ingreso', 'Ingresos'], ['gasto', 'Gastos']].map(([v, l]) => h('option', { value: v }, l)));
  sel.value = ui.ftype;
  sel.addEventListener('change', () => { ui.ftype = sel.value; render(); });
  w.append(h('div', { class: 'card' }, h('div', { class: 'filters' }, sel, search),
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('span', { class: 'mute' }, 'Ingresos'), h('b', { class: 'in' }, usd(t.i))),
      h('div', { class: 'stat' }, h('span', { class: 'mute' }, 'Gastos'), h('b', { class: 'out' }, usd(t.g))),
      h('div', { class: 'stat' }, h('span', { class: 'mute' }, 'Balance'), h('b', { class: t.b < 0 ? 'out' : 'in' }, usd(t.b))))));
  const card = h('div', { class: 'card' });
  if (!list.length) card.append(h('div', { class: 'empty' }, 'Sin registros'));
  for (const e of list) {
    card.append(h('div', { class: 'item', role: 'button', tabindex: '0', onclick: () => editEntry(p, e), onkeydown: ev => { if (ev.key === 'Enter') editEntry(p, e); } },
      h('span', { class: 'date' }, fmtDate(e.date)),
      h('div', { class: 'grow' }, e.concept + (e.att ? ' 📎' : ''), [mname(e.mid), !isCash(e) && 'aporte en ' + e.kind, tn(e)].some(Boolean) && h('div', { class: 'mute' }, [mname(e.mid), !isCash(e) && 'aporte en ' + e.kind, tn(e)].filter(Boolean).join(' · ')),
        e.lines.length > 0 && h('div', { class: 'mute' }, `${e.lines.length} líneas`), e.notes && h('div', { class: 'mute' }, e.notes)),
      h('span', { class: 'money ' + (e.type === 'ingreso' ? 'in' : 'out') }, (e.type === 'ingreso' ? '+' : '−') + usd(e.amount))));
  }
  w.append(card,
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: () => editEntry(p, null, 'ingreso') }, '+ Ingreso'),
      h('button', { class: 'btn', onclick: () => editEntry(p, null, 'gasto') }, '+ Gasto'),
      h('button', { class: 'btn', onclick: () => manageConcepts(p.idn) }, 'Conceptos')));
}

function tabReportes(w, p) {
  const R = ui.rep;
  if (R.pid !== (p.id || '')) { R.pid = p.id || ''; R.from = p.start || ''; R.to = p.end || ''; } // período del proyecto por defecto
  const kind = h('select', { 'aria-label': 'Tipo de reporte' }, [['conta', 'Registros contables (detallado)'], ['actividad', 'Por actividad / tarea'], ['concepto', 'Por concepto'], ['general', 'Resumen general de la identidad'], ['cuotas', 'Cuotas pendientes'], ['miembros', 'Miembros y aportaciones'], ['grupos', 'Grupos'], ['participacion', 'Participación por grupos']].map(([v, l]) => h('option', { value: v }, l)));
  kind.value = R.kind;
  const acts = [...new Set(p.entries.filter(e => e.type === 'ingreso' && e.mid).map(e => e.concept))].sort((a, b) => a.localeCompare(b, 'es'));
  if (!acts.includes(R.act)) R.act = '';
  const act = h('select', { 'aria-label': 'Actividad' }, [['', 'Todas las actividades'], ...acts.map(a => [a, a])].map(([v, l]) => h('option', { value: v }, l)));
  act.value = R.act;
  const from = h('input', { type: 'date', 'aria-label': 'Desde' }), to = h('input', { type: 'date', 'aria-label': 'Hasta' });
  from.value = R.from; to.value = R.to;
  const apply = () => { R.kind = kind.value; R.act = act.value; R.from = isDate(from.value) ? from.value : ''; R.to = isDate(to.value) ? to.value : ''; render(); };
  [kind, act, from, to].forEach(x => x.addEventListener('change', apply));
  const r = buildReport(p, R.kind, R.from, R.to, R.act);
  w.append(
    h('div', { class: 'card noprint' }, h('div', { class: 'filters' }, kind, R.kind === 'participacion' && act, h('div', null, h('label', null, 'Desde'), from), h('div', null, h('label', null, 'Hasta'), to))),
    h('div', { class: 'card' }, reportNode(r)),
    h('div', { class: 'row noprint' },
      h('button', { class: 'btn primary', onclick: () => window.print() }, 'Imprimir / PDF'),
      h('button', { class: 'btn', onclick: () => shareReport(r) }, 'Compartir'),
      h('button', { class: 'btn', onclick: () => emailReport(r) }, 'Email'),
      h('button', { class: 'btn', onclick: () => download(`${slug(p.name)}-${slug(r.title)}.csv`, reportCsv(r), 'text/csv') }, 'CSV')));
}

function render() {
  const app = document.getElementById('app');
  const old = app.querySelector('.scroll');
  const st = old ? old.scrollTop : 0;
  app.replaceChildren();
  if (!ident()) { ui.iid = null; ui.pid = null; }
  const I = ident();
  if (I && !proj() && I.projects.length) ui.pid = I.projects[0].id;
  const p = I ? proj() : null;
  const w = h('main', { class: 'scroll' });
  if (!I) {
    tabIdentidades(w);
    app.append(h('div', { class: 'shell' }, topBar('Proyecto Local', 'Identidades'), w));
  } else {
    if (ui.tab === 'proyectos') tabProyectos(w, I);
    else if (!p && !['miembros', 'grupos', 'reportes'].includes(ui.tab)) w.append(h('div', { class: 'empty card' }, h('h2', null, 'Aún no hay proyecto'), h('p', null, 'Cree un proyecto para usar esta sección.'),
      h('button', { class: 'btn primary', onclick: () => editProject() }, '+ Nuevo proyecto')));
    else ({ resumen: tabResumen, miembros: tabMiembros, grupos: tabGrupos, conta: tabConta, reportes: tabReportes })[ui.tab](w, p || identityView(I));
    const label = NAV.find(n => n[0] === ui.tab)[1];
    app.append(h('div', { class: 'shell' }, topBar(ui.tab === 'proyectos' ? I.name : label, ui.tab === 'proyectos' ? 'Proyectos' : (p ? I.name + ' · ' + p.name : I.name)), w, dock()));
  }
  if (ui.lastTab === ui.tab) w.scrollTop = st;
  ui.lastTab = ui.tab;
  document.title = I ? `${p ? p.name + ' · ' : ''}${I.name} · Proyecto Local` : 'Proyecto Local';
}

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; render(); });
window.addEventListener('appinstalled', () => { installEvt = null; toast('App instalada'); render(); });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
render();
