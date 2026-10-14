# AGENTS.md — SGEC (Release 1.0)

Proyecto académico: Sistema de Gestión de Escenarios y Bienes Culturales (Secretaría de Cultura, Pereira). Node 22 + TypeScript + Express + PostgreSQL + Prisma.

## Lectura obligatoria al empezar cualquier sesión
SPEC.md → PLAN.md → DECISIONS.md → BLOCKERS.md → PROGRESS.md.
Reglas completas: `.agent/rules/autonomia.md` y `.agent/rules/arquitectura.md` (léelas con tus herramientas de archivos antes de escribir código).
Procedimientos: `.agents/skills/build-project/SKILL.md`, `verify-release.md` y `resume.md`. Si no existen como comandos, lee el archivo y síguelo paso a paso.

## Modo autónomo (resumen vinculante)
1. Toma la primera tarea sin marcar de PLAN.md.
2. Impleméntala según SPEC.md.
3. Verifica: `npm run lint && npm run typecheck && npm test`.
4. Si falla, corrige (máx. 5 intentos; luego anótalo en BLOCKERS.md y sigue con otra).
5. Commit convencional en `release/1.0`, marca `[x]` en PLAN.md, añade línea a PROGRESS.md.
6. Vuelve al paso 1. No te detengas al terminar una tarea ni una fase; no pidas confirmación; no preguntes al usuario: decide, registra en DECISIONS.md y sigue.
Solo te detienes cuando PLAN.md esté completo con `v1.0.0` etiquetada, o ante un bloqueo real que impida toda tarea restante.

## Arquitectura (resumen)
Monolito modular en capas: presentación → aplicación → dominio ← infraestructura. El dominio no importa Express, Prisma ni Nunjucks. Patrones: State (ciclo del contrato), Repository, Strategy (tarifas). TypeScript estricto, sin `any`. Autorización siempre en servidor.

## Seguridad operativa
Solo dentro de este repo y solo contra las bases `sgec_dev` y `sgec_test`. Prohibido: sudo, `rm -rf` amplio, `git push --force`, dropdb, DROP DATABASE. No subir `.env` ni `storage/`.

## Honestidad
Nunca marques una tarea sin haber ejecutado la verificación. Nunca borres ni relajes pruebas para que pasen. No inventes resultados en los documentos.

Entorno: `eval "$(fnm env)" && fnm use 22`. Arranque: `npm install && npm run setup && npm run dev`.
Idioma: UI y documentación en español; código, commits y nombres técnicos en inglés.