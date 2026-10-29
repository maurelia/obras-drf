# Obras DRF — Atacama Kozan

App web instalable (PWA) para el control de obras fluviales del DRF: obras, partidas,
reportes de terreno y protocolos de entrega. Funciona sin señal.

Desde v0.4 solo lo aprobado llega a SharePoint:

1. **Terreno** (operadores, topógrafos, supervisores de terraza) entra con una cuenta Google
   (correo personal o de empresa). Al firmar, cada registro se sube como paquete JSON (datos,
   fotos y firma) a la carpeta «Obras DRF - Envíos» de su propio Drive, compartida solo lectura
   con la cuenta Google del proyecto (`BUZON_CORREO`). Sin señal queda en cola.
2. **Administrador** (cuenta Kozan) trae los envíos desde esa cuenta (Registros → ⤓), los revisa,
   observa (aviso por correo al autor) o aprueba. Al aprobar se asigna el código correlativo y
   el registro, con sus fotos y firma, se sube a SharePoint.
3. Cualquier otra cuenta Kozan o invitada (p. ej. supervisor de empresa colaboradora) solo consulta lo aprobado.

Publicada en **https://maurelia.github.io/obras-drf/** (GitHub Pages, rama `main`).
Este repositorio contiene solo el código: los datos viven en el SharePoint de Kozan.

```
config.js     ← CLIENT_ID, TENANT_ID, sitio SharePoint, GOOGLE_CLIENT_ID, BUZON_CORREO
js/schema.js  ← estructura de las listas, perfiles y códigos de registro
js/forms.js   ← los 8 formatos (PDA, PCT, RCM, PTT, TRT, PRV, PHU, PND), tolerancias y puntos de control
js/engine.js  ← arma cada formulario y su documento imprimible / PDF
js/avance.js  ← avance ponderado (obra × etapa), igual que la planilla de control LJ
js/catalogo.js← 11 obras del proyecto con pesos y etapas
js/store.js   ← base local + bandeja de salida (offline)
js/graph.js   ← SharePoint vía Microsoft Graph
js/auth.js    ← login Microsoft (MSAL)
js/gdrive.js  ← buzón de terreno en Google Drive (Google Identity Services)
vendor/       ← @azure/msal-browser 3.27.0 (licencia MIT)
```

En el PC, los formatos de la empresa están fuera del repositorio
(`apps\obras_drf\00_FORMATOS`).

## Estado (v0.4.0)

- Perfiles: **Administrador** (ingenieros de proyectos y TI), **Supervisor de terraza**, **Supervisor empresa colaboradora** (externo, invitado B2B; solo consulta registros aprobados), **Topógrafo** y **Operador**, en la lista DRF_Usuarios.
  Para terreno se registra el correo de su cuenta Google: al importar, la app compara el dueño del archivo
  (según Google) con esa lista y rechaza lo que no corresponda a su perfil.
  Sin usuarios cargados, todos entran como administrador (configuración inicial).
- Los envíos importados y los observados quedan solo en el equipo del administrador hasta aprobarlos.
  Si ese equipo se borra, se vuelven a traer desde el buzón (el original sigue en el Drive del autor).
- El avance suma solo protocolos diarios aprobados.
- 8 formatos digitales transcritos de `03.PROYECTO\08.PROTOCOLOS-PROCEDIMIENTOS`, con fotos con GPS, firma en pantalla,
  adjuntos (subida por partes sobre 4 MB) y documento imprimible / PDF.
- Flujo Borrador → Enviado (buzón) → Aprobado (SharePoint) / Observado (correo al autor, que corrige y reenvía);
  la revisión PRV aprueba u observa su transmittal.
- Panel de avance: global ponderado, curva acumulada, avance por obra, horas máquina y conformidad topográfica.
- Instructivo de uso: `apps\obras_drf\01_DOCUMENTOS\IN-OF-01_INSTRUCTIVO_USO_APP_OBRAS_DRF.docx` (fuera del repo).
- Pendiente: probar con SharePoint real (falta CLIENT_ID de Informática). Los permisos por perfil se aplican en la app;
  para reforzarlos en SharePoint, dar a DRF_Usuarios permisos de edición solo a administradores.

