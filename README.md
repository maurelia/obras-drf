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

## Versión 1.4.0 (10-11-2026)

- **Dos proyectos** con selector en Avance, Obras y Registros (se recuerda en el equipo, clave `proyecto`):
  Obras Fluviales DRF (OF, DRF-OF-2509-06, CECO 144004) y **Piscina Operacional DRF** (PO, DRF-PO-2401-05,
  CECO 144002), según `CODIGOS-PROYECTOS-DOCUMENTOS-CECO.xlsx`. `PROYECTOS` en `config.js` y `SIGLAS` en `buzon/Code.gs`.
- Cada proyecto tiene su panel (Obras Fluviales con tempranas / definitivas; Piscina Operacional con su avance
  y «Avance por piscina»), sus obras, sus registros y su correlativo: PDA-OF-001 y PDA-PO-001 son independientes.
  Obra y registro llevan `Proyecto` (sin campo = OF). Formatos por proyecto: `proyectos` en `forms.js`.
- Nuevo **PCP – Protocolo de control topográfico de piscinas** (Topógrafo y Administrador): tabla de puntos con
  ubicación (fondo, talud, zanja, coronamiento), coordenadas, cota de diseño y medida, resultado con la diferencia
  (tolerancias 0,15 / 0,30 m), talud medido, fotos y las 4 firmas del PCT. Botón «Cargar puntos» con el eje de
  fondo de la Piscina A (DM 20–40, informe de estatus de agosto 2026). El PCT queda solo en Obras Fluviales.
- Requiere `buzon/Code.gs` 1.4.0 desplegado (acepta PCP y numera por proyecto).

## Versión 1.3.0 (10-11-2026)

- Piscinas operacionales **Piscina A (PA)** y **Piscina B (PB)** del DRF como obras, con 8 etapas cada una
  (fase `Piscina`, Uids `of-pa-p1…p8`): replanteo 5, excavación 30, perfilado de taludes y sello 15, rellenos y
  compactación 10, zanja de anclaje 5, geotextil + HDPE 25, insertos HDPE 5, terminaciones y recepción 5 (pesos
  preliminares). Geometría tipo: 50 × 30 m arriba, 36 × 16 m fondo, h 3,5 m, talud 2:1, 3.515 m³.
- Aparecen en todos los protocolos que piden obra o etapa (PDA, RCM, PTT, TRT, PND) y el PDA suma su avance.
- Tercer grupo en el panel: «Piscinas» (peso por obra `PesoPis`, 50 / 50), aparte de obras tempranas y definitivas.
- Para cargarlas: Obras › «Cargar obras del proyecto» (agrega solo lo que falta en el buzón).

## Versión 1.2.2 (08-11-2026)

- Humectación (PHU) impresa como su original: título en barra azul 1F3864, secciones en barras naranjas E8501E,
  etiquetas F2F2F2 (`estilo: 'naranja'` en forms.js). Casillas Sí / No en línea dentro de las tablas.

## Versión 1.2.1 (08-11-2026)

- Impreso: número de página en el pie (recuadro gris a la derecha, `@page kozan` con cajas de margen) y
  casillas como en los formatos originales (todas las opciones, ☒ la elegida, ☐ las demás; en tablas, una por línea).

## Versión 1.2.0 (08-11-2026)

- Todo en Google Drive por ahora: `SHAREPOINT: false` en `config.js` oculta la subida a SharePoint y el panel
  cuenta lo visado. Con `true` (y los datos de Informática) vuelve el flujo con SharePoint.
- Fotos en los 8 formatos: «Registro fotográfico» en RCM, PTT, TRT, PRV y PND (PDA, PCT y PHU ya tenían),
  botón «Tomar foto» (cámara) y «Elegir de la galería», y descripción por foto. Funciona sin señal.
- Documento impreso con formato Kozan (como los formatos originales en Word): franja azul, logo
  (`img/kozan_logo.png`), bloque de la empresa, títulos 1F4E79, etiquetas EDF3F8, pie con dirección y fono;
  encabezado y pie se repiten en cada página.
- Pendiente: sub-etapas de las obras.

## Versión 1.1.0 (08-11-2026)

- Monitoreo propio, sin servicios externos (`js/monitor.js`): errores de JavaScript, promesas rechazadas,
  avisos de error y tiempos del buzón; cada equipo los guarda y los manda al buzón (acción `reportar`,
  archivo `Obras DRF/obrasdrf_monitoreo.json`, 1.000 eventos máx.) con un latido de versión cada 6 h.
- Ajustes › Monitoreo y errores (administrador): estado del buzón, versión publicada vs. instalada,
  equipos, errores agrupados con stack, CSV y limpiar.
- Política de privacidad v3 (diagnóstico técnico): la app vuelve a pedir la aceptación.

## Versión 1.0.0 (08-11-2026)

Primera versión final, en producción con un solo usuario: el administrador (dueño del buzón).

- Google y buzón conectados (`GOOGLE_CLIENT_ID`, `BUZON_URL`); buzón en su versión de implementación 2.
- 8 formatos (PDA, PCT, RCM, PTT, TRT, PRV, PHU, PND), visado con código, avance por obras tempranas y definitivas.
- Política de privacidad (v2) y términos de uso (v1), con autorización al entrar y constancia en el buzón;
  permiso de ubicación en fotos; Ajustes › Mis datos e Inventario de datos (CSV).
- Se actualiza sola al publicar una versión nueva.
- Pendiente para versiones siguientes: SharePoint (`CLIENT_ID`, `TENANT_ID`, `SITE_HOST` de Informática;
  hasta entonces «Subir a SharePoint» no funciona), alta de usuarios de terreno, instructivo IN-OF-01 Rev. E.

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

## Licencia

© 2026 S.C.M. Atacama Kozan. Todos los derechos reservados. Ver [LICENSE](LICENSE).
