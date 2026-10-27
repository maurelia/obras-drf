// Configuración de la app. Mientras CLIENT_ID esté vacío la app corre en
// "modo demo": todo se guarda solo en este equipo, sin login ni SharePoint.
// Los valores se obtienen al registrar la app en Azure (ver README.md).
export const CONFIG = {
  CLIENT_ID: '',            // Id. de aplicación (cliente) del registro en Entra ID
  TENANT_ID: '',            // Id. de directorio (inquilino) de Atacama Kozan
  SITE_HOST: '',            // p. ej. 'atacamakozan.sharepoint.com'
  SITE_PATH: '/sites/ObrasDRF', // sitio de SharePoint donde viven las listas
  LIST_PREFIX: 'DRF_',      // prefijo de las listas creadas por la app
  VERSION: '0.2.0',
};

export const DEMO = !CONFIG.CLIENT_ID;
