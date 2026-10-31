// Cuenta Microsoft 365 de Atacama Kozan (MSAL). La usa el administrador para
// subir lo visado a SharePoint (ventana emergente, para no perder lo que está
// haciendo) y quien entra solo a consultar (flujo redirect, mejor en el teléfono).
import { CONFIG, HAY_KOZAN } from '../config.js';

export const SCOPES = ['User.Read', 'Sites.ReadWrite.All'];
export const ADMIN_SCOPES = ['Sites.Manage.All']; // solo para crear las listas

let pca = null;

export async function initAuth() {
  if (!HAY_KOZAN) return null;
  pca = new msal.PublicClientApplication({
    auth: {
      clientId: CONFIG.CLIENT_ID,
      authority: `https://login.microsoftonline.com/${CONFIG.TENANT_ID}`,
      redirectUri: location.origin + location.pathname,
    },
    cache: { cacheLocation: 'localStorage' },
  });
  await pca.initialize();
  const res = await pca.handleRedirectPromise();
  if (res?.account) pca.setActiveAccount(res.account);
  else if (!pca.getActiveAccount() && pca.getAllAccounts().length) pca.setActiveAccount(pca.getAllAccounts()[0]);
  return account();
}

export const account = () => pca?.getActiveAccount() || null;

export const login = () => pca.loginRedirect({ scopes: SCOPES });
export const logout = () => pca.logoutRedirect({ account: account() });

// Conecta la cuenta Microsoft sin salir de la app (administrador).
export async function conectar() {
  if (!pca) throw new Error('SharePoint no está configurado (falta CLIENT_ID en config.js)');
  if (account()) return account();
  const r = await pca.loginPopup({ scopes: SCOPES, prompt: 'select_account' });
  pca.setActiveAccount(r.account);
  return r.account;
}

export async function desconectar() {
  const acc = account();
  if (acc) await pca.clearCache({ account: acc });
}

export async function token(scopes = SCOPES) {
  const acc = account() || await conectar();
  try {
    return (await pca.acquireTokenSilent({ scopes, account: acc })).accessToken;
  } catch (e) {
    if (e instanceof msal.InteractionRequiredAuthError) {
      return (await pca.acquireTokenPopup({ scopes, account: acc })).accessToken;
    }
    throw e;
  }
}
