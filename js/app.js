// Interfaz: navegación por hash (#/obras, #/obra/<uid>, #/reportes, #/protocolos, #/ajustes).
import { CONFIG, DEMO } from '../config.js';
import * as auth from './auth.js';
import * as graph from './graph.js';
import * as store from './store.js';
import { ESTADOS_OBRA, ESTADOS_PARTIDA, TIPOS_PROTOCOLO, uid } from './schema.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Íconos SVG (trazo, heredan color)
const P = {
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
};
const ic = (n, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;

const TABS = [
  ['obras', 'Obras', 'obras'],
  ['reportes', 'Reportes', 'rep'],
  ['protocolos', 'Protocolos', 'prot'],
  ['ajustes', 'Ajustes', 'ajustes'],
];

const estadoBadge = (e) => {
  const cls = { 'En ejecución': '', Terminada: 'ok', Protocolizada: 'ok', Firmado: 'ok', Aprobado: 'ok', Paralizada: 'warn', Borrador: 'warn', Anulado: 'bad' }[e] ?? '';
  return e ? `<span class="badge ${cls}">${esc(e)}</span>` : '';
};
const fmtDate = (d) => (d ? new Date(d.length === 10 ? d + 'T12:00' : d).toLocaleDateString('es-CL') : '—');
const today = () => new Date().toISOString().slice(0, 10);

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
    if (manual) toast('Sincronizado');
  } catch (e) {
    console.error(e);
    if (manual) toast(e.message, true);
  }
  await updatePill();
  route();
}
addEventListener('online', () => trySync());
addEventListener('offline', updatePill);

function toast(msg, bad = false) {
  const t = document.createElement('div');
  t.setAttribute('role', 'status');
  t.className = 'notice';
  t.style.cssText = `position:fixed;left:16px;right:16px;bottom:calc(84px + env(safe-area-inset-bottom));z-index:40;max-width:560px;margin:auto;box-shadow:var(--shadow);${bad ? 'background:var(--card);color:var(--bad)' : ''}`;
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 3500);
}

// ---------- Sheet genérico de formulario ----------

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

// ---------- Vistas ----------

const OBRA_FIELDS = [
  { name: 'Title', label: 'Nombre', required: true, ph: 'Defensa fluvial río Copiapó' },
  { name: 'Codigo', label: 'Código', required: true, ph: 'TD' },
  { name: 'Mandante', label: 'Mandante' },
  { name: 'Ubicacion', label: 'Ubicación' },
  { name: 'Estado', label: 'Estado', type: 'select', options: ESTADOS_OBRA },
  { name: 'FechaInicio', label: 'Inicio', type: 'date' },
  { name: 'FechaTermino', label: 'Término', type: 'date' },
  { name: 'Lat', label: 'Latitud', type: 'number', ph: '-27.36' },
  { name: 'Lon', label: 'Longitud', type: 'number', ph: '-70.33' },
  { name: 'Notas', label: 'Notas', type: 'textarea' },
];

const PARTIDA_FIELDS = [
  { name: 'Item', label: 'Ítem', ph: '3.1' },
  { name: 'Title', label: 'Descripción', required: true, ph: 'Enrocado de protección' },
  { name: 'Unidad', label: 'Unidad', ph: 'm³' },
  { name: 'CantContrato', label: 'Cant. contrato', type: 'number' },
  { name: 'CantEjecutada', label: 'Cant. ejecutada', type: 'number' },
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
    title: p.Uid ? 'Editar partida' : 'Nueva partida',
    fields: PARTIDA_FIELDS,
    values: { Estado: 'Pendiente', ...p },
    onSave: async (d) => {
      await store.save('partidas', { ...d, ObraUid: obraUid, Uid: p.Uid || uid() });
      await updatePill(); trySync(); route();
    },
  });
}

const pendIcon = (r) => (r._pending ? ' <span class="badge warn" title="Pendiente de subir">●</span>' : '');

