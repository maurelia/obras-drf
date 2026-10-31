// Interfaz: navegación por hash (#/inicio, #/obras, #/obra/<uid>, #/registros,
// #/nuevo/<tipo>, #/reg/<uid>, #/ajustes).
import { CONFIG, DEMO, HAY_KOZAN } from '../config.js';
import * as auth from './auth.js';
import * as buzon from './buzon.js';
import * as graph from './graph.js';
import * as store from './store.js';
import * as publicar from './publicar.js';
import { ESTADOS_OBRA, ESTADOS_PARTIDA, uid, nextCode } from './schema.js';
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
  down: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  up: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.2 9.4 4.3 4.3 0 0 0 7 18z"/>',
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
const ls = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};
// Dos formas de entrar:
// - 'google': todos (terreno y administrador). Lo firmado queda en el Google Drive del
//   administrador; el perfil lo asigna el administrador y lo entrega el buzón al entrar.
// - 'kozan': cuenta Microsoft, solo consulta lo que ya está en SharePoint.
// En modo demo se elige en la misma pantalla de inicio de sesión, sin contraseña.
const ROLES_TERRENO = ['Supervisor de terraza', 'Topógrafo', 'Operador'];
const ROLES_GOOGLE = ['Administrador', ...ROLES_TERRENO];
const modo = () => { const m = ls.get(DEMO ? 'demoSesion' : 'modo'); return m === 'terreno' ? 'google' : m; };
const esAdmin = () => modo() === 'google' && SES?.rol === 'Administrador';
const esTerreno = () => modo() === 'google' && !esAdmin();
const soloConsulta = () => modo() === 'kozan';
const puedeLlenar = (tipo) => !soloConsulta() && puede(SES?.rol, tipo);
// Visado y subido a SharePoint: es lo que cuenta en el panel (y lo que leerá Power BI).
const enSP = (r) => r.Estado === 'Aprobado' && (!!r.SharePoint || (soloConsulta() && !DEMO));
const porSubir = (regs) => regs.filter((r) => r.Estado === 'Aprobado' && !r.SharePoint);

async function cargarSesion() {
  store.setRemoto(!DEMO && modo() === 'kozan');
  const m = modo();
  if (DEMO) {
    if (!m) return (SES = null);
    if (m === 'kozan') return (SES = { nombre: 'Consulta demo', correo: 'consulta@local', rol: 'Consulta' });
    let rol = null;
    try { rol = localStorage.getItem('demoRol'); } catch {}
    return (SES = { nombre: 'Usuario demo', correo: 'demo@local', rol: ROLES_GOOGLE.includes(rol) ? rol : null });
  }
  if (m === 'google') {
    const p = ls.get('perfilGoogle');
    return (SES = p?.correo ? { nombre: p.nombre, correo: p.correo, rol: ROLES_GOOGLE.includes(p.rol) ? p.rol : null } : null);
  }
  const acc = auth.account();
  if (m !== 'kozan' || !acc) return (SES = null);
  return (SES = { nombre: acc.name || acc.username, correo: (acc.username || '').toLowerCase(), rol: 'Consulta' });
}

// ---------- Marco: tab bar, barra superior, estado de conexión ----------

