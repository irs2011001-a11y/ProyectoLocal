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
- `styles.css` — diseño estilo Apple: tarjeta central translúcida (`.shell`) sobre `icons/bg.svg`, dock inferior de iconos (`nav.dock`, etiqueta al hover), color azul `--brand`. Tema claro/oscuro, `@media print` oculta `.noprint`.
- Navegación: `NAV`/`ICONS`/`dock()` en app.js; secciones visibles sin proyecto (muestran estado vacío). Subcategorías: `subList()` + opción "Crear nueva" (`custom` en `openForm`), sin almacenar lista aparte.
- `sw.js` — caché offline. **Subir `VERSION` al cambiar cualquier archivo del shell.**
- `manifest.webmanifest`, `icons/` — generados con `node tools/gen-icons.js`.

## Modelo de datos (v2, clave `proyectoLocal.v2`; v1 se migra solo y queda intacta)
- identity `{id,name,desc,groups[],members[],projects[]}` (grupos y personas viven aquí; `member.active=false` = migrada/archivada)
- project `{id,name,sub,desc,cat,start,end,quota,assign:{gids,pids},tasks:[{id,name,state,budget,gids,pids}],entries[]}` (fechas YYYY-MM-DD opcionales; quota en centavos por persona asignada)
- member `{id,name,phone,notes,gid,active}`; group `{id,name,desc}`
- entry `{id,date,type,kind:'dinero'|'especie'|'trabajo',concept,cid,amount,mid,tid,notes,lines[{d,a,tid}],att}`; solo `kind=dinero` entra a caja (`isCash`/`totals`)
- entry.qa = parte (centavos) del aporte en dinero aplicada a cuota; reporte cuotas suma `qa` (`quotaPaid`), pagos parciales ok; `applyPastToQuota` convierte aportes antiguos
- identity.concepts `[{id,name,type}]`: lista guardada (desplegable + "Crear nuevo"), editable en Contabilidad → Conceptos; renombrar propaga a `entry.concept`
- Navegación: `ui.iid` (identidad) → `ui.pid` (proyecto) → `ui.tab`. Inicio = lista de identidades. Identidad sin proyectos usa `identityView()` (solo Miembros/Grupos/Reportes).

## Reglas
- Nunca `innerHTML`; construir DOM con `h()`. CSV escapa fórmulas (`=+-@`).
- Importar JSON siempre pasa por `sanitize()`.
- Cambios: tocar solo el área afectada. <15 líneas → indicar al usuario ruta/línea/fragmento.
- Modelo: Haiku para texto/cambios mecánicos; Sonnet/Opus para lógica/depuración.

## Ejecutar / publicar
- Local: `npx serve .` o `python -m http.server 8080` (SW requiere http/https, no file://).
- Publicar: push a GitHub → Settings → Pages → rama main / root. URL https = instalable.

## Siguiente evolución
- Diseño v2: ver `DISENO.md`. **Fases 1–3 hechas (identidades; cat/assign/tasks; conceptos guardados, actividad=tarea, kind, cuota, fechas de proyecto, reportes general/actividad/concepto/cuotas)**; falta pulir (fase 4: gráficos, reportes extra)

## Estado
- v1 completa: proyectos, miembros, grupos, contabilidad, reportes (imprimir/compartir/email/CSV), respaldo, PWA.
- Pendiente (ideas): gráficos, categorías de gasto, sincronización en la nube (Supabase).
