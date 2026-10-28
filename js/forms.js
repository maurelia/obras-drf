// Definición de los formularios, transcritos de E:\03.PROYECTO\08.PROTOCOLOS-PROCEDIMIENTOS
// y 07.SEGUIMIENTO\03.CONTROLES. El motor (engine.js) arma con esto la pantalla
// de llenado y el documento imprimible/PDF.
//
// Tipos de campo: text, date, time, number, textarea, select, radio (una opción),
// checks (varias), obra, etapa, registro (referencia a otro registro), info (texto fijo),
// table (filas; cols con los mismos tipos; rows = filas fijas), points (control de cotas),
// checklist, photos, files, signature, firmas (varias firmas por etapa).

const A = 'Administrador', T = 'Topógrafo', O = 'Operador';
const SI_NO = ['Sí', 'No'];

// Tolerancias de 07.SEGUIMIENTO\03.CONTROLES\CONTROL_AVANCE_OBRAS_FLUVIALES_AK.xlsx (1_CONFIG).
export const TOL = { conforme: 0.15, observacion: 0.30 };

// Diferencia = cota medida - cota diseño. Positivo: falta excavar; negativo: rellenar.
export function evalCota(diseno, medida) {
  if (medida === '' || medida == null || isNaN(medida)) return null;
  const d = Math.round((Number(medida) - diseno) * 1000) / 1000;
  const a = Math.abs(d);
  const res = a <= TOL.conforme ? 'OK' : d > 0 ? 'Excavar' : 'Rellenar';
  return { d, res, nivel: a <= TOL.conforme ? 'ok' : a <= TOL.observacion ? 'warn' : 'bad' };
}

// Ensayo PANDA: qd ≥ 1,6 MPa conforme; 1,3–1,6 condicionado; < 1,3 no conforme.
export function evalPanda(qd) {
  if (qd === '' || qd == null || isNaN(qd)) return null;
  const q = Number(qd);
  return q >= 1.6 ? { res: 'Conforme', nivel: 'ok' } : q >= 1.3 ? { res: 'Condicionado', nivel: 'warn' } : { res: 'No conforme', nivel: 'bad' };
}

// Puntos del protocolo 08.Protocolo_Rapido_Disipador_DRF_RevA (cotas de diseño en m).
const RAPIDO_AB = [533, 532.75, 532.5, 532.25, 532, 530.64, 529.27, 527.91, 526.55, 525.185, 524.05, 523.12,
  522.18, 521.25, 520.315, 519.381, 518.78, 518.3, 517.83];
export const PUNTOS = {
  rapido: RAPIDO_AB.flatMap((ab, i) => ['A', 'B', 'C'].map((l) => ({
    p: `DM-${i * 5}-${l}`, z: l === 'C' ? Math.round((ab - 2.5) * 1000) / 1000 : ab,
  }))),
  disipador: [
    ...Array.from({ length: 15 }, (_, i) => ({ p: `HD-${String(i + 1).padStart(2, '0')}`, z: 514.51 })),
    ...Array.from({ length: 4 }, (_, i) => ({ p: `FD-${String(i + 1).padStart(2, '0')}`, z: 512.06 })),
  ],
};

const CRITERIO_COTA = `Diferencia = cota medida − cota diseño. Positivo: falta excavar. Negativo: sobreexcavación, rellenar. `
  + `Conforme si |diferencia| ≤ ${TOL.conforme.toFixed(2).replace('.', ',')} m; entre ${TOL.conforme.toFixed(2).replace('.', ',')} y `
  + `${TOL.observacion.toFixed(2).replace('.', ',')} m queda en observación.`;

const AREAS = ['Operaciones DRF', 'Topografía', 'Dirección de Proyectos', 'Contratista', 'Otra'];
const EQUIPOS_TOPO = ['GNSS RTK', 'Estación Total', 'Nivel', 'Otro'];

