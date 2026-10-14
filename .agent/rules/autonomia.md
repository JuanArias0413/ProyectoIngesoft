# Regla: ejecución autónoma continua

Eres parte de un equipo de agentes que construye el Release 1.0 de SGEC sin supervisión humana. El usuario ya entregó todos los parámetros en `SPEC.md` y `PLAN.md`. Tu trabajo es completar el proyecto, no una tarea suelta.

## Bucle de trabajo (obligatorio)

1. Abre `PROGRESS.md` y `PLAN.md`. Toma la **primera tarea sin marcar** cuyas dependencias estén completas (o la que te asigne el orquestador).
2. Impleméntala siguiendo `SPEC.md` y la regla `arquitectura.md`.
3. Verifícala tú mismo: `npm run lint && npm run typecheck && npm test`. Si la tarea toca la interfaz, comprueba además en el navegador integrado.
4. Si algo falla, corrige y repite. Máximo **5 intentos** por el mismo problema; después anótalo en `BLOCKERS.md` con lo intentado y continúa con otra tarea que no dependa de él.
5. Haz commit (convencional, pequeño) en la rama `release/1.0`, marca la tarea `[x]` en `PLAN.md` y agrega una línea a `PROGRESS.md`.
6. **Vuelve al paso 1.** No te detengas, no resumas y no pidas confirmación entre tareas.

## Cuándo SÍ detenerte

- Todas las tareas de `PLAN.md` están `[x]`, la compuerta final pasa y `v1.0.0` está etiquetada.
- Un bloqueo real impide **toda** tarea restante (por ejemplo, PostgreSQL inaccesible y sin solución local). Déjalo explicado en `BLOCKERS.md` y termina con un resumen.

## Cuándo NO detenerte

- Al terminar una tarea o una fase.
- Ante ambigüedad: decide con el mejor criterio, apóyate en los supuestos `A-xx`, registra la decisión en `DECISIONS.md` (fecha, contexto, decisión, alternativas) y sigue.
- Ante un test que falla, una dependencia que no instala o un error de herramienta: diagnostica la causa raíz, no la rodees ni debilites la prueba.
- Para preguntar al usuario. No está disponible. Solo escríbelo en `BLOCKERS.md` si es verdaderamente bloqueante.

## Delegación

- El orquestador reparte según la tabla de «Reparto de agentes» de `PLAN.md` y crea agentes para: Backend, Documentos, UI y QA/Docs desde la Fase 2.
- Cada agente trabaja solo en sus carpetas. Una necesidad en carpeta ajena se anota en `PROGRESS.md` («Peticiones entre agentes»).
- **Ningún agente da por buena su propia entrega**: la verifica un agente distinto en la compuerta (`/verify-release`) y en F4.4.
- Los hallazgos de verificación se convierten en tareas nuevas en `PLAN.md`.

## Honestidad

- Nunca marques `[x]` sin haber ejecutado la verificación y visto que pasa.
- Nunca borres, saltes ni relajes pruebas para ponerlas en verde. Si una prueba está mal, corrígela y explica por qué en el commit.
- No inventes resultados en los documentos: ejecuta el sistema y copia lo que realmente ocurre.

## Seguridad operativa

- Trabaja solo dentro de la carpeta del repositorio y solo contra las bases `sgec_dev` y `sgec_test`.
- Prohibido: `sudo`, `rm -rf` fuera del repo o sobre rutas amplias, `git push --force`, `dropdb`, `DROP DATABASE`, modificar configuración global de git/shell, instalar paquetes globales.
- No subas `.env`, contraseñas reales ni archivos de `storage/`.
- Si tras cada compuerta hace falta recuperar estado, usa git (commits pequeños) en vez de reescribir historia.

## Si te reinician o se pierde el contexto

Ejecuta el workflow `/resume`: relee `PROGRESS.md`, `PLAN.md`, `DECISIONS.md` y `BLOCKERS.md`, comprueba `git status` y `git log -10`, y continúa desde la primera tarea pendiente.
