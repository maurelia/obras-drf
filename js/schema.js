// Estructura de las listas de SharePoint. Cada registro lleva un Uid generado
// en el teléfono, así se puede crear sin señal y relacionar antes de sincronizar.
// Los campos variables de cada formulario (reporte, protocolo) van en "Datos"
// como JSON hasta que se definan los formatos definitivos.

const text = (name, extra = {}) => ({ name, text: { maxLength: 255 }, ...extra });
const note = (name) => ({ name, text: { allowMultipleLines: true, linesForEditing: 6 } });
const num = (name) => ({ name, number: {} });
const date = (name) => ({ name, dateTime: { format: 'dateOnly' } });
const choice = (name, choices) => ({ name, choice: { choices, displayAs: 'dropDownMenu' } });

export const ESTADOS_OBRA = ['Planificada', 'En ejecución', 'Paralizada', 'Terminada'];
export const ESTADOS_PARTIDA = ['Pendiente', 'En ejecución', 'Protocolizada'];
export const ESTADOS_REPORTE = ['Borrador', 'Enviado', 'Aprobado'];
export const ESTADOS_PROTOCOLO = ['Borrador', 'Firmado', 'Anulado'];

// Familias de protocolo usadas hoy en Tercer Dren (07_PROTOCOLOS).
export const TIPOS_PROTOCOLO = {
  PEA: 'Entrega / solicitud de área',
  PCO: 'Protocolo PCO',
  PIN: 'Protocolo PIN',
  PTO: 'Protocolo PTO',
  PEO: 'Entrega de obra',
  PRT: 'Entrega de equipos',
};

export const LISTS = {
  obras: {
    title: 'Obras',
    columns: [
      text('Uid', { indexed: true }), text('Codigo'), text('Mandante'), text('Ubicacion'),
      choice('Estado', ESTADOS_OBRA), date('FechaInicio'), date('FechaTermino'),
      num('Lat'), num('Lon'), note('Notas'),
    ],
  },
  partidas: {
    title: 'Partidas',
    columns: [
      text('Uid', { indexed: true }), text('ObraUid', { indexed: true }), text('Item'), text('Unidad'),
      num('CantContrato'), num('CantEjecutada'), choice('Estado', ESTADOS_PARTIDA),
    ],
  },
  reportes: {
    title: 'Reportes',
    columns: [
      text('Uid', { indexed: true }), text('ObraUid', { indexed: true }), date('Fecha'), text('Autor'),
      choice('Estado', ESTADOS_REPORTE), note('Datos'),
    ],
  },
  protocolos: {
    title: 'Protocolos',
    columns: [
      text('Uid', { indexed: true }), text('ObraUid', { indexed: true }),
      choice('Tipo', Object.keys(TIPOS_PROTOCOLO)), num('Correlativo'), date('Fecha'),
      choice('Estado', ESTADOS_PROTOCOLO), note('Datos'), text('PdfUrl'),
    ],
  },
};

// Campos que se leen/escriben (Title + columnas propias).
export const fieldNames = (key) => ['Title', ...LISTS[key].columns.map((c) => c.name)];

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

// Código correlativo al estilo de la carpeta TOP: PEA-TD-14, RDT-TD-003.
export function nextCode(prefix, obraCodigo, existentes, pad = 2) {
  const n = existentes.reduce((m, r) => Math.max(m, Number(r.Correlativo) || 0), 0) + 1;
  return { code: `${prefix}-${obraCodigo || 'XX'}-${String(n).padStart(pad, '0')}`, n };
}
