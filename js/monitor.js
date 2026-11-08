// Monitoreo: captura errores de la app y tiempos de respuesta del buzón, los guarda en
// este equipo y los manda al buzón (Drive del administrador) cuando hay señal.
// No usa servicios externos. Lo que se envía se describe en privacidad.html.
import { CONFIG } from '../config.js';

const COLA = 'monitor:cola';
const ULTIMO = 'monitor:ultimoEnvio';
const MAX_COLA = 50;
const LATIDO_MS = 6 * 3600 * 1000; // cada cuánto informar «sigo usando la app» sin errores

const ls = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const corta = (s, n) => String(s ?? '').slice(0, n);

// Tiempos de respuesta del buzón en esta sesión (últimos 30).
const tiempos = [];
export function medir(accion, ms, ok) {
  tiempos.push({ accion, ms: Math.round(ms), ok, ts: Date.now() });
  if (tiempos.length > 30) tiempos.shift();
}
export const resumenTiempos = () => {
  const ok = tiempos.filter((t) => t.ok).map((t) => t.ms).sort((a, b) => a - b);
  return { n: tiempos.length, fallas: tiempos.length - ok.length, mediana: ok.length ? ok[Math.floor(ok.length / 2)] : null, max: ok.length ? ok[ok.length - 1] : null };
};

export function dispositivo() {
  const ua = navigator.userAgent;
  const so = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Otro';
  const nav = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Otro';
  const app = matchMedia('(display-mode: standalone)').matches || navigator.standalone ? 'instalada' : 'navegador';
  return `${so} · ${nav} · ${app}`;
}

// Registra un evento. Repetidos (mismo mensaje en 10 min) suman en vez de duplicarse.
export function registrar(tipo, error, extra = {}) {
  try {
    const mensaje = corta(error?.message || error?.reason?.message || error, 400) || '(sin mensaje)';
    const cola = ls.get(COLA) || [];
    const ahora = new Date().toISOString();
    const igual = cola.find((e) => e.tipo === tipo && e.mensaje === mensaje && Date.parse(ahora) - Date.parse(e.ultimo) < 600000);
    if (igual) { igual.veces++; igual.ultimo = ahora; }
    else {
      cola.push({
        id: Math.random().toString(36).slice(2, 10), tipo, mensaje, veces: 1, fecha: ahora, ultimo: ahora,
        stack: corta(error?.stack, 1500), ruta: corta(location.hash.split('?')[0], 80), version: CONFIG.VERSION,
        enLinea: navigator.onLine, dispositivo: dispositivo(), ...extra,
      });
      while (cola.length > MAX_COLA) cola.shift();
    }
    ls.set(COLA, cola);
  } catch { /* el monitoreo nunca debe romper la app */ }
}

export const pendientes = () => (ls.get(COLA) || []).length;
export const colaLocal = () => ls.get(COLA) || [];

// Errores no capturados y promesas rechazadas sin manejar.
let instalado = false;
export function instalar() {
  if (instalado) return;
  instalado = true;
  addEventListener('error', (e) => {
    if (e.target && e.target !== window && (e.target.src || e.target.href)) return registrar('recurso', `No cargó ${e.target.src || e.target.href}`);
    registrar('error', e.error || e.message, { lugar: corta(`${e.filename || ''}:${e.lineno || ''}:${e.colno || ''}`, 200) });
  }, true);
  addEventListener('unhandledrejection', (e) => registrar('promesa', e.reason || 'Promesa rechazada'));
}

// Manda lo acumulado (y un latido cada 6 h aunque no haya errores).
// enviarFn = (eventos, dispositivo) => Promise; lo pone app.js para no depender del buzón aquí.
let enviando = null;
export function enviar(enviarFn, forzar = false) {
  const cola = ls.get(COLA) || [];
  const ultimo = ls.get(ULTIMO) || 0;
  if (!cola.length && !forzar && Date.now() - ultimo < LATIDO_MS) return Promise.resolve(false);
  return (enviando ||= (async () => {
    try {
      await enviarFn(cola, dispositivo());
      const ids = new Set(cola.map((e) => e.id));
      ls.set(COLA, (ls.get(COLA) || []).filter((e) => !ids.has(e.id))); // lo que llegó mientras se enviaba se queda
      ls.set(ULTIMO, Date.now());
      return true;
    } catch { return false; } finally { enviando = null; }
  })());
}
export const ultimoEnvio = () => ls.get(ULTIMO);
