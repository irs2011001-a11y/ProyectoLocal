# Diseño v2 — Identidades, proyectos y tareas (pendiente de implementar)

Estado: **solo diseño**, sin código. Implementar por fases; cada fase = commit estable.

## Decisiones del usuario
- Una persona pertenece a **un solo grupo**, pero puede asignarse a **tareas** (aparte del grupo).
- **Migrar** persona entre identidades: solo la persona, **sin sus aportaciones**.
- Un proyecto se asigna a **grupos completos y/o personas individuales**.
- Tareas: nombre, responsables, estado (pendiente/en curso/hecha), presupuesto opcional. Sin fechas.
- **Cuota esperada opcional** por proyecto → reporte de pendientes.
- Colaboradores aportan **dinero, trabajo o materiales**; se registran las aportaciones en general.
- Inicio = **lista de identidades**. Reportes por identidad y por proyecto. Respaldo = exportar todo.
- Gastos mantienen desglose en líneas; **cada línea puede tener su propia actividad**.

## Modelo de datos (v2)
- identity `{id,name,desc,groups[],people[],concepts[],projects[]}`
  - group `{id,name,desc,kind:'vecinos'|'colaboradores'|'otro'}`
  - person `{id,name,phone,notes,gid,active}` (`active:false` = migrada/archivada, conserva historial)
  - concept `{id,name,type:'ingreso'|'gasto'}` — lista reutilizable, desplegable + "Crear nuevo"
- project `{id,name,desc,cat,assign:{gids[],pids[]},quota:{enabled,amount},tasks[],entries[]}`
  - cat = tipo de actividad (reparación de calles, ornamentación…); lista propia + "Crear nueva" (como `subList()`)
  - task `{id,name,state,budget,gids[],pids[]}`
- entry `{id,date,type,kind:'dinero'|'especie'|'trabajo',cid(concepto),concept(texto respaldo),amount,value,mid,tid(tarea|''),notes,lines[],att}`
  - line `{d,a,tid}` (actividad propia por línea)
  - `kind` ≠ dinero: no entra al balance de caja; se reporta aparte (valor opcional).
- "Actividad" de un registro = tarea (`tid`); sin tarea → categoría del proyecto.

## Migración de datos v1 → v2 (en `sanitize()`)
- Crear identidad "Mi comunidad" y mover ahí todos los proyectos existentes.
- Grupos/miembros de cada proyecto → grupos/personas de la identidad (fusionar por nombre; remapear `gid`/`mid`).
- Entradas existentes: `kind:'dinero'`, `tid:''`, `cid` creado desde `concept`.
- Clave `proyectoLocal.v1` → leer v1, guardar como `proyectoLocal.v2`; conservar v1 como respaldo.
- Respaldo JSON: `v:2`; importar v1 también debe migrar.

## Migrar persona entre identidades
- Copia persona al destino (id nuevo, mismos datos, sin grupo); en origen queda `active:false`.
- Aportaciones y registros se quedan en origen (historial intacto).

## Fases
1. **Identidades**: pantalla inicial, CRUD, personas y grupos dentro de la identidad, migración v1→v2, migrar persona.
2. **Proyecto**: categoría, asignación de grupos/personas, tareas con responsables/estado/presupuesto.
3. **Registros**: conceptos guardados (desplegable), actividad (tarea) en ingreso/gasto/línea, `kind` dinero/especie/trabajo, cuota opcional.
4. **Reportes**: por identidad y por proyecto; por actividad y grupo; pendientes de cuota; aportes en especie; participación (ya existe, adaptar).

## Reglas que se mantienen
- Sin `innerHTML`, DOM con `h()`; CSV escapa fórmulas; importar siempre por `sanitize()`.
- Subir `VERSION` de `sw.js` en cada cambio del shell.
- Modelo: Opus para fases 1 y 3 (migración/lógica); Sonnet para 2 y 4; Haiku para textos.
