/**
 * Obras DRF – buzón en el Google Drive del administrador.
 *
 * Se publica como aplicación web desde la cuenta Google del administrador:
 *   Implementar → Nueva implementación → Aplicación web
 *   Ejecutar como: Yo   ·   Quién tiene acceso: Cualquier persona
 * y la URL (…/exec) va en BUZON_URL de config.js.
 *
 * Todo queda en la carpeta «Obras DRF» del Drive de quien lo publica:
 *   Obras DRF/obrasdrf_datos.json         usuarios, obras, etapas y todos los registros
 *   Obras DRF/Registros/<TIPO>/<fecha>_<id>/  registro.json + fotos, firmas y adjuntos
 *
 * La app manda el token de Google de quien está usando la app; aquí se valida
 * (debe ser de nuestro cliente OAuth) y de ahí sale el correo. Quien publica el
 * script es siempre administrador; los demás perfiles se asignan en la app.
 */
const CLIENT_ID = '';                 // = GOOGLE_CLIENT_ID de config.js
const PROYECTO = 'DRF-OF-2509-06';
const SIGLA = 'OF';                   // códigos de registro: PDA-OF-001
const RAIZ = 'Obras DRF';
const DATOS = 'obrasdrf_datos.json';

// Qué formatos puede enviar cada perfil (igual que js/forms.js).
const PERMISOS = {
  'Supervisor de terraza': ['PDA', 'RCM', 'PHU'],
  'Topógrafo': ['PDA', 'PCT', 'PTT', 'TRT', 'PND'],
  'Operador': ['PDA', 'RCM', 'PHU'],
};
const TIPOS = ['PDA', 'PCT', 'RCM', 'PTT', 'TRT', 'PRV', 'PHU', 'PND'];

function doGet() {
  return ContentService.createTextOutput('Obras DRF · buzón activo (' + PROYECTO + ')');
}

function doPost(e) {
  let out;
  try {
    const q = JSON.parse(e.postData.contents);
    const u = usuario_(q.token);
    out = { ok: true, ...accion_(q, u) };
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Identidad ----------

function usuario_(token) {
  if (!CLIENT_ID) throw new Error('Falta CLIENT_ID en el script del buzón');
  if (!token) throw new Error('Sin sesión de Google');
  const cache = CacheService.getScriptCache();
  const k = 'tk' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)).slice(0, 40);
  let correo = cache.get(k);
  if (!correo) {
    const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) throw new Error('Sesión de Google vencida: vuelve a entrar');
    const t = JSON.parse(r.getContentText());
    if (t.azp !== CLIENT_ID && t.aud !== CLIENT_ID) throw new Error('El token no es de la app Obras DRF');
    if (!t.email || String(t.email_verified) !== 'true') throw new Error('Cuenta Google sin correo verificado');
    correo = t.email.toLowerCase();
    const seg = Math.min(600, Number(t.expires_in) || 0);
    if (seg > 30) cache.put(k, correo, seg);
  }
  const d = leer_();
  const dueno = Session.getEffectiveUser().getEmail().toLowerCase();
  const reg = d.usuarios.find((x) => (x.Correo || '').toLowerCase() === correo && x.Activo !== false);
  const rol = correo === dueno ? 'Administrador' : reg ? reg.Rol : null;
  return { correo, rol, admin: rol === 'Administrador', nombre: reg ? reg.Title : '' };
}

const soloAdmin_ = (u) => { if (!u.admin) throw new Error('Solo el administrador puede hacer esto'); };

// ---------- Acciones ----------

