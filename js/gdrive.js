// Buzón intermedio en Google Drive. Quien llena protocolos en terreno entra con
// su cuenta Google y cada envío se sube como un paquete JSON (datos, fotos y
// firma) a una carpeta de su propio Drive compartida, solo lectura, con la
// cuenta Google del proyecto. El administrador entra a esa cuenta, importa los
// paquetes, los revisa y solo lo aprobado pasa a SharePoint.
// Terreno usa drive.file: la app solo ve y toca los archivos que ella creó.
import { CONFIG, PROYECTO } from '../config.js';

const API = 'https://www.googleapis.com/drive/v3';
const UP = 'https://www.googleapis.com/upload/drive/v3';
const SC_TERRENO = 'https://www.googleapis.com/auth/drive.file openid email profile';
const SC_ADMIN = 'https://www.googleapis.com/auth/drive.readonly openid email';
const FOLDER = 'Obras DRF - Envíos';
const PREFIJO = 'OBRASDRF_';
export const FORMATO = 'obrasdrf-envio';

const ls = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};

// ---------- Token (Google Identity Services) ----------

const gis = () => new Promise((ok, fail) => {
  if (window.google?.accounts?.oauth2) return ok(google.accounts.oauth2);
  let n = 0;
  const t = setInterval(() => {
    if (window.google?.accounts?.oauth2) { clearInterval(t); ok(google.accounts.oauth2); }
    else if (++n > 50) { clearInterval(t); fail(new Error('No se pudo cargar el inicio de sesión de Google (¿sin conexión?)')); }
  }, 100);
});

// El token dura una hora; se guarda para no pedir la cuenta en cada envío.
// Pedir uno nuevo abre la ventana de Google, por eso debe partir de un toque del usuario.
async function token(scope, hint) {
  const k = 'gtok:' + scope;
  const t = ls.get(k);
  if (t && t.exp > Date.now() + 60000) return t.v;
  const oauth2 = await gis();
  const res = await new Promise((ok, fail) => {
    oauth2.initTokenClient({
      client_id: CONFIG.GOOGLE_CLIENT_ID, scope, login_hint: hint || undefined,
      callback: (r) => (r.error ? fail(new Error(r.error_description || r.error)) : ok(r)),
      error_callback: (e) => fail(new Error(e.message || 'Inicio de sesión de Google cancelado')),
    }).requestAccessToken({ prompt: t ? '' : 'select_account' });
  });
  ls.set(k, { v: res.access_token, exp: Date.now() + res.expires_in * 1000 });
  return res.access_token;
}
export const hayToken = (admin = false) => (ls.get('gtok:' + (admin ? SC_ADMIN : SC_TERRENO))?.exp || 0) > Date.now() + 60000;
export function olvidar() { ls.del('gtok:' + SC_TERRENO); ls.del('gtok:' + SC_ADMIN); ls.del('gFolder'); }

async function call(url, { method = 'GET', body, headers = {}, admin = false, raw = false } = {}) {
  const tk = await token(admin ? SC_ADMIN : SC_TERRENO, admin ? CONFIG.BUZON_CORREO : ls.get('gCorreo'));
  const res = await fetch(url, {
    method, body,
    headers: { Authorization: `Bearer ${tk}`, ...(body && !(body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}), ...headers },
  });
  if (res.status === 401) ls.del('gtok:' + (admin ? SC_ADMIN : SC_TERRENO));
  if (!res.ok) {
    let msg = `${res.status}`;
    try { msg += ' ' + (await res.json()).error.message; } catch {}
    throw new Error(`Drive: ${msg}`);
  }
  return raw ? res : res.status === 204 ? null : res.json();
}

// ---------- Terreno ----------

// Inicia sesión y devuelve { nombre, correo } de la cuenta Google.
export async function login() {
  const tk = await token(SC_TERRENO);
  const u = await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tk}` } })).json();
  if (!u.email) throw new Error('Google no entregó el correo de la cuenta');
  ls.set('gCorreo', u.email.toLowerCase());
  return { nombre: u.name || u.email, correo: u.email.toLowerCase() };
}

// Carpeta de envíos en el Drive del usuario, compartida con la cuenta del proyecto.
async function carpeta() {
  const id = ls.get('gFolder');
  if (id) return id;
  const q = encodeURIComponent(`name = '${FOLDER}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  let f = (await call(`${API}/files?q=${q}&fields=files(id)`)).files[0];
  if (!f) f = await call(`${API}/files?fields=id`, { method: 'POST', body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' }) });
  await call(`${API}/files/${f.id}/permissions?sendNotificationEmail=false`, {
    method: 'POST', body: JSON.stringify({ type: 'user', role: 'reader', emailAddress: CONFIG.BUZON_CORREO }),
  });
  ls.set('gFolder', f.id);
  return f.id;
}

const b64 = (blob) => new Promise((ok, fail) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1]);
  r.onerror = () => fail(r.error);
  r.readAsDataURL(blob);
});
const deB64 = (s, type) => { const bin = atob(s); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type }); };

