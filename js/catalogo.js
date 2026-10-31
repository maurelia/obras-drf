// Obras del proyecto Obras Fluviales DRF (DRF-OF-2509-06), tomadas de
// 04.REUNIONES\Antecedentes_Obras_Fluviales_Sellos.xlsx (hoja OBRAS_CIVILES).
// El Uid es fijo para que dos equipos que carguen el catálogo no dupliquen obras.

const CANAL_RESTITUCION = {
  Descripcion: 'Canal de sección trapecial revestido, con bocatomas de muros de empréstito con largo variable.',
  Materialidad: 'Canal construido sobre cubeta consolidada y nivelada con relave filtrado y empréstito compactado, con revestimiento compuesto de:\n'
    + '- Geotextil\n- Lámina de HDPE e=1 mm\n- Mampostería de piedra con mortero de hormigón e=20 cm\n'
    + '- Bocatomas dispuestas en terreno natural revestidas con empedrado y hormigón sobre pretiles compactados',
};
const MAMPOSTERIA = 'Canal excavado en terreno con revestimiento de mampostería de piedra con mortero de hormigón.';

export const UBICACION = 'Depósito de relaves filtrados (DRF)';

// Fase de cada obra (bases técnicas 3503-BT-001_C y plano de obras fluviales tempranas):
// tempranas = RD, DE y CE, más los canales secundarios, que se construyen en esta etapa;
// RD-1 y DE tendrán además su fase definitiva sobre la misma obra (PAS 155 y 157).
// El canal de contorno CC-1 es definitivo y ya está construido.
const AMBAS = 'Temprana y definitiva';
export const FASES_OBRA = ['Temprana', 'Definitiva', AMBAS];
const FASE_OBRA = { 'CR-1': 'Definitiva', 'CR-2': 'Definitiva', 'CR-3': 'Definitiva', VE: 'Definitiva', 'CD-1': 'Definitiva',
  'CC-1': 'Definitiva', 'RD-1': AMBAS, DE: AMBAS, 'CS-1': 'Temprana', 'CS-2': 'Temprana', CE: 'Temprana' };

export const OBRAS_PROYECTO = [
  { Codigo: 'CR-1', Title: 'Canal de restitución 1', ...CANAL_RESTITUCION,
    Geometria: 'Trapecial\nB: 6 m\nH: 1,5 m\nZ: 1\nL: 1.120 m\ni: -14,4 %' },
  { Codigo: 'CR-2', Title: 'Canal de restitución 2', ...CANAL_RESTITUCION,
    Geometria: 'Trapecial\nB: 3 m\nH: 1,5 m\nZ: 1\nL: 746,21 m\ni: -1,62 %' },
  { Codigo: 'CR-3', Title: 'Canal de restitución 3', ...CANAL_RESTITUCION,
    Geometria: 'Trapecial\nB: 2 m\nH: 1,5 m\nZ: 1\nL: 521,85 m\ni: -0,249 %' },
  { Codigo: 'VE', Title: 'Vertedero de emergencia',
    Descripcion: 'Vertedero rectangular de perfil tipo Creager.',
    Materialidad: 'Vertedero dispuesto sobre terreno natural y materializado con hormigón armado.',
    Geometria: 'Vertedero tipo Creager\nP: 1 m\nL: 12 m' },
  { Codigo: 'CD-1', Title: 'Canal de descarga vertedero',
    Descripcion: 'Canal de sección trapecial revestido.', Materialidad: MAMPOSTERIA,
    Geometria: 'Trapecial\nB: 2 m\nH: 2 m\nZ: 0,5' },
  { Codigo: 'CC-1', Title: 'Canal de contorno',
    Descripcion: 'Canal de sección trapecial revestido.',
    Materialidad: 'Canal excavado en terreno con revestimiento de manta de hormigón anclada al terreno.',
    Geometria: 'Trapecial\nB: 2 m\nH: 2 m\nZ: 0,5\nL: 1.780 m\ni: -15,31 %' },
  { Codigo: 'CS-1', Title: 'Canal secundario 1',
    Descripcion: 'Canal de sección trapecial revestido.', Materialidad: MAMPOSTERIA,
    Geometria: 'Trapecial\nB: 1 m\nH: 1 m\nZ: 0,5\nL: 194,93 m\ni: -9,7 %' },
  { Codigo: 'CS-2', Title: 'Canal secundario 2',
    Descripcion: 'Canal de sección trapecial revestido.', Materialidad: MAMPOSTERIA,
    Geometria: 'Trapecial\nB: 1 m\nH: 1 m\nZ: 0,5\nL: 99,64 m\ni: -11,71 %' },
  { Codigo: 'RD-1', Title: 'Rápido de descarga',
    Descripcion: 'Canal en pendiente fuerte de sección rectangular revestido.',
    Materialidad: 'Canal materializado en hormigón armado, con espesor de muros de 0,5 m y fundación en terreno natural compactado.',
    Geometria: 'Rectangular\nB: 2,5 m\nH: 2 m' },
  { Codigo: 'DE', Title: 'Disipador de energía',
    Descripcion: 'Tanque disipador de energía tipo cuenco.',
    Materialidad: 'Cuenco excavado en terreno, revestido con empedrado, bolones y hormigón.',
    Geometria: 'Cuenco rectangular\nLi: 8 m · Ai: 6 m\nLe: 24 m · Ae: 18 m\nh: 2 m\nH/V: 3/1' },
  // Sin descripción en la planilla de origen.
  { Codigo: 'CE', Title: 'Canal de encauzamiento' },
].map((o) => ({ ...o, Uid: 'of-' + o.Codigo.toLowerCase(), Ubicacion: UBICACION, Estado: 'Planificada', Peso: 0, Fase: FASE_OBRA[o.Codigo] }));

