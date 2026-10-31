// Buzón en el Google Drive del administrador (ver buzon/Code.gs).
// Todos entran con Google: la app pide un token (solo correo y perfil, nada de
// acceso al Drive de quien usa la app) y lo manda al script del buzón, que corre
// con la cuenta del administrador, valida el token y guarda todo en su Drive.
import { CONFIG, PROYECTO } from '../config.js';

const SCOPE = 'openid email profile';
const K = 'gtok';

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

// El token dura una hora. Pedir uno nuevo abre la ventana de Google, por eso
// solo se hace tras un toque del usuario (interactivo = true).
async function token(interactivo) {
  const t = ls.get(K);
  if (t && t.exp > Date.now() + 60000) return t.v;
  if (!interactivo) throw new Error('Sesión de Google vencida: toca para reconectar');
  const oauth2 = await gis();
  const res = await new Promise((ok, fail) => {
    oauth2.initTokenClient({
      client_id: CONFIG.GOOGLE_CLIENT_ID, scope: SCOPE, login_hint: ls.get('gCorreo') || undefined,
      callback: (r) => (r.error ? fail(new Error(r.error_description || r.error)) : ok(r)),
      error_callback: (e) => fail(new Error(e.message || 'Inicio de sesión de Google cancelado')),
    }).requestAccessToken({ prompt: t || ls.get('gCorreo') ? '' : 'select_account' });
  });
  ls.set(K, { v: res.access_token, exp: Date.now() + res.expires_in * 1000 });
  return res.access_token;
}
export const hayToken = () => (ls.get(K)?.exp || 0) > Date.now() + 60000;
export function olvidar() { ls.del(K); ls.del('gCorreo'); }

// text/plain evita la consulta previa CORS, que Apps Script no responde.
async function call(accion, params = {}, interactivo = true) {
  const tk = await token(interactivo);
  let res;
  try {
    res = await fetch(CONFIG.BUZON_URL, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ accion, token: tk, ...params }),
    });
  } catch { throw new Error('Sin conexión con el buzón'); }
  if (!res.ok) throw new Error(`Buzón: error ${res.status}`);
  const out = await res.json();
  if (!out.ok) {
    if (/vencida/.test(out.error)) ls.del(K);
    throw new Error(out.error);
  }
  return out;
}

// ---------- Sesión ----------

// Entra con Google y pregunta al buzón el perfil de esa cuenta.
export async function login() {
  ls.del('gCorreo');
  const tk = await token(true);
  const u = await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tk}` } })).json();
  if (!u.email) throw new Error('Google no entregó el correo de la cuenta');
  ls.set('gCorreo', u.email.toLowerCase());
  const s = await call('sesion');
  return { nombre: s.usuario.nombre || u.name || u.email, correo: s.usuario.correo, rol: s.usuario.rol, sesion: s };
}

export const sesion = (interactivo = false) => call('sesion', {}, interactivo);

// ---------- Registros ----------

const b64 = (blob) => new Promise((ok, fail) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1]);
  r.onerror = () => fail(r.error);
  r.readAsDataURL(blob);
});
const deB64 = (s, type) => { const bin = atob(s); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type }); };

// Manda un registro firmado con sus fotos, firmas y adjuntos.
export async function enviar(reg, refs, getFile, interactivo = true) {
  const registro = Object.fromEntries(Object.entries(reg).filter(([k]) => !k.startsWith('_')));
  const archivos = [];
  for (const r of refs) {
    const f = await getFile(r.fid);
    if (f?.blob) archivos.push({ fid: r.fid, name: f.name || r.name, type: f.blob.type || f.type, data: await b64(f.blob) });
  }
  return (await call('enviar', { proyecto: PROYECTO.codigo, registro, archivos }, interactivo)).registro;
}

export async function archivos(uid) {
  return (await call('archivos', { uid })).archivos.map((a) => ({ ...a, blob: deB64(a.data, a.type), data: undefined }));
}

// ---------- Administrador ----------

export const datos = (interactivo = false) => call('datos', {}, interactivo);
export const estado = async (uid, cambios) => (await call('estado', { uid, cambios })).registro;
export const eliminar = (uid) => call('eliminar', { uid });
export const guardar = (lista, items) => call('guardar', { lista, items });