// Paquete de un registro: los datos más cada archivo (foto, firma, adjunto) en base64.
export async function empaquetar(reg, refs, getFile) {
  const registro = Object.fromEntries(Object.entries(reg).filter(([k]) => !k.startsWith('_')));
  const archivos = [];
  for (const r of refs) {
    const f = await getFile(r.fid);
    if (f?.blob) archivos.push({ fid: r.fid, name: f.name || r.name, type: f.blob.type || f.type, data: await b64(f.blob) });
  }
  return { formato: FORMATO, version: 1, proyecto: PROYECTO.codigo, enviado: new Date().toISOString(), registro, archivos };
}

// Sube el paquete (subida reanudable: sirve para paquetes de cualquier tamaño).
export async function subir(paquete) {
  const parent = await carpeta();
  const r = paquete.registro;
  const meta = {
    name: `${PREFIJO}${r.Tipo}_${r.Fecha}_${r.Uid}.json`, parents: [parent], mimeType: 'application/json',
    appProperties: { obrasdrf: '1', uid: r.Uid, tipo: r.Tipo },
  };
  const ini = await call(`${UP}/files?uploadType=resumable&fields=id`, {
    method: 'POST', body: JSON.stringify(meta), headers: { 'X-Upload-Content-Type': 'application/json' }, raw: true,
  });
  const loc = ini.headers.get('Location');
  const res = await fetch(loc, { method: 'PUT', body: new Blob([JSON.stringify(paquete)], { type: 'application/json' }) });
  if (!res.ok) throw new Error(`Drive: subida ${res.status}`);
  return (await res.json()).id;
}

// ---------- Administrador (cuenta Google del proyecto) ----------

// Lista los paquetes en las carpetas que los usuarios compartieron con la cuenta del proyecto.
export async function bandeja() {
  const qf = encodeURIComponent(`name = '${FOLDER}' and mimeType = 'application/vnd.google-apps.folder' and sharedWithMe and trashed = false`);
  const carpetas = (await call(`${API}/files?q=${qf}&fields=files(id)&pageSize=1000`, { admin: true })).files;
  const out = [];
  for (const c of carpetas) {
    let page = '';
    do {
      const q = encodeURIComponent(`'${c.id}' in parents and name contains '${PREFIJO}' and trashed = false`);
      const r = await call(`${API}/files?q=${q}&pageSize=1000&fields=nextPageToken,files(id,name,modifiedTime,size,owners(emailAddress,displayName))${page ? '&pageToken=' + page : ''}`, { admin: true });
      out.push(...r.files);
      page = r.nextPageToken;
    } while (page);
  }
  return out.sort((a, b) => a.modifiedTime.localeCompare(b.modifiedTime));
}

// Baja un paquete y convierte sus archivos de vuelta a Blob.
export async function bajar(id) {
  const p = await (await call(`${API}/files/${id}?alt=media`, { admin: true, raw: true })).json();
  if (p.formato !== FORMATO) throw new Error('El archivo no es un envío de Obras DRF');
  if (p.proyecto !== PROYECTO.codigo) throw new Error(`El envío es de otro proyecto (${p.proyecto})`);
  p.archivos = (p.archivos || []).map((a) => ({ ...a, blob: deB64(a.data, a.type), data: undefined }));
  return p;
}

// Confirma que el administrador entró con la cuenta del proyecto y no con otra.
export async function cuentaAdmin() {
  const tk = await token(SC_ADMIN, CONFIG.BUZON_CORREO);
  const u = await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tk}` } })).json();
  if ((u.email || '').toLowerCase() !== CONFIG.BUZON_CORREO.toLowerCase()) {
    ls.del('gtok:' + SC_ADMIN);
    throw new Error(`Entraste con ${u.email}; el buzón es ${CONFIG.BUZON_CORREO}`);
  }
  return u.email;
}