export const FORMS = {
  PDA: {
    titulo: 'Protocolo diario de avance de obras', corto: 'Protocolo diario de avance', rev: 'Rev. C',
    roles: [A, T, O], icon: 'rep',
    secciones: [
      { t: 'A. Información general', campos: [
        { k: 'fecha', l: 'Fecha', type: 'date', req: true, def: 'hoy' },
        { k: 'obra', l: 'Obra', type: 'obra', req: true },
        { k: 'sector', l: 'Sector / ubicación' },
        { k: 'area', l: 'Área responsable', type: 'radio', options: AREAS },
        { k: 'responsable', l: 'Responsable a cargo', def: 'usuario' },
        { k: 'equipos', l: 'Equipo(s), si corresponde' },
        { k: 'condicion', l: 'Condición / referencia relevante' },
      ] },
      { t: 'B. Registro de avance del día', nota: 'Una fila por etapa trabajada. El avance (% de la etapa ejecutado hoy) se suma al avance del proyecto al enviar.',
        campos: [{ k: 'avances', type: 'table', minRows: 1, cols: [
          { k: 'etapa', l: 'Obra / etapa', type: 'etapa', req: true },
          { k: 'ubicacion', l: 'Ubicación / PK' },
          { k: 'actividad', l: 'Actividad ejecutada', req: true },
          { k: 'area', l: 'Área', type: 'select', options: ['OP', 'TOP', 'PRY', 'Otro'] },
          { k: 'avance', l: 'Avance del día (%)', type: 'number', req: true },
          { k: 'estado', l: 'Estado', type: 'select', options: ['Conforme', 'Pendiente'] },
          { k: 'obs', l: 'Observaciones' },
        ] }] },
      { t: 'C. Croquis / plano / referencia del avance', campos: [
        { k: 'croquis', l: 'Sector intervenido, límites del avance, PK y referencias', type: 'textarea' },
        { k: 'fotos', l: 'Fotos', type: 'photos' },
      ] },
      { t: 'D. Observaciones generales', campos: [{ k: 'observaciones', l: 'Observaciones', type: 'textarea' }] },
      { t: 'E. Responsable de la intervención', campos: [
        { k: 'firmaArea', l: 'Área', type: 'radio', options: ['Operaciones DRF', 'Topografía', 'Proyectos', 'Contratista', 'Otra'] },
        { k: 'firmaNombre', l: 'Nombre', def: 'usuario', req: true },
        { k: 'firmaCargo', l: 'Cargo' },
        { k: 'firma', l: 'Firma', type: 'signature', req: true },
      ] },
    ],
  },

  PCT: {
    titulo: 'Protocolo de control topográfico – Rápido de descarga y disipador de energía', corto: 'Control topográfico rápido y disipador',
    rev: 'Rev. A', roles: [A, T], icon: 'target', obraFija: 'of-rd-1',
    secciones: [
      { t: 'A. Información general', campos: [
        { k: 'fecha', l: 'Fecha', type: 'date', req: true, def: 'hoy' },
        { k: 'responsable', l: 'Responsable topografía', def: 'usuario', req: true },
        { k: 'supervisor', l: 'Supervisor' },
        { k: 'equipos', l: 'Equipos utilizados', type: 'checks', options: EQUIPOS_TOPO },
      ] },
      { t: 'B. Registro de control – Rápido de descarga', nota: CRITERIO_COTA + ' Los puntos A y B son hombros y C es fondo.',
        campos: [{ k: 'rapido', type: 'points', set: 'rapido' }] },
      { t: 'C. Registro de control – Disipador de energía', nota: CRITERIO_COTA + ' HD = hombro de talud; FD = fondo del disipador.',
        campos: [{ k: 'disipador', type: 'points', set: 'disipador' }] },
      { t: 'Registro fotográfico', campos: [{ k: 'fotos', l: 'Fotos', type: 'photos' }] },
      { t: 'D. Cierre y responsables', campos: [{ k: 'firmas', type: 'firmas', req: [0], etapas: [
        'Topografía – Control inicial', 'Supervisor – Recepción', 'Operador – Instrucción recibida', 'Topografía – Recontrol / cierre',
      ] }] },
    ],
  },

  RCM: {
    titulo: 'Registro control de maquinarias', corto: 'Registro de maquinarias', rev: '', roles: [A, O], icon: 'truck',
    secciones: [
      { t: 'Datos del turno', campos: [
        { k: 'fecha', l: 'Fecha', type: 'date', req: true, def: 'hoy' },
        { k: 'turno', l: 'Turno', type: 'radio', options: ['Día', 'Noche'] },
        { k: 'operador', l: 'Nombre operador', def: 'usuario', req: true },
        { k: 'equipo', l: 'Equipo', type: 'select', req: true,
          options: ['Excavadora', 'Bulldozer', 'Motoniveladora', 'Rodillo', 'Aljibe', 'Cargador frontal', 'Otro'] },
        { k: 'equipoId', l: 'Identificación (modelo / patente)' },
        { k: 'obra', l: 'Obra', type: 'obra' },
      ] },
      { t: 'Registro de control', campos: [{ k: 'registro', type: 'table', minRows: 1, cols: [
        { k: 'inicio', l: 'Hora de inicio', type: 'time', req: true },
        { k: 'termino', l: 'Hora de término', type: 'time' },
        { k: 'horoIni', l: 'Horómetro inicial', type: 'number', req: true },
        { k: 'horoFin', l: 'Horómetro final', type: 'number' },
        { k: 'combustible', l: 'Carga combustible (L)', type: 'number' },
        { k: 'sector', l: 'Sector de trabajo' },
        { k: 'actividad', l: 'Actividad' },
        { k: 'obs', l: 'Observaciones' },
      ] }] },
      { t: 'Cierre', campos: [
        { k: 'comentarios', l: 'Comentarios adicionales', type: 'textarea' },
        { k: 'firma', l: 'Firma operador', type: 'signature', req: true },
        { k: 'supervisor', l: 'Nombre supervisor' },
        { k: 'firmaSup', l: 'Firma supervisor', type: 'signature' },
      ] },
    ],
  },

  PTT: {
    titulo: 'Protocolo de trabajos topográficos', corto: 'Trabajos topográficos', rev: 'Rev. C', roles: [A, T], icon: 'target',
    secciones: [
      { t: 'A. Información general', campos: [
        { k: 'fecha', l: 'Fecha', type: 'date', req: true, def: 'hoy' },
        { k: 'inicio', l: 'Hora inicio', type: 'time' },
        { k: 'termino', l: 'Hora término', type: 'time' },
        { k: 'obra', l: 'Obra', type: 'obra' },
        { k: 'sector', l: 'Sector / ubicación' },
        { k: 'responsable', l: 'Responsable topografía', def: 'usuario', req: true },
        { k: 'equipos', l: 'Equipos utilizados', type: 'checks', options: ['GNSS RTK', 'Estación Total', 'Dron', 'Nivel', 'Otro'] },
      ] },
      { t: 'B. Trabajos planificados y ejecutados', campos: [{ k: 'trabajos', type: 'table', minRows: 1, cols: [
        { k: 'planificado', l: 'Trabajo planificado', req: true },
        { k: 'sector', l: 'Sector / referencia' },
        { k: 'ejecutado', l: 'Trabajo realmente ejecutado' },
        { k: 'estado', l: 'Estado', type: 'select', options: ['Ejecutado', 'Parcial', 'No ejecutado'] },
        { k: 'obs', l: 'Observación' },
      ] }] },
      { t: 'C. Instalación y control de base GNSS', campos: [{ k: 'bases', type: 'table', minRows: 0, cols: [
        { k: 'punto', l: 'Punto base' },
        { k: 'x', l: 'Este X (m)', type: 'number' }, { k: 'y', l: 'Norte Y (m)', type: 'number' }, { k: 'z', l: 'Cota Z (m)', type: 'number' },
        { k: 'antena', l: 'Altura antena (m)', type: 'number' },
        { k: 'datum', l: 'Sistema / datum' },
        { k: 'hInst', l: 'Hora instalación', type: 'time' }, { k: 'hRet', l: 'Hora retiro', type: 'time' },
        { k: 'medicion', l: 'Medición altura', type: 'select', options: ['Vertical', 'Inclinada'] },
        { k: 'condicion', l: 'Condición base', type: 'select', options: ['Punto conocido', 'Temporal'] },
        { k: 'estado', l: 'Estado', type: 'select', options: ['Conforme', 'Revisar'] },
        { k: 'obs', l: 'Observación' },
      ] }] },
      { t: 'D. Vuelo topográfico', nota: 'Completar solo si fue planificado.', campos: [
        { k: 'vueloPlan', l: '¿Planificado?', type: 'radio', options: SI_NO },
        { k: 'vueloEjec', l: '¿Ejecutado?', type: 'radio', options: ['Sí', 'Parcial', 'No'] },
        { k: 'vueloSector', l: 'Sector / área' },
        { k: 'vueloSup', l: 'Superficie aprox. (ha)', type: 'number' },
        { k: 'vueloAltura', l: 'Altura de vuelo (m)', type: 'number' },
        { k: 'vueloN', l: 'N° de vuelos', type: 'number' },
      ] },
      { t: 'E. Croquis', nota: 'Solo en caso de vuelo planificado: ubicación general, base GNSS y área levantada.', campos: [
        { k: 'croquis', l: 'Descripción', type: 'textarea' },
        { k: 'fotos', l: 'Croquis / fotos', type: 'photos' },
      ] },
      { t: 'F. Observaciones generales', campos: [{ k: 'observaciones', l: 'Observaciones', type: 'textarea' }] },
      { t: 'G. Responsable del trabajo topográfico', campos: [
        { k: 'firmaNombre', l: 'Nombre', def: 'usuario', req: true },
        { k: 'firmaCargo', l: 'Cargo' },
        { k: 'firma', l: 'Firma', type: 'signature', req: true },
      ] },
    ],
  },

  TRT: {
    titulo: 'Transmittal de entrega de información topográfica', corto: 'Transmittal topográfico', rev: 'Rev. A', roles: [A, T], icon: 'send',
    secciones: [
      { t: 'A. Identificación y trazabilidad', nota: 'El N° de transmittal se asigna al enviar.', campos: [
        { k: 'fecha', l: 'Fecha de entrega', type: 'date', req: true, def: 'hoy' },
        { k: 'obra', l: 'Proyecto / obra', type: 'obra' },
        { k: 'sector', l: 'Sector / ubicación' },
        { k: 'protocolo', l: 'Protocolo de trabajos asociado', type: 'registro', tipo: 'PTT' },
        { k: 'emisor', l: 'Emisor / topografía', def: 'usuario', req: true },
        { k: 'receptor', l: 'Receptor', req: true },
        { k: 'tipoEntrega', l: 'Tipo de entrega', type: 'radio', options: ['Preliminar', 'Para revisión', 'Final', 'Reentrega'] },
        { k: 'revision', l: 'Revisión', def: '0' },
        { k: 'motivo', l: 'Motivo / referencia' },
      ] },
      { t: 'B. Documentos / archivos entregados', campos: [
        { k: 'archivos', type: 'table', minRows: 1, cols: [
          { k: 'archivo', l: 'Archivo / documento', req: true },
          { k: 'formato', l: 'Formato' },
          { k: 'descripcion', l: 'Descripción / contenido' },
          { k: 'revision', l: 'Revisión' },
          { k: 'obs', l: 'Observación' },
        ] },
        { k: 'adjuntos', l: 'Adjuntar archivos', type: 'files',
          nota: 'Se suben a SharePoint junto con el transmittal. Para nubes de puntos u ortomosaicos muy pesados, indica la ruta en la sección E.' },
      ] },
      { t: 'C. Tipo de información topográfica entregada', campos: [
        { k: 'infoBase', l: 'Información base', type: 'checks', options: ['Coordenadas / puntos', 'Replanteo', 'Nivelación', 'Perfiles', 'Secciones', 'Otro'] },
        { k: 'productos', l: 'Productos de levantamiento', type: 'checks', options: ['DXF/DWG', 'CSV/TXT', 'SHP/GPKG', 'Nube de puntos', 'DEM/DSM', 'Curvas de nivel'] },
        { k: 'vuelo', l: 'Productos de vuelo', type: 'checks', options: ['Ortofoto', 'Nube fotogramétrica', 'Modelo 3D', 'GCP / control', 'No aplica'] },
      ] },
      { t: 'D. Sistema de referencia y control', campos: [
        { k: 'crs', l: 'Sistema de coordenadas / CRS' },
        { k: 'datum', l: 'Datum' },
        { k: 'unidadH', l: 'Unidad horizontal', def: 'm' },
        { k: 'unidadV', l: 'Unidad vertical', def: 'm' },
        { k: 'refAlt', l: 'Referencia altimétrica' },
        { k: 'puntoBase', l: 'Punto base / control' },
        { k: 'obsTecnica', l: 'Observación técnica', type: 'textarea' },
      ] },
      { t: 'E. Medio de entrega', campos: [
        { k: 'medio', l: 'Medio', type: 'radio', options: ['Esta app', 'Correo electrónico', 'Carpeta compartida', 'Servidor', 'Disco / USB', 'Otro'] },
        { k: 'ruta', l: 'Ruta / enlace / ubicación' },
        { k: 'paquete', l: 'Nombre de carpeta o paquete' },
      ] },
      { t: 'F. Observaciones de la entrega', campos: [{ k: 'observaciones', l: 'Observaciones', type: 'textarea' }] },
      { t: 'G. Entrega', nota: 'La recepción y revisión se registran en el Protocolo de revisión de información topográfica.', campos: [
        { k: 'cargo', l: 'Cargo / área' },
        { k: 'firma', l: 'Firma de quien entrega', type: 'signature', req: true },
      ] },
    ],
  },

  PRV: {
    titulo: 'Protocolo de revisión de información topográfica', corto: 'Revisión de información topográfica', rev: 'Rev. B',
    roles: [A], icon: 'check',
    secciones: [
      { t: 'A. Identificación y trazabilidad', nota: 'El N° de protocolo se asigna al enviar. Al enviarlo, el transmittal queda aprobado u observado según el resultado.', campos: [
        { k: 'fecha', l: 'Fecha revisión', type: 'date', req: true, def: 'hoy' },
        { k: 'transmittal', l: 'Transmittal asociado', type: 'registro', tipo: 'TRT', req: true },
        { k: 'revEntrega', l: 'Revisión de entrega' },
        { k: 'revisor', l: 'Revisor / área', def: 'usuario', req: true },
        { k: 'topografo', l: 'Responsable topografía' },
        { k: 'tipoRevision', l: 'Tipo de revisión', type: 'radio', options: ['Inicial', 'Revisión de correcciones', 'Cierre'] },
      ] },
      { t: 'B. Información revisada', campos: [{ k: 'revisados', type: 'table', minRows: 1, cols: [
        { k: 'archivo', l: 'Archivo / producto revisado', req: true },
        { k: 'revision', l: 'Revisión' },
        { k: 'contenido', l: 'Contenido / sector' },
        { k: 'obs', l: 'Observación general' },
      ] }] },
      { t: 'C. Control de revisión', campos: [{ k: 'control', type: 'checklist', options: ['Conforme', 'Observado'], items: [
        'Correspondencia con protocolo diario y trabajo ejecutado',
        'Sistema de coordenadas / datum / referencia altimétrica',
        'Coordenadas, cotas y puntos de control',
        'Cobertura / extensión del levantamiento',
        'Consistencia de archivos y productos entregados',
        'Nomenclatura, identificación y revisión de archivos',
      ] }] },
      { t: 'D. Observaciones y correcciones requeridas', campos: [{ k: 'observaciones', type: 'table', minRows: 0, cols: [
        { k: 'archivo', l: 'Archivo / punto' },
        { k: 'observacion', l: 'Observación detectada' },
        { k: 'correccion', l: 'Corrección requerida' },
        { k: 'responsable', l: 'Responsable' },
        { k: 'estado', l: 'Estado', type: 'select', options: ['Abierta', 'Cerrada'] },
      ] }] },
      { t: 'E. Resultado de la revisión', campos: [
        { k: 'resultado', l: 'Resultado', type: 'radio', req: true, options: ['Conforme', 'Conforme con observaciones', 'Requiere corrección'] },
        { k: 'nuevaEntrega', l: '¿Requiere nueva entrega?', type: 'radio', options: ['No', 'Sí'] },
        { k: 'comentario', l: 'Comentario de cierre', type: 'textarea' },
      ] },
      { t: 'F. Responsables', campos: [
        { k: 'cargo', l: 'Cargo / área' },
        { k: 'firma', l: 'Firma revisor', type: 'signature', req: true },
      ] },
    ],
  },

  PHU: {
    titulo: 'Protocolo de humectación – Planilla de chequeo', corto: 'Humectación planta', rev: '', roles: [A, O], icon: 'drop',
    secciones: [
      { t: 'Datos generales', campos: [
        { k: 'fecha', l: 'Fecha', type: 'date', req: true, def: 'hoy' },
        { k: 'sector', l: 'Sector', def: 'Planta de Selección de Áridos' },
        { k: 'supervisor', l: 'Supervisor', def: 'usuario', req: true },
      ] },
      { t: 'Chequeo por horario', campos: [{ k: 'chequeo', type: 'table',
        rows: ['Inicio jornada', '09:00', '12:00', '16:00', 'Término jornada'], cols: [
          { k: 'hora', l: 'Hora' },
          { k: 'stockpile', l: 'Stockpile humectado', type: 'select', options: SI_NO },
          { k: 'caminos', l: 'Caminos humectados', type: 'select', options: SI_NO },
          { k: 'polvo', l: 'Polvo visible', type: 'select', options: SI_NO },
          { k: 'accion', l: 'Acción correctiva' },
        ] }] },
      { t: 'Condiciones de operación', campos: [
        { k: 'aljibe', l: 'Camión aljibe operativo', type: 'radio', options: SI_NO },
        { k: 'escurrimientos', l: 'Sin escurrimientos por exceso de agua', type: 'radio', options: SI_NO },
        { k: 'barro', l: 'Sin barro que afecte la operación', type: 'radio', options: SI_NO },
        { k: 'polvoFuera', l: 'Sin polvo visible fuera del área de trabajo', type: 'radio', options: SI_NO },
        { k: 'reforzar', l: 'Reforzar humectación si', type: 'checks',
          options: ['Viento fuerte', 'Más finos', 'Más tránsito de equipos', 'Polvo visible en carguío', 'Quejas / advertencias por polvo'] },
        { k: 'fotos', l: 'Fotos', type: 'photos' },
      ] },
      { t: 'Cierre', campos: [
        { k: 'firmaNombre', l: 'Supervisor de turno', def: 'usuario', req: true },
        { k: 'firma', l: 'Firma', type: 'signature', req: true },
      ] },
    ],
  },

  PND: {
    titulo: 'Control de compactación – Ensayo PANDA', corto: 'Compactación PANDA', rev: '', roles: [A, T], icon: 'gauge',
    secciones: [
      { t: 'Datos generales', campos: [
        { k: 'fecha', l: 'Fecha', type: 'date', req: true, def: 'hoy' },
        { k: 'obra', l: 'Obra', type: 'obra', req: true },
        { k: 'responsable', l: 'Responsable', def: 'usuario', req: true },
      ] },
      { t: 'Ensayos', nota: 'qd ≥ 1,6 MPa = conforme · 1,3 ≤ qd < 1,6 = condicionado · qd < 1,3 = no conforme. Punto: A = lado izq., B = lado der., C = centro (3 puntos por PK).',
        campos: [{ k: 'ensayos', type: 'table', minRows: 1, cols: [
          { k: 'pk', l: 'PK (m)', type: 'number', req: true },
          { k: 'punto', l: 'Punto', type: 'select', options: ['A', 'B', 'C'] },
          { k: 'sector', l: 'Sector' },
          { k: 'prof', l: 'Prof. (m)', type: 'number' },
          { k: 'qd', l: 'qd (MPa)', type: 'number', req: true },
          { k: 'humedad', l: 'Humedad (%)', type: 'number' },
          { k: 'obs', l: 'Observaciones' },
        ], calc: (r) => evalPanda(r.qd) }] },
      { t: 'Cierre', campos: [
        { k: 'observaciones', l: 'Observaciones', type: 'textarea' },
        { k: 'firma', l: 'Firma', type: 'signature', req: true },
      ] },
    ],
  },
};

export const puede = (rol, tipo) => !!rol && FORMS[tipo].roles.includes(rol);
