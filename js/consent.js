// Autorizaciones: aceptación de la política de privacidad y los términos de uso
// (con constancia en el buzón) y permiso para guardar la ubicación de las fotos.
// También ayuda a inventariar lo que se recopila (clasificar, CSV, descarga).
import { CONFIG } from '../config.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};

// Versiones vigentes: deben coincidir con privacidad.html, terminos.html y buzon/Code.gs.
export const VIGENTE = CONFIG.POLITICAS;

// ---------- Aceptación de privacidad y términos ----------

const clave = (correo) => 'consent:' + String(correo || '').toLowerCase();
export const aceptado = (correo) => ls.get(clave(correo));
export const vigente = (c) => !!c && !c.retiro
  && Number(c.privacidad) >= VIGENTE.privacidad && Number(c.terminos) >= VIGENTE.terminos;

export function aceptar(correo) {
  const c = { privacidad: VIGENTE.privacidad, terminos: VIGENTE.terminos, fecha: new Date().toISOString(), pendiente: true };
  ls.set(clave(correo), c);
  return c;
}
export function retirar(correo) {
  const c = { privacidad: VIGENTE.privacidad, terminos: VIGENTE.terminos, fecha: new Date().toISOString(), retiro: true, pendiente: true };
  ls.set(clave(correo), c);
  return c;
}
export function registrado(correo) {
  const c = aceptado(correo);
  if (c) ls.set(clave(correo), { ...c, pendiente: false });
}
// La constancia que ya tiene el buzón (otro teléfono) evita volver a preguntar.
export function adoptar(correo, c) {
  if (!c || vigente(aceptado(correo)) || !vigente(c)) return;
  ls.set(clave(correo), { privacidad: c.privacidad, terminos: c.terminos, fecha: c.fecha, pendiente: false });
}
export const borrar = (correo) => ls.del(clave(correo));

// ---------- Ubicación de las fotos ----------

export const permisoGPS = () => ls.get('permGPS'); // 'si' | 'no' | null (se preguntará)
export const fijarGPS = (v) => (v ? ls.set('permGPS', v) : ls.del('permGPS'));

// Estado del permiso en el navegador: 'granted' | 'denied' | 'prompt' | null.
export async function estadoGPSNavegador() {
  try { return (await navigator.permissions.query({ name: 'geolocation' })).state; } catch { return null; }
}

// Antes de pedir el GPS al navegador, explica para qué y deja decidir. Recuerda la respuesta.
export function pedirGPS() {
  const p = permisoGPS();
  if (p) return Promise.resolve(p === 'si');
  return new Promise((ok) => {
    const dlg = document.getElementById('sheet');
    dlg.innerHTML = `<div class="sh-head"><span class="navbtn"></span><h2 id="shTitle">Ubicación de las fotos</h2><span class="navbtn"></span></div>
      <div class="sh-body">
        <p>La app puede guardar la ubicación GPS de cada foto que agregas, para dejar constancia de dónde se tomó.</p>
        <p class="foot" style="margin:0 0 14px">Solo se toma al agregar fotos, nunca en segundo plano. Si no lo permites, las fotos se guardan igual, sin coordenadas. Puedes cambiarlo en Ajustes › Mis datos.</p>
        <button type="button" class="btn" data-si>Permitir</button>
        <button type="button" class="btn sec" data-no>Ahora no</button>
      </div>`;
    const fin = (v) => { fijarGPS(v ? 'si' : 'no'); dlg.close(); ok(v); };
    dlg.querySelector('[data-si]').onclick = () => fin(true);
    dlg.querySelector('[data-no]').onclick = () => fin(false);
    dlg.oncancel = (e) => { e.preventDefault(); fin(false); };
    dlg.showModal();
  });
}

// ---------- Inventario ----------

// Cuenta lo que trae un registro según las referencias a archivos de sus datos.
export function clasificar(refs) {
  const o = { fotos: 0, gps: 0, firmas: 0, adjuntos: 0, bytesFotos: 0 };
  for (const r of refs) {
    if (r.name === 'firma.png') o.firmas++;
    else if (/^foto_/.test(r.name || '') || 'lat' in r) { o.fotos++; o.bytesFotos += r.size || 0; if ('lat' in r) o.gps++; }
    else o.adjuntos++;
  }
  return o;
}

// CSV con «;» y BOM, para que Excel en español lo abra bien.
export const csv = (filas) => '﻿' + filas.map((f) => f.map((c) => {
  const s = String(c ?? '');
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}).join(';')).join('\r\n');

export function descargar(nombre, texto, tipo = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export const textoVersion = (c) => (c ? `Privacidad v${c.privacidad} · Términos v${c.terminos}` : '—');
export { esc };