function renderTabs(active) {
  // En terreno no hay panel de avance: el avance se calcula con lo aprobado en SharePoint.
  $('#tabs').innerHTML = TABS.filter(([id]) => !(esTerreno() && id === 'inicio')).map(([id, label, icon]) =>
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
  const pend = modo() === 'google' ? (await porEnviar()).length : 0;
  const pill = $('#pill');
  const off = !navigator.onLine;
  pill.classList.toggle('show', off || pend > 0);
  $('span', pill).textContent = off ? `Sin conexión${pend ? ` · ${pend} por enviar` : ''}` : `${pend} por enviar · tocar para enviar`;
  pill.onclick = pend && !off ? () => enviarPendientes(true) : null;
}

// ---------- Buzón en Google Drive (terreno y administrador) ----------

const porEnviar = async () => (SES && !DEMO && modo() === 'google'
  ? (await store.all('registros')).filter((r) => r.Estado === 'Enviado' && !r._drive && r.AutorCorreo === SES.correo) : []);

// Sube cada registro firmado (datos + fotos + firma) al Drive del administrador.
// Lo que firma el administrador queda visado de inmediato. Pedir la cuenta Google
// abre una ventana, así que sin token vigente solo se hace tras un toque.
let enviando = null;
function enviarPendientes(manual = false) {
  if (DEMO || modo() !== 'google' || !navigator.onLine || (!manual && !buzon.hayToken())) return updatePill();
  return (enviando ||= (async () => {
    let n = 0;
    try {
      for (const r of await porEnviar()) {
        let rec = await buzon.enviar(r, fileRefs(r.Datos), store.getFile, manual);
        if (esAdmin()) rec = await buzon.estado(rec.Uid, { Estado: 'Aprobado', Revisor: SES.nombre });
        await store.save('registros', { ...rec, _drive: rec.Carpeta || 'ok' });
        if (esAdmin()) await trasVisar(rec);
        n++;
      }
      if (n) toast(esAdmin() ? (n === 1 ? 'Registro visado y guardado en Drive' : `${n} registros visados`)
        : n === 1 ? 'Enviado al administrador' : `${n} registros enviados al administrador`);
    } catch (e) {
      console.error(e);
      toast(`No se pudo enviar (${e.message}). Queda pendiente.`, true);
    } finally { enviando = null; }
    await updatePill();
    if (!formActual) route();
  })());
}

const sinPrivados = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')));

// Perfil, catálogo y estado de lo enviado, según el buzón.
async function aplicarSesion(s) {
  const p = { ...ls.get('perfilGoogle'), correo: s.usuario.correo, rol: s.usuario.rol, ...(s.usuario.nombre ? { nombre: s.usuario.nombre } : {}) };
  ls.set('perfilGoogle', p);
  SES = null; await cargarSesion();
  if (s.obras?.length) await store.reemplazar('obras', s.obras);
  if (s.partidas?.length) await store.reemplazar('partidas', s.partidas);
  for (const m of s.mios || []) {
    const loc = await store.get('registros', m.Uid);
    if (!loc) continue;
    // Lo visado manda; lo demás solo si no hay cambios locales sin enviar.
    if (m.Estado !== 'Aprobado' && (loc.Estado === 'Borrador' || (loc.Estado === 'Enviado' && !loc._drive))) continue;
    await store.save('registros', { Uid: m.Uid, Estado: m.Estado, Codigo: m.Codigo, Correlativo: m.Correlativo, Revisor: m.Revisor, Comentario: m.Comentario, _drive: loc._drive || 'ok' });
  }
  await store.meta('lastSync', new Date().toISOString());
}

// Administrador: baja todo lo que hay en el buzón (usuarios, obras, etapas y registros).
// Se conservan los borradores propios y lo firmado que aún no se envía.
async function bajarDatos(interactivo = false) {
  const d = await buzon.datos(interactivo);
  await store.reemplazar('usuarios', d.usuarios);
  if (d.obras.length) await store.reemplazar('obras', d.obras);
  if (d.partidas.length) await store.reemplazar('partidas', d.partidas);
  await store.reemplazar('registros', d.registros.map((r) => ({ ...r, _drive: r.Carpeta || 'ok' })),
    (r) => r.Estado === 'Borrador' || (r.Estado === 'Enviado' && !r._drive));
  await store.meta('lastSync', new Date().toISOString());
}

// Guarda usuarios, obras o etapas: primero en el buzón (fuente de verdad), luego aquí.
async function persistir(lista, items) {
  if (!DEMO) await buzon.guardar(lista, items.map(sinPrivados));
  for (const it of items) await store.save(lista, it);
}

// Terreno usa el catálogo de obras y etapas que trae la app mientras el buzón no tenga uno.
async function sembrarCatalogo() {
  if ((await store.all('obras')).length) return;
  for (const o of OBRAS_PROYECTO) await store.save('obras', o);
  for (const p of ETAPAS_PROYECTO) await store.save('partidas', p);
}

async function trySync(manual = false) {
  if (DEMO || !navigator.onLine) return updatePill();
  if (modo() === 'google') {
    if (!manual && !buzon.hayToken()) return updatePill();
    await enviarPendientes(manual);
    try {
      if (esAdmin()) await bajarDatos(manual); else await aplicarSesion(await buzon.sesion(manual));
      if (manual) toast('Actualizado desde Google Drive');
    } catch (e) {
      console.error(e);
      if (manual) toast(e.message, true);
    }
  } else if (auth.account()) {
    try {
      await store.sync();
      if (manual) toast('Sincronizado con SharePoint');
    } catch (e) {
      console.error(e);
      if (manual) toast(e.message, true);
    }
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
  // El avance cuenta solo lo visado y subido a SharePoint.
  const filas = filasAvance(registros.filter(enSP));
  const porEtapa = avanceEtapas(partidas, filas);
  return { obras, partidas, registros, filas, porEtapa };
}

// Lo que ve cada uno: el administrador, todo lo recibido; en terreno, lo propio;
// quien consulta con cuenta Kozan, solo lo que está en SharePoint.
const visibles = (regs) => regs.filter((r) => soloConsulta() ? enSP(r)
  : r.AutorCorreo === SES.correo || (esAdmin() && r.Estado !== 'Borrador'));
// El código correlativo lo asigna el administrador al aprobar.
const codigoDe = (r) => r.Codigo || (r.Estado === 'Borrador' ? 'Borrador' : 'Sin código');
const regRow = (r, obras) => `<button class="row" data-go="#/reg/${esc(r.Uid)}">
  <span class="ricon">${ic(FORMS[r.Tipo]?.icon, 20)}</span>
  <div class="main"><div class="t">${esc(codigoDe(r))} · ${esc(FORMS[r.Tipo]?.corto || r.Tipo)}${pendIcon(r)}</div>
  <div class="s">${fmtDate(r.Fecha)}${obras[r.ObraUid] ? ' · ' + esc(obras[r.ObraUid].Codigo) : ''} · ${esc(r.Autor)}</div></div>${estadoBadge(r.Estado)}</button>`;
const pendIcon = (r) => (!DEMO && modo() === 'google' && r.Estado === 'Enviado' && !r._drive ? ' <span class="badge warn" title="Pendiente de envío">●</span>'
  : esAdmin() && r.Estado === 'Aprobado' && r.Tipo && !r.SharePoint ? ' <span class="badge" title="Visado, falta subir a SharePoint">SP</span>' : '');

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
      const rec = { ...sinPrivados(obra), ...d, Uid: obra.Uid || uid() };
      await persistir('obras', [rec]);
      route();
      if (!obra.Uid) location.hash = '#/obra/' + rec.Uid;
    },
  });
}

function editPartida(obraUid, p = {}) {
  openForm({
    title: p.Uid ? 'Editar etapa' : 'Nueva etapa',
    fields: PARTIDA_FIELDS,
    values: { Estado: 'Pendiente', ...p },
    onSave: async (d) => {
      await persistir('partidas', [{ ...sinPrivados(p), ...d, ObraUid: obraUid, Uid: p.Uid || uid() }]);
      route();
    },
  });
}

