# Proyecto Local — memoria del proyecto (leer ESTO primero, no todos los archivos)

## Qué es
- PWA sin dependencias ni build: HTML + CSS + JS vanilla. Instalable (icono en escritorio/celular).
- Un solo administrador. Español, USD (centavos enteros). Datos en `localStorage` clave `proyectoLocal.v1`.
- Acceso PC/celular: hosting estático (GitHub Pages) + enlace por email. Sincronización = exportar/importar JSON (botón "Respaldo").

## Mapa de archivos
- `index.html` — shell + CSP estricta (sin inline scripts/styles).
- `app.js` — todo: datos, formularios modal (`openForm`), vistas por pestaña, reportes, respaldo.
  - Datos/sanitize: `sanitize()`, `load()`, `save()`
  - Formularios: `editProject/editMember/editGroup/editEntry`
  - Reportes: `buildReport` → `reportNode` (HTML), `reportCsv`, `reportText`, `shareReport`, `emailReport`
  - Vistas: `viewHome`, `viewProject`, `tabResumen|Miembros|Grupos|Conta|Reportes`
- `styles.css` — tema claro/oscuro, `@media print` oculta `.noprint`.
- `sw.js` — caché offline. **Subir `VERSION` al cambiar cualquier archivo del shell.**
- `manifest.webmanifest`, `icons/` — generados con `node tools/gen-icons.js`.

## Modelo de datos
- project `{id,name,sub,desc,groups[],members[],entries[]}`
- member `{id,name,phone,notes,gid}` (gid = grupo asignado)
- group `{id,name,desc}`
- entry `{id,date(YYYY-MM-DD),type:'ingreso'|'gasto',concept,amount(centavos),mid}`; historial de aportaciones del miembro = entries ingreso con `mid`.

## Reglas
- Nunca `innerHTML`; construir DOM con `h()`. CSV escapa fórmulas (`=+-@`).
- Importar JSON siempre pasa por `sanitize()`.
- Cambios: tocar solo el área afectada. <15 líneas → indicar al usuario ruta/línea/fragmento.
- Modelo: Haiku para texto/cambios mecánicos; Sonnet/Opus para lógica/depuración.

## Ejecutar / publicar
- Local: `npx serve .` o `python -m http.server 8080` (SW requiere http/https, no file://).
- Publicar: push a GitHub → Settings → Pages → rama main / root. URL https = instalable.

## Estado
- v1 completa: proyectos, miembros, grupos, contabilidad, reportes (imprimir/compartir/email/CSV), respaldo, PWA.
- Pendiente (ideas): gráficos, categorías de gasto, sincronización en la nube (Supabase).
