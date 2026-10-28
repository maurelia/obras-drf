// Interfaz: navegación por hash (#/inicio, #/obras, #/obra/<uid>, #/registros,
// #/nuevo/<tipo>, #/reg/<uid>, #/ajustes).
import { CONFIG, DEMO } from '../config.js';
import * as auth from './auth.js';
import * as graph from './graph.js';
import * as store from './store.js';
import { ESTADOS_OBRA, ESTADOS_PARTIDA, ROLES, uid, nextCode } from './schema.js';
import { OBRAS_PROYECTO, ETAPAS_PROYECTO, FECHA_BASE } from './catalogo.js';
import { FORMS, PUNTOS, evalCota, puede } from './forms.js';
import { initialData, renderForm, renderDoc, hydrate, fileRefs } from './engine.js';
import { filasAvance, avanceEtapas, avanceObra, avanceGlobal, serieGlobal, horasRCM, lunes } from './avance.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Íconos SVG (trazo, heredan color)
const P = {
  inicio: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  obras: '<path d="M3 20h18M5 20V9l7-5 7 5v11M9 20v-6h6v6"/>',
  rep: '<path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6"/>',
  prot: '<path d="M9 4h6v3H9zM7 5H5v16h14V5h-2M9 13l2 2 4-4"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  sync: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/>',
  pin: '<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  truck: '<path d="M3 17V6h11v11M14 10h4l3 4v3h-7M7.5 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>',
  send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  gauge: '<path d="M4 16a8 8 0 1 1 16 0M12 16l4-5"/>',
  print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
};
const ic = (n, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || P.rep}</svg>`;

const TABS = [
  ['inicio', 'Avance', 'inicio'],
  ['obras', 'Obras', 'obras'],
  ['registros', 'Registros', 'prot'],
  ['ajustes', 'Ajustes', 'ajustes'],
];

const estadoBadge = (e) => {
  const cls = { 'En ejecución': '', Terminada: 'ok', Aprobado: 'ok', Paralizada: 'warn', Borrador: 'warn', Observado: 'bad', Enviado: '' }[e] ?? '';
  return e ? `<span class="badge ${cls}">${esc(e)}</span>` : '';
};
const fmtDate = (d) => (d ? new Date(d.length === 10 ? d + 'T12:00' : d).toLocaleDateString('es-CL') : '—');
const fmtPct = (v, dec = 1) => (v == null ? '—' : `${v.toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec })} %`);
const fmtN = (n) => (n === null || n === undefined || n === '' ? '0' : Number(n).toLocaleString('es-CL'));
// Fecha local (no UTC: en Chile después de las 21:00 UTC ya es el día siguiente).
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const addDays = (f, n) => { const d = new Date(f + 'T12:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

// ---------- Sesión y perfil ----------

let SES = null; // { nombre, correo, rol }
const esAdmin = () => SES?.rol === 'Administrador';
// El supervisor de terraza ve lo enviado por todos (sin aprobar ni administrar).
const veTodo = () => esAdmin() || SES?.rol === 'Supervisor de terraza';

async function cargarSesion() {
  const acc = auth.account();
  if (!acc) return (SES = null);
  const correo = (acc.username || '').toLowerCase();
  let rol = null;
  if (DEMO) {
    try { rol = localStorage.getItem('demoRol'); } catch {}
    if (!ROLES.includes(rol)) rol = 'Administrador';
  } else if (await store.meta('lastSync')) {
    const us = await store.all('usuarios');
    // Sin usuarios cargados todavía: quien configura el sitio entra como administrador.
    if (!us.length) rol = 'Administrador';
    else rol = us.find((u) => (u.Correo || '').toLowerCase() === correo && u.Activo !== false)?.Rol || null;
  }
  SES = { nombre: acc.name || correo, correo, rol };
  return SES;
}

// ---------- Marco: tab bar, barra superior, estado de conexión ----------

function renderTabs(active) {
  $('#tabs').innerHTML = TABS.map(([id, label, icon]) =>
    `<button role="tab" aria-selected="${id === active}" aria-label="${label}" data-go="#/${id}">${ic(icon, 24)}<span>${label}</span></button>`).join('');
}

function setNav(title, backHref) {
  $('#navTitle').textContent = title;
  const b = $('#back');
  b.hidden = !backHref;
  b.innerHTML = ic('back') + '<span>Atrás</span>';
  b.onclick = () => (history.length > 1 ? history.back() : (location.hash = backHref));
  document.body.classList.toggle('sub', !!backHref);
  $('#nav').classList.toggle('sub', !!backHref);
}

let lastY = 0;
addEventListener('scroll', () => {
  const y = scrollY;
  $('#nav').classList.toggle('show', y > 40);
  $('#tabs').classList.toggle('min', y > lastY && y > 80);
  lastY = y;
}, { passive: true });

async function updatePill() {
  const pend = await store.pendingCount();
  const pill = $('#pill');
  const off = !navigator.onLine;
  pill.classList.toggle('show', off || pend > 0);
  $('span', pill).textContent = off ? `Sin conexión${pend ? ` · ${pend} por subir` : ''}` : `${pend} por subir`;
}

async function trySync(manual = false) {
  if (DEMO || !auth.account() || !navigator.onLine) return updatePill();
  try {
    await store.sync();
    await cargarSesion();
    if (manual) toast('Sincronizado');
  } catch (e) {
    console.error(e);
    if (manual) toast(e.message, true);
  }
  await updatePill();
  if (!formActual) route(); // no redibujar encima de un formulario a medio llenar
}
addEventListener('online', () => trySync());
addEventListener('offline', updatePill);

function toast(msg, bad = false) {
  const t = document.createElement('div');
  t.setAttribute('role', 'status');
  t.className = 'notice toast';
  if (bad) t.classList.add('bad');
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 3500);
}

// ---------- Sheet genérico de formulario (obras, etapas, usuarios) ----------

function openForm({ title, fields, values = {}, onSave, saveLabel = 'Guardar' }) {
  const dlg = $('#sheet');
  dlg.innerHTML = `
    <form method="dialog">
      <div class="sh-head">
        <button type="button" class="navbtn" data-x>Cancelar</button>
        <h2 id="shTitle">${esc(title)}</h2>
        <button class="navbtn" style="font-weight:600">${esc(saveLabel)}</button>
      </div>
      <div class="sh-body">
        <div class="group">${fields.map((f) => fieldHtml(f, values[f.name])).join('')}</div>
        <p class="err" hidden></p>
      </div>
    </form>`;
  const form = $('form', dlg);
  $('[data-x]', dlg).onclick = () => dlg.close();
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const data = {};
    for (const f of fields) {
      const el = form.elements[f.name];
      let v = el.value.trim();
      if (f.type === 'number') v = v === '' ? null : Number(v.replace(',', '.'));
      data[f.name] = v;
      if (f.required && (v === '' || v === null)) { showErr(`Falta: ${f.label}`); el.focus(); return; }
    }
    try { await onSave(data); dlg.close(); } catch (e) { showErr(e.message); }
  };
  const showErr = (m) => { const p = $('.err', dlg); p.hidden = false; p.textContent = m; };
  dlg.showModal();
}

function fieldHtml(f, v) {
  const id = 'f_' + f.name;
  const req = f.required ? ' required' : '';
  if (f.type === 'select') {
    return `<div class="field"><label for="${id}">${esc(f.label)}</label><select id="${id}" name="${f.name}">${f.options.map((o) => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
  }
  if (f.type === 'textarea') {
    return `<div class="field col"><label for="${id}">${esc(f.label)}</label><textarea id="${id}" name="${f.name}" rows="4">${esc(v)}</textarea></div>`;
  }
  const t = f.type === 'number' ? 'text" inputmode="decimal' : f.type || 'text';
  return `<div class="field"><label for="${id}">${esc(f.label)}</label><input id="${id}" name="${f.name}" type="${t}" value="${esc(v)}" placeholder="${esc(f.ph || '')}"${req}></div>`;
}