function accion_(q, u) {
  switch (q.accion) {
    // Al entrar y al sincronizar en terreno: perfil, catálogo y estado de lo enviado.
    case 'sesion': {
      const d = leer_();
      const mios = Object.values(d.registros).filter((r) => r.AutorCorreo === u.correo)
        .map((r) => ({ Uid: r.Uid, Estado: r.Estado, Codigo: r.Codigo, Correlativo: r.Correlativo, Revisor: r.Revisor, Comentario: r.Comentario }));
      return { usuario: u, obras: d.obras, partidas: d.partidas, mios };
    }

    // Recibe un registro firmado con sus archivos (base64).
    case 'enviar': {
      const r = q.registro || {};
      if (TIPOS.indexOf(r.Tipo) < 0) throw new Error('Formato desconocido: ' + r.Tipo);
      if (!r.Uid) throw new Error('Registro sin identificador');
      if (!u.rol) throw new Error(u.correo + ' no está autorizado en Obras DRF. Pide al administrador que te agregue.');
      if (!u.admin && (PERMISOS[u.rol] || []).indexOf(r.Tipo) < 0) throw new Error('Tu perfil (' + u.rol + ') no puede enviar ' + r.Tipo);
      return conBloqueo_(() => {
        const d = leer_();
        const prev = d.registros[r.Uid];
        if (prev && prev.AutorCorreo !== u.correo && !u.admin) throw new Error('El registro pertenece a otro usuario');
        if (prev && prev.Estado === 'Aprobado') throw new Error('El registro ya fue aprobado; no se puede reemplazar');
        const carpeta = carpetaRegistro_(r, prev);
        guardarArchivos_(carpeta, q.archivos || []);
        const rec = Object.assign({}, r, {
          Autor: r.Autor || u.nombre || u.correo, AutorCorreo: u.correo, Estado: 'Enviado',
          Codigo: prev ? prev.Codigo : '', Correlativo: prev ? prev.Correlativo : null,
          Revisor: prev ? prev.Revisor : '', Comentario: prev ? prev.Comentario : '',
          Recibido: new Date().toISOString(), Carpeta: carpeta.getId(),
        });
        escribirJson_(carpeta, 'registro.json', rec);
        d.registros[r.Uid] = rec;
        escribir_(d);
        return { registro: rec };
      });
    }

    // Archivos de un registro (para verlo, imprimirlo o subirlo a SharePoint).
    case 'archivos': {
      const d = leer_();
      const r = d.registros[q.uid];
      if (!r) throw new Error('Registro no encontrado');
      if (!u.admin && r.AutorCorreo !== u.correo) throw new Error('Sin acceso a este registro');
      const out = [];
      const it = DriveApp.getFolderById(r.Carpeta).getFiles();
      while (it.hasNext()) {
        const f = it.next();
        const fid = f.getDescription();
        if (!fid || f.getName() === 'registro.json') continue;
        const b = f.getBlob();
        out.push({ fid, name: f.getName().replace(/^[^_]*_/, ''), type: b.getContentType(), data: Utilities.base64Encode(b.getBytes()) });
      }
      return { archivos: out };
    }

    // ---- Administrador ----

    case 'datos': {
      soloAdmin_(u);
      const d = leer_();
      return { usuarios: d.usuarios, obras: d.obras, partidas: d.partidas, registros: Object.values(d.registros) };
    }

    // Visar (Aprobado), observar o marcar como subido a SharePoint.
    case 'estado': {
      soloAdmin_(u);
      return conBloqueo_(() => {
        const d = leer_();
        const r = d.registros[q.uid];
        if (!r) throw new Error('Registro no encontrado');
        const c = q.cambios || {};
        ['Estado', 'Revisor', 'Comentario', 'SharePoint'].forEach((k) => { if (k in c) r[k] = c[k]; });
        if (c.Datos) r.Datos = c.Datos;
        if (r.Estado === 'Aprobado' && !r.Codigo) {
          const n = Object.values(d.registros).filter((x) => x.Tipo === r.Tipo)
            .reduce((m, x) => Math.max(m, Number(x.Correlativo) || 0), 0) + 1;
          r.Correlativo = n;
          r.Codigo = r.Tipo + '-' + SIGLA + '-' + ('00' + n).slice(-3);
        }
        r.Title = (r.Codigo || 'Sin código') + ' ' + r.Tipo;
        if (c.Estado) r.Visado = new Date().toISOString();
        escribirJson_(DriveApp.getFolderById(r.Carpeta), 'registro.json', r);
        escribir_(d);
        return { registro: r };
      });
    }

    case 'eliminar': {
      soloAdmin_(u);
      return conBloqueo_(() => {
        const d = leer_();
        const r = d.registros[q.uid];
        if (r && r.Estado === 'Aprobado') throw new Error('No se elimina un registro aprobado');
        if (r && r.Carpeta) DriveApp.getFolderById(r.Carpeta).setTrashed(true);
        delete d.registros[q.uid];
        escribir_(d);
        return {};
      });
    }

    // Usuarios, obras y etapas: agrega o reemplaza por Uid.
    case 'guardar': {
      soloAdmin_(u);
      if (['usuarios', 'obras', 'partidas'].indexOf(q.lista) < 0) throw new Error('Lista desconocida');
      return conBloqueo_(() => {
        const d = leer_();
        const arr = d[q.lista];
        (q.items || []).forEach((it) => {
          if (!it.Uid) return;
          if (q.lista === 'usuarios') it.Correo = String(it.Correo || '').toLowerCase();
          const i = arr.findIndex((x) => x.Uid === it.Uid);
          if (i >= 0) arr[i] = Object.assign({}, arr[i], it); else arr.push(it);
        });
        escribir_(d);
        return { [q.lista]: arr };
      });
    }

    default: throw new Error('Acción desconocida: ' + q.accion);
  }
}