// Agrega obras y etapas del catálogo que falten (por código / Uid), en el buzón y aquí.
async function cargarCatalogo() {
  if (!DEMO) {
    try { await bajarDatos(true); } catch (e) { return toast(`Sin conexión con el buzón: ${e.message}`, true); }
  }
  const obras = await store.all('obras');
  const porCodigo = Object.fromEntries(obras.map((o) => [(o.Codigo || '').toUpperCase(), o]));
  const nuevasObras = [];
  for (const o of OBRAS_PROYECTO) {
    const ex = porCodigo[o.Codigo];
    if (!ex) nuevasObras.push(o);
    else if (ex.Peso == null && o.Peso) nuevasObras.push({ ...sinPrivados(ex), Peso: o.Peso });
  }
  const partidas = new Set((await store.all('partidas')).map((p) => p.Uid));
  const obraUid = Object.fromEntries([...obras, ...nuevasObras].map((o) => [o.Codigo, o.Uid]));
  const nuevasEtapas = ETAPAS_PROYECTO.filter((p) => !partidas.has(p.Uid)).map((p) => {
    const cod = OBRAS_PROYECTO.find((o) => o.Uid === p.ObraUid).Codigo;
    return { ...p, ObraUid: obraUid[cod] || p.ObraUid };
  });
  try {
    if (nuevasObras.length) await persistir('obras', nuevasObras);
    if (nuevasEtapas.length) await persistir('partidas', nuevasEtapas);
  } catch (e) { return toast(e.message, true); }
  const n = nuevasObras.filter((o) => !porCodigo[o.Codigo]).length;
  toast(n || nuevasEtapas.length ? `${n} obras y ${nuevasEtapas.length} etapas agregadas` : 'Las obras del proyecto ya estaban cargadas');
  route();
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
  const enviados = registros.filter(enSP); // el panel muestra lo publicado en SharePoint
  const deSemana = enviados.filter((r) => r.Fecha >= sem);
  const horas = deSemana.filter((r) => r.Tipo === 'RCM').reduce((s, r) => s + horasRCM(r), 0);
  const ultPCT = enviados.filter((r) => r.Tipo === 'PCT').sort((a, b) => (b.Fecha || '').localeCompare(a.Fecha || ''))[0];
  let conf = null;
  if (ultPCT) {
    const ev = ['rapido', 'disipador'].flatMap((k) => PUNTOS[k].map((p) => evalCota(p.z, ultPCT.Datos?.[k]?.[p.p])).filter(Boolean));
    conf = ev.length ? { pct: (ev.filter((e) => e.nivel === 'ok').length / ev.length) * 100, n: ev.length } : null;
  }
  const porRevisar = esAdmin() ? registros.filter((r) => r.Estado === 'Enviado').length : null;
  const nSubir = esAdmin() ? porSubir(registros).length : 0;
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
      ${porRevisar != null ? tile('Por visar', porRevisar, 'recibidos de terreno', '#/registros?f=revisar') : soloConsulta() ? tile('En SharePoint', visibles(registros).length, 'registros visados', '#/registros') : tile('Mis registros', visibles(registros).length, 'en total', '#/registros')}
    </div>
    ${nSubir ? `<div class="notice">${ic('up', 20)}<div><b>${nSubir} ${nSubir === 1 ? 'registro visado' : 'registros visados'} sin subir a SharePoint.</b> El panel se actualiza al subirlos.<br>
      <button class="btn" data-go="#/registros?f=subir" style="margin-top:8px">Revisar y subir</button></div></div>` : ''}

    <h3>Avance acumulado</h3>
    <div class="group chartbox">${chartSerie(serie)}</div>
    <details class="foot tabla"><summary>Ver como tabla</summary><table class="dt"><thead><tr><th>Fecha</th><th>Avance global</th></tr></thead>
      <tbody>${serie.map((p) => `<tr><td>${fmtDate(p.fecha)}</td><td class="num">${fmtPct(p.v)}</td></tr>`).join('')}</tbody></table></details>
    <p class="foot">Parte del avance al ${fmtDate(FECHA_BASE)} según la planilla de control LJ; desde ahí suman los protocolos diarios visados y subidos a SharePoint.</p>

    <h3>Avance por obra</h3>
    <div class="group">${conPeso.map((o) => {
      const a = avanceObra(o.Uid, partidas, porEtapa) ?? 0;
      return `<button class="row" data-go="#/obra/${esc(o.Uid)}"><div class="main"><div class="t">${esc(o.Title)}</div>
        <div class="s">${esc(o.Codigo)} · peso ${fmtN(o.Peso)} %</div><div class="bar"><i style="width:${a}%"></i></div></div>
        <span class="pct">${fmtPct(a, 0)}</span><span class="chev">${ic('chev', 18)}</span></button>`;
    }).join('') || '<div class="row">Ninguna obra tiene peso asignado.</div>'}</div>

    <h3>Últimos registros</h3>
    ${ultimos.length ? `<div class="group">${ultimos.map((r) => regRow(r, obrasMap)).join('')}</div>` : '<p class="foot">Todavía no hay registros.</p>'}`;
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

const demoNotice = () => (DEMO ? `<div class="notice">${ic('info', 20)}<div><b>Modo demo.</b> Los datos quedan solo en este equipo. Perfil de prueba: ${esc(SES?.rol)} (cámbialo en Ajustes o cierra sesión).</div></div>` : '');

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
  const subir = porSubir(registros);
  const segs = soloConsulta() ? { todos: 'En SharePoint' } : esAdmin()
    ? { revisar: `Por visar (${registros.filter((r) => r.Estado === 'Enviado').length})`, subir: `Por subir (${subir.length})`, todos: 'Todos', mios: 'Míos' }
    : { mios: 'Míos', pendientes: `Borradores (${mios.filter((r) => r.Estado === 'Observado' || r.Estado === 'Borrador').length})` };
  const f = segs[filtro] ? filtro : Object.keys(segs)[0];
  const rows = (f === 'revisar' ? registros.filter((r) => r.Estado === 'Enviado')
    : f === 'subir' ? subir
      : f === 'todos' ? visibles(registros)
        : f === 'pendientes' ? mios.filter((r) => r.Estado === 'Observado' || r.Estado === 'Borrador') : mios)
    .sort((a, b) => (b.Fecha || '').localeCompare(a.Fecha || '') || (b.Correlativo || 0) - (a.Correlativo || 0));
  const tipos = Object.keys(FORMS).filter(puedeLlenar);
  const nPend = (await porEnviar()).length;
  const vacio = { revisar: ['Nada por visar', DEMO ? '' : 'Usa ↻ para traer lo último que llegó a tu Google Drive.'], subir: ['Nada por subir', 'Todo lo visado ya está en SharePoint.'] }[f]
    || ['Sin registros', tipos.length ? 'Usa el botón + para llenar un protocolo o registro.' : 'Aquí aparecerán los registros visados y subidos a SharePoint.'];
  v.innerHTML = `<div class="head"><h1>Registros</h1><span class="hbtns">${!DEMO && !soloConsulta() ? `<button class="round sec" id="actualizar" aria-label="Actualizar desde Google Drive">${ic('sync')}</button>` : ''}${tipos.length ? `<button class="round" id="nuevo" aria-label="Nuevo registro">${ic('plus')}</button>` : ''}</span></div>
    ${nPend ? `<div class="notice">${ic('send', 20)}<div><b>${nPend} ${nPend === 1 ? 'registro' : 'registros'} por enviar.</b> ${esAdmin() ? 'Se guardan en tu Google Drive' : 'Se envían al administrador'} cuando hay señal.<br><button class="btn" id="enviarYa" style="margin-top:8px">Enviar ahora</button></div></div>` : ''}
    <div class="seg" role="tablist">${Object.entries(segs).map(([k, l]) => `<button role="tab" aria-selected="${k === f}" data-go="#/registros?f=${k}">${l}</button>`).join('')}</div>
    ${f === 'subir' && rows.length ? `<div class="notice">${ic('up', 20)}<div>Se suben a <b>${esc(DEMO ? 'SharePoint (simulado en modo demo)' : CONFIG.SITE_PATH + ' › ' + CONFIG.CARPETA)}</b>: PDF del protocolo, fotos y firmas por código, y la fila en la lista que alimenta el panel.<br>
      <button class="btn" id="subirTodo" style="margin-top:8px">${ic('up', 20)} Subir ${rows.length} a SharePoint</button></div></div>` : ''}
    ${rows.length ? `<div class="group">${rows.map((r) => regRow(r, obrasMap)).join('')}</div>`
      : `<div class="empty">${ic('prot', 48)}<b>${vacio[0]}</b>${vacio[1]}</div>`}`;
  $('#nuevo') && ($('#nuevo').onclick = () => elegirTipo(tipos));
  $('#actualizar') && ($('#actualizar').onclick = () => trySync(true));
  $('#enviarYa') && ($('#enviarYa').onclick = () => enviarPendientes(true));
  $('#subirTodo') && ($('#subirTodo').onclick = () => subirSharePoint(rows));
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
  if (!spec || (!reg && !puedeLlenar(tipo))) { location.hash = '#/registros'; return; }
  const ctx = { obras, partidas, registros, usuario: SES.nombre, regUid: reg?.Uid || uid() };
  const propio = !reg || reg.AutorCorreo === SES.correo;
  const editable = (!reg && puedeLlenar(tipo)) || (reg && ['Borrador', 'Observado'].includes(reg.Estado) && propio && !soloConsulta());
  setNav(reg?.Codigo || spec.corto, '#/registros');

  if (!editable) return viewDoc(v, reg, ctx);

  v.innerHTML = `<div class="head"><h1 style="font-size:1.6rem">${esc(spec.titulo)}</h1></div>
    <p class="foot">${tipo}${spec.rev ? ' · ' + esc(spec.rev) : ''} · ${reg?.Codigo ? esc(reg.Codigo) : 'el código se asigna al aprobar'}</p>
    ${reg?.Estado === 'Observado' ? `<div class="notice bad">${ic('info', 20)}<div><b>Observado por ${esc(reg.Revisor || 'el revisor')}.</b> ${esc(reg.Comentario || '')}<br>Corrige y vuelve a enviar.</div></div>` : ''}
    <div id="frm"></div>
    <p class="err" id="errs" hidden></p>
    <div class="actions noprint">
      <button class="btn" id="enviar">${esAdmin() ? 'Firmar y visar' : 'Firmar y enviar'}</button>
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
      Estado: enviar ? 'Enviado' : reg?.Estado || 'Borrador', Title: `${reg?.Codigo || 'Borrador'} ${spec.corto}`,
    };
    // "Enviar" deja el registro en cola para el buzón de Google Drive; lo que firma el
    // administrador queda visado al llegar allá (en modo demo, de inmediato).
    if (enviar) rec._drive = DEMO ? 'demo' : null;
    await store.save('registros', rec);
    if (enviar && DEMO && esAdmin()) await trasVisar(await visar(rec));
    dirty = false;
    return true;
  };

  formActual = { guardarSiCambio: () => (dirty ? guardar(false) : null) };
  $('#enviar').onclick = async () => {
    if (await guardar(true)) {
      formActual = null;
      toast(DEMO ? (esAdmin() ? 'Registro visado' : 'Registro enviado') : esAdmin() ? 'Registro firmado; guardando en tu Drive…' : 'Registro firmado; enviando al administrador…');
      await updatePill(); enviarPendientes(true); location.hash = '#/reg/' + ctx.regUid; route();
    }
  };
  $('#borrador').onclick = async () => {
    await guardar(false); formActual = null; toast('Borrador guardado'); await updatePill();
    if (!reg) location.replace('#/reg/' + ctx.regUid); else route();
  };
  $('#descartar') && ($('#descartar').onclick = async () => {
    formActual = null; await store.remove('registros', reg.Uid); toast('Borrador descartado'); await updatePill(); location.hash = '#/registros';
  });
}

