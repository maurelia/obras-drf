// Motor de formularios: con una definición de forms.js arma la pantalla de llenado
// (renderForm) y el documento para revisar, imprimir o guardar como PDF (renderDoc).
import { FORMS, PUNTOS, evalCota } from './forms.js';
import { PROYECTO } from '../config.js';
import * as store from './store.js';
import { uid } from './schema.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Fecha local (no UTC: en Chile después de las 21:00 UTC ya es el día siguiente).
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const fmtDate = (d) => (d ? new Date(d.length === 10 ? d + 'T12:00' : d).toLocaleDateString('es-CL') : '');
const fmtNum = (n, dec) => (n === '' || n == null || isNaN(n) ? '' : Number(n).toLocaleString('es-CL', dec != null ? { minimumFractionDigits: dec, maximumFractionDigits: dec } : {}));
const vacio = (v) => v == null || v === '' || (Array.isArray(v) && !v.length);
const NIVEL_TXT = { ok: 'Conforme', warn: 'Observación', bad: 'Fuera de tolerancia' };

// ---------- Valores iniciales ----------

export function initialData(tipo, ctx) {
  const d = {};
  for (const s of FORMS[tipo].secciones) for (const c of s.campos) {
    if (c.type === 'table') d[c.k] = c.rows ? c.rows.map((r) => ({ [c.cols[0].k]: r })) : Array.from({ length: c.minRows ?? 1 }, () => ({}));
    else if (c.type === 'points' || c.type === 'checklist') d[c.k] = {};
    else if (c.type === 'firmas') d[c.k] = c.etapas.map(() => ({}));
    else if (c.def === 'hoy') d[c.k] = today();
    else if (c.def === 'usuario') d[c.k] = ctx.usuario;
    else if (c.def != null) d[c.k] = c.def;
  }
  if (FORMS[tipo].obraFija) d.obra = FORMS[tipo].obraFija;
  return d;
}

// ---------- Opciones dependientes de los datos ----------

