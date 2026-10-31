// Acceso a SharePoint vía Microsoft Graph.
import { CONFIG } from '../config.js';
import { token, ADMIN_SCOPES, SCOPES } from './auth.js';
import { LISTS, fieldNames } from './schema.js';

const G = 'https://graph.microsoft.com/v1.0';
let siteId = null;
let listIds = null; // { obras: '...', ... }

async function call(path, { method = 'GET', body, scopes = SCOPES } = {}) {
  const res = await fetch(path.startsWith('http') ? path : G + path, {
    method,
    headers: {
      Authorization: `Bearer ${await token(scopes)}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try { msg += ' ' + (await res.json()).error.message; } catch {}
    throw new Error(`Graph ${method} ${path}: ${msg}`);
  }
  return res.status === 204 ? null : res.json();
}

export async function site() {
  if (!siteId) siteId = (await call(`/sites/${CONFIG.SITE_HOST}:${CONFIG.SITE_PATH}`)).id;
  return siteId;
}

const fullName = (key) => CONFIG.LIST_PREFIX + LISTS[key].title;

// Devuelve { faltantes: [...] } si alguna lista no existe todavía.
export async function resolveLists() {
  const sid = await site();
  const { value } = await call(`/sites/${sid}/lists?$select=id,displayName&$top=200`);
  const byName = Object.fromEntries(value.map((l) => [l.displayName, l.id]));
  const ids = {};
  const faltantes = [];
  for (const key of Object.keys(LISTS)) {
    if (byName[fullName(key)]) ids[key] = byName[fullName(key)];
    else faltantes.push(fullName(key));
  }
  if (!faltantes.length) listIds = ids;
  return { faltantes };
}

// Crea las listas que falten (requiere permiso Sites.Manage.All).
export async function provision(log = () => {}) {
  const sid = await site();
  const { faltantes } = await resolveLists();
  for (const key of Object.keys(LISTS)) {
    if (!faltantes.includes(fullName(key))) { log(`✓ ${fullName(key)} ya existe`); continue; }
    log(`Creando ${fullName(key)}…`);
    await call(`/sites/${sid}/lists`, {
      method: 'POST',
      scopes: ADMIN_SCOPES,
      body: { displayName: fullName(key), list: { template: 'genericList' }, columns: LISTS[key].columns },
    });
    log(`✓ ${fullName(key)} creada`);
  }
  await resolveLists();
}

async function ensureLists() {
  if (!listIds) {
    const { faltantes } = await resolveLists();
    if (faltantes.length) throw new Error(`Faltan listas en SharePoint: ${faltantes.join(', ')}. Créalas en Ajustes.`);
  }
}

export async function fetchAll(key) {
  await ensureLists();
  const sel = fieldNames(key).join(',');
  let url = `/sites/${siteId}/lists/${listIds[key]}/items?expand=fields(select=${sel})&$top=500`;
  const out = [];
  while (url) {
    const page = await call(url);
    for (const it of page.value) out.push({ ...it.fields, _spId: it.id, _modified: it.lastModifiedDateTime, _by: it.lastModifiedBy?.user?.displayName });
    url = page['@odata.nextLink'];
  }
  return out;
}

export async function createItem(key, fields) {
  await ensureLists();
  const it = await call(`/sites/${siteId}/lists/${listIds[key]}/items`, { method: 'POST', body: { fields } });
  return it.id;
}

export async function updateItem(key, spId, fields) {
  await ensureLists();
  await call(`/sites/${siteId}/lists/${listIds[key]}/items/${spId}/fields`, { method: 'PATCH', body: fields });
}

// ---------- Archivos en la biblioteca de documentos del sitio ----------

const encPath = (p) => p.split('/').filter(Boolean).map(encodeURIComponent).join('/');
let driveBase = null;

// Biblioteca configurada (CONFIG.BIBLIOTECA) o la principal del sitio.
async function biblioteca() {
  if (driveBase) return driveBase;
  const sid = await site();
  if (!CONFIG.BIBLIOTECA) return (driveBase = `/sites/${sid}/drive`);
  const { value } = await call(`/sites/${sid}/drives?$select=id,name`);
  const d = value.find((x) => x.name.toLowerCase() === CONFIG.BIBLIOTECA.toLowerCase());
  if (!d) throw new Error(`No existe la biblioteca «${CONFIG.BIBLIOTECA}» en el sitio (hay: ${value.map((x) => x.name).join(', ')})`);
  return (driveBase = `/drives/${d.id}`);
}

// Sube un archivo (reemplaza si ya existe); sobre 4 MB usa sesión de carga por partes.
export async function uploadFile(path, blob) {
  const base = `${await biblioteca()}/root:/${encPath(path)}:`;
  if (blob.size <= 4 * 1024 * 1024) {
    const res = await fetch(G + base + '/content?@microsoft.graph.conflictBehavior=replace', {
      method: 'PUT', headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': blob.type || 'application/octet-stream' }, body: blob,
    });
    if (!res.ok) throw new Error(`Subida ${path}: ${res.status}`);
    return res.json();
  }
  const { uploadUrl } = await call(base + '/createUploadSession', { method: 'POST', body: { item: { '@microsoft.graph.conflictBehavior': 'replace' } } });
  const CH = 5 * 320 * 1024; // múltiplo de 320 KiB, como exige Graph
  for (let i = 0; i < blob.size; i += CH) {
    const end = Math.min(i + CH, blob.size);
    const res = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Range': `bytes ${i}-${end - 1}/${blob.size}` }, body: blob.slice(i, end) });
    if (!res.ok) throw new Error(`Subida ${path}: ${res.status}`);
    if (end === blob.size) return res.json();
  }
}

export async function downloadFile(itemId) {
  const res = await fetch(`${G}${await biblioteca()}/items/${itemId}/content`, { headers: { Authorization: `Bearer ${await token()}` } });
  if (!res.ok) throw new Error(`Descarga: ${res.status}`);
  return res.blob();
}

export async function deleteItem(key, spId) {
  await ensureLists();
  await call(`/sites/${siteId}/lists/${listIds[key]}/items/${spId}`, { method: 'DELETE' });
}
