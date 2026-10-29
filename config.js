// Configuración de la app. Hay dos formas de entrar:
// - Terreno (cuenta Google): llena protocolos y los envía al buzón en Google Drive.
// - Kozan (cuenta Microsoft): el administrador importa, revisa y sube lo aprobado a
//   SharePoint; los demás perfiles con cuenta Kozan solo consultan lo aprobado.
// Con CLIENT_ID y GOOGLE_CLIENT_ID vacíos la app corre en "modo demo": todo queda
// en este equipo, sin login. Ver README.md para obtener los valores.
export const CONFIG = {
  CLIENT_ID: '',            // Id. de aplicación (cliente) del registro en Entra ID
  TENANT_ID: '',            // Id. de directorio (inquilino) de Atacama Kozan
  SITE_HOST: '',            // p. ej. 'atacamakozan.sharepoint.com'
  SITE_PATH: '/sites/ObrasDRF', // sitio de SharePoint donde viven las listas
  LIST_PREFIX: 'DRF_',      // prefijo de las listas creadas por la app
  FILES_FOLDER: 'ObrasDRF', // carpeta de fotos, firmas y adjuntos en Documentos del sitio
  GOOGLE_CLIENT_ID: '',     // Id. de cliente OAuth (aplicación web) del proyecto en Google Cloud
  BUZON_CORREO: '',         // cuenta Google del proyecto que recibe los envíos de terreno
  VERSION: '0.4.1',
};

export const PROYECTO = {
  nombre: 'Obras Fluviales DRF',
  codigo: 'DRF-OF-2509-06',
  sigla: 'OF',              // va en los códigos de registro: PDA-OF-001
  empresa: 'S.C.M. Atacama Kozan',
};

export const HAY_KOZAN = !!CONFIG.CLIENT_ID;
export const HAY_GOOGLE = !!(CONFIG.GOOGLE_CLIENT_ID && CONFIG.BUZON_CORREO);
export const DEMO = !HAY_KOZAN && !HAY_GOOGLE;