// Visar (aprobar): el buzón asigna el código correlativo y lo anota en el Drive.
// Recién visado se puede subir a SharePoint.
async function visar(reg, extra = {}) {
  if (DEMO) {
    const rec = { ...reg, ...extra, Estado: 'Aprobado', Revisor: SES.nombre, Visado: new Date().toISOString() };
    if (!rec.Codigo) Object.assign(rec, nextCode(rec.Tipo, (await store.all('registros')).filter((r) => r.Uid !== rec.Uid)));
    rec.Title = `${rec.Codigo} ${FORMS[rec.Tipo].corto}`;
    return store.save('registros', rec);
  }
  const r = await buzon.estado(reg.Uid, { Estado: 'Aprobado', Revisor: SES.nombre, ...extra });
  return store.save('registros', { ...r, _drive: r.Carpeta || 'ok' });
}

// Observar: vuelve al autor, que lo ve al sincronizar (y por correo), corrige y reenvía.
async function observar(reg, Comentario) {
  const cambios = { Estado: 'Observado', Revisor: SES.nombre, Comentario };
  if (DEMO) return store.save('registros', { Uid: reg.Uid, ...cambios });
  const r = await buzon.estado(reg.Uid, cambios);
  return store.save('registros', { ...r, _drive: r.Carpeta || 'ok' });
}

