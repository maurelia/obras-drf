// Almacenamiento local (IndexedDB) para trabajar sin señal.
// Con cuenta Google (terreno y administrador) todo vive aquí y en el buzón de
// Google Drive: remoto = false. Solo la consulta con cuenta Kozan usa sync(),
// que baja de SharePoint lo ya publicado. Fotos, firmas y adjuntos viven en "files".
import { CONFIG, DEMO } from '../config.js';
import { LISTS, fieldNames } from './schema.js';
import * as graph from './graph.js';

const DB = 'obrasdrf';
let db;
let remoto = !DEMO;
export const setRemoto = (v) => { remoto = !DEMO && v; };

function open() {
  if (db) return Promise.resolve(db);
  return new Promise((ok, fail) => {
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = (ev) => {
      const d = req.result;
      if (ev.oldVersion < 1) {
        d.createObjectStore('items', { keyPath: 'key' });        // key = lista:Uid
        d.createObjectStore('outbox', { keyPath: 'key' });       // un pendiente por registro
        d.createObjectStore('meta', { keyPath: 'k' });
      }
      if (ev.oldVersion < 2) d.createObjectStore('files', { keyPath: 'id' }); // { id, blob, name, type, regUid, path, driveId }
    };
    req.onsuccess = () => ok((db = req.result));
    req.onerror = () => fail(req.error);
  });
}

function tx(store, mode, fn) {
  return open().then((d) => new Promise((ok, fail) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then((r) => (result = r));
    t.oncomplete = () => ok(result);
    t.onerror = () => fail(t.error);
  }));
}

const reqP = (r) => new Promise((ok, fail) => { r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); });

export async function all(list) {
  const rows = await tx('items', 'readonly', (s) => reqP(s.getAll()));
  return rows.filter((r) => r.list === list).map((r) => r.data);
}

export async function get(list, Uid) {
  const r = await tx('items', 'readonly', (s) => reqP(s.get(`${list}:${Uid}`)));
  return r?.data;
}

// Guarda un registro local y lo deja en cola para subir (salvo { local: true }).
export async function save(list, data, { local = false } = {}) {
  const prev = await get(list, data.Uid);
  const sube = remoto && !local;
  const merged = { ...prev, ...data, _pending: sube, _local: local || undefined };
  await tx('items', 'readwrite', (s) => s.put({ key: `${list}:${data.Uid}`, list, data: merged }));
  if (sube) await tx('outbox', 'readwrite', (s) => s.put({ key: `${list}:${data.Uid}`, list, Uid: data.Uid, at: Date.now() }));
  return merged;
}

// Borra un registro local; si ya estaba en SharePoint, queda en cola para borrarlo allá.
export async function remove(list, Uid) {
  const prev = await get(list, Uid);
  await tx('items', 'readwrite', (s) => s.delete(`${list}:${Uid}`));
  if (!remoto) return;
  if (prev?._spId) await tx('outbox', 'readwrite', (s) => s.put({ key: `${list}:${Uid}`, list, Uid, del: prev._spId, at: Date.now() }));
  else await tx('outbox', 'readwrite', (s) => s.delete(`${list}:${Uid}`));
}

// Deja la lista igual a "rows" (lo que manda el buzón), salvo los locales que keep() conserva.
export async function reemplazar(list, rows, keep = () => false) {
  const actuales = await all(list);
  const quedan = new Set(actuales.filter(keep).map((r) => r.Uid));
  const ids = new Set(rows.map((r) => r.Uid));
  await tx('items', 'readwrite', (s) => {
    for (const r of actuales) if (!ids.has(r.Uid) && !quedan.has(r.Uid)) s.delete(`${list}:${r.Uid}`);
    for (const r of rows) if (!quedan.has(r.Uid)) s.put({ key: `${list}:${r.Uid}`, list, data: r });
  });
}

export const pendingCount = () => tx('outbox', 'readonly', (s) => reqP(s.count()));

export async function meta(k, v) {
  if (v === undefined) return (await tx('meta', 'readonly', (s) => reqP(s.get(k))))?.v;
  await tx('meta', 'readwrite', (s) => s.put({ k, v }));
}

// ---------- Archivos (fotos, firmas, adjuntos) ----------