async function viewObras(v) {
  setNav('Obras');
  const obras = (await store.all('obras')).sort((a, b) => (a.Title || '').localeCompare(b.Title || ''));
  const partidas = await store.all('partidas');
  v.innerHTML = `
    <div class="head"><h1>Obras</h1><button class="round" id="addObra" aria-label="Nueva obra">${ic('plus')}</button></div>
    ${DEMO ? `<div class="notice">${ic('info', 20)}<div><b>Modo demo.</b> Los datos quedan solo en este equipo. Al configurar el registro en Azure (README) la app se conecta a SharePoint.</div></div>` : ''}
    ${obras.length ? `<div class="group">${obras.map((o) => {
      const ps = partidas.filter((p) => p.ObraUid === o.Uid);
      const av = avance(ps);
      return `<button class="row" data-go="#/obra/${esc(o.Uid)}">
        <div class="main"><div class="t">${esc(o.Title)}${pendIcon(o)}</div>
        <div class="s">${esc(o.Codigo)}${o.Ubicacion ? ' · ' + esc(o.Ubicacion) : ''} · ${ps.length} ${ps.length === 1 ? 'partida' : 'partidas'}</div>
        ${ps.length ? `<div class="bar" role="img" aria-label="Avance ${av}%"><i style="width:${av}%"></i></div>` : ''}</div>
        ${estadoBadge(o.Estado)}<span class="chev">${ic('chev', 18)}</span></button>`;
    }).join('')}</div>` : `
      <div class="empty">${ic('obras', 48)}<b>Sin obras todavía</b>Crea la primera obra para registrar sus partidas, reportes de terreno y protocolos.<br><br>
      <button class="btn" id="addObra2">${ic('plus', 20)} Nueva obra</button></div>`}`;
  $('#addObra').onclick = () => editObra();
  $('#addObra2') && ($('#addObra2').onclick = () => editObra());
}

// Avance ponderado simple: promedio de ejecutado/contrato por partida.
function avance(ps) {
  const val = ps.filter((p) => Number(p.CantContrato) > 0).map((p) => Math.min(1, (Number(p.CantEjecutada) || 0) / Number(p.CantContrato)));
  const proto = ps.filter((p) => !(Number(p.CantContrato) > 0)).map((p) => (p.Estado === 'Protocolizada' ? 1 : 0));
  const all = [...val, ...proto];
  return all.length ? Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 100) : 0;
}

let obraTab = 'partidas';