// La revisión de un transmittal (PRV) lo visa u observa según su resultado.
async function trasVisar(rec) {
  const d = rec.Datos || {};
  if (rec.Tipo !== 'PRV' || !d.transmittal) return;
  const trt = await store.get('registros', d.transmittal);
  if (!trt || trt.Estado === 'Aprobado') return;
  const nota = `${rec.Codigo}: ${d.resultado}${d.comentario ? ' – ' + d.comentario : ''}`;
  if (d.resultado !== 'Requiere corrección') await visar(trt, { Comentario: nota });
  else await observar(trt, nota);
}

function avisar(reg) {
  const t = `${FORMS[reg.Tipo].corto} del ${fmtDate(reg.Fecha)}`;
  const body = `Hola ${reg.Autor}:\n\nTu registro "${t}" tiene observaciones:\n\n${reg.Comentario || ''}\n\n`
    + 'Corrígelo en la app Obras DRF (Registros → Borradores → abre el registro, corrige y vuelve a enviar).\n\n' + SES.nombre;
  location.href = `mailto:${reg.AutorCorreo}?subject=${encodeURIComponent('Obras DRF: ' + t + ' observado')}&body=${encodeURIComponent(body)}`;
}

// Fotos, firmas y adjuntos de un registro; los que no están en el equipo se bajan del buzón.
async function archivosDe(reg) {
  const refs = fileRefs(reg.Datos);
  const faltan = [];
  for (const r of refs) if (!(await store.getFile(r.fid))?.blob) faltan.push(r);
  if (faltan.length && !DEMO) {
    for (const a of await buzon.archivos(reg.Uid)) await store.putFile({ id: a.fid, blob: a.blob, name: a.name, type: a.type, regUid: reg.Uid });
  }
  const out = [];
  for (const r of refs) {
    const f = await store.getFile(r.fid);
    if (f?.blob) out.push({ fid: r.fid, name: f.name || r.name, blob: f.blob });
  }
  return out;
}

// Botón del administrador: sube lo visado a la carpeta de Obras Fluviales en SharePoint.
async function subirSharePoint(regs) {
  regs = regs.filter((r) => r.Estado === 'Aprobado');
  if (!regs.length) return;
  if (!DEMO && !HAY_KOZAN) return toast('Falta conectar SharePoint: CLIENT_ID, TENANT_ID y SITE_HOST en config.js', true);
  if (!navigator.onLine) return toast('Sin conexión', true);
  const dlg = $('#sheet');
  dlg.innerHTML = `<div class="sh-head"><span class="navbtn"></span><h2 id="shTitle">Subir a SharePoint</h2><button type="button" class="navbtn" data-x style="font-weight:600" disabled>Listo</button></div>
    <div class="sh-body"><p class="foot">${regs.length} ${regs.length === 1 ? 'registro' : 'registros'} → ${esc(CONFIG.CARPETA)}</p><div class="log" id="spLog"></div></div>`;
  const listo = $('[data-x]', dlg);
  listo.onclick = () => { dlg.close(); route(); };
  dlg.showModal();
  const logEl = $('#spLog');
  const log = (m) => { logEl.textContent += m + '\n'; logEl.scrollTop = logEl.scrollHeight; };
  let n = 0;
  try {
    if (!DEMO) { log('Cuenta Microsoft…'); await auth.conectar(); }
    const { obras, partidas, registros } = await datos();
    const ctx = { obras, partidas, registros, usuario: SES.nombre };
    await publicar.subir(regs, {
      ctx, obras: obras.map(sinPrivados), partidas: partidas.map(sinPrivados), archivosDe, log,
      alSubir: async (reg, info) => {
        const sp = { fecha: info.fecha, url: info.url, carpeta: info.carpeta };
        if (DEMO) await store.save('registros', { Uid: reg.Uid, SharePoint: sp });
        else { const r = await buzon.estado(reg.Uid, { SharePoint: sp }); await store.save('registros', { ...r, _drive: r.Carpeta || 'ok' }); }
        n++;
      },
    });
    log(`Listo: ${n} ${n === 1 ? 'registro subido' : 'registros subidos'}. El panel ya los incluye.`);
  } catch (e) {
    console.error(e);
    log(`Error: ${e.message}`);
    if (n) log(`(${n} alcanzaron a subirse; vuelve a intentar con el resto)`);
  }
  listo.disabled = false;
}