const obraLabel = (o) => `${o.Codigo} · ${o.Title}`;
function optionsFor(c, ctx) {
  if (c.type === 'obra') return [...ctx.obras].sort((a, b) => a.Codigo.localeCompare(b.Codigo, 'es', { numeric: true })).map((o) => [o.Uid, obraLabel(o)]);
  if (c.type === 'registro') return ctx.registros.filter((r) => r.Tipo === c.tipo && r.Estado !== 'Borrador')
    .sort((a, b) => (b.Fecha || '').localeCompare(a.Fecha || '')).map((r) => [r.Uid, `${r.Codigo} · ${fmtDate(r.Fecha)} · ${r.Autor}`]);
  return (c.options || []).map((o) => [o, o]);
}
function etapaOptions(ctx, v) {
  const byObra = {};
  for (const p of ctx.partidas) (byObra[p.ObraUid] ||= []).push(p);
  return Object.entries(byObra).map(([ou, ps]) => {
    const o = ctx.obras.find((x) => x.Uid === ou);
    return o ? `<optgroup label="${esc(obraLabel(o))}">${ps.sort((a, b) => String(a.Item).localeCompare(String(b.Item), 'es', { numeric: true }))
      .map((p) => `<option value="${esc(p.Uid)}"${p.Uid === v ? ' selected' : ''}>${esc(o.Codigo)} · ${esc(p.Title)}</option>`).join('')}</optgroup>` : '';
  }).join('');
}
export function labelOf(c, v, ctx) {
  if (vacio(v)) return '';
  if (c.type === 'obra') { const o = ctx.obras.find((x) => x.Uid === v); return o ? obraLabel(o) : v; }
  if (c.type === 'etapa') {
    const p = ctx.partidas.find((x) => x.Uid === v); const o = p && ctx.obras.find((x) => x.Uid === p.ObraUid);
    return p ? `${o?.Codigo || ''} · ${p.Title}` : v;
  }
  if (c.type === 'registro') { const r = ctx.registros.find((x) => x.Uid === v); return r ? r.Codigo : v; }
  if (c.type === 'date') return fmtDate(v);
  if (c.type === 'number') return fmtNum(v);
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

// ---------- Pantalla de llenado ----------

function inputHtml(c, v, path, ctx) {
  const a = `data-p="${esc(path)}" id="i_${esc(path)}"`;
  const req = c.req === true ? ' required' : '';
  switch (c.type) {
    case 'textarea': return `<textarea ${a} rows="3"${req}>${esc(v)}</textarea>`;
    case 'number': return `<input ${a} type="text" inputmode="decimal" value="${esc(v)}"${req}>`;
    case 'date': case 'time': return `<input ${a} type="${c.type}" value="${esc(v)}"${req}>`;
    case 'etapa': return `<select ${a}${req}><option value="">Elegir…</option>${etapaOptions(ctx, v)}</select>`;
    case 'select': case 'obra': case 'registro':
      return `<select ${a}${req}><option value="">${c.type === 'select' ? '—' : 'Elegir…'}</option>${optionsFor(c, ctx)
        .map(([val, l]) => `<option value="${esc(val)}"${val === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    default: return `<input ${a} type="text" value="${esc(v)}"${req}>`;
  }
}

const chips = (c, v, path, multi) => `<div class="chips" role="${multi ? 'group' : 'radiogroup'}" aria-label="${esc(c.l)}">${c.options.map((o) => {
  const on = multi ? (v || []).includes(o) : v === o;
  return `<button type="button" class="chip" role="${multi ? 'checkbox' : 'radio'}" aria-checked="${on}" data-chip="${esc(path)}" data-val="${esc(o)}" data-multi="${multi ? 1 : ''}">${esc(o)}</button>`;
}).join('')}</div>`;

function fileRefsHtml(refs, path, kind) {
  return (refs || []).map((r, i) => kind === 'photos'
    ? `<figure class="thumb"><img data-fid="${esc(r.fid)}" ${r.driveId ? `data-drive="${esc(r.driveId)}"` : ''} alt="Foto ${i + 1}"><button type="button" class="x" data-rmfile="${esc(path)}" data-i="${i}" aria-label="Quitar foto">×</button>
       ${r.lat ? `<figcaption>${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}</figcaption>` : ''}</figure>`
    : `<div class="filerow"><span>${esc(r.name)} <small>${(r.size / 1048576).toFixed(1)} MB</small></span><button type="button" class="navbtn" data-rmfile="${esc(path)}" data-i="${i}">Quitar</button></div>`).join('');
}

const sigHtml = (ref, path, label) => `<div class="sig">${ref ? `<img data-fid="${esc(ref.fid)}" ${ref.driveId ? `data-drive="${esc(ref.driveId)}"` : ''} alt="${esc(label)}">` : '<span>Sin firma</span>'}
  <button type="button" class="btn sec" data-sign="${esc(path)}">${ref ? 'Volver a firmar' : 'Firmar en pantalla'}</button></div>`;

function campoHtml(c, d, ctx) {
  const v = d[c.k];
  const lab = c.l ? `<label for="i_${esc(c.k)}">${esc(c.l)}${c.req === true ? ' <b class="req">*</b>' : ''}</label>` : '';
  switch (c.type) {
    case 'info': return `<p class="foot">${esc(c.l)}</p>`;
    case 'radio': return `<div class="field col">${lab}${chips(c, v, c.k, false)}</div>`;
    case 'checks': return `<div class="field col">${lab}${chips(c, v, c.k, true)}</div>`;
    case 'textarea': return `<div class="field col">${lab}${inputHtml(c, v, c.k, ctx)}</div>`;
    case 'photos': return `<div class="field col">${lab}<div class="thumbs">${fileRefsHtml(v, c.k, 'photos')}</div>
      <label class="btn sec filebtn">Agregar fotos<input type="file" accept="image/*" multiple data-addfile="${c.k}" data-kind="photos" hidden></label></div>`;
    case 'files': return `<div class="field col">${lab}${fileRefsHtml(v, c.k, 'files')}
      <label class="btn sec filebtn">Elegir archivos<input type="file" multiple data-addfile="${c.k}" data-kind="files" hidden></label>${c.nota ? `<p class="foot">${esc(c.nota)}</p>` : ''}</div>`;
    case 'signature': return `<div class="field col">${lab}${sigHtml(v, c.k, c.l)}</div>`;
    case 'table': return tableHtml(c, v || [], ctx);
    case 'points': return pointsHtml(c, v || {});
    case 'checklist': return `<div class="group">${c.items.map((it, i) => `<div class="field col"><label>${esc(it)}</label>
      ${chips({ l: it, options: c.options }, v?.[i]?.v, `${c.k}.${i}.v`, false)}
      <input data-p="${c.k}.${i}.c" type="text" placeholder="Comentario / referencia" value="${esc(v?.[i]?.c)}" class="sub"></div>`).join('')}</div>`;
    case 'firmas': return c.etapas.map((et, i) => `<div class="group card"><div class="cardh">${esc(et)}${(c.req || []).includes(i) ? ' <b class="req">*</b>' : ''}</div>
      <div class="field"><label>Nombre</label><input data-p="${c.k}.${i}.nombre" type="text" value="${esc(v?.[i]?.nombre)}"></div>
      <div class="field"><label>Fecha</label><input data-p="${c.k}.${i}.fecha" type="date" value="${esc(v?.[i]?.fecha)}"></div>
      <div class="field col">${sigHtml(v?.[i]?.firma, `${c.k}.${i}.firma`, et)}</div></div>`).join('');
    default: return `<div class="field">${lab}${inputHtml(c, v, c.k, ctx)}</div>`;
  }
}

function tableHtml(c, rows, ctx) {
  const fixed = !!c.rows;
  return rows.map((r, i) => {
    const res = c.calc?.(r);
    return `<div class="group card"><div class="cardh">${fixed ? esc(r[c.cols[0].k]) : `Fila ${i + 1}`}
      ${res ? `<span class="badge ${res.nivel}" data-calc="${c.k}.${i}">${esc(res.res)}</span>` : c.calc ? `<span data-calc="${c.k}.${i}"></span>` : ''}
      ${!fixed && rows.length > (c.minRows ?? 1) ? `<button type="button" class="navbtn" data-rmrow="${c.k}" data-i="${i}">Eliminar</button>` : ''}</div>
      ${c.cols.slice(fixed ? 1 : 0).map((col) => `<div class="field"><label for="i_${c.k}.${i}.${col.k}">${esc(col.l)}${col.req ? ' <b class="req">*</b>' : ''}</label>
        ${inputHtml({ ...col, req: false }, r[col.k], `${c.k}.${i}.${col.k}`, ctx)}</div>`).join('')}</div>`;
  }).join('') + (fixed ? '' : `<button type="button" class="btn sec" data-addrow="${c.k}">+ Agregar fila</button>`);
}

function pointCells(pt, med) {
  const e = evalCota(pt.z, med);
  return `<td class="num">${e ? fmtNum(e.d, 3) : ''}</td><td>${e ? `<span class="badge ${e.nivel}" title="${NIVEL_TXT[e.nivel]}">${e.res}</span>` : ''}</td>`;
}
function pointsHtml(c, v) {
  const pts = PUNTOS[c.set];
  const n = pts.filter((p) => !vacio(v[p.p])).length;
  return `<p class="foot" data-count="${c.k}">${n} de ${pts.length} puntos medidos</p><div class="tablewrap"><table class="pts"><thead><tr><th>Punto</th><th>Diseño (m)</th><th>Medida (m)</th><th>Dif. (m)</th><th>Resultado</th></tr></thead><tbody>
    ${pts.map((pt) => `<tr data-row="${c.k}.${pt.p}"><th scope="row">${pt.p}</th><td class="num">${fmtNum(pt.z, 3)}</td>
      <td><input data-p="${c.k}.${pt.p}" data-z="${pt.z}" type="text" inputmode="decimal" value="${esc(v[pt.p])}" aria-label="Cota medida ${pt.p}"></td>${pointCells(pt, v[pt.p])}</tr>`).join('')}
  </tbody></table></div>`;
}

const getPath = (o, path) => path.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
function setPath(o, path, val) {
  const ks = path.split('.');
  let x = o;
  ks.slice(0, -1).forEach((k, i) => { x = x[k] ??= /^\d+$/.test(ks[i + 1]) ? [] : {}; });
  x[ks.at(-1)] = val;
}
const num = (s) => (s === '' ? '' : Number(String(s).replace(',', '.')));

// Abre el panel de firma y devuelve un PNG (Blob) o null si se cancela.
function pedirFirma(titulo) {
  return new Promise((ok) => {
    const dlg = document.getElementById('sheet');
    dlg.innerHTML = `<div class="sh-head"><button type="button" class="navbtn" data-x>Cancelar</button><h2 id="shTitle">${esc(titulo)}</h2>
      <button type="button" class="navbtn" data-ok style="font-weight:600">Listo</button></div>
      <div class="sh-body"><canvas class="pad" width="600" height="240" aria-label="Área de firma"></canvas>
      <button type="button" class="btn sec" data-clr>Borrar</button><p class="foot">Firma con el dedo o el lápiz dentro del recuadro.</p></div>`;
    const cv = dlg.querySelector('canvas'), g = cv.getContext('2d');
    g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#0b2a4a';
    let drawing = false, used = false;
    const pos = (e) => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * cv.width / b.width, (e.clientY - b.top) * cv.height / b.height]; };
    cv.onpointerdown = (e) => { drawing = used = true; cv.setPointerCapture(e.pointerId); g.beginPath(); g.moveTo(...pos(e)); };
    cv.onpointermove = (e) => { if (drawing) { g.lineTo(...pos(e)); g.stroke(); } };
    cv.onpointerup = cv.onpointercancel = () => (drawing = false);
    dlg.querySelector('[data-clr]').onclick = () => { g.clearRect(0, 0, cv.width, cv.height); used = false; };
    const close = (v) => { dlg.close(); ok(v); };
    dlg.querySelector('[data-x]').onclick = () => close(null);
    dlg.querySelector('[data-ok]').onclick = () => (used ? cv.toBlob((b) => close(b), 'image/png') : close(null));
    dlg.showModal();
  });
}

