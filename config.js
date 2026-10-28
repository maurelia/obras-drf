// Configuración de la app. Mientras CLIENT_ID esté vacío la app corre en
// "modo demo": todo se guarda solo en este equipo, sin login ni SharePoint.
// Los valores se obtienen al registrar la app en Azure (ver README.md).
export const CONFIG = {
  CLIENT_ID: '',            // Id. de aplicación (cliente) del registro en Entra ID
  TENANT_ID: '',            // Id. de directorio (inquilino) de Atacama Kozan
  SITE_HOST: '',            // p. ej. 'atacamakozan.sharepoint.com'
  SITE_PATH: '/sites/ObrasDRF', // sitio de SharePoint donde viven las listas
  LIST_PREFIX: 'DRF_',      // prefijo de las listas creadas por la app
  FILES_FOLDER: 'ObrasDRF', // carpeta de fotos, firmas y adjuntos en Documentos del sitio
  VERSION: '0.3.0',
};

export const PROYECTO = {
  nombre: 'Obras Fluviales DRF',
  codigo: 'DRF-OF-2509-06',
  sigla: 'OF',              // va en los códigos de registro: PDA-OF-001
  empresa: 'S.C.M. Atacama Kozan',
};

export const DEMO = !CONFIG.CLIENT_ID;