// Vista de lectura / impresión, con visado y subida a SharePoint del administrador.
async function viewDoc(v, reg, ctx) {
  const revisable = esAdmin() && reg.Estado === 'Enviado' && (DEMO || !!reg._drive);
  const subible = esAdmin() && reg.Estado === 'Aprobado' && !reg.SharePoint;
  const avisable = esAdmin() && reg.Estado === 'Observado' && reg.AutorCorreo !== SES.correo && !DEMO;
  const propioEnviado = esTerreno() && reg.AutorCorreo === SES.correo && reg.Estado === 'Enviado';
  const estadoEnvio = propioEnviado && !DEMO ? (reg._drive
    ? `<div class="notice noprint">${ic('check', 20)}<div><b>Enviado al administrador.</b> Queda en revisión. Si te piden corregir, usa «Corregir y reenviar».</div></div>`
    : `<div class="notice noprint">${ic('send', 20)}<div><b>Pendiente de envío.</b> Se enviará cuando haya señal.</div></div>`) : '';
  const sp = reg.SharePoint;
  const enSharePoint = sp && !esTerreno() ? `<div class="notice noprint">${ic('cloud', 20)}<div><b>En SharePoint</b> desde el ${new Date(sp.fecha).toLocaleString('es-CL')}<br>
    <small>${esc(sp.carpeta || '')}</small><br><a href="${esc(sp.url)}" target="_blank" rel="noopener">Abrir PDF</a></div></div>`
    : subible ? `<div class="notice noprint">${ic('up', 20)}<div><b>Visado.</b> Falta subirlo a SharePoint para que cuente en el panel.</div></div>` : '';
  v.innerHTML = `<div class="actions top noprint">
      <button class="btn sec" id="print">${ic('print', 20)} Imprimir / guardar PDF</button>
      ${revisable ? `<button class="btn" id="aprobar">${ic('check', 20)} Visar</button><button class="btn danger" id="observar">Observar</button>` : ''}
      ${subible ? `<button class="btn" id="subirSP">${ic('up', 20)} Subir a SharePoint</button>` : ''}
      ${avisable ? `<button class="btn sec" id="avisar">Avisar al autor por correo</button>` : ''}
      ${propioEnviado && !DEMO && !reg._drive ? `<button class="btn" id="enviarYa">${ic('send', 20)} Enviar ahora</button>` : ''}
      ${propioEnviado ? `<button class="btn sec" id="corregir">Corregir y reenviar</button>` : ''}
    </div>${estadoEnvio}${enSharePoint}
    ${renderDoc(reg, ctx)}`;
  $('#print').onclick = () => print();
  $('#avisar') && ($('#avisar').onclick = () => avisar(reg));
  $('#enviarYa') && ($('#enviarYa').onclick = () => enviarPendientes(true));
  $('#subirSP') && ($('#subirSP').onclick = () => subirSharePoint([reg]));
  $('#corregir') && ($('#corregir').onclick = async () => {
    await store.save('registros', { Uid: reg.Uid, Estado: 'Borrador', _drive: null });
    await updatePill(); route();
  });
  if (revisable) {
    $('#aprobar').onclick = async (ev) => {
      ev.target.disabled = true;
      try {
        const r = await visar(reg);
        await trasVisar(r);
        toast(`Visado como ${r.Codigo}`); route();
      } catch (e) { toast(e.message, true); ev.target.disabled = false; }
    };
    $('#observar').onclick = () => openForm({
      title: 'Observar registro', saveLabel: 'Observar',
      fields: [{ name: 'Comentario', label: 'Qué debe corregir', type: 'textarea', required: true }],
      onSave: async ({ Comentario }) => {
        const r = await observar(reg, Comentario);
        toast('Observado: el autor lo verá al sincronizar'); route();
        if (!DEMO && r.AutorCorreo !== SES.correo) avisar(r);
      },
    });
  }
  // El administrador puede no tener las fotos en este equipo: se bajan del buzón.
  if (esAdmin() && !DEMO && fileRefs(reg.Datos).length) {
    try { await archivosDe(reg); } catch (e) { toast(`No se pudieron bajar las fotos (${e.message})`, true); }
  }
  hydrate(v);
}

const USUARIO_FIELDS = [
  { name: 'Title', label: 'Nombre', required: true },
  { name: 'Correo', label: 'Cuenta Google', type: 'email', required: true, ph: 'correo@gmail.com o de empresa' },
  { name: 'Rol', label: 'Perfil', type: 'select', options: ROLES_GOOGLE },
  { name: 'Activo', label: 'Activo', type: 'select', options: ['Sí', 'No'] },
];
function editUsuario(u = {}) {
  openForm({
    title: u.Uid ? 'Editar usuario' : 'Nuevo usuario',
    fields: USUARIO_FIELDS,
    values: { Rol: 'Operador', ...u, Activo: u.Activo === false ? 'No' : 'Sí' },
    onSave: async (d) => {
      await persistir('usuarios', [{ ...sinPrivados(u), ...d, Correo: d.Correo.toLowerCase(), Activo: d.Activo === 'Sí', Uid: u.Uid || uid() }]);
      route();
    },
  });
}

function cerrarSesion() {
  if (DEMO) { ls.del('demoSesion'); SES = null; location.hash = ''; return route(); }
  const m = modo();
  ls.del('modo');
  if (m === 'google') { buzon.olvidar(); ls.del('perfilGoogle'); SES = null; store.setRemoto(false); location.hash = ''; return route(); }
  auth.logout();
}

const filaKV = (k, val) => `<div class="row"><span class="k">${esc(k)}</span><span class="v">${val}</span></div>`;
const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-CL') : '—');

// Ajustes en terreno: cuenta Google, perfil asignado y envíos pendientes.
async function ajustesTerreno(v) {
  const pend = (await porEnviar()).length;
  v.innerHTML = `<div class="head"><h1>Ajustes</h1></div>
    <h3>Cuenta Google</h3>
    <div class="group kv">${filaKV('Usuario', esc(SES.nombre))}${filaKV('Correo', esc(SES.correo))}${filaKV('Perfil', esc(SES.rol))}</div>
    <p class="foot">El perfil lo asigna el administrador del proyecto.</p>
    <h3>Envíos</h3>
    <div class="group kv">${filaKV('Por enviar', pend)}${filaKV('Última actualización', fechaHora(await store.meta('lastSync')))}</div>
    <div style="margin-top:10px">${pend ? `<button class="btn" id="enviarYa">${ic('send', 20)} Enviar pendientes</button>` : ''}
      <button class="btn sec" id="syncNow">${ic('sync', 20)} Actualizar estado</button>
      <button class="btn danger" id="logout" ${pend ? 'disabled' : ''}>Cerrar sesión</button></div>
    <p class="foot">${pend ? 'Envía los pendientes antes de cerrar sesión. ' : ''}Lo que firmas queda guardado en el Google Drive del administrador del proyecto; tu cuenta solo se usa para identificarte.</p>
    <h3>Acerca de</h3>
    <div class="group kv">${filaKV('Versión', CONFIG.VERSION)}</div>`;
  $('#enviarYa') && ($('#enviarYa').onclick = () => enviarPendientes(true));
  $('#syncNow').onclick = () => trySync(true);
  $('#logout').onclick = cerrarSesion;
}

