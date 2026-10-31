// Configuración de la app (ver README.md para obtener cada valor).
// - Todos entran con su cuenta Google. Lo que se firma queda en el Google Drive del
//   administrador, a través del script del buzón (buzon/Code.gs) publicado desde su cuenta.
// - El administrador visa y, con un botón, sube lo visado al SharePoint de proyectos
//   (necesita además su cuenta Microsoft de Kozan). Con cuenta Kozan se puede entrar
//   solo a consultar lo que ya está en SharePoint.
// Con GOOGLE_CLIENT_ID y CLIENT_ID vacíos la app corre en "modo demo": todo queda
// en este equipo, sin contraseñas.
export const CONFIG = {
  // Google (obligatorio)
  GOOGLE_CLIENT_ID: '',     // Id. de cliente OAuth (aplicación web) en Google Cloud
  BUZON_URL: '',            // URL …/exec de la aplicación web de Apps Script (buzon/Code.gs)
  // SharePoint de proyectos (para subir lo visado)
  CLIENT_ID: '',            // Id. de aplicación (cliente) del registro en Entra ID
  TENANT_ID: '',            // Id. de directorio (inquilino) de Atacama Kozan
  SITE_HOST: '',            // p. ej. 'atacamakozan.sharepoint.com'
  SITE_PATH: '/sites/Proyectos', // sitio de SharePoint de proyectos
  BIBLIOTECA: '',           // biblioteca de documentos; vacío = la principal (Documentos)
  CARPETA: 'OBRAS FLUVIALES/07_PROTOCOLOS/03_REGISTROS_APP', // carpeta de las Obras Fluviales dentro de la biblioteca
  LIST_PREFIX: 'DRF_',      // prefijo de las listas (base del panel y de Power BI)
  VERSION: '0.5.0',
};

export const PROYECTO = {
  nombre: 'Obras Fluviales DRF',
  codigo: 'DRF-OF-2509-06',
  sigla: 'OF',              // va en los códigos de registro: PDA-OF-001
  empresa: 'S.C.M. Atacama Kozan',
};

export const HAY_KOZAN = !!CONFIG.CLIENT_ID;
export const HAY_GOOGLE = !!(CONFIG.GOOGLE_CLIENT_ID && CONFIG.BUZON_URL);
export const DEMO = !HAY_GOOGLE;