async function viewObra(v, obraUid) {
  const o = await store.get('obras', obraUid);
  if (!o) { v.innerHTML = '<div class="empty"><b>Obra no encontrada</b></div>'; setNav('', '#/obras'); return; }
  setNav(o.Title, '#/obras');
  const partidas = (await store.all('partidas')).filter((p) => p.ObraUid === obraUid)
    .sort((a, b) => String(a.Item || '').localeCompare(String(b.Item || ''), 'es', { numeric: true }));
  const reportes = (await store.all('reportes')).filter((r) => r.ObraUid === obraUid);
  const protocolos = (await store.all('protocolos')).filter((r) => r.ObraUid === obraUid);
  const av = avance(partidas);
  const mapa = o.Lat && o.Lon ? `<a class="row" href="https://maps.google.com/?q=${o.Lat},${o.Lon}" target="_blank" rel="noopener">${ic('pin', 20)}<div class="main">Ver en el mapa</div><span class="chev">${ic('chev', 18)}</span></a>` : '';

  const tabs = { partidas: `Partidas (${partidas.length})`, reportes: `Reportes (${reportes.length})`, protocolos: `Protocolos (${protocolos.length})` };
  let body = '';
  if (obraTab === 'partidas') {
    body = partidas.length ? `<div class="group">${partidas.map((p) => `
      <button class="row" data-partida="${esc(p.Uid)}"><div class="main"><div class="t">${esc(p.Item ? p.Item + ' ' : '')}${esc(p.Title)}${pendIcon(p)}</div>
      <div class="s">${p.CantContrato ? `${fmtN(p.CantEjecutada)} / ${fmtN(p.CantContrato)} ${esc(p.Unidad)}` : esc(p.Unidad)}</div></div>
      ${estadoBadge(p.Estado)}</button>`).join('')}</div>` : `<div class="empty">Agrega las partidas del contrato para controlar avance y protocolos.</div>`;
    body += `<div style="margin-top:12px"><button class="btn sec" id="addPartida">${ic('plus', 20)} Agregar partida</button></div>`;
  } else {
    const rows = obraTab === 'reportes' ? reportes : protocolos;
    body = (rows.length ? `<div class="group">${rows.map((r) => `<div class="row"><div class="main"><div class="t">${esc(r.Title)}</div><div class="s">${fmtDate(r.Fecha)}${r.Tipo ? ' · ' + esc(TIPOS_PROTOCOLO[r.Tipo]) : ''}</div></div>${estadoBadge(r.Estado)}</div>`).join('')}</div>` : '')
      + formatosPendientes(obraTab);
  }

  v.innerHTML = `
    <div class="head"><h1 style="font-size:1.75rem">${esc(o.Title)}</h1></div>
    <div class="group kv">
      <div class="row"><span class="k">Código</span><span class="v">${esc(o.Codigo)}</span></div>
      <div class="row"><span class="k">Estado</span><span class="v">${estadoBadge(o.Estado)}</span></div>
      ${o.Mandante ? `<div class="row"><span class="k">Mandante</span><span class="v">${esc(o.Mandante)}</span></div>` : ''}
      ${o.Ubicacion ? `<div class="row"><span class="k">Ubicación</span><span class="v">${esc(o.Ubicacion)}</span></div>` : ''}
      ${o.FechaInicio || o.FechaTermino ? `<div class="row"><span class="k">Plazo</span><span class="v">${fmtDate(o.FechaInicio)} – ${fmtDate(o.FechaTermino)}</span></div>` : ''}
      <div class="row"><span class="k">Avance</span><span class="v">${av}%<div class="bar"><i style="width:${av}%"></i></div></span></div>
      ${mapa}
    </div>
    ${o.Notas ? `<p class="foot">${esc(o.Notas)}</p>` : ''}
    <div style="margin-top:10px"><button class="btn sec" id="editObra">Editar obra</button></div>
    <div class="seg" role="tablist">${Object.entries(tabs).map(([k, l]) => `<button role="tab" aria-selected="${k === obraTab}" data-otab="${k}">${l}</button>`).join('')}</div>
    ${body}`;

  $('#editObra').onclick = () => editObra(o);
  v.querySelectorAll('[data-otab]').forEach((b) => (b.onclick = () => { obraTab = b.dataset.otab; route(); }));
  $('#addPartida') && ($('#addPartida').onclick = () => editPartida(obraUid));
  v.querySelectorAll('[data-partida]').forEach((b) => (b.onclick = () => editPartida(obraUid, partidas.find((p) => p.Uid === b.dataset.partida))));
}

const fmtN = (n) => (n === null || n === undefined || n === '' ? '0' : Number(n).toLocaleString('es-CL'));

function formatosPendientes(kind) {
  const que = kind === 'reportes' ? 'el reporte de terreno' : 'los protocolos (PEA, PCO, PIN, PTO, PEO, PRT)';
  return `<div class="notice">${ic('info', 20)}<div>El formulario de ${que} se arma con los formatos de la empresa. Estará disponible en la próxima versión.</div></div>`;
}

async function viewListado(v, kind) {
  const title = kind === 'reportes' ? 'Reportes' : 'Protocolos';
  setNav(title);
  const rows = (await store.all(kind)).sort((a, b) => (b.Fecha || '').localeCompare(a.Fecha || ''));
  const obras = Object.fromEntries((await store.all('obras')).map((o) => [o.Uid, o]));
  v.innerHTML = `<div class="head"><h1>${title}</h1></div>
    ${rows.length ? `<div class="group">${rows.map((r) => `<button class="row" data-go="#/obra/${esc(r.ObraUid)}"><div class="main"><div class="t">${esc(r.Title)}</div>
      <div class="s">${esc(obras[r.ObraUid]?.Title || '—')} · ${fmtDate(r.Fecha)}</div></div>${estadoBadge(r.Estado)}</button>`).join('')}</div>`
      : `<div class="empty">${ic(kind === 'reportes' ? 'rep' : 'prot', 48)}<b>Sin ${title.toLowerCase()}</b>Aquí aparecerán los de todas las obras, del más reciente al más antiguo.</div>`}
    ${formatosPendientes(kind)}`;
}