// Ajustes de quien consulta con cuenta Kozan.
async function ajustesConsulta(v) {
  v.innerHTML = `<div class="head"><h1>Ajustes</h1></div>
    <h3>Cuenta</h3>
    <div class="group kv">${filaKV('Usuario', esc(SES.nombre))}${filaKV('Correo', esc(SES.correo))}${filaKV('Acceso', 'Consulta de lo publicado en SharePoint')}</div>
    <div style="margin-top:10px"><button class="btn danger" id="logout">Cerrar sesión</button></div>
    <h3>SharePoint</h3>
    <div class="group kv">${filaKV('Sitio', DEMO ? 'Modo demo' : esc(CONFIG.SITE_HOST + CONFIG.SITE_PATH))}${filaKV('Última sincronización', fechaHora(await store.meta('lastSync')))}</div>
    ${DEMO ? '' : `<div style="margin-top:10px"><button class="btn" id="syncNow">${ic('sync', 20)} Sincronizar ahora</button></div>`}
    <h3>Acerca de</h3>
    <div class="group kv">${filaKV('Versión', CONFIG.VERSION)}</div>`;
  $('#logout').onclick = cerrarSesion;
  $('#syncNow') && ($('#syncNow').onclick = () => trySync(true));
}

async function viewAjustes(v) {
  setNav('Ajustes');
  if (soloConsulta()) return ajustesConsulta(v);
  if (esTerreno() && !DEMO) return ajustesTerreno(v);
  const usuarios = (await store.all('usuarios')).sort((a, b) => (a.Title || '').localeCompare(b.Title || ''));
  const registros = await store.all('registros');
  const ms = DEMO ? null : auth.account();
  v.innerHTML = `<div class="head"><h1>Ajustes</h1></div>
    <h3>Cuenta Google</h3>
    <div class="group kv">${filaKV('Usuario', esc(SES.nombre))}${filaKV('Correo', esc(SES.correo))}${filaKV('Perfil', esc(SES.rol))}</div>
    ${DEMO ? `<div class="group" style="margin-top:10px"><div class="field"><label for="demoRol">Perfil de prueba</label><select id="demoRol">${ROLES_GOOGLE.map((r) => `<option${r === SES.rol ? ' selected' : ''}>${r}</option>`).join('')}</select></div></div>
      <p class="foot">Solo en modo demo: cambia el perfil para ver la app como topógrafo, operador o supervisor.</p>` : ''}
    <div style="margin-top:10px"><button class="btn danger" id="logout">Cerrar sesión</button></div>
    ${esAdmin() ? `
    <h3>Datos en Google Drive</h3>
    <div class="group kv">${filaKV('Ubicación', DEMO ? 'Modo demo: solo este equipo' : `Drive de ${esc(SES.correo)} › Obras DRF`)}
      ${filaKV('Registros', registros.filter((r) => r.Estado !== 'Borrador').length)}${filaKV('Última actualización', fechaHora(await store.meta('lastSync')))}</div>
    ${DEMO ? '' : `<div style="margin-top:10px"><button class="btn" id="syncNow">${ic('sync', 20)} Actualizar ahora</button></div>`}
    <p class="foot">Todo lo que se firma en terreno llega a la carpeta «Obras DRF» de tu Google Drive (un subcarpeta por registro, con su JSON, fotos y firmas).</p>
    <h3>SharePoint de proyectos</h3>
    <div class="group kv">${filaKV('Sitio', DEMO ? 'Simulado (modo demo)' : HAY_KOZAN ? esc(CONFIG.SITE_HOST + CONFIG.SITE_PATH) : 'Sin configurar')}
      ${filaKV('Carpeta', esc(CONFIG.CARPETA))}${filaKV('Cuenta Microsoft', DEMO ? '—' : ms ? esc(ms.username) : 'No conectada')}
      ${filaKV('Visados por subir', porSubir(registros).length)}</div>
    ${!DEMO && HAY_KOZAN ? `<div style="margin-top:10px">${ms ? '<button class="btn sec" id="msOut">Desconectar cuenta Microsoft</button>' : '<button class="btn sec" id="msIn">Conectar cuenta Microsoft</button>'}
      <button class="btn sec" id="prov">Revisar / crear listas</button></div><div class="log" id="provLog" hidden></div>` : ''}
    <p class="foot">Al subir, cada registro visado deja su PDF, fotos y firmas en ${esc(CONFIG.CARPETA)}/&lt;tipo&gt;/&lt;código&gt;, y una fila en las listas ${esc(CONFIG.LIST_PREFIX)}Obras, ${esc(CONFIG.LIST_PREFIX)}Partidas y ${esc(CONFIG.LIST_PREFIX)}Registros (base del panel y de Power BI).</p>
    <h3>Usuarios y perfiles</h3>
    ${usuarios.length ? `<div class="group">${usuarios.map((u) => `<button class="row" data-user="${esc(u.Uid)}"><div class="main"><div class="t">${esc(u.Title)}</div>
      <div class="s">${esc(u.Correo)}</div></div><span class="badge ${u.Activo === false ? 'bad' : ''}">${u.Activo === false ? 'Inactivo' : esc(u.Rol)}</span></button>`).join('')}</div>`
      : '<p class="foot">Sin usuarios. Agrega la cuenta Google de cada persona de terreno con su perfil: sin eso el buzón no le recibe envíos.</p>'}
    <div style="margin-top:10px"><button class="btn sec" id="addUser">${ic('plus', 20)} Agregar usuario</button></div>
    <p class="foot">Todos entran con su cuenta Google (correo personal o de empresa). Quien publicó el buzón es siempre administrador. Supervisor de terraza: PDA, RCM y PHU. Topógrafo: PDA, PCT, PTT, TRT y PND. Operador: PDA, RCM y PHU. Quien solo consulta entra con su cuenta Kozan y ve lo publicado en SharePoint.</p>
    <h3>Proyecto</h3>
    <div><button class="btn sec" id="cargar">Cargar obras y etapas del proyecto</button></div>
    <p class="foot">Agrega solo las que falten (11 obras, con pesos y etapas de la planilla de control LJ).</p>` : ''}
    <h3>Acerca de</h3>
    <div class="group kv">${filaKV('Versión', CONFIG.VERSION)}</div>`;
  $('#demoRol') && ($('#demoRol').onchange = async (e) => {
    try { localStorage.setItem('demoRol', e.target.value); } catch {}
    SES = null; await cargarSesion(); route();
  });
  $('#cargar') && ($('#cargar').onclick = cargarCatalogo);
  $('#addUser') && ($('#addUser').onclick = () => editUsuario());
  v.querySelectorAll('[data-user]').forEach((b) => (b.onclick = () => editUsuario(usuarios.find((u) => u.Uid === b.dataset.user))));
  $('#logout').onclick = cerrarSesion;
  $('#syncNow') && ($('#syncNow').onclick = () => trySync(true));
  $('#msIn') && ($('#msIn').onclick = async () => { try { await auth.conectar(); route(); } catch (e) { toast(e.message, true); } });
  $('#msOut') && ($('#msOut').onclick = async () => { await auth.desconectar(); route(); });
  $('#prov') && ($('#prov').onclick = async () => {
    const log = $('#provLog'); log.hidden = false; log.textContent = '';
    const w = (m) => (log.textContent += m + '\n');
    try { await graph.provision(w); w('Listo.'); } catch (e) { w('Error: ' + e.message); }
  });
}

