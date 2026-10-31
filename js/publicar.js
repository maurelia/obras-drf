// Subida a SharePoint de lo visado (botón del administrador).
// Por cada registro deja en <CARPETA>/<TIPO>/<CÓDIGO>/ el PDF del protocolo y sus
// fotos, firmas y adjuntos, y lo anota en la lista DRF_Registros (con las obras y
// etapas en DRF_Obras y DRF_Partidas): de ahí leen el panel de consulta y Power BI.
import { CONFIG, DEMO } from '../config.js';
import * as graph from './graph.js';
import { fieldNames } from './schema.js';
import { fileRefs, renderDoc } from './engine.js';

// ---------- PDF del documento (html2pdf, se carga solo cuando se necesita) ----------

let h2p = null;
const cargarH2P = () => (h2p ||= new Promise((ok, fail) => {
  if (window.html2pdf) return ok(window.html2pdf);
  const s = document.createElement('script');
  s.src = 'vendor/html2pdf.bundle.min.js';
  s.onload = () => ok(window.html2pdf);
  s.onerror = () => { h2p = null; fail(new Error('No se pudo cargar el generador de PDF')); };
  document.head.append(s);
}));

const dataUrl = (blob) => new Promise((ok, fail) => {
  const r = new FileReader();
  r.onload = () => ok(r.result);
  r.onerror = () => fail(r.error);
  r.readAsDataURL(blob);
});

// archivos: Map fid → Blob
export async function pdf(reg, ctx, archivos) {
  const html2pdf = await cargarH2P();
  const box = document.createElement('div');
  box.className = 'pdfbox';
  box.innerHTML = `<div class="pdfdoc">${renderDoc(reg, ctx)}</div>`;
  document.body.append(box);
  try {
    // html2canvas no dibuja imágenes blob:, por eso van como data URL.
    await Promise.all([...box.querySelectorAll('img[data-fid]')].map(async (img) => {
      const b = archivos.get(img.dataset.fid);
      if (!b) { img.remove(); return; }
      img.src = await dataUrl(b);
      await img.decode().catch(() => {});
    }));
    return await html2pdf().set({
      margin: [10, 10, 12, 10],
      image: { type: 'jpeg', quality: 0.9 },
      html2canvas: { scale: 2, backgroundColor: '#ffffff', logging: false, scrollX: 0, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', 'figure', '.docsec h4', '.dochead'] },
    }).from(box.firstElementChild).outputPdf('blob');
  } finally {
    box.remove();
  }
}

// ---------- Listas ----------

const pick = (list, data) => Object.fromEntries(
  fieldNames(list).filter((f) => data[f] !== undefined && data[f] !== null && data[f] !== '')
    .map((f) => [f, typeof data[f] === 'object' ? JSON.stringify(data[f]) : data[f]])
);
const igual = (a, b) => Object.keys(a).every((k) => String(a[k]) === String(b[k] ?? ''));

async function upsert(list, items, remotos) {
  const porUid = Object.fromEntries(remotos.map((r) => [r.Uid, r]));
  for (const it of items) {
    const f = pick(list, it);
    const r = porUid[it.Uid];
    if (!r) await graph.createItem(list, f);
    else if (!igual(f, r)) await graph.updateItem(list, r._spId, f);
  }
}

// Ruta segura para SharePoint (sin caracteres prohibidos).
const limpio = (s) => String(s || 'archivo').replace(/["*:<>?/\\|#%]/g, '_').trim();

// regs: registros visados. archivosDe(reg) → [{ fid, name, blob }].
// alSubir(reg, info) se llama tras cada registro, para dejarlo anotado aunque falle el siguiente.
export async function subir(regs, { ctx, obras, partidas, archivosDe, alSubir, log = () => {} }) {
  if (DEMO) {
    for (const reg of regs) {
      log(`${reg.Codigo}: generando PDF…`);
      const archivos = new Map((await archivosDe(reg)).map((a) => [a.fid, a.blob]));
      const blob = await pdf(reg, ctx, archivos);
      log(`✓ ${reg.Codigo} (demo: PDF de ${Math.round(blob.size / 1024)} kB, no se sube)`);
      await alSubir(reg, { fecha: new Date().toISOString(), url: URL.createObjectURL(blob), carpeta: `${CONFIG.CARPETA}/${reg.Tipo}/${reg.Codigo}`, demo: true });
    }
    return;
  }

  log('Conectando con SharePoint…');
  const { faltantes } = await graph.resolveLists();
  if (faltantes.length) { log(`Creando listas: ${faltantes.join(', ')}`); await graph.provision(log); }

  log('Actualizando obras y etapas…');
  await upsert('obras', obras, await graph.fetchAll('obras'));
  await upsert('partidas', partidas, await graph.fetchAll('partidas'));
  const remotos = await graph.fetchAll('registros');
  const porUid = Object.fromEntries(remotos.map((r) => [r.Uid, r]));

  for (const reg of regs) {
    if (!reg.Codigo) throw new Error('Registro sin código: vísalo antes de subirlo');
    const carpeta = `${CONFIG.CARPETA}/${reg.Tipo}/${reg.Codigo}`;
    log(`${reg.Codigo}: subiendo archivos…`);
    const lista = await archivosDe(reg);
    const subidos = {};
    for (const a of lista) {
      const it = await graph.uploadFile(`${carpeta}/${limpio(a.name)}`, a.blob);
      subidos[a.fid] = { driveId: it.id, webUrl: it.webUrl };
    }
    const faltan = fileRefs(reg.Datos).filter((r) => !subidos[r.fid]).length;
    if (faltan) log(`  ⚠ ${faltan} archivo(s) no estaban en el buzón`);

    log(`${reg.Codigo}: generando PDF…`);
    const doc = await pdf(reg, ctx, new Map(lista.map((a) => [a.fid, a.blob])));
    const pdfIt = await graph.uploadFile(`${carpeta}/${reg.Codigo}.pdf`, doc);

    const conUrls = (v) => Array.isArray(v) ? v.map(conUrls)
      : v && typeof v === 'object' ? (v.fid && subidos[v.fid] ? { ...v, ...subidos[v.fid] } : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, conUrls(x)])))
        : v;
    const fila = { ...reg, Datos: conUrls(reg.Datos), Title: `${reg.Codigo} ${reg.Tipo}`, Documento: pdfIt.webUrl, FechaVisado: (reg.Visado || '').slice(0, 10) };
    const prev = porUid[reg.Uid];
    if (prev) await graph.updateItem('registros', prev._spId, pick('registros', fila));
    else await graph.createItem('registros', pick('registros', fila));
    log(`✓ ${reg.Codigo}`);
    await alSubir(reg, { fecha: new Date().toISOString(), url: pdfIt.webUrl, carpeta });
  }
}
