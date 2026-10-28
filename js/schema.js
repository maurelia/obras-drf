// Estructura de las listas de SharePoint. Cada registro lleva un Uid generado
// en el teléfono, así se puede crear sin señal y relacionar antes de sincronizar.
// El contenido de cada formulario (protocolo, registro) va en "Datos" como JSON;
// fotos, firmas y adjuntos van como archivos a la biblioteca Documentos del sitio.
import { PROYECTO } from '../config.js';

const text = (name, extra = {}) => ({ name, text: { maxLength: 255 }, ...extra });
const note = (name) => ({ name, text: { allowMultipleLines: true, linesForEditing: 6 } });
const num = (name) => ({ name, number: {} });
const date = (name) => ({ name, dateTime: { format: 'dateOnly' } });
const bool = (name) => ({ name, boolean: {} });
const choice = (name, choices) => ({ name, choice: { choices, displayAs: 'dropDownMenu' } });

export const ROLES = ['Administrador', 'Supervisor de terraza', 'Topógrafo', 'Operador'];
export const ESTADOS_OBRA = ['Planificada', 'En ejecución', 'Paralizada', 'Terminada'];
export const ESTADOS_PARTIDA = ['Pendiente', 'En ejecución', 'Terminada'];
// Borrador: solo lo ve su autor. Enviado: firmado, espera revisión. Observado: vuelve al autor.
export const ESTADOS_REG = ['Borrador', 'Enviado', 'Observado', 'Aprobado'];
export const TIPOS_REG = ['PDA', 'PCT', 'RCM', 'PTT', 'TRT', 'PRV', 'PHU', 'PND'];

export const LISTS = {
  obras: {
    title: 'Obras',
    columns: [
      text('Uid', { indexed: true }), text('Codigo'), text('Mandante'), text('Ubicacion'),
      choice('Estado', ESTADOS_OBRA), date('FechaInicio'), date('FechaTermino'), num('Peso'),
      num('Lat'), num('Lon'), note('Notas'),
      note('Descripcion'), note('Materialidad'), note('Geometria'),
    ],
  },
  // Etapas de cada obra. Peso y AvanceBase en %; el avance suma lo informado en los protocolos diarios.
  partidas: {
    title: 'Partidas',
    columns: [
      text('Uid', { indexed: true }), text('ObraUid', { indexed: true }), text('Item'), num('Peso'),
      num('AvanceBase'), text('Unidad'), num('CantContrato'), choice('Estado', ESTADOS_PARTIDA),
    ],
  },
  registros: {
    title: 'Registros',
    columns: [
      text('Uid', { indexed: true }), text('ObraUid', { indexed: true }), choice('Tipo', TIPOS_REG),
      num('Correlativo'), text('Codigo'), date('Fecha'), text('Autor'), text('AutorCorreo', { indexed: true }),
      choice('Estado', ESTADOS_REG), note('Datos'), text('Revisor'), note('Comentario'),
    ],
  },
  usuarios: {
    title: 'Usuarios',
    columns: [text('Uid', { indexed: true }), text('Correo', { indexed: true }), choice('Rol', ROLES), bool('Activo')],
  },
};

// Campos que se leen/escriben (Title + columnas propias).
export const fieldNames = (key) => ['Title', ...LISTS[key].columns.map((c) => c.name)];

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

// Código correlativo por tipo: PDA-OF-001. Se asigna al enviar; dos personas
// enviando sin señal podrían tomar el mismo número (se ve en la lista).
export function nextCode(tipo, registros) {
  const n = registros.filter((r) => r.Tipo === tipo).reduce((m, r) => Math.max(m, Number(r.Correlativo) || 0), 0) + 1;
  return { Codigo: `${tipo}-${PROYECTO.sigla}-${String(n).padStart(3, '0')}`, Correlativo: n };
}