// Reduce fotos a 1600 px (JPEG) para que suban rápido con señal débil.
async function comprimir(file) {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const cv = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  return new Promise((ok) => cv.toBlob((b) => ok(b || file), 'image/jpeg', 0.82));
}
const ubicacion = () => new Promise((ok) => {
  if (!navigator.geolocation) return ok(null);
  navigator.geolocation.getCurrentPosition((p) => ok(p.coords), () => ok(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
});

export async function hydrate(el) {
  for (const img of el.querySelectorAll('img[data-fid]')) {
    store.fileUrl({ fid: img.dataset.fid, driveId: img.dataset.drive }).then((u) => { if (u) img.src = u; }).catch(() => {});
  }
}

// Monta el formulario editable en `el`. Devuelve { collect } para validar y leer los datos.
export function renderForm(el, { tipo, data, ctx }) {
  const spec = FORMS[tipo];
  const d = structuredClone(data);
  const draw = () => {
    const y = scrollY;
    el.innerHTML = spec.secciones.map((s) => `<section><h3>${esc(s.t)}</h3>${s.nota ? `<p class="foot">${esc(s.nota)}</p>` : ''}
      ${s.campos.every((c) => ['table', 'points', 'firmas', 'checklist'].includes(c.type)) ? s.campos.map((c) => campoHtml(c, d, ctx)).join('')
        : `<div class="group">${s.campos.map((c) => campoHtml(c, d, ctx)).join('')}</div>`}</section>`).join('');
    if (spec.obraFija) el.querySelectorAll('[data-p="obra"]').forEach((x) => (x.disabled = true));
    hydrate(el);
    scrollTo(0, y);
  };

  el.oninput = el.onchange = (e) => {
    const t = e.target, p = t.dataset.p;
    if (!p) return;
    ctx.onChange?.();
    const isNum = t.inputMode === 'decimal';
    setPath(d, p, isNum ? num(t.value.trim()) : t.value);
    if (t.dataset.z) { // punto de control: recalcula diferencia y resultado
      const tr = t.closest('tr'); tr.querySelectorAll('td:nth-last-child(-n+2)').forEach((x) => x.remove());
      tr.insertAdjacentHTML('beforeend', pointCells({ z: Number(t.dataset.z) }, getPath(d, p)));
      const k = p.split('.')[0], pts = PUNTOS[spec.secciones.flatMap((s) => s.campos).find((c) => c.k === k).set];
      el.querySelector(`[data-count="${k}"]`).textContent = `${pts.filter((x) => !vacio(d[k]?.[x.p])).length} de ${pts.length} puntos medidos`;
    }
    const m = p.match(/^(\w+)\.(\d+)\./);
    const tc = m && spec.secciones.flatMap((s) => s.campos).find((c) => c.k === m[1] && c.calc);
    if (tc) {
      const res = tc.calc(d[m[1]][m[2]]), b = el.querySelector(`[data-calc="${m[1]}.${m[2]}"]`);
      if (b) b.outerHTML = res ? `<span class="badge ${res.nivel}" data-calc="${m[1]}.${m[2]}">${esc(res.res)}</span>` : `<span data-calc="${m[1]}.${m[2]}"></span>`;
    }
  };

  el.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.chip || b.dataset.addrow || b.dataset.rmrow || b.dataset.rmfile) ctx.onChange?.();
    if (b.dataset.chip) {
      const p = b.dataset.chip, v = b.dataset.val;
      if (b.dataset.multi) { const arr = new Set(getPath(d, p) || []); arr.has(v) ? arr.delete(v) : arr.add(v); setPath(d, p, [...arr]); }
      else setPath(d, p, getPath(d, p) === v ? '' : v);
      draw();
    } else if (b.dataset.addrow) { d[b.dataset.addrow].push({}); draw(); }
    else if (b.dataset.rmrow) { d[b.dataset.rmrow].splice(Number(b.dataset.i), 1); draw(); }
    else if (b.dataset.rmfile) { getPath(d, b.dataset.rmfile).splice(Number(b.dataset.i), 1); draw(); }
    else if (b.dataset.sign) {
      const blob = await pedirFirma('Firma');
      if (!blob) return;
      const f = await store.putFile({ id: uid(), blob, name: 'firma.png', type: 'image/png', regUid: ctx.regUid });
      setPath(d, b.dataset.sign, { fid: f.id, name: f.name, type: f.type, ts: Date.now() });
      ctx.onChange?.();
      draw();
    }
  };

  el.addEventListener('change', async (e) => {
    const inp = e.target; if (!inp.dataset.addfile) return;
    const files = [...inp.files]; if (!files.length) return;
    const fotos = inp.dataset.kind === 'photos';
    const pos = fotos ? await ubicacion() : null;
    const arr = getPath(d, inp.dataset.addfile) || [];
    for (const file of files) {
      const blob = fotos ? await comprimir(file) : file;
      const name = fotos ? `foto_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}_${arr.length + 1}.jpg` : file.name;
      const f = await store.putFile({ id: uid(), blob, name, type: blob.type, regUid: ctx.regUid });
      arr.push({ fid: f.id, name, type: blob.type, size: blob.size, ts: Date.now(), ...(pos ? { lat: pos.latitude, lon: pos.longitude } : {}) });
    }
    setPath(d, inp.dataset.addfile, arr);
    ctx.onChange?.();
    draw();
  });

  draw();

  return {
    data: () => d,
    // Limpia filas vacías y devuelve la lista de faltantes (vacía = se puede enviar).
    collect() {
      const faltan = [];
      for (const s of spec.secciones) for (const c of s.campos) {
        if (c.type === 'table' && !c.rows) {
          d[c.k] = (d[c.k] || []).filter((r) => Object.values(r).some((x) => !vacio(x)));
          if (d[c.k].length < (c.minRows ?? 1)) faltan.push(`${s.t}: al menos ${c.minRows ?? 1} fila`);
          d[c.k].forEach((r, i) => c.cols.filter((col) => col.req && vacio(r[col.k])).forEach((col) => faltan.push(`${s.t}, fila ${i + 1}: ${col.l}`)));
        } else if (c.type === 'firmas') {
          (c.req || []).forEach((i) => { if (!d[c.k][i]?.firma) faltan.push(`Firma: ${c.etapas[i]}`); });
        } else if (c.type === 'points') {
          if (!PUNTOS[c.set].some((p) => !vacio(d[c.k]?.[p.p])) && !spec.secciones.some((s2) => s2.campos.some((c2) => c2.type === 'points' && c2 !== c && PUNTOS[c2.set].some((p) => !vacio(d[c2.k]?.[p.p]))))) faltan.push('Al menos un punto medido');
        } else if (c.req === true && vacio(d[c.k])) faltan.push(c.l);
      }
      return [...new Set(faltan)];
    },
  };
}