async function viewAjustes(v) {
  setNav('Ajustes');
  const acc = auth.account();
  const last = await store.meta('lastSync');
  const pend = await store.pendingCount();
  v.innerHTML = `<div class="head"><h1>Ajustes</h1></div>
    <h3>Cuenta</h3>
    <div class="group kv">
      <div class="row"><span class="k">Usuario</span><span class="v">${esc(acc?.name || '—')}</span></div>
      <div class="row"><span class="k">Correo</span><span class="v">${esc(acc?.username || '—')}</span></div>
    </div>
    ${DEMO ? '' : `<div style="margin-top:10px"><button class="btn danger" id="logout">Cerrar sesión</button></div>`}
    <h3>SharePoint</h3>
    <div class="group kv">
      <div class="row"><span class="k">Sitio</span><span class="v">${DEMO ? 'No configurado (modo demo)' : esc(CONFIG.SITE_HOST + CONFIG.SITE_PATH)}</span></div>
      <div class="row"><span class="k">Última sincronización</span><span class="v">${last ? new Date(last).toLocaleString('es-CL') : '—'}</span></div>
      <div class="row"><span class="k">Cambios por subir</span><span class="v">${pend}</span></div>
    </div>
    ${DEMO ? '' : `
    <div style="margin-top:10px">
      <button class="btn" id="syncNow">${ic('sync', 20)} Sincronizar ahora</button>
      <button class="btn sec" id="prov">Revisar / crear listas</button>
    </div>
    <p class="foot">Crear listas requiere ser propietario del sitio. Solo se hace una vez.</p>
    <div class="log" id="provLog" hidden></div>`}
    <h3>Acerca de</h3>
    <div class="group kv"><div class="row"><span class="k">Versión</span><span class="v">${CONFIG.VERSION}</span></div></div>`;
  if (DEMO) return;
  $('#logout').onclick = () => auth.logout();
  $('#syncNow').onclick = () => trySync(true);
  $('#prov').onclick = async () => {
    const log = $('#provLog'); log.hidden = false; log.textContent = '';
    const w = (m) => (log.textContent += m + '\n');
    try { await graph.provision(w); w('Listo.'); } catch (e) { w('Error: ' + e.message); }
  };
}

function viewLogin(v) {
  setNav('');
  $('#tabs').innerHTML = '';
  v.innerHTML = `<div class="empty" style="padding-top:18vh">
    <img src="icon.svg" width="84" height="84" alt="" style="border-radius:20px"><br><br>
    <b style="font-size:1.75rem">Obras DRF</b>Reportes de terreno y protocolos de entrega.<br>Entra con tu cuenta de Atacama Kozan.<br><br>
    <button class="btn" id="login">Iniciar sesión con Microsoft</button></div>`;
  $('#login').onclick = () => auth.login();
}

// ---------- Router ----------

async function route() {
  const v = $('#view');
  if (!DEMO && !auth.account()) return viewLogin(v);
  const [, name = 'obras', arg] = location.hash.split('/');
  renderTabs(name === 'obra' ? 'obras' : name);
  if (name === 'obra') return viewObra(v, decodeURIComponent(arg));
  if (name === 'reportes' || name === 'protocolos') return viewListado(v, name);
  if (name === 'ajustes') return viewAjustes(v);
  return viewObras(v);
}

addEventListener('hashchange', () => {
  obraTab = 'partidas'; // cada obra abre en Partidas
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
  await route();
  await updatePill();
  trySync();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js');
})();