// ---------- Datos comunes ----------

async function datos() {
  const [obras, partidas, registros] = await Promise.all([store.all('obras'), store.all('partidas'), store.all('registros')]);
  const filas = filasAvance(registros);
  const porEtapa = avanceEtapas(partidas, filas);
  return { obras, partidas, registros, filas, porEtapa };
}

// Lo que ve cada uno: administrador y supervisor de terraza ven todo lo enviado; los demás, lo suyo.
const visibles = (regs) => regs.filter((r) => r.AutorCorreo === SES.correo || (veTodo() && r.Estado !== 'Borrador'));
const regRow = (r, obras) => `<button class="row" data-go="#/reg/${esc(r.Uid)}">
  <span class="ricon">${ic(FORMS[r.Tipo]?.icon, 20)}</span>
  <div class="main"><div class="t">${esc(r.Codigo || 'Borrador')} · ${esc(FORMS[r.Tipo]?.corto || r.Tipo)}${pendIcon(r)}</div>
  <div class="s">${fmtDate(r.Fecha)}${obras[r.ObraUid] ? ' · ' + esc(obras[r.ObraUid].Codigo) : ''} · ${esc(r.Autor)}</div></div>${estadoBadge(r.Estado)}</button>`;
const pendIcon = (r) => (r._pending ? ' <span class="badge warn" title="Pendiente de subir">●</span>' : '');

// ---------- Obras y etapas (administración) ----------

const OBRA_FIELDS = [
  { name: 'Title', label: 'Nombre', required: true, ph: 'Canal de restitución 1' },
  { name: 'Codigo', label: 'Código', required: true, ph: 'CR-1' },
  { name: 'Peso', label: 'Peso en el proyecto (%)', type: 'number' },
  { name: 'Mandante', label: 'Mandante' },
  { name: 'Ubicacion', label: 'Ubicación' },
  { name: 'Estado', label: 'Estado', type: 'select', options: ESTADOS_OBRA },
  { name: 'FechaInicio', label: 'Inicio', type: 'date' },
  { name: 'FechaTermino', label: 'Término', type: 'date' },
  { name: 'Lat', label: 'Latitud', type: 'number', ph: '-27.36' },
  { name: 'Lon', label: 'Longitud', type: 'number', ph: '-70.33' },
  { name: 'Descripcion', label: 'Descripción', type: 'textarea' },
  { name: 'Materialidad', label: 'Método constructivo (materialidad)', type: 'textarea' },
  { name: 'Geometria', label: 'Geometría', type: 'textarea' },
  { name: 'Notas', label: 'Notas', type: 'textarea' },
];

const PARTIDA_FIELDS = [
  { name: 'Item', label: 'Ítem', ph: '1' },
  { name: 'Title', label: 'Etapa', required: true, ph: 'Excavación' },
  { name: 'Peso', label: 'Peso en la obra (%)', type: 'number' },
  { name: 'AvanceBase', label: 'Avance inicial (%)', type: 'number' },
  { name: 'Unidad', label: 'Unidad', ph: 'm³' },
  { name: 'CantContrato', label: 'Cantidad', type: 'number' },
  { name: 'Estado', label: 'Estado', type: 'select', options: ESTADOS_PARTIDA },
];

function editObra(obra = {}) {
  openForm({
    title: obra.Uid ? 'Editar obra' : 'Nueva obra',
    fields: OBRA_FIELDS,
    values: { Estado: 'En ejecución', ...obra },
    onSave: async (d) => {
      d.Codigo = d.Codigo.toUpperCase();
      const saved = await store.save('obras', { ...d, Uid: obra.Uid || uid() });
      await updatePill(); trySync(); route();
      if (!obra.Uid) location.hash = '#/obra/' + saved.Uid;
    },
  });
}

function editPartida(obraUid, p = {}) {
  openForm({
    title: p.Uid ? 'Editar etapa' : 'Nueva etapa',
    fields: PARTIDA_FIELDS,
    values: { Estado: 'Pendiente', ...p },
    onSave: async (d) => {
      await store.save('partidas', { ...d, ObraUid: obraUid, Uid: p.Uid || uid() });
      await updatePill(); trySync(); route();
    },
  });
}