// Archivos de un registro (para asignarles carpeta en SharePoint al enviar).
export function fileRefs(v, out = []) {
  if (Array.isArray(v)) v.forEach((x) => fileRefs(x, out));
  else if (v && typeof v === 'object') { if (v.fid) out.push(v); else Object.values(v).forEach((x) => fileRefs(x, out)); }
  return out;
}

// ---------- Documento (vista de lectura, impresión y PDF) ----------

const sigDoc = (ref) => (ref ? `<img class="sigimg" data-fid="${esc(ref.fid)}" ${ref.driveId ? `data-drive="${esc(ref.driveId)}"` : ''} alt="Firma">` : '');
const kvRow = (k, v) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`;

function campoDoc(c, d, ctx) {
  const v = d[c.k];
  switch (c.type) {
    case 'table': {
      const rows = v || [];
      if (!rows.length) return '<p class="muted">Sin registros.</p>';
      return `<div class="tablewrap"><table class="dt"><thead><tr>${c.cols.map((col) => `<th>${esc(col.l)}</th>`).join('')}${c.calc ? '<th>Estado</th>' : ''}</tr></thead><tbody>
        ${rows.map((r) => { const res = c.calc?.(r); return `<tr>${c.cols.map((col) => `<td>${esc(labelOf(col, r[col.k], ctx))}</td>`).join('')}${c.calc ? `<td>${res ? `<span class="badge ${res.nivel}">${esc(res.res)}</span>` : ''}</td>` : ''}</tr>`; }).join('')}
      </tbody></table></div>`;
    }
    case 'points': {
      const pts = PUNTOS[c.set].filter((p) => !vacio(v?.[p.p]));
      if (!pts.length) return '<p class="muted">Sin puntos medidos.</p>';
      const ev = pts.map((p) => ({ p, e: evalCota(p.z, v[p.p]) }));
      const ok = ev.filter((x) => x.e.nivel === 'ok').length;
      return `<p class="muted">${ok} de ${pts.length} puntos conformes (${Math.round((ok / pts.length) * 100)} %)</p>
        <div class="tablewrap"><table class="dt"><thead><tr><th>Punto</th><th>Cota diseño (m)</th><th>Cota medida (m)</th><th>Diferencia (m)</th><th>Resultado</th></tr></thead><tbody>
        ${ev.map(({ p, e }) => `<tr><td>${p.p}</td><td class="num">${fmtNum(p.z, 3)}</td><td class="num">${fmtNum(v[p.p], 3)}</td><td class="num">${fmtNum(e.d, 3)}</td>
          <td><span class="badge ${e.nivel}">${e.res}</span> <small>${NIVEL_TXT[e.nivel]}</small></td></tr>`).join('')}</tbody></table></div>`;
    }
    case 'checklist': return `<table class="dt"><thead><tr><th>Ítem de control</th><th>Resultado</th><th>Comentario</th></tr></thead><tbody>
      ${c.items.map((it, i) => `<tr><td>${esc(it)}</td><td>${esc(v?.[i]?.v || '')}</td><td>${esc(v?.[i]?.c || '')}</td></tr>`).join('')}</tbody></table>`;
    case 'firmas': return `<table class="dt"><thead><tr><th>Etapa</th><th>Nombre</th><th>Firma</th><th>Fecha</th></tr></thead><tbody>
      ${c.etapas.map((et, i) => `<tr><td>${esc(et)}</td><td>${esc(v?.[i]?.nombre || '')}</td><td>${sigDoc(v?.[i]?.firma)}</td><td>${fmtDate(v?.[i]?.fecha)}</td></tr>`).join('')}</tbody></table>`;
    case 'photos': return vacio(v) ? '' : `<div class="docphotos">${v.map((r, i) => `<figure><img data-fid="${esc(r.fid)}" ${r.driveId ? `data-drive="${esc(r.driveId)}"` : ''} alt="Foto ${i + 1}">
      <figcaption>Foto ${i + 1}${r.lat ? ` · ${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}` : ''}${r.ts ? ` · ${new Date(r.ts).toLocaleString('es-CL')}` : ''}</figcaption></figure>`).join('')}</div>`;
    default: return null;
  }
}

export function renderDoc(reg, ctx) {
  const spec = FORMS[reg.Tipo];
  const d = reg.Datos || {};
  const body = spec.secciones.map((s) => {
    const kv = [], blocks = [];
    for (const c of s.campos) {
      const blk = campoDoc(c, d, ctx);
      if (blk !== null) { if (c.type === 'photos' && blk) blocks.push(`<p class="muted">${esc(c.l)}</p>${blk}`); else if (blk) blocks.push(blk); continue; }
      if (c.type === 'signature') kv.push(kvRow(c.l, sigDoc(d[c.k]) || '<span class="muted">Sin firma</span>'));
      else if (c.type === 'files') kv.push(kvRow(c.l, (d[c.k] || []).map((r) => r.webUrl ? `<a href="${esc(r.webUrl)}" target="_blank" rel="noopener">${esc(r.name)}</a>` : esc(r.name)).join('<br>') || '—'));
      else if (c.type !== 'info') kv.push(kvRow(c.l, esc(labelOf(c, d[c.k], ctx)).replace(/\n/g, '<br>') || '<span class="muted">—</span>'));
    }
    return `<section class="docsec"><h4>${esc(s.t)}</h4>${s.nota ? `<p class="muted small">${esc(s.nota)}</p>` : ''}${kv.length ? `<table class="kvt">${kv.join('')}</table>` : ''}${blocks.join('')}</section>`;
  }).join('');
  return `<article class="doc">
    <header class="dochead"><div><b>${esc(PROYECTO.empresa)}</b><br>${esc(PROYECTO.nombre)} · ${esc(PROYECTO.codigo)}</div>
      <div class="dc"><b>${esc(reg.Codigo || (reg.Estado === 'Borrador' ? 'Borrador' : 'Sin código'))}</b><br>${esc(spec.rev || '')}</div></header>
    <h2 class="doctitle">${esc(spec.titulo)}</h2>
    <table class="kvt meta">${kvRow('Fecha', fmtDate(reg.Fecha))}${kvRow('Registrado por', esc(reg.Autor))}${kvRow('Estado', esc(reg.Estado))}
      ${reg.Revisor ? kvRow('Revisado por', esc(reg.Revisor)) : ''}${reg.Comentario ? kvRow('Comentario de revisión', esc(reg.Comentario)) : ''}</table>
    ${body}
    <footer class="docfoot">Generado con Obras DRF · ${new Date().toLocaleString('es-CL')}</footer></article>`;
}