// Pesos (en obras tempranas) y etapas de 07.SEGUIMIENTO\Control_Avance_Diario_Protocolos_LJ_Obras_Fluviales_RevB.xlsx
// (hojas Configuracion y Registro_Diario). Pesos en %; AvanceBase = avance acumulado
// al último registro de esa planilla (FECHA_BASE); desde ahí suman los protocolos diarios. "Canales Secundarios" (10 %) se reparte entre CS-1 y CS-2.
export const FECHA_BASE = '2026-09-09';

const SECUNDARIOS = [['Excavación', 20], ['Perfilado y compactación', 15], ['Revestimiento HDPE', 25],
  ['Enrocado con mortero', 30], ['Terminaciones / control', 10]];
const PLAN = {
  CE: { Peso: 55, Estado: 'Terminada', etapas: [['Corte y relleno', 40, 100], ['Perfilado y compactación superior', 10, 100],
    ['Excavación canal', 25, 100], ['Perfilado final', 15, 100], ['Compactación final', 10, 100]] },
  'RD-1': { Peso: 15, Estado: 'En ejecución', etapas: [['Excavación', 35, 90], ['Compactación de fondo', 15], ['Hormigonado', 40], ['Curado', 10]] },
  DE: { Peso: 20, Estado: 'En ejecución', etapas: [['Excavación de fondo', 20, 35], ['Excavación de cuenco', 20], ['Enrocado', 25],
    ['Hormigonado', 25], ['Curado', 10]] },
  'CS-1': { Peso: 5, etapas: SECUNDARIOS },
  'CS-2': { Peso: 5, etapas: SECUNDARIOS },
};

// Pesos en obras definitivas (%), preliminares: costo directo estimado en
// 01_DOCUMENTOS\Pesos_Obras_Definitivas_Rev0.xlsx (no hay presupuesto oficial).
export const PESO_DEF = { 'CR-1': 32, 'CC-1': 29, 'CR-2': 14, 'CR-3': 9, 'RD-1': 9, 'CD-1': 3, VE: 2, DE: 2 };
// Etapas definitivas conocidas: CC-1 ya construido.
const PLAN_DEF = { 'CC-1': { Estado: 'Terminada', etapas: [['Canal de contorno construido', 100, 100]] } };

export const ETAPAS_PROYECTO = [];
for (const o of OBRAS_PROYECTO) {
  const plan = PLAN[o.Codigo];
  if (!plan) continue;
  o.Peso = plan.Peso;
  if (plan.Estado) o.Estado = plan.Estado;
  plan.etapas.forEach(([Title, Peso, AvanceBase = 0], i) => ETAPAS_PROYECTO.push({
    Uid: `${o.Uid}-e${i + 1}`, ObraUid: o.Uid, Item: String(i + 1), Title, Peso, AvanceBase, Fase: 'Temprana',
    Estado: AvanceBase >= 100 ? 'Terminada' : AvanceBase > 0 ? 'En ejecución' : 'Pendiente',
  }));
}
for (const o of OBRAS_PROYECTO) {
  if (PESO_DEF[o.Codigo]) o.PesoDef = PESO_DEF[o.Codigo];
  const plan = PLAN_DEF[o.Codigo];
  if (!plan) continue;
  if (plan.Estado) o.Estado = plan.Estado;
  plan.etapas.forEach(([Title, Peso, AvanceBase = 0], i) => ETAPAS_PROYECTO.push({
    Uid: `${o.Uid}-d${i + 1}`, ObraUid: o.Uid, Item: `D${i + 1}`, Title, Peso, AvanceBase, Fase: 'Definitiva',
    Estado: AvanceBase >= 100 ? 'Terminada' : AvanceBase > 0 ? 'En ejecución' : 'Pendiente',
  }));
}
