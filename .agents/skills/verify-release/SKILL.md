---
name: verify-release
description: Compuerta de calidad y verificación integral para el cierre de fase y final del Release 1.0 de SGEC.
---

# /verify-release — Compuerta de calidad

Ejecútala al cerrar cada fase y al final. **Quien la ejecuta no debe ser el agente que escribió el código evaluado** (si hay un solo agente, vuelve a leer el código como revisor y sé estricto).

## 1. Verificaciones automáticas
Ejecuta y guarda la salida resumida en `PROGRESS.md`:
```
npm run lint
npm run typecheck
npm test
npm run test:e2e        # desde la Fase 4
npm audit --omit=dev    # desde la Fase 4: reporta, no bloquea salvo críticos
```
Cualquier fallo: crear tarea de corrección en `PLAN.md`.

## 2. Arranque real
- `npm run dev` levanta sin errores y `GET /health` responde 200.
- Login con los 6 usuarios semilla.
- Recorre en el navegador integrado el flujo disponible hasta la fase actual.

## 3. Cumplimiento del SPEC
- Para cada AC de las características ya implementadas, confirma que existe una prueba que lo cubre y que pasa. Lista los AC sin prueba.
- Confirma que ninguna regla de negocio vive en controladores o vistas.
- Confirma que `status` solo cambia dentro de la máquina de estados (busca con grep asignaciones a `status`).
- Confirma que el dominio no importa Express, Prisma ni Nunjucks (grep en `src/modules/*/domain`).
- Confirma que toda ruta POST tiene CSRF y `requirePermission`.

## 4. Revisión de código
Busca y reporta: funciones > 40 líneas, duplicación evidente, `any`, `console.log`, `TODO`, pruebas omitidas (`.skip`, `.only`), secretos en el repo, archivos sin usar.

## 5. Informe
Escribe en `PROGRESS.md` una entrada «Compuerta Gx» con: fecha, resultados (números reales), hallazgos y tareas creadas. La compuerta **pasa** solo si no quedan fallos automáticos ni hallazgos críticos abiertos.
