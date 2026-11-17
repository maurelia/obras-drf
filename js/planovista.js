// Plano del proyecto Obras Fluviales DRF en el panel: planta o vista 3D con cada obra
// coloreada por su avance (azul de un solo tono: más oscuro = más avance) y su etiqueta;
// tocar una obra abre su ficha. Las mismas imágenes dan la imagen de cada obra (recorte en planta).
// Geometría e imágenes: js/plano.js e img/plano/ (01_DOCUMENTOS/_plano/03_render.py).
import { PLANO } from './plano.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (v) => `${Math.round(v)} %`;

// Rampa secuencial azul (pasos 150 → 700 de la paleta de referencia). 0 % = sin iniciar (blanco con borde).
const RAMPA = ['#b7d3f6', '#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281', '#0d366b'];
export function colorAvance(v) {
  if (v == null) return null;
  if (v <= 0) return '#ffffff';
  return RAMPA[Math.min(RAMPA.length - 1, Math.floor((v / 100) * (RAMPA.length - 1) + 0.0001))];
}
const FUERA = '#9aa1ab';

export const hayPlano = (codigo) => !!PLANO.obras[codigo];

// estado: { codigo: { avance (0..100 | null = fuera de la fase), titulo, uid } }
function capas(vista, estado, { etiquetas = true, foco = null } = {}) {
  const k = vista === 'v' ? 'v' : 'p';
  const orden = Object.keys(PLANO.obras).sort((a, b) => (a === foco) - (b === foco));
  const formas = orden.map((c) => {
    const o = PLANO.obras[c], e = estado[c];
    const fuera = !e || e.avance == null;
    const fill = fuera ? FUERA : colorAvance(e.avance);
    const tenue = foco && c !== foco;
    return `<g class="po${fuera ? ' fuera' : ''}${c === foco ? ' foco' : ''}" data-cod="${esc(c)}" tabindex="${foco ? -1 : 0}" role="link"
      aria-label="${esc(`${c} ${e?.titulo || ''}: ${fuera ? 'sin peso en esta fase' : 'avance ' + pct(e.avance)}`)}" ${tenue ? 'opacity=".45"' : ''}>
      <path class="halo" d="${o[k]}"/><path class="cuerpo" d="${o[k]}" fill="${fill}" stroke="${fill}"${e?.avance === 0 ? ' stroke-dasharray="3 2"' : ''}/></g>`;
  }).join('');
  const etq = etiquetas ? Object.entries(PLANO.obras).map(([c, o]) => {
    const e = estado[c], [ax, ay] = o['a' + k], [dx, dy] = k === 'v' ? o.d3 || o.d : o.d;
    const tx = ax + dx, ty = ay + dy;
    return `<g class="etq" aria-hidden="true"><line x1="${ax}" y1="${ay}" x2="${tx}" y2="${ty}"/>
      <text x="${tx}" y="${ty}" text-anchor="${dx < -6 ? 'end' : dx > 6 ? 'start' : 'middle'}" dy="${dy < 0 ? -3 : 11}">
      <tspan class="c">${esc(c)}</tspan>${e && e.avance != null ? `<tspan class="v"> ${pct(e.avance)}</tspan>` : ''}</text></g>`;
  }).join('') : '';
  return formas + etq;
}

// Plano completo (panel).
export function planoSVG(vista, estado) {
  const im = vista === 'v' ? PLANO.vista3d : PLANO.planta;
  return `<svg class="plano${vista === 'v' ? ' v3d' : ''}" viewBox="0 0 ${im.w} ${im.h}" role="group" aria-label="Plano de las obras fluviales: ${vista === 'v' ? 'vista 3D' : 'planta'}">
    <image href="${im.src}" width="${im.w}" height="${im.h}"/>
    ${capas(vista, estado)}
    ${vista === 'v' ? '' : `<g class="norte" transform="translate(${im.w - 46},52)" aria-hidden="true"><path d="M0,-30 L11,8 L0,2 L-11,8Z"/><text y="26" text-anchor="middle">N</text></g>
    <g class="escala" transform="translate(28,${im.h - 30})" aria-hidden="true"><path d="M0,0 h${(200 * im.w) / ((376110 - 374130))}"/><text y="-8">200 m</text></g>`}
  </svg><div class="tip" hidden></div>`;
}

