// Avance del proyecto, igual que la planilla Control_Avance_Diario_Protocolos_LJ:
// avance etapa = último corte (recálculo de Proyectos o reporte de terreno visado; si no hay, AvanceBase)
// + Σ "avance del día" de los protocolos diarios visados posteriores (tope 100 %);
// avance obra = Σ peso etapa × avance etapa; avance global = Σ peso obra × avance obra.

// Obras tempranas (previas, para mitigar erosión mientras se construye el sistema definitivo)
// y definitivas (sistema de desvío de aguas naturales del DRF, PAS 155 y 157). La fase va en
// cada etapa: RD-1, DE y CC-1 tienen etapas tempranas y luego definitivas sobre la misma obra.
// Cada obra tiene un peso por fase (Peso = tempranas, PesoDef = definitivas).
// Las piscinas operacionales A y B del DRF son un tercer grupo, con su propio avance (PesoPis).
export const FASES = ['Temprana', 'Definitiva', 'Piscina'];
export const FASE_PLURAL = { Temprana: 'Obras tempranas', Definitiva: 'Obras definitivas', Piscina: 'Piscinas' };
export const faseDe = (p) => (FASES.includes(p.Fase) ? p.Fase : 'Temprana');
const CAMPO_PESO = { Temprana: 'Peso', Definitiva: 'PesoDef', Piscina: 'PesoPis' };
export const pesoObra = (o, fase) => Number(o[CAMPO_PESO[fase] || 'Peso']) || 0;
export const fasesDeObra = (obraUid, partidas) => FASES.filter((f) => partidas.some((p) => p.ObraUid === obraUid && faseDe(p) === f));

const CUENTA = new Set(['Aprobado']); // solo lo visado por Proyectos

// Filas de avance de los registros visados: [{ fecha, hora, etapa, avance, corte, reg }].
// - Protocolo diario (PDA): avance = % de la etapa ejecutado ese día (se suma).
// - Reporte de terreno (RTE): avance = % ACUMULADO de la etapa observado en terreno a esa fecha y
//   hora (corte: reemplaza lo anterior; desde ahí vuelven a sumar los protocolos diarios).
export function filasAvance(registros) {
  const ok = registros.filter((r) => CUENTA.has(r.Estado));
  const pda = ok.filter((r) => r.Tipo === 'PDA')
    .flatMap((r) => (r.Datos?.avances || []).filter((a) => a.etapa && Number(a.avance))
      .map((a) => ({ fecha: r.Fecha, etapa: a.etapa, avance: Number(a.avance), reg: r })));
  const rte = ok.filter((r) => r.Tipo === 'RTE')
    .flatMap((r) => (r.Datos?.avances || []).filter((a) => a.etapa && a.acumulado !== '' && a.acumulado != null && !isNaN(a.acumulado))
      .map((a) => ({ fecha: r.Fecha, hora: r.Datos?.hora || '', etapa: a.etapa, avance: Number(a.acumulado), corte: true, reg: r })));
  return [...pda, ...rte];
}

// Cortes de una etapa: los recálculos del catálogo (Corte a FechaCorte) y los reportes de terreno visados.
const clave = (f) => `${f.fecha || ''} ${f.hora || ''}`;
function cortesDe(p, filas) {
  const cs = filas.filter((f) => f.corte && f.etapa === p.Uid);
  if (p.FechaCorte && p.Corte !== '' && p.Corte != null) cs.push({ fecha: p.FechaCorte, hora: '', etapa: p.Uid, avance: Number(p.Corte), corte: true });
  return cs.sort((a, b) => clave(a).localeCompare(clave(b)));
}

// % por etapa (Uid → 0..100), opcionalmente hasta una fecha: último corte (o AvanceBase)
// más lo informado en los protocolos diarios posteriores a ese corte (tope 100 %).
export function avanceEtapas(partidas, filas, hasta) {
  const out = {};
  const porEtapa = {};
  for (const f of filas) if (!f.corte) (porEtapa[f.etapa] ||= []).push(f);
  for (const p of partidas) {
    const c = cortesDe(p, filas).filter((x) => !hasta || x.fecha <= hasta).at(-1);
    let v = c ? c.avance : Number(p.AvanceBase) || 0;
    for (const f of porEtapa[p.Uid] || []) if ((!hasta || f.fecha <= hasta) && (!c || f.fecha > c.fecha)) v += f.avance;
    out[p.Uid] = Math.max(0, Math.min(100, v));
  }
  return out;
}

// % de una obra (en una fase, o en todas sus etapas). Sin pesos definidos, promedio simple.
export function avanceObra(obraUid, partidas, porEtapa, fase) {
  const ps = partidas.filter((p) => p.ObraUid === obraUid && (!fase || faseDe(p) === fase));
  if (!ps.length) return null;
  const tot = ps.reduce((s, p) => s + (Number(p.Peso) || 0), 0);
  return tot > 0 ? ps.reduce((s, p) => s + (Number(p.Peso) || 0) * porEtapa[p.Uid], 0) / tot
    : ps.reduce((s, p) => s + porEtapa[p.Uid], 0) / ps.length;
}

// % de una fase: Σ peso de la obra en esa fase × avance de sus etapas de esa fase.
export function avanceGlobal(obras, partidas, porEtapa, fase = 'Temprana') {
  const con = obras.filter((o) => pesoObra(o, fase) > 0);
  const tot = con.reduce((s, o) => s + pesoObra(o, fase), 0);
  if (!tot) return null;
  return con.reduce((s, o) => s + pesoObra(o, fase) * (avanceObra(o.Uid, partidas, porEtapa, fase) ?? 0), 0) / tot;
}

// Serie del avance global por fecha: un punto en la fecha base y uno por cada día con protocolo.
export function serieGlobal(obras, partidas, filas, fechaBase, fase = 'Temprana') {
  const ps = partidas.filter((p) => faseDe(p) === fase);
  const enFase = new Set(ps.map((p) => p.Uid));
  filas = filas.filter((f) => enFase.has(f.etapa));
  const fechas = [...new Set([...filas.map((f) => f.fecha), ...ps.map((p) => p.FechaCorte)].filter((f) => f && f > fechaBase))].sort();
  return [fechaBase, ...fechas].map((f) => ({ fecha: f, v: avanceGlobal(obras, partidas, avanceEtapas(partidas, filas, f), fase) ?? 0 }));
}

// Horas de máquina por registro de maquinaria (Σ horómetro final − inicial).
export const horasRCM = (r) => (r.Datos?.registro || []).reduce((s, x) =>
  s + (Number(x.horoFin) > Number(x.horoIni) ? Number(x.horoFin) - Number(x.horoIni) : 0), 0);

// Lunes (ISO) de la semana de una fecha 'aaaa-mm-dd'.
export function lunes(fecha) {
  const d = new Date(fecha + 'T12:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