## Probar en el PC (modo demo)

```
python -m http.server 8080
```
Abrir http://localhost:8080. Sin `CLIENT_ID` ni `GOOGLE_CLIENT_ID` todo queda solo en ese navegador; en Ajustes
se cambia el perfil de prueba (los de terreno ven la app como con cuenta Google).

## Conectar a SharePoint (una vez, lo hace un administrador del M365)

1. **Sitio**: crear un sitio de SharePoint para el proyecto, p. ej. `/sites/ObrasDRF`,
   y agregar como miembros a quienes usarán la app (los permisos del sitio son los de la app).
2. **Registro de la app** en https://entra.microsoft.com → Aplicaciones → Registros de aplicaciones → Nuevo registro:
   - Nombre: `Obras DRF`
   - Tipos de cuenta: *Solo las cuentas de este directorio organizativo*
   - URI de redirección: plataforma **Aplicación de página única (SPA)**:
     `https://maurelia.github.io/obras-drf/` (y `http://localhost:8080/` para pruebas).
3. **Permisos de API** → Agregar → Microsoft Graph → Permisos delegados:
   `User.Read`, `Sites.ReadWrite.All`, `Sites.Manage.All` → **Conceder consentimiento de administrador**.
4. Copiar en `config.js`: *Id. de aplicación (cliente)* → `CLIENT_ID`, *Id. de directorio (inquilino)* → `TENANT_ID`,
   el dominio `xxxx.sharepoint.com` → `SITE_HOST`, y la ruta del sitio → `SITE_PATH`.
5. Abrir la app, iniciar sesión, ir a **Ajustes → Revisar / crear listas**. Crea `DRF_Obras`, `DRF_Partidas`,
   `DRF_Reportes` y `DRF_Protocolos` en el sitio.

Los datos quedan en esas listas: se pueden ver, filtrar y exportar a Excel desde SharePoint
sin pasar por la app.

## Buzón de terreno en Google Drive (una vez, lo hace el administrador)

1. Crear la cuenta Google del proyecto (p. ej. `obrasdrf.kozan@gmail.com`). Su clave la guardan los administradores / TI.
2. Con esa cuenta, en https://console.cloud.google.com: crear el proyecto `Obras DRF` y habilitar **Google Drive API**.
3. **Pantalla de consentimiento OAuth**: tipo *Externo*, nombre `Obras DRF`, correo de soporte = cuenta del proyecto,
   alcances `drive.file` (terreno) y `drive.readonly` (solo lo pide la cuenta del proyecto al traer envíos).
   Publicar la app (*En producción*). Terreno solo pide `drive.file`, que no requiere verificación de Google;
   la cuenta del proyecto verá una vez el aviso de «app no verificada» por `drive.readonly`.
4. **Credenciales → Crear ID de cliente OAuth → Aplicación web**. Orígenes JavaScript autorizados:
   `https://maurelia.github.io` (y `http://localhost:8080` para pruebas).
5. Copiar el ID de cliente en `config.js` → `GOOGLE_CLIENT_ID`, y la cuenta del proyecto → `BUZON_CORREO`.

Quien no tenga Gmail puede crear una cuenta Google con su correo actual (accounts.google.com → Crear cuenta →
Usar mi dirección de correo actual).

## Notas de diseño

- Cada registro tiene un `Uid` generado en el teléfono; las relaciones (partida → obra) usan `ObraUid`,
  así se puede crear todo sin señal.
- Los campos propios de cada formulario van en la columna `Datos` (JSON) hasta fijar los formatos.
- Códigos de registro `PDA-OF-001` (`nextCode` en schema.js): los asigna el administrador al aprobar,
  así terreno nunca repite un correlativo.
- Al publicar una versión nueva, subir `CACHE` en `sw.js` para que los teléfonos se actualicen.
