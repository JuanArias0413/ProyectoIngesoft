# /resume — Retomar tras una interrupción

Úsalo cuando el trabajo se detuvo (cuota agotada, error, reinicio, contexto perdido).

1. Lee `AGENTS.md`, `SPEC.md`, `PLAN.md`, `DECISIONS.md`, `BLOCKERS.md` y `PROGRESS.md`.
2. Ejecuta `git status` y `git log --oneline -15`. Si hay cambios sin commit de una tarea a medias:
   - corre `npm run lint && npm run typecheck && npm test`;
   - si pasan, haz commit; si no, termina o corrige la tarea antes de seguir (no descartes trabajo sin entenderlo).
3. Verifica el entorno: `fnm use 22`, dependencias instaladas, PostgreSQL arriba, bases `sgec_dev` y `sgec_test` migradas.
4. Reconstruye la lista de tareas desde `PLAN.md`.
5. Continúa en `/build-project` desde el paso de la fase en curso, con el bucle de `autonomia.md`.
6. Añade a `PROGRESS.md` una línea «Reanudado: <fecha>, estado encontrado, siguiente tarea».