// Agrega obras y etapas del catálogo que falten (por código / Uid).
// Con SharePoint, sincroniza antes para no duplicar lo que otro ya cargó.
async function cargarCatalogo() {
  if (!DEMO) {
    try { await store.sync(); } catch { return toast('Sin conexión: conéctate para cargar las obras del proyecto.', true); }
  }
  const obras = await store.all('obras');
  const porCodigo = Object.fromEntries(obras.map((o) => [(o.Codigo || '').toUpperCase(), o]));
  let n = 0;
  for (const o of OBRAS_PROYECTO) {
    const ex = porCodigo[o.Codigo];
    if (!ex) { await store.save('obras', o); n++; }
    else if (ex.Peso == null && o.Peso) await store.save('obras', { Uid: ex.Uid, Peso: o.Peso });
  }
  const partidas = new Set((await store.all('partidas')).map((p) => p.Uid));
  const obraUid = Object.fromEntries((await store.all('obras')).map((o) => [o.Codigo, o.Uid]));
  let e = 0;
  for (const p of ETAPAS_PROYECTO) {
    if (partidas.has(p.Uid)) continue;
    const cod = OBRAS_PROYECTO.find((o) => o.Uid === p.ObraUid).Codigo;
    await store.save('partidas', { ...p, ObraUid: obraUid[cod] || p.ObraUid }); e++;
  }
  toast(n || e ? `${n} obras y ${e} etapas agregadas` : 'Las obras del proyecto ya estaban cargadas');
  await updatePill(); trySync(); route();
}

// ---------- Vistas ----------

// Dashboard: avance global, curva acumulada, avance por obra y actividad de la semana.
async function viewInicio(v) {
  setNav('Avance');
  const { obras, partidas, registros, filas, porEtapa } = await datos();
  const glob = avanceGlobal(obras, partidas, porEtapa);
  const serie = serieGlobal(obras, partidas, filas, FECHA_BASE);
  const hace7 = avanceGlobal(obras, partidas, avanceEtapas(partidas, filas, addDays(today(), -7)));
  const sem = lunes(today());
  const enviados = registros.filter((r) => r.Estado !== 'Borrador');
  const deSemana = enviados.filter((r) => r.Fecha >= sem);
  const horas = deSemana.filter((r) => r.Tipo === 'RCM').reduce((s, r) => s + horasRCM(r), 0);
  const ultPCT = enviados.filter((r) => r.Tipo === 'PCT').sort((a, b) => (b.Fecha || '').localeCompare(a.Fecha || ''))[0];
  let conf = null;
  if (ultPCT) {
    const ev = ['rapido', 'disipador'].flatMap((k) => PUNTOS[k].map((p) => evalCota(p.z, ultPCT.Datos?.[k]?.[p.p])).filter(Boolean));
    conf = ev.length ? { pct: (ev.filter((e) => e.nivel === 'ok').length / ev.length) * 100, n: ev.length } : null;
  }
  const porRevisar = esAdmin() ? enviados.filter((r) => r.Estado === 'Enviado').length : null;
  const conPeso = obras.filter((o) => Number(o.Peso) > 0).sort((a, b) => Number(b.Peso) - Number(a.Peso));
  const obrasMap = Object.fromEntries(obras.map((o) => [o.Uid, o]));
  const ultimos = visibles(registros).filter((r) => r.Estado !== 'Borrador').sort((a, b) => (b.Fecha || '').localeCompare(a.Fecha || '')).slice(0, 5);

  if (!obras.length) {
    v.innerHTML = `<div class="head"><h1>Avance</h1></div>${demoNotice()}
      <div class="empty">${ic('inicio', 48)}<b>Sin obras cargadas</b>${esAdmin() ? `Carga las obras y etapas del proyecto para empezar a medir el avance.<br><br>
      <button class="btn" id="cargar">Cargar obras del proyecto (${OBRAS_PROYECTO.length})</button>` : 'El administrador debe cargar las obras del proyecto.'}</div>`;
    $('#cargar') && ($('#cargar').onclick = cargarCatalogo);
    return;
  }

  const delta = glob != null && hace7 != null ? glob - hace7 : null;
  v.innerHTML = `<div class="head"><h1>Avance</h1></div>${demoNotice()}
    <div class="group hero"><div class="hl">Avance físico global</div>
      <div class="hv">${fmtPct(glob)}</div>
      <div class="bar big" role="img" aria-label="Avance global ${fmtPct(glob)}"><i style="width:${glob ?? 0}%"></i></div>
      <div class="hs">${delta ? `${delta > 0 ? '+' : ''}${delta.toLocaleString('es-CL', { maximumFractionDigits: 1 })} pts en los últimos 7 días` : 'Sin variación en los últimos 7 días'}
        · ponderado por peso de obra y etapa</div></div>

    <div class="tiles">
      ${tile('Protocolos diarios', deSemana.filter((r) => r.Tipo === 'PDA').length, 'esta semana')}
      ${tile('Horas máquina', horas.toLocaleString('es-CL', { maximumFractionDigits: 1 }), 'esta semana (horómetro)')}
      ${tile('Control topográfico', conf ? fmtPct(conf.pct, 0) : '—', conf ? `conforme · ${ultPCT.Codigo}` : 'sin controles')}
      ${porRevisar != null ? tile('Por revisar', porRevisar, 'registros enviados', '#/registros?f=revisar') : tile('Mis registros', visibles(registros).length, 'en total', '#/registros')}
    </div>

    <h3>Avance acumulado</h3>
    <div class="group chartbox">${chartSerie(serie)}</div>
    <details class="foot tabla"><summary>Ver como tabla</summary><table class="dt"><thead><tr><th>Fecha</th><th>Avance global</th></tr></thead>
      <tbody>${serie.map((p) => `<tr><td>${fmtDate(p.fecha)}</td><td class="num">${fmtPct(p.v)}</td></tr>`).join('')}</tbody></table></details>
    <p class="foot">Parte del avance al ${fmtDate(FECHA_BASE)} según la planilla de control LJ; desde ahí suman los protocolos diarios enviados.</p>

    <h3>Avance por obra</h3>
    <div class="group">${conPeso.map((o) => {
      const a = avanceObra(o.Uid, partidas, porEtapa) ?? 0;
      return `<button class="row" data-go="#/obra/${esc(o.Uid)}"><div class="main"><div class="t">${esc(o.Title)}</div>
        <div class="s">${esc(o.Codigo)} · peso ${fmtN(o.Peso)} %</div><div class="bar"><i style="width:${a}%"></i></div></div>
        <span class="pct">${fmtPct(a, 0)}</span><span class="chev">${ic('chev', 18)}</span></button>`;
    }).join('') || '<div class="row">Ninguna obra tiene peso asignado.</div>'}</div>

    <h3>Últimos registros</h3>
    ${ultimos.length ? `<div class="group">${ultimos.map((r) => regRow(r, obrasMap)).join('')}</div>` : '<p class="foot">Todavía no hay registros enviados.</p>'}`;
  wireChart(v, serie);
}