// Imagen de una obra: recorte de la planta centrado en ella (las demás, tenues).
export function imagenObra(codigo, estado, { lado = 180, etiqueta = false, clase = '', aspecto = 1 } = {}) {
  const o = PLANO.obras[codigo];
  if (!o) return '';
  const [x0, y0, x1, y1] = o.bb;
  // Alto m y ancho m × aspecto, con la obra completa dentro.
  const m = Math.max((x1 - x0) / aspecto, y1 - y0, lado) * 1.18, mw = m * aspecto;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const im = PLANO.planta;
  return `<svg class="plano mini ${clase}" viewBox="${(cx - mw / 2).toFixed(1)} ${(cy - m / 2).toFixed(1)} ${mw.toFixed(1)} ${m.toFixed(1)}" role="img"
    aria-label="${esc(`Ubicación de ${codigo} en el plano`)}"><image href="${im.src}" width="${im.w}" height="${im.h}"/>
    ${capas('p', estado, { etiquetas: etiqueta, foco: codigo })}</svg>`;
}

// Tooltip y navegación al tocar una obra del plano.
export function activarPlano(cont, estado, abrir) {
  const svg = cont.querySelector('svg.plano'), tip = cont.querySelector('.tip');
  if (!svg) return;
  const mostrar = (g, ev) => {
    const c = g.dataset.cod, e = estado[c];
    tip.hidden = false;
    tip.innerHTML = `<b>${esc(c)}</b> · ${esc(e?.titulo || '')}<br>${e && e.avance != null ? `Avance ${pct(e.avance)}` : 'Sin peso en esta fase'}`;
    const b = cont.getBoundingClientRect();
    tip.style.left = `${Math.min(Math.max(ev.clientX - b.left, 70), b.width - 70)}px`;
    tip.style.top = `${Math.max(ev.clientY - b.top - 64, 4)}px`;
  };
  svg.querySelectorAll('g.po').forEach((g) => {
    g.addEventListener('pointerenter', (ev) => mostrar(g, ev));
    g.addEventListener('pointermove', (ev) => mostrar(g, ev));
    g.addEventListener('pointerleave', () => (tip.hidden = true));
    g.addEventListener('click', () => estado[g.dataset.cod]?.uid && abrir(estado[g.dataset.cod].uid));
    g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && estado[g.dataset.cod]?.uid) abrir(estado[g.dataset.cod].uid); });
  });
}

// Leyenda: rampa de avance, sin iniciar y fuera de la fase.
export const leyendaPlano = () => `<div class="leyplano" aria-hidden="true">
  <span class="sw" style="background:#fff;border:1.5px dashed #2a78d6"></span>Sin iniciar
  <span class="rampa" style="background:linear-gradient(90deg,${RAMPA.join(',')})"></span><span>0 → 100 %</span>
  <span class="sw" style="background:${FUERA}"></span>Fuera de esta fase</div>`;

// ---------- Piscinas (Piscina Operacional DRF) ----------
// Esquema 3D de una piscina tipo (coronamiento 50 × 30 m, fondo 36 × 16 m, h 3,5 m, talud H/V 2/1; Cálculo Piscina
// de Emergencia DRF y EETT) que muestra su estado según el avance de cada etapa (Item P1..P8 del catálogo):
// P2 excavación → profundidad excavada; P3 perfilado de taludes y sello; P5 zanja de anclaje; P6 geomembrana.
// No es un plano: la ubicación de las piscinas en el DRF todavía no está en la app.
const PIS = { L: 50, A: 30, H: 3.5, T: 2, Z: 1.5 };
const ETQ_PIS = [['P2', 'Excavación'], ['P3', 'Taludes y sello'], ['P5', 'Zanja de anclaje'], ['P6', 'Geomembrana']];