export async function putFile(f) {
  await tx('files', 'readwrite', (s) => s.put(f));
  return f;
}
export const getFile = (id) => tx('files', 'readonly', (s) => reqP(s.get(id)));

// URL para mostrar un archivo: local si está en el equipo; si no, se baja de SharePoint.
const urls = new Map();
export async function fileUrl(ref) {
  if (!ref) return '';
  if (urls.has(ref.fid)) return urls.get(ref.fid);
  let f = await getFile(ref.fid);
  if (!f?.blob && ref.driveId && remoto) {
    const blob = await graph.downloadFile(ref.driveId);
    f = await putFile({ ...(f || {}), id: ref.fid, blob, name: ref.name, type: blob.type, driveId: ref.driveId });
  }
  if (!f?.blob) return '';
  const u = URL.createObjectURL(f.blob);
  urls.set(ref.fid, u);
  return u;
}

// Recorre los Datos de un registro y reemplaza las referencias a archivos ya subidos.
function patchRefs(v, done) {
  if (Array.isArray(v)) return v.map((x) => patchRefs(x, done));
  if (v && typeof v === 'object') {
    if (v.fid && done[v.fid]) return { ...v, ...done[v.fid] };
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, patchRefs(x, done)]));
  }
  return v;
}

async function uploadFiles() {
  const pend = (await tx('files', 'readonly', (s) => reqP(s.getAll()))).filter((f) => !f.driveId && f.blob && f.path);
  const byReg = {};
  for (const f of pend) {
    const it = await graph.uploadFile(`${CONFIG.FILES_FOLDER}/${f.path}`, f.blob);
    await putFile({ ...f, driveId: it.id, webUrl: it.webUrl });
    (byReg[f.regUid] ||= {})[f.id] = { driveId: it.id, webUrl: it.webUrl };
  }
  for (const [regUid, done] of Object.entries(byReg)) {
    const r = await get('registros', regUid);
    if (r) await save('registros', { Uid: regUid, Datos: patchRefs(r.Datos, done) });
  }
}

// ---------- Sincronización ----------

const pick = (list, data) => Object.fromEntries(
  fieldNames(list).filter((f) => data[f] !== undefined && data[f] !== null && data[f] !== '')
    .map((f) => [f, typeof data[f] === 'object' ? JSON.stringify(data[f]) : data[f]])
);
const parse = (r) => {
  if (typeof r.Datos === 'string') { try { r.Datos = JSON.parse(r.Datos); } catch { /* texto libre */ } }
  return r;
};

let syncing = null;

// Sube archivos y bandeja de salida, y luego baja todo desde SharePoint.
export function sync() {
  if (!remoto) return Promise.resolve({ subidos: 0, local: true });
  return (syncing ||= (async () => {
    try {
      await uploadFiles();
      const pend = await tx('outbox', 'readonly', (s) => reqP(s.getAll()));
      pend.sort((a, b) => order(a.list) - order(b.list) || a.at - b.at);
      let subidos = 0;
      for (const p of pend) {
        const data = p.del ? null : await get(p.list, p.Uid);
        if (p.del) await graph.deleteItem(p.list, p.del);
        else if (data) {
          const fields = pick(p.list, data);
          if (data._spId) await graph.updateItem(p.list, data._spId, fields);
          else data._spId = await graph.createItem(p.list, fields);
          await tx('items', 'readwrite', (s) => s.put({ key: p.key, list: p.list, data: { ...data, _pending: false } }));
        }
        await tx('outbox', 'readwrite', (s) => s.delete(p.key));
        subidos++;
      }
      for (const list of Object.keys(LISTS)) {
        const remote = await graph.fetchAll(list);
        const stillPending = new Set((await tx('outbox', 'readonly', (s) => reqP(s.getAllKeys()))));
        await tx('items', 'readwrite', (s) => {
          for (const r of remote) {
            if (!r.Uid) continue;
            const key = `${list}:${r.Uid}`;
            if (!stillPending.has(key)) s.put({ key, list, data: parse(r) });
          }
        });
      }
      await meta('lastSync', new Date().toISOString());
      return { subidos };
    } finally {
      syncing = null;
    }
  })());
}

// Obras primero, para que los hijos nunca lleguen antes que su obra.
const order = (list) => Object.keys(LISTS).indexOf(list);
