// Almacenamiento local (IndexedDB) + bandeja de salida para trabajar sin señal.
// Todo cambio se guarda primero aquí; sync() lo sube a SharePoint cuando hay red.
import { DEMO } from '../config.js';
import { LISTS, fieldNames } from './schema.js';
import * as graph from './graph.js';

const DB = 'obrasdrf';
let db;

function open() {
  if (db) return Promise.resolve(db);
  return new Promise((ok, fail) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      d.createObjectStore('items', { keyPath: 'key' });        // key = lista:Uid
      d.createObjectStore('outbox', { keyPath: 'key' });       // un pendiente por registro
      d.createObjectStore('meta', { keyPath: 'k' });
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

// Guarda un registro local y lo deja en cola para subir.
export async function save(list, data) {
  const prev = await get(list, data.Uid);
  const merged = { ...prev, ...data, _pending: !DEMO };
  await tx('items', 'readwrite', (s) => s.put({ key: `${list}:${data.Uid}`, list, data: merged }));
  if (!DEMO) await tx('outbox', 'readwrite', (s) => s.put({ key: `${list}:${data.Uid}`, list, Uid: data.Uid, at: Date.now() }));
  return merged;
}

export const pendingCount = () => tx('outbox', 'readonly', (s) => reqP(s.count()));

export async function meta(k, v) {
  if (v === undefined) return (await tx('meta', 'readonly', (s) => reqP(s.get(k))))?.v;
  await tx('meta', 'readwrite', (s) => s.put({ k, v }));
}

const pick = (list, data) => Object.fromEntries(
  fieldNames(list).filter((f) => data[f] !== undefined && data[f] !== null && data[f] !== '').map((f) => [f, data[f]])
);

let syncing = null;

// Sube la bandeja de salida y luego baja todo desde SharePoint.
export function sync() {
  if (DEMO) return Promise.resolve({ subidos: 0, demo: true });
  return (syncing ||= (async () => {
    try {
      const pend = await tx('outbox', 'readonly', (s) => reqP(s.getAll()));
      pend.sort((a, b) => order(a.list) - order(b.list) || a.at - b.at);
      let subidos = 0;
      for (const p of pend) {
        const data = await get(p.list, p.Uid);
        if (data) {
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
            if (!stillPending.has(key)) s.put({ key, list, data: r });
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
