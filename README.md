# Obras DRF — Atacama Kozan

App web instalable (PWA) para el control de obras fluviales del DRF: obras, etapas,
reportes de terreno y protocolos de entrega. Funciona sin señal.

Desde v0.5 (etapa 1):

1. **Todos entran con Google** (pantalla inicial). El perfil de cada cuenta lo asigna el
   administrador; quien publicó el buzón es siempre administrador.
2. **Lo firmado queda en el Google Drive del administrador**: la app lo manda al buzón
   (`buzon/Code.gs`, aplicación web de Apps Script publicada desde la cuenta del administrador),
   que valida el token de Google y guarda en `Obras DRF/` → `obrasdrf_datos.json` (usuarios, obras,
   etapas, registros) y `Registros/<TIPO>/<fecha>_<id>/` (registro.json, fotos, firmas, adjuntos).
   Terreno solo pide `openid email profile`: la app no toca el Drive de nadie más.
3. **El administrador visa** (asigna el código PDA-OF-001…) u **observa** (el autor lo ve al sincronizar
   y le llega un correo). Lo que firma el administrador queda visado.
4. **Botón «Subir a SharePoint»** (por registro o «Por subir» → todos): con su cuenta Microsoft de Kozan,
   deja en `<CARPETA>/<TIPO>/<CÓDIGO>/` el PDF del protocolo, fotos, firmas y adjuntos, y una fila en
   `DRF_Obras`, `DRF_Partidas` y `DRF_Registros` (columna `Documento` = enlace al PDF).
5. **El panel de avance cuenta solo lo subido a SharePoint**, igual que lo verá Power BI (etapa 2,
   sobre esas listas). Con cuenta Kozan se entra solo a consultar lo publicado.

Publicada en **https://maurelia.github.io/obras-drf/** (GitHub Pages, rama `main`).

```
config.js       ← GOOGLE_CLIENT_ID, BUZON_URL, y SharePoint: CLIENT_ID, TENANT_ID, SITE_HOST, SITE_PATH, BIBLIOTECA, CARPETA
buzon/Code.gs   ← script del buzón (se pega en script.google.com con la cuenta del administrador)
js/buzon.js     ← login Google (Google Identity Services) y llamadas al buzón
js/publicar.js  ← subida a SharePoint: PDF (html2pdf), archivos y listas
js/schema.js    ← listas de SharePoint y códigos de registro
js/forms.js     ← los 8 formatos (PDA, PCT, RCM, PTT, TRT, PRV, PHU, PND), perfiles, tolerancias
js/engine.js    ← formulario y documento imprimible
js/avance.js    ← avance ponderado (obra × etapa), igual que la planilla de control LJ
js/catalogo.js  ← 11 obras del proyecto con pesos y etapas
js/store.js     ← base local (IndexedDB, offline)
js/graph.js     ← SharePoint vía Microsoft Graph
js/auth.js      ← cuenta Microsoft (MSAL)
vendor/         ← @azure/msal-browser 3.27.0, html2pdf.js 0.10.1 (MIT)
```

Perfiles: **Administrador**, **Supervisor de terraza** (PDA, RCM, PHU), **Topógrafo** (PDA, PCT, PTT, TRT, PND),
**Operador** (PDA, RCM, PHU). El buzón aplica los mismos permisos que la app.

## Probar en el PC (modo demo)

```
python -m http.server 8080
```
Abrir http://localhost:8080. Sin `GOOGLE_CLIENT_ID`/`BUZON_URL` todo queda en ese navegador: «Entrar con Google»
pide elegir un perfil de prueba y «Subir a SharePoint» genera el PDF sin subirlo.
Antes de probar cambios: Application → Service workers → Unregister y borrar caché (la app se sirve desde caché).

## 1. Google: cliente OAuth (una vez, con la cuenta del administrador)

1. https://console.cloud.google.com → crear proyecto `Obras DRF`.
2. **Pantalla de consentimiento OAuth**: tipo *Externo*, nombre `Obras DRF`, alcances `openid`, `email`, `profile`
   (no sensibles: no requiere verificación). Publicar (*En producción*).
3. **Credenciales → Crear ID de cliente OAuth → Aplicación web**. Orígenes JavaScript autorizados:
   `https://maurelia.github.io` y `http://localhost:8080`.
4. Copiar el ID de cliente en `config.js` → `GOOGLE_CLIENT_ID` y en `buzon/Code.gs` → `CLIENT_ID`.

## 2. Buzón en tu Drive (Apps Script)

1. https://script.google.com con la cuenta del administrador → Proyecto nuevo `Obras DRF buzón`.
2. Pegar `buzon/Code.gs` (con `CLIENT_ID` completado) y guardar.
3. Ejecutar la función `prueba` una vez y autorizar (Drive, servicios externos). Crea la carpeta `Obras DRF`.
4. **Implementar → Nueva implementación → Aplicación web**: Ejecutar como **Yo**, Acceso **Cualquier persona**.
   Copiar la URL `…/exec` en `config.js` → `BUZON_URL`.
5. Al cambiar el script: Implementar → Gestionar implementaciones → editar → Versión nueva (la URL no cambia).

«Cualquier persona» solo permite llegar al script: sin un token válido de la app y una cuenta autorizada en
Ajustes → Usuarios, no recibe ni entrega nada.

## 3. SharePoint de proyectos (para el botón de subida)

1. **Registro de la app** en https://entra.microsoft.com (lo hace TI): Aplicación de página única (SPA),
   URI de redirección `https://maurelia.github.io/obras-drf/` (y `http://localhost:8080/`), permisos delegados
   `User.Read`, `Sites.ReadWrite.All`, `Sites.Manage.All` con consentimiento de administrador.
2. En `config.js`: `CLIENT_ID`, `TENANT_ID`, `SITE_HOST` (xxxx.sharepoint.com), `SITE_PATH` del sitio de proyectos,
   `BIBLIOTECA` (vacío = Documentos) y `CARPETA` = ruta de la carpeta de las Obras Fluviales dentro de la biblioteca.
3. En la app: Ajustes → Conectar cuenta Microsoft → Revisar / crear listas (crea `DRF_Obras`, `DRF_Partidas`, `DRF_Registros`).

## Notas de diseño

- Cada registro tiene un `Uid` generado en el teléfono; las relaciones (partida → obra) usan `ObraUid`,
  así se puede crear todo sin señal.
- Los campos propios de cada formulario van en la columna `Datos` (JSON) hasta fijar los formatos.
- Códigos de registro `PDA-OF-001`: los asigna el buzón al visar (bajo bloqueo), así nunca se repite un correlativo.
- Al publicar una versión nueva, subir `CACHE` en `sw.js` para que los teléfonos se actualicen.
