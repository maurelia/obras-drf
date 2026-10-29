// Avance del proyecto, igual que la planilla Control_Avance_Diario_Protocolos_LJ:
// avance etapa = AvanceBase + Σ "avance del día" de los protocolos diarios enviados (tope 100 %);
// avance obra = Σ peso etapa × avance etapa; avance global = Σ peso obra × avance obra.

const CUENTA = new Set(['Aprobado']); // solo lo aprobado, que es lo que se sube a SharePoint

// Filas de avance de los protocolos diarios: [{ fecha, etapa, avance, reg }]
export function filasAvance(registros) {
  return registros.filter((r) => r.Tipo === 'PDA' && CUENTA.has(r.Estado))
    .flatMap((r) => (r.Datos?.avances || []).filter((a) => a.etapa && Number(a.avance))
      .map((a) => ({ fecha: r.Fecha, etapa: a.etapa, avance: Number(a.avance), reg: r })));
}

// % por etapa (Uid → 0..100), opcionalmente hasta una fecha.
export function avanceEtapas(partidas, filas, hasta) {
  const out = {};
  for (const p of partidas) out[p.Uid] = Number(p.AvanceBase) || 0;
  for (const f of filas) if (!hasta || f.fecha <= hasta) if (f.etapa in out) out[f.etapa] += f.avance;
  for (const k in out) out[k] = Math.min(100, out[k]);
  return out;
}

// % de una obra. Sin pesos definidos, promedio simple de sus etapas.
export function avanceObra(obraUid, partidas, porEtapa) {
  const ps = partidas.filter((p) => p.ObraUid === obraUid);
  if (!ps.length) return null;
  const tot = ps.reduce((s, p) => s + (Number(p.Peso) || 0), 0);
  return tot > 0 ? ps.reduce((s, p) => s + (Number(p.Peso) || 0) * porEtapa[p.Uid], 0) / tot
    : ps.reduce((s, p) => s + porEtapa[p.Uid], 0) / ps.length;
}

export function avanceGlobal(obras, partidas, porEtapa) {
  const con = obras.filter((o) => Number(o.Peso) > 0);
  const tot = con.reduce((s, o) => s + Number(o.Peso), 0);
  if (!tot) return null;
  return con.reduce((s, o) => s + Number(o.Peso) * (avanceObra(o.Uid, partidas, porEtapa) ?? 0), 0) / tot;
}

// Serie del avance global por fecha: un punto en la fecha base y uno por cada día con protocolo.
export function serieGlobal(obras, partidas, filas, fechaBase) {
  const fechas = [...new Set(filas.map((f) => f.fecha).filter((f) => f > fechaBase))].sort();
  return [fechaBase, ...fechas].map((f) => ({ fecha: f, v: avanceGlobal(obras, partidas, avanceEtapas(partidas, filas.filter((x) => x.fecha <= f))) ?? 0 }));
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
