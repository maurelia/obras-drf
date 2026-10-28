# Obras DRF — Atacama Kozan

App web instalable (PWA) para el control de obras fluviales del DRF: obras, partidas,
reportes de terreno y protocolos de entrega. Funciona sin señal y sincroniza con
SharePoint (Microsoft 365 de Atacama Kozan). Cada persona entra con su cuenta.

Publicada en **https://maurelia.github.io/obras-drf/** (GitHub Pages, rama `main`).
Este repositorio contiene solo el código: los datos viven en el SharePoint de Kozan.

```
config.js     ← CLIENT_ID, TENANT_ID, sitio SharePoint
js/schema.js  ← estructura de las listas, perfiles y códigos de registro
js/forms.js   ← los 8 formatos (PDA, PCT, RCM, PTT, TRT, PRV, PHU, PND), tolerancias y puntos de control
js/engine.js  ← arma cada formulario y su documento imprimible / PDF
js/avance.js  ← avance ponderado (obra × etapa), igual que la planilla de control LJ
js/catalogo.js← 11 obras del proyecto con pesos y etapas
js/store.js   ← base local + bandeja de salida (offline)
js/graph.js   ← SharePoint vía Microsoft Graph
js/auth.js    ← login Microsoft (MSAL)
vendor/       ← @azure/msal-browser 3.27.0 (licencia MIT)
```

En el PC, los formatos de la empresa están fuera del repositorio
(`apps\obras_drf\00_FORMATOS`).

## Estado (v0.3.0)

- Perfiles: **Administrador** (ingenieros de proyectos y TI), **Supervisor de terraza**, **Topógrafo** y **Operador**, en la lista DRF_Usuarios.
  Sin usuarios cargados, todos entran como administrador (configuración inicial).
- 8 formatos digitales transcritos de `03.PROYECTO\08.PROTOCOLOS-PROCEDIMIENTOS`, con fotos con GPS, firma en pantalla,
  adjuntos (subida por partes sobre 4 MB) y documento imprimible / PDF.
- Flujo Borrador → Enviado → Aprobado / Observado; la revisión PRV aprueba u observa su transmittal.
- Panel de avance: global ponderado, curva acumulada, avance por obra, horas máquina y conformidad topográfica.
- Instructivo de uso: `apps\obras_drf\01_DOCUMENTOS\IN-OF-01_INSTRUCTIVO_USO_APP_OBRAS_DRF.docx` (fuera del repo).
- Pendiente: probar con SharePoint real (falta CLIENT_ID de Informática). Los permisos por perfil se aplican en la app;
  para reforzarlos en SharePoint, dar a DRF_Usuarios permisos de edición solo a administradores.

## Probar en el PC (modo demo)

```
python -m http.server 8080
```
Abrir http://localhost:8080. Sin `CLIENT_ID` todo queda solo en ese navegador.

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

## Notas de diseño

- Cada registro tiene un `Uid` generado en el teléfono; las relaciones (partida → obra) usan `ObraUid`,
  así se puede crear todo sin señal.
- Los campos propios de cada formulario van en la columna `Datos` (JSON) hasta fijar los formatos.
- Códigos de documento al estilo carpeta TOP: `PEA-TD-14`, `RDT-TD-003` (`nextCode` en schema.js).
  Dos personas sin señal podrían tomar el mismo correlativo; se resolverá al implementar los protocolos.
- Al publicar una versión nueva, subir `CACHE` en `sw.js` para que los teléfonos se actualicen.