// ---------- Drive ----------

function conBloqueo_(fn) {
  const l = LockService.getScriptLock();
  l.waitLock(30000);
  try { return fn(); } finally { l.releaseLock(); }
}

function sub_(padre, nombre) {
  const it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}

function raiz_() {
  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty('RAIZ');
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { /* se recrea */ } }
  const f = sub_(DriveApp.getRootFolder(), RAIZ);
  p.setProperty('RAIZ', f.getId());
  return f;
}

function leer_() {
  const it = raiz_().getFilesByName(DATOS);
  const d = it.hasNext() ? JSON.parse(it.next().getBlob().getDataAsString('UTF-8')) : {};
  return { proyecto: PROYECTO, usuarios: d.usuarios || [], obras: d.obras || [], partidas: d.partidas || [], registros: d.registros || {} };
}

function escribir_(d) { escribirJson_(raiz_(), DATOS, d); }

function escribirJson_(carpeta, nombre, obj) {
  const txt = JSON.stringify(obj, null, 1);
  const it = carpeta.getFilesByName(nombre);
  if (it.hasNext()) it.next().setContent(txt);
  else carpeta.createFile(nombre, txt, MimeType.PLAIN_TEXT);
}

function carpetaRegistro_(r, prev) {
  if (prev && prev.Carpeta) { try { return DriveApp.getFolderById(prev.Carpeta); } catch (e) { /* se recrea */ } }
  const tipo = sub_(sub_(raiz_(), 'Registros'), r.Tipo);
  return tipo.createFolder((r.Fecha || 'sin-fecha') + '_' + String(r.Uid).slice(0, 8));
}

// Reemplaza los archivos del registro (un reenvío corregido trae el juego completo).
function guardarArchivos_(carpeta, archivos) {
  const it = carpeta.getFiles();
  while (it.hasNext()) { const f = it.next(); if (f.getName() !== 'registro.json') f.setTrashed(true); }
  archivos.forEach((a) => {
    const nombre = String(a.fid).slice(0, 8) + '_' + String(a.name || 'archivo').replace(/[\\/:*?"<>|]/g, '_');
    const blob = Utilities.newBlob(Utilities.base64Decode(a.data), a.type || 'application/octet-stream', nombre);
    carpeta.createFile(blob).setDescription(a.fid);
  });
}

// Ejecutar una vez desde el editor para autorizar Drive y crear la carpeta.
function prueba() {
  const d = leer_();
  escribir_(d);
  Logger.log('Carpeta: ' + raiz_().getUrl() + ' · administrador: ' + Session.getEffectiveUser().getEmail());
}
