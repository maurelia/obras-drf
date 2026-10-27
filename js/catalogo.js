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
].map((o) => ({ ...o, Uid: 'of-' + o.Codigo.toLowerCase(), Ubicacion: UBICACION, Estado: 'Planificada' }));