export function piscinaSVG(cod, av = {}, { mini = false } = {}) {
  const a = (k) => Math.max(0, Math.min(100, Number(av[k]) || 0)) / 100;
  const s = 7.2, c30 = Math.cos(Math.PI / 6), s30 = 0.5, kz = 1.6;
  const M = 9; // margen de plataforma (m)
  const pr = (x, y, z) => [((x - y) * c30) * s, ((x + y) * s30 - z * kz) * s];
  const P = (pts) => pts.map((p) => pr(...p).map((v) => v.toFixed(1)).join(',')).join(' ');
  const { L, A, H, T } = PIS;
  const d = H * a('P2');                       // profundidad excavada
  const b = (z) => [T * z, T * z];             // retiro del talud a la profundidad z
  const top = [[0, 0, 0], [L, 0, 0], [L, A, 0], [0, A, 0]];
  const [rx] = b(d);
  const fondo = [[rx, rx, -d], [L - rx, rx, -d], [L - rx, A - rx, -d], [rx, A - rx, -d]];
  const fin = [[T * H, T * H, -H], [L - T * H, T * H, -H], [L - T * H, A - T * H, -H], [T * H, A - T * H, -H]];
  const pad = [[-M, -M, 0], [L + M, -M, 0], [L + M, A + M, 0], [-M, A + M, 0]];
  const borde = [[-M, A + M, 0], [L + M, A + M, 0], [L + M, A + M, -1.2], [-M, A + M, -1.2]];
  const borde2 = [[L + M, -M, 0], [L + M, A + M, 0], [L + M, A + M, -1.2], [L + M, -M, -1.2]];
  // Caras interiores: muros del fondo (y = 0 y x = 0, los lejanos) y los cercanos.
  const muro = (i) => [top[i], top[(i + 1) % 4], fondo[(i + 1) % 4], fondo[i]];
  const perf = a('P3'), geo = a('P6'), zanja = a('P5');
  const tierra = ['#d9c7a6', '#cbb48e', '#bda47c', '#b0966e'];
  // Taludes perfilados: la tierra toma el azul del avance (más perfilado = más azul).
  const mezcla = (h1, h2, t) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(h1.slice(i, i + 2), 16) * t + parseInt(h2.slice(i, i + 2), 16) * (1 - t))
    .toString(16).padStart(2, '0')).join('');
  const caraCol = (k) => (perf > 0 ? mezcla(colorAvance(perf * 100), tierra[k], 0.25 + 0.45 * perf) : tierra[k]);
  const xs = [...pad, ...fin].map((p) => pr(...p)[0]), ys = [...pad, ...borde].map((p) => pr(...p)[1]);
  const vb = [Math.min(...xs) - 6, Math.min(...ys) - (mini ? 6 : 30), Math.max(...xs) - Math.min(...xs) + 12, Math.max(...ys) - Math.min(...ys) + (mini ? 12 : 36)];
  const zan = PIS.Z;
  const anillo = [[-zan, -zan, 0], [L + zan, -zan, 0], [L + zan, A + zan, 0], [-zan, A + zan, 0]];
  const lbl = mini ? '' : `<text class="pt" x="${(vb[0] + 8).toFixed(1)}" y="${(vb[1] + 20).toFixed(1)}">${esc(cod)} · excavado ${d.toLocaleString('es-CL', { maximumFractionDigits: 1 })} de ${H.toLocaleString('es-CL')} m</text>`;
  return `<svg class="pisc${mini ? ' mini' : ''}" viewBox="${vb.map((v) => v.toFixed(1)).join(' ')}" role="img"
    aria-label="${esc(`${cod}: esquema 3D, excavación ${pct(a('P2') * 100)}, taludes ${pct(perf * 100)}, geomembrana ${pct(geo * 100)}`)}">
    <polygon points="${P(borde)}" fill="#b9a585"/><polygon points="${P(borde2)}" fill="#a8946f"/>
    <polygon points="${P(pad)}" fill="#e6d9bf"/>
    ${d > 0.01 ? `${[0, 3].map((i) => `<polygon points="${P(muro(i))}" fill="${caraCol(i === 0 ? 2 : 3)}" stroke="#8c7550" stroke-width=".6"/>`).join('')}
      <polygon points="${P(fondo)}" fill="${caraCol(0)}" stroke="#8c7550" stroke-width=".6"/>
      ${[1, 2].map((i) => `<polygon points="${P(muro(i))}" fill="${caraCol(1)}" stroke="#8c7550" stroke-width=".6"/>`).join('')}
      ${geo > 0 ? `<g opacity="${(0.35 + 0.6 * geo).toFixed(2)}" fill="#2f3a48">${[0, 3].map((i) => `<polygon points="${P(muro(i))}"/>`).join('')}<polygon points="${P(fondo)}"/></g>` : ''}` : ''}
    ${d < H - 0.01 ? `<polygon points="${P(fin)}" fill="none" stroke="#0b0f14" stroke-width="1.2" stroke-dasharray="4 3" opacity=".7"/>` : ''}
    <polygon points="${P(top)}" fill="none" stroke="#5c4a2e" stroke-width="1.4"/>
    <polygon points="${P(anillo)}" fill="none" stroke="${zanja > 0 ? '#2f3a48' : '#8c7550'}" stroke-width="${zanja > 0 ? 2.5 : 1}" ${zanja > 0 ? '' : 'stroke-dasharray="3 3"'}/>
    ${lbl}</svg>`;
}

// Etapas clave de la piscina con su avance (para acompañar el esquema).
export const etapasPiscina = (av) => `<div class="pisetapas">${ETQ_PIS.map(([k, l]) => {
  const v = Math.max(0, Math.min(100, Number(av[k]) || 0));
  return `<div><span>${l}</span><b>${pct(v)}</b><div class="bar"><i style="width:${v}%"></i></div></div>`;
}).join('')}</div>`;