function viewLogin(v) {
  setNav('');
  $('#tabs').innerHTML = '';
  v.innerHTML = `<div class="empty" style="padding-top:14vh">
    <img src="icon.svg" width="84" height="84" alt="" style="border-radius:20px"><br><br>
    <b style="font-size:1.75rem">Obras DRF</b>Protocolos, reportes de operación y avance de obras.<br><br>
    <button class="btn" id="loginG">${GOOGLE_G} Entrar con Google</button>
    <p class="foot">Administrador, supervisores, topógrafos y operadores, con su correo personal o de empresa.</p>
    ${HAY_KOZAN || DEMO ? `<button class="btn sec" id="loginM">Solo consulta · cuenta Kozan (Microsoft)</button>
      <p class="foot">Ver lo publicado en SharePoint.</p>` : ''}
    ${DEMO ? `<div class="notice" style="text-align:left">${ic('info', 20)}<div><b>Modo demo.</b> La app aún no está conectada a Google: estos botones entran sin contraseña y los datos quedan solo en este equipo.</div></div>` : ''}</div>`;
  if (DEMO) {
    const entrar = (m, rol) => { ls.set('demoSesion', m); try { localStorage.setItem('demoRol', rol); } catch {} SES = null; route(); };
    $('#loginG').onclick = () => entrar('google', '');
    $('#loginM').onclick = () => entrar('kozan', '');
    return;
  }
  $('#loginM') && ($('#loginM').onclick = () => { ls.set('modo', 'kozan'); auth.login(); });
  $('#loginG').onclick = async (ev) => {
    const b = ev.currentTarget;
    b.disabled = true;
    try {
      const u = await buzon.login();
      ls.set('perfilGoogle', { nombre: u.nombre, correo: u.correo, rol: u.rol });
      ls.set('modo', 'google');
      await aplicarSesion(u.sesion);
      if (esAdmin()) await bajarDatos(true).catch((e) => toast(e.message, true));
      location.hash = '';
      route(); updatePill();
    } catch (e) { toast(e.message, true); b.disabled = false; }
  };
}
const GOOGLE_G = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" style="background:#fff;border-radius:50%;padding:2px"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.6 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.2-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';

// Solo en modo demo: elegir el perfil de prueba (en la app real lo asigna el administrador).
function viewPerfil(v) {
  setNav('');
  $('#tabs').innerHTML = '';
  v.innerHTML = `<div class="head"><h1>Perfil de prueba</h1></div>
    <p class="foot">Modo demo: elige el perfil con que quieres probar la app. En la app conectada, el perfil lo asigna el administrador a cada cuenta Google.</p>
    <div class="group"><div class="field"><label for="pr">Perfil</label><select id="pr">${ROLES_GOOGLE.map((r) => `<option>${r}</option>`).join('')}</select></div></div>
    <div style="margin-top:12px"><button class="btn" id="ok">Continuar</button><button class="btn danger" id="salir">Volver</button></div>`;
  $('#ok').onclick = () => {
    try { localStorage.setItem('demoRol', $('#pr').value); } catch {}
    SES = null; location.hash = $('#pr').value === 'Administrador' ? '#/inicio' : '#/registros'; route();
  };
  $('#salir').onclick = cerrarSesion;
}

async function viewSinAcceso(v) {
  setNav('');
  $('#tabs').innerHTML = '';
  v.innerHTML = `<div class="empty" style="padding-top:16vh">${ic('info', 48)}
    <b>Cuenta sin perfil asignado</b>
    Tu cuenta (${esc(SES.correo)}) aún no está autorizada en Obras DRF. Pide al administrador del proyecto que la agregue con tu perfil y luego toca Reintentar.<br><br>
    <button class="btn" id="retry">${ic('sync', 20)} Reintentar</button><button class="btn danger" id="logout">Cerrar sesión</button></div>`;
  $('#retry').onclick = async () => {
    try { await aplicarSesion(await buzon.sesion(true)); if (esAdmin()) await bajarDatos(true); } catch (e) { toast(e.message, true); }
    route();
  };
  $('#logout').onclick = cerrarSesion;
}

// ---------- Router ----------

async function route() {
  const v = $('#view');
  if (!SES) await cargarSesion();
  if (!SES) return viewLogin(v);
  if (DEMO && modo() === 'google' && !SES.rol) return viewPerfil(v);
  if (!SES.rol) return viewSinAcceso(v);
  if (esTerreno()) await sembrarCatalogo();
  const [path, query = ''] = location.hash.slice(1).split('?');
  let [, name = 'inicio', arg] = path.split('/');
  if (!name || (name === 'inicio' && esTerreno())) name = esTerreno() ? 'registros' : 'inicio';
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
