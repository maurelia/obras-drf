// Login con la cuenta Microsoft 365 de Atacama Kozan (MSAL, flujo redirect,
// que funciona mejor que los popups en la PWA instalada en el teléfono).
import { CONFIG, DEMO } from '../config.js';

export const SCOPES = ['User.Read', 'Sites.ReadWrite.All'];
export const ADMIN_SCOPES = ['Sites.Manage.All']; // solo para crear las listas

let pca = null;

export async function initAuth() {
  if (DEMO) return null;
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

export function account() {
  if (DEMO) return { name: 'Usuario demo', username: 'demo@local' };
  return pca?.getActiveAccount() || null;
}

export const login = () => pca.loginRedirect({ scopes: SCOPES });
export const logout = () => pca.logoutRedirect({ account: account() });

export async function token(scopes = SCOPES) {
  const acc = account();
  if (!acc) throw new Error('Sin sesión');
  try {
    return (await pca.acquireTokenSilent({ scopes, account: acc })).accessToken;
  } catch (e) {
    if (e instanceof msal.InteractionRequiredAuthError) {
      await pca.acquireTokenRedirect({ scopes, account: acc });
    }
    throw e;
  }
}
