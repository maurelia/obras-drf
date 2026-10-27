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