const tile = (k, val, s, go) => `<${go ? `button data-go="${go}"` : 'div'} class="tile"><div class="tk">${esc(k)}</div><div class="tv">${esc(val)}</div><div class="ts">${esc(s)}</div></${go ? 'button' : 'div'}>`;

// Línea de una sola serie (avance global, 0–100 %) con cursor y tooltip.
const CH = { w: 640, h: 220, l: 40, r: 12, t: 12, b: 28 };
function chartXY(serie) {
  const t0 = new Date(serie[0].fecha).getTime(), t1 = new Date(serie.at(-1).fecha).getTime() || t0 + 1;
  const x = (f) => CH.l + ((new Date(f).getTime() - t0) / Math.max(1, t1 - t0)) * (CH.w - CH.l - CH.r);
  const y = (val) => CH.t + (1 - val / 100) * (CH.h - CH.t - CH.b);
  return { x, y };
}
function chartSerie(serie) {
  if (serie.length < 2) return `<p class="foot" style="padding:16px">La curva aparece cuando se envíe el primer protocolo diario con avance. Hoy: ${fmtPct(serie[0]?.v)}.</p>`;
  const { x, y } = chartXY(serie);
  const pts = serie.map((p) => `${x(p.fecha).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${CH.w} ${CH.h}" role="img" aria-label="Avance global acumulado: de ${fmtPct(serie[0].v)} a ${fmtPct(serie.at(-1).v)}">
    ${[0, 25, 50, 75, 100].map((g) => `<line class="grid" x1="${CH.l}" x2="${CH.w - CH.r}" y1="${y(g)}" y2="${y(g)}"/><text class="ax" x="${CH.l - 6}" y="${y(g) + 4}" text-anchor="end">${g}%</text>`).join('')}
    <text class="ax" x="${CH.l}" y="${CH.h - 8}">${fmtDate(serie[0].fecha)}</text>
    <text class="ax" x="${CH.w - CH.r}" y="${CH.h - 8}" text-anchor="end">${fmtDate(serie.at(-1).fecha)}</text>
    <polyline class="ln" points="${pts}"/>
    <circle class="end" cx="${x(serie.at(-1).fecha)}" cy="${y(serie.at(-1).v)}" r="4"/>
    <g class="cur" visibility="hidden"><line class="xh" y1="${CH.t}" y2="${CH.h - CH.b}"/><circle class="dot" r="5"/></g>
    <rect class="hit" x="${CH.l}" y="0" width="${CH.w - CH.l - CH.r}" height="${CH.h}" fill="transparent"/></svg><div class="tip" hidden></div>`;
}
function wireChart(v, serie) {
  const svg = $('.chart', v); if (!svg) return;
  const { x, y } = chartXY(serie);
  const cur = $('.cur', svg), tip = $('.tip', v);
  const show = (ev) => {
    const b = svg.getBoundingClientRect();
    const px = ((ev.clientX - b.left) / b.width) * CH.w;
    const p = serie.reduce((m, q) => (Math.abs(x(q.fecha) - px) < Math.abs(x(m.fecha) - px) ? q : m));
    cur.setAttribute('visibility', 'visible');
    $('.xh', cur).setAttribute('x1', x(p.fecha)); $('.xh', cur).setAttribute('x2', x(p.fecha));
    $('.dot', cur).setAttribute('cx', x(p.fecha)); $('.dot', cur).setAttribute('cy', y(p.v));
    tip.hidden = false; tip.innerHTML = `<b>${fmtPct(p.v)}</b><br>${fmtDate(p.fecha)}`;
    const left = (x(p.fecha) / CH.w) * b.width;
    tip.style.left = `${Math.min(Math.max(left, 50), b.width - 50)}px`;
  };
  const hide = () => { cur.setAttribute('visibility', 'hidden'); tip.hidden = true; };
  svg.addEventListener('pointermove', show); svg.addEventListener('pointerdown', show); svg.addEventListener('pointerleave', hide);
}

const demoNotice = () => (DEMO ? `<div class="notice">${ic('info', 20)}<div><b>Modo demo.</b> Los datos quedan solo en este equipo. Perfil de prueba: ${esc(SES?.rol)} (cámbialo en Ajustes).</div></div>` : '');

async function viewObras(v) {
  setNav('Obras');
  const { obras, partidas, porEtapa } = await datos();
  obras.sort((a, b) => (a.Codigo || '').localeCompare(b.Codigo || '', 'es', { numeric: true }));
  v.innerHTML = `
    <div class="head"><h1>Obras</h1>${esAdmin() ? `<button class="round" id="addObra" aria-label="Nueva obra">${ic('plus')}</button>` : ''}</div>
    ${obras.length ? `<div class="group">${obras.map((o) => {
      const ps = partidas.filter((p) => p.ObraUid === o.Uid);
      const av = avanceObra(o.Uid, partidas, porEtapa);
      return `<button class="row" data-go="#/obra/${esc(o.Uid)}">
        <div class="main"><div class="t">${esc(o.Title)}${pendIcon(o)}</div>
        <div class="s">${esc(o.Codigo)}${Number(o.Peso) ? ` · peso ${fmtN(o.Peso)} %` : ''} · ${ps.length} ${ps.length === 1 ? 'etapa' : 'etapas'}</div>
        ${av != null ? `<div class="bar" role="img" aria-label="Avance ${Math.round(av)}%"><i style="width:${av}%"></i></div>` : ''}</div>
        ${estadoBadge(o.Estado)}<span class="chev">${ic('chev', 18)}</span></button>`;
    }).join('')}</div>` : `
      <div class="empty">${ic('obras', 48)}<b>Sin obras todavía</b>${esAdmin() ? `Carga las obras del proyecto o crea una nueva.<br><br>
      <button class="btn" id="cargar">Cargar obras del proyecto (${OBRAS_PROYECTO.length})</button><br>
      <button class="btn sec" id="addObra2">${ic('plus', 20)} Nueva obra</button>` : 'El administrador debe cargar las obras del proyecto.'}</div>`}`;
  $('#addObra') && ($('#addObra').onclick = () => editObra());
  $('#addObra2') && ($('#addObra2').onclick = () => editObra());
  $('#cargar') && ($('#cargar').onclick = cargarCatalogo);
}

let obraTab = 'etapas';

async function viewObra(v, obraUid) {
  const { obras, partidas: todas, registros, porEtapa } = await datos();
  const o = obras.find((x) => x.Uid === obraUid);
  if (!o) { v.innerHTML = '<div class="empty"><b>Obra no encontrada</b></div>'; setNav('', '#/obras'); return; }
  setNav(o.Title, '#/obras');
  const partidas = todas.filter((p) => p.ObraUid === obraUid)
    .sort((a, b) => String(a.Item || '').localeCompare(String(b.Item || ''), 'es', { numeric: true }));
  const etapasUid = new Set(partidas.map((p) => p.Uid));
  const regs = visibles(registros).filter((r) => r.ObraUid === obraUid || (r.Datos?.avances || []).some((a) => etapasUid.has(a.etapa)))
    .sort((a, b) => (b.Fecha || '').localeCompare(a.Fecha || ''));
  const av = avanceObra(obraUid, todas, porEtapa);
  const obrasMap = Object.fromEntries(obras.map((x) => [x.Uid, x]));
  const mapa = o.Lat && o.Lon ? `<a class="row" href="https://maps.google.com/?q=${o.Lat},${o.Lon}" target="_blank" rel="noopener">${ic('pin', 20)}<div class="main">Ver en el mapa</div><span class="chev">${ic('chev', 18)}</span></a>` : '';

  const tabs = { etapas: `Etapas (${partidas.length})`, registros: `Registros (${regs.length})` };
  let body = '';
  if (obraTab === 'etapas') {
    body = partidas.length ? `<div class="group">${partidas.map((p) => `
      <button class="row" data-partida="${esc(p.Uid)}" ${esAdmin() ? '' : 'disabled'}><div class="main"><div class="t">${esc(p.Item ? p.Item + '. ' : '')}${esc(p.Title)}${pendIcon(p)}</div>
      <div class="s">${Number(p.Peso) ? `peso ${fmtN(p.Peso)} %` : 'sin peso'}${p.CantContrato ? ` · ${fmtN(p.CantContrato)} ${esc(p.Unidad)}` : ''}</div>
      <div class="bar"><i style="width:${porEtapa[p.Uid]}%"></i></div></div><span class="pct">${fmtPct(porEtapa[p.Uid], 0)}</span></button>`).join('')}</div>`
      : `<div class="empty">${esAdmin() ? 'Agrega las etapas de la obra con su peso para medir el avance.' : 'Esta obra no tiene etapas definidas.'}</div>`;
    if (esAdmin()) body += `<div style="margin-top:12px"><button class="btn sec" id="addPartida">${ic('plus', 20)} Agregar etapa</button></div>`;
  } else {
    body = regs.length ? `<div class="group">${regs.map((r) => regRow(r, obrasMap)).join('')}</div>` : '<div class="empty">Sin registros para esta obra.</div>';
  }

  v.innerHTML = `
    <div class="head"><h1 style="font-size:1.75rem">${esc(o.Title)}</h1></div>
    <div class="group kv">
      <div class="row"><span class="k">Código</span><span class="v">${esc(o.Codigo)}</span></div>
      <div class="row"><span class="k">Estado</span><span class="v">${estadoBadge(o.Estado)}</span></div>
      ${Number(o.Peso) ? `<div class="row"><span class="k">Peso en el proyecto</span><span class="v">${fmtN(o.Peso)} %</span></div>` : ''}
      ${o.Mandante ? `<div class="row"><span class="k">Mandante</span><span class="v">${esc(o.Mandante)}</span></div>` : ''}
      ${o.Ubicacion ? `<div class="row"><span class="k">Ubicación</span><span class="v">${esc(o.Ubicacion)}</span></div>` : ''}
      ${o.FechaInicio || o.FechaTermino ? `<div class="row"><span class="k">Plazo</span><span class="v">${fmtDate(o.FechaInicio)} – ${fmtDate(o.FechaTermino)}</span></div>` : ''}
      <div class="row"><span class="k">Avance</span><span class="v">${fmtPct(av)}<div class="bar"><i style="width:${av ?? 0}%"></i></div></span></div>
      ${mapa}
    </div>
    ${o.Descripcion || o.Materialidad || o.Geometria ? `<h3>Ficha técnica</h3><div class="group kv">
      ${[['Descripción', o.Descripcion], ['Materialidad', o.Materialidad], ['Geometría', o.Geometria]].filter(([, x]) => x)
        .map(([k, x]) => `<div class="row"><span class="k">${k}</span><span class="v pre">${esc(x)}</span></div>`).join('')}</div>` : ''}
    ${o.Notas ? `<p class="foot">${esc(o.Notas)}</p>` : ''}
    ${esAdmin() ? `<div style="margin-top:10px"><button class="btn sec" id="editObra">Editar obra</button></div>` : ''}
    <div class="seg" role="tablist">${Object.entries(tabs).map(([k, l]) => `<button role="tab" aria-selected="${k === obraTab}" data-otab="${k}">${l}</button>`).join('')}</div>
    ${body}`;

  $('#editObra') && ($('#editObra').onclick = () => editObra(o));
  v.querySelectorAll('[data-otab]').forEach((b) => (b.onclick = () => { obraTab = b.dataset.otab; route(); }));
  $('#addPartida') && ($('#addPartida').onclick = () => editPartida(obraUid));
  if (esAdmin()) v.querySelectorAll('[data-partida]').forEach((b) => (b.onclick = () => editPartida(obraUid, partidas.find((p) => p.Uid === b.dataset.partida))));
}

// Lista de registros + botón para crear según el perfil.
async function viewRegistros(v, filtro) {
  setNav('Registros');
  const { obras, registros } = await datos();
  const obrasMap = Object.fromEntries(obras.map((o) => [o.Uid, o]));
  const mios = registros.filter((r) => r.AutorCorreo === SES.correo);
  const segs = esAdmin()
    ? { revisar: `Por revisar (${registros.filter((r) => r.Estado === 'Enviado').length})`, todos: 'Todos', mios: 'Míos' }
    : { mios: 'Míos', pendientes: `Por corregir (${mios.filter((r) => r.Estado === 'Observado' || r.Estado === 'Borrador').length})`, ...(veTodo() ? { todos: 'Todos' } : {}) };
  const f = segs[filtro] ? filtro : Object.keys(segs)[0];
  const rows = (f === 'revisar' ? registros.filter((r) => r.Estado === 'Enviado')
    : f === 'todos' ? visibles(registros)
      : f === 'pendientes' ? mios.filter((r) => r.Estado === 'Observado' || r.Estado === 'Borrador') : mios)
    .sort((a, b) => (b.Fecha || '').localeCompare(a.Fecha || '') || (b.Correlativo || 0) - (a.Correlativo || 0));
  const tipos = Object.keys(FORMS).filter((t) => puede(SES.rol, t));
  v.innerHTML = `<div class="head"><h1>Registros</h1><button class="round" id="nuevo" aria-label="Nuevo registro">${ic('plus')}</button></div>
    <div class="seg" role="tablist">${Object.entries(segs).map(([k, l]) => `<button role="tab" aria-selected="${k === f}" data-go="#/registros?f=${k}">${l}</button>`).join('')}</div>
    ${rows.length ? `<div class="group">${rows.map((r) => regRow(r, obrasMap)).join('')}</div>`
      : `<div class="empty">${ic('prot', 48)}<b>${f === 'revisar' ? 'Nada por revisar' : 'Sin registros'}</b>${f === 'revisar' ? '' : 'Usa el botón + para llenar un protocolo o registro.'}</div>`}`;
  $('#nuevo').onclick = () => elegirTipo(tipos);
}

function elegirTipo(tipos) {
  const dlg = $('#sheet');
  dlg.innerHTML = `<div class="sh-head"><button type="button" class="navbtn" data-x>Cancelar</button><h2 id="shTitle">Nuevo registro</h2><span class="navbtn"></span></div>
    <div class="sh-body"><div class="group">${tipos.map((t) => `<button class="row" data-tipo="${t}"><span class="ricon">${ic(FORMS[t].icon, 20)}</span>
      <div class="main"><div class="t">${esc(FORMS[t].corto)}</div><div class="s">${t}${FORMS[t].rev ? ' · ' + esc(FORMS[t].rev) : ''}</div></div><span class="chev">${ic('chev', 18)}</span></button>`).join('')}</div>
      <p class="foot">Se muestran los formatos de tu perfil (${esc(SES.rol)}).</p></div>`;
  $('[data-x]', dlg).onclick = () => dlg.close();
  dlg.querySelectorAll('[data-tipo]').forEach((b) => (b.onclick = () => { dlg.close(); location.hash = '#/nuevo/' + b.dataset.tipo; }));
  dlg.showModal();
}

// Formulario en curso: se guarda como borrador si se sale sin enviar.
let formActual = null;

async function viewRegistro(v, regUid, tipoNuevo) {
  const { obras, partidas, registros } = await datos();
  const reg = regUid ? registros.find((r) => r.Uid === regUid) : null;
  if (regUid && !reg) { setNav('', '#/registros'); v.innerHTML = '<div class="empty"><b>Registro no encontrado</b></div>'; return; }
  const tipo = reg?.Tipo || tipoNuevo;
  const spec = FORMS[tipo];
  if (!spec) { location.hash = '#/registros'; return; }
  const ctx = { obras, partidas, registros, usuario: SES.nombre, regUid: reg?.Uid || uid() };
  const propio = !reg || reg.AutorCorreo === SES.correo;
  const editable = (!reg && puede(SES.rol, tipo)) || (reg && ['Borrador', 'Observado'].includes(reg.Estado) && (propio || esAdmin()));
  setNav(reg?.Codigo || spec.corto, '#/registros');

  if (!editable) return viewDoc(v, reg, ctx);

  v.innerHTML = `<div class="head"><h1 style="font-size:1.6rem">${esc(spec.titulo)}</h1></div>
    <p class="foot">${tipo}${spec.rev ? ' · ' + esc(spec.rev) : ''} · ${reg?.Codigo ? esc(reg.Codigo) : 'el código se asigna al enviar'}</p>
    ${reg?.Estado === 'Observado' ? `<div class="notice bad">${ic('info', 20)}<div><b>Observado por ${esc(reg.Revisor || 'el revisor')}.</b> ${esc(reg.Comentario || '')}<br>Corrige y vuelve a enviar.</div></div>` : ''}
    <div id="frm"></div>
    <p class="err" id="errs" hidden></p>
    <div class="actions noprint">
      <button class="btn" id="enviar">Firmar y enviar</button>
      <button class="btn sec" id="borrador">Guardar borrador</button>
      ${reg && reg.Estado === 'Borrador' ? '<button class="btn danger" id="descartar">Descartar borrador</button>' : ''}
    </div>`;
  let dirty = false;
  const form = renderForm($('#frm', v), { tipo, data: reg?.Datos || initialData(tipo, ctx), ctx: { ...ctx, onChange: () => (dirty = true) } });

  const guardar = async (enviar) => {
    const faltan = form.collect();
    if (enviar && faltan.length) {
      const e = $('#errs'); e.hidden = false; e.innerHTML = '<b>Falta completar:</b><br>' + faltan.map(esc).join('<br>');
      e.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    const d = form.data();
    const rec = {
      Uid: ctx.regUid, Tipo: tipo, Fecha: d.fecha || today(), ObraUid: d.obra || spec.obraFija || '',
      Datos: d, Autor: reg?.Autor || SES.nombre, AutorCorreo: reg?.AutorCorreo || SES.correo,
      Estado: enviar ? 'Enviado' : reg?.Estado || 'Borrador',
    };
    if (enviar) {
      if (!reg?.Codigo) Object.assign(rec, nextCode(tipo, await store.all('registros')));
      const cod = rec.Codigo || reg.Codigo;
      // Fotos, firmas y adjuntos se suben a <carpeta>/<tipo>/<código>/ en SharePoint.
      for (const ref of fileRefs(d)) {
        const f = await store.getFile(ref.fid);
        if (f && !f.driveId) await store.putFile({ ...f, regUid: ctx.regUid, path: `${tipo}/${cod}/${f.name}` });
      }
      rec.Title = `${cod} ${spec.corto}`;
    } else rec.Title = `${reg?.Codigo || 'Borrador'} ${spec.corto}`;
    await store.save('registros', rec);
    // La revisión de un transmittal lo aprueba u observa según su resultado.
    if (enviar && tipo === 'PRV' && d.transmittal) {
      const ok = d.resultado !== 'Requiere corrección';
      await store.save('registros', { Uid: d.transmittal, Estado: ok ? 'Aprobado' : 'Observado', Revisor: SES.nombre,
        Comentario: `${rec.Codigo || reg.Codigo}: ${d.resultado}${d.comentario ? ' – ' + d.comentario : ''}` });
    }
    dirty = false;
    return true;
  };

  formActual = { guardarSiCambio: () => (dirty ? guardar(false) : null) };
  $('#enviar').onclick = async () => {
    if (await guardar(true)) { formActual = null; toast('Registro enviado'); await updatePill(); trySync(); location.hash = '#/reg/' + ctx.regUid; route(); }
  };
  $('#borrador').onclick = async () => {
    await guardar(false); formActual = null; toast('Borrador guardado'); await updatePill(); trySync();
    if (!reg) location.replace('#/reg/' + ctx.regUid); else route();
  };
  $('#descartar') && ($('#descartar').onclick = async () => {
    formActual = null; await store.remove('registros', reg.Uid); toast('Borrador descartado'); await updatePill(); trySync(); location.hash = '#/registros';
  });
}

// Vista de lectura / impresión, con aprobación del administrador.
function viewDoc(v, reg, ctx) {
  const revisable = esAdmin() && reg.Estado === 'Enviado';
  v.innerHTML = `<div class="actions top noprint">
      <button class="btn sec" id="print">${ic('print', 20)} Imprimir / guardar PDF</button>
      ${revisable ? `<button class="btn" id="aprobar">${ic('check', 20)} Aprobar</button><button class="btn danger" id="observar">Observar</button>` : ''}
    </div>
    ${renderDoc(reg, ctx)}`;
  hydrate(v);
  $('#print').onclick = () => print();
  if (revisable) {
    $('#aprobar').onclick = async () => {
      await store.save('registros', { Uid: reg.Uid, Estado: 'Aprobado', Revisor: SES.nombre });
      toast('Registro aprobado'); await updatePill(); trySync(); route();
    };
    $('#observar').onclick = () => openForm({
      title: 'Observar registro', saveLabel: 'Enviar',
      fields: [{ name: 'Comentario', label: 'Qué debe corregir', type: 'textarea', required: true }],
      onSave: async ({ Comentario }) => {
        await store.save('registros', { Uid: reg.Uid, Estado: 'Observado', Revisor: SES.nombre, Comentario });
        toast('Devuelto al autor con observaciones'); await updatePill(); trySync(); route();
      },
    });
  }
}

const USUARIO_FIELDS = [
  { name: 'Title', label: 'Nombre', required: true },
  { name: 'Correo', label: 'Correo', type: 'email', required: true, ph: 'nombre@atacamakozan.cl' },
  { name: 'Rol', label: 'Perfil', type: 'select', options: ROLES },
  { name: 'Activo', label: 'Activo', type: 'select', options: ['Sí', 'No'] },
];
function editUsuario(u = {}) {
  openForm({
    title: u.Uid ? 'Editar usuario' : 'Nuevo usuario',
    fields: USUARIO_FIELDS,
    values: { Rol: 'Operador', ...u, Activo: u.Activo === false ? 'No' : 'Sí' },
    onSave: async (d) => {
      await store.save('usuarios', { ...d, Correo: d.Correo.toLowerCase(), Activo: d.Activo === 'Sí', Uid: u.Uid || uid() });
      await updatePill(); trySync(); route();
    },
  });
}

async function viewAjustes(v) {
  setNav('Ajustes');
  const last = await store.meta('lastSync');
  const pend = await store.pendingCount();
  const usuarios = (await store.all('usuarios')).sort((a, b) => (a.Title || '').localeCompare(b.Title || ''));
  v.innerHTML = `<div class="head"><h1>Ajustes</h1></div>
    <h3>Cuenta</h3>
    <div class="group kv">
      <div class="row"><span class="k">Usuario</span><span class="v">${esc(SES.nombre)}</span></div>
      <div class="row"><span class="k">Correo</span><span class="v">${esc(SES.correo)}</span></div>
      <div class="row"><span class="k">Perfil</span><span class="v">${esc(SES.rol)}</span></div>
    </div>
    ${DEMO ? `<div class="group" style="margin-top:10px"><div class="field"><label for="demoRol">Perfil de prueba</label><select id="demoRol">${ROLES.map((r) => `<option${r === SES.rol ? ' selected' : ''}>${r}</option>`).join('')}</select></div></div>
      <p class="foot">Solo en modo demo: cambia el perfil para ver la app como topógrafo u operador.</p>`
      : `<div style="margin-top:10px"><button class="btn danger" id="logout">Cerrar sesión</button></div>`}
    <h3>SharePoint</h3>
    <div class="group kv">
      <div class="row"><span class="k">Sitio</span><span class="v">${DEMO ? 'No configurado (modo demo)' : esc(CONFIG.SITE_HOST + CONFIG.SITE_PATH)}</span></div>
      <div class="row"><span class="k">Última sincronización</span><span class="v">${last ? new Date(last).toLocaleString('es-CL') : '—'}</span></div>
      <div class="row"><span class="k">Cambios por subir</span><span class="v">${pend}</span></div>
    </div>
    ${DEMO ? '' : `<div style="margin-top:10px"><button class="btn" id="syncNow">${ic('sync', 20)} Sincronizar ahora</button>
      ${esAdmin() ? '<button class="btn sec" id="prov">Revisar / crear listas</button>' : ''}</div>
      ${esAdmin() ? '<p class="foot">Crear listas requiere ser propietario del sitio. Solo se hace una vez.</p><div class="log" id="provLog" hidden></div>' : ''}`}
    ${esAdmin() ? `
    <h3>Usuarios y perfiles</h3>
    ${usuarios.length ? `<div class="group">${usuarios.map((u) => `<button class="row" data-user="${esc(u.Uid)}"><div class="main"><div class="t">${esc(u.Title)}${pendIcon(u)}</div>
      <div class="s">${esc(u.Correo)}</div></div><span class="badge ${u.Activo === false ? 'bad' : ''}">${u.Activo === false ? 'Inactivo' : esc(u.Rol)}</span></button>`).join('')}</div>`
      : '<p class="foot">Sin usuarios. Mientras la lista esté vacía, todos entran como administrador: agrega al menos a los administradores.</p>'}
    <div style="margin-top:10px"><button class="btn sec" id="addUser">${ic('plus', 20)} Agregar usuario</button></div>
    <p class="foot">Administrador: ingenieros de proyectos y TI (obras, etapas, usuarios y aprobación). Supervisor de terraza: protocolo diario, maquinarias y humectación; ve los registros de todos. Supervisor empresa colaboradora: los mismos formatos, solo sus registros. Topógrafo: protocolos topográficos, transmittal y PANDA. Operador: maquinarias, humectación y protocolo diario.</p>
    <h3>Proyecto</h3>
    <div><button class="btn sec" id="cargar">Cargar obras y etapas del proyecto</button></div>
    <p class="foot">Agrega solo las que falten (11 obras, con pesos y etapas de la planilla de control LJ).</p>` : ''}
    <h3>Acerca de</h3>
    <div class="group kv"><div class="row"><span class="k">Versión</span><span class="v">${CONFIG.VERSION}</span></div></div>`;
  $('#demoRol') && ($('#demoRol').onchange = async (e) => { try { localStorage.setItem('demoRol', e.target.value); } catch {} await cargarSesion(); route(); });
  $('#cargar') && ($('#cargar').onclick = cargarCatalogo);
  $('#addUser') && ($('#addUser').onclick = () => editUsuario());
  v.querySelectorAll('[data-user]').forEach((b) => (b.onclick = () => editUsuario(usuarios.find((u) => u.Uid === b.dataset.user))));
  if (DEMO) return;
  $('#logout').onclick = () => auth.logout();
  $('#syncNow').onclick = () => trySync(true);
  $('#prov') && ($('#prov').onclick = async () => {
    const log = $('#provLog'); log.hidden = false; log.textContent = '';
    const w = (m) => (log.textContent += m + '\n');
    try {
      await graph.provision(w);
      await store.sync();
      if (!(await store.all('usuarios')).length) {
        await store.save('usuarios', { Uid: uid(), Title: SES.nombre, Correo: SES.correo, Rol: 'Administrador', Activo: true });
        w(`✓ ${SES.correo} registrado como administrador`);
        await store.sync();
      }
      w('Listo.');
    } catch (e) { w('Error: ' + e.message); }
  });
}

function viewLogin(v) {
  setNav('');
  $('#tabs').innerHTML = '';
  v.innerHTML = `<div class="empty" style="padding-top:18vh">
    <img src="icon.svg" width="84" height="84" alt="" style="border-radius:20px"><br><br>
    <b style="font-size:1.75rem">Obras DRF</b>Protocolos, reportes de operación y avance de obras.<br>Entra con tu cuenta de Atacama Kozan.<br><br>
    <button class="btn" id="login">Iniciar sesión con Microsoft</button></div>`;
  $('#login').onclick = () => auth.login();
}

async function viewSinAcceso(v) {
  setNav('');
  $('#tabs').innerHTML = '';
  const nunca = !(await store.meta('lastSync'));
  v.innerHTML = `<div class="empty" style="padding-top:16vh">${ic('info', 48)}
    <b>${nunca ? 'Preparando la app' : 'Sin perfil asignado'}</b>
    ${nunca ? 'Se necesita conexión la primera vez para bajar los datos del proyecto.'
      : `Tu cuenta (${esc(SES.correo)}) no tiene perfil en Obras DRF. Pide a un ingeniero de proyectos que te agregue en Ajustes → Usuarios.`}<br><br>
    <button class="btn" id="retry">${ic('sync', 20)} Reintentar</button><button class="btn danger" id="logout">Cerrar sesión</button></div>`;
  $('#retry').onclick = () => trySync(true).then(route);
  $('#logout').onclick = () => auth.logout();
}

// ---------- Router ----------

async function route() {
  const v = $('#view');
  if (!DEMO && !auth.account()) return viewLogin(v);
  if (!SES) await cargarSesion();
  if (!SES?.rol) return viewSinAcceso(v);
  const [path, query = ''] = location.hash.slice(1).split('?');
  const [, name = 'inicio', arg] = path.split('/');
  const tab = { obra: 'obras', nuevo: 'registros', reg: 'registros' }[name] || name;
  renderTabs(TABS.some(([id]) => id === tab) ? tab : 'inicio');
  document.body.classList.toggle('docview', name === 'reg');
  if (name === 'obra') return viewObra(v, decodeURIComponent(arg));
  if (name === 'registros') return viewRegistros(v, new URLSearchParams(query).get('f'));
  if (name === 'nuevo') return viewRegistro(v, null, arg);
  if (name === 'reg') return viewRegistro(v, decodeURIComponent(arg));
  if (name === 'obras') return viewObras(v);
  if (name === 'ajustes') return viewAjustes(v);
  return viewInicio(v);
}

addEventListener('hashchange', async () => {
  // Salir de un formulario a medio llenar lo guarda como borrador.
  if (formActual) {
    const f = formActual; formActual = null;
    if (await f.guardarSiCambio()) { toast('Guardado como borrador'); updatePill(); }
  }
  obraTab = 'etapas';
  scrollTo(0, 0);
  route();
});
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) location.hash = go.dataset.go;
});

(async function start() {
  $('#view').innerHTML = '<div class="skel" style="margin-top:80px"></div><div class="skel"></div><div class="skel"></div>';
  try { await auth.initAuth(); } catch (e) { console.error(e); toast('Error de inicio de sesión: ' + e.message, true); }
  await cargarSesion();
  await route();
  await updatePill();
  trySync();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js');
})();
