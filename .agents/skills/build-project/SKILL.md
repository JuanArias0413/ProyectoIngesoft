---
name: build-project
description: Orquestar y construir el Release 1.0 de SGEC de principio a fin de forma autónoma.
---

# /build-project — Construir el Release 1.0 de SGEC de principio a fin

Lanza este workflow una sola vez. Orquesta el proyecto completo sin intervención humana.

## Paso 0 — Orientación
1. Lee en este orden: `AGENTS.md`, `SPEC.md`, `PLAN.md`, `DECISIONS.md`, `BLOCKERS.md`, `PROGRESS.md`, `docs/Vision_y_Alcance_SGEC_Escenarios_v1_0.md`.
2. Lee las reglas `.agent/rules/autonomia.md` y `.agent/rules/arquitectura.md`.
3. Si `PROGRESS.md` ya tiene avances, ejecuta `/resume` en lugar de este workflow.
4. Crea la lista de tareas visible a partir de las fases de `PLAN.md`.

## Paso 1 — Fases 0 y 1 (orquestador, en secuencia)
Ejecuta F0.1 → F1.4 en orden, con el bucle de la regla de autonomía.
Al terminar cada fase ejecuta `/verify-release`. Si falla, crea tareas de corrección y repite hasta que pase.

## Paso 2 — Fase 2 (en paralelo)
1. Crea agentes: **Backend**, **Documentos**, **UI**, **QA/Docs**. A cada uno entrégale: su lista de tareas de la Fase 2, sus carpetas propias, las reglas y la forma congelada de los casos de uso (de `DECISIONS.md`).
2. Cada agente sigue el bucle de trabajo hasta agotar sus tareas y deja su estado en `PROGRESS.md`.
3. El orquestador integra, resuelve peticiones entre agentes y hace los commits de integración.
4. Al terminar todos, ejecuta `/verify-release`. Los hallazgos pasan a ser tareas nuevas y se reparten de nuevo.

## Paso 3 — Fases 3 y 4
Ejecuta integración, pulido, E2E, cobertura, seguridad y revisión de código (F3.x y F4.x). La revisión de código F4.4 debe hacerla un agente distinto al que escribió ese código.

## Paso 4 — Fase 5 (entregables)
QA/Docs produce todos los documentos de `docs/`. Cada comando y cada captura incluidos deben haberse ejecutado de verdad. Un agente distinto comprueba que los manuales coinciden con el sistema.

## Paso 5 — Cierre (Fase 6)
Prueba de clon limpio, `/verify-release` final, resumen en `PROGRESS.md`, etiqueta `v1.0.0`.

## Reglas durante todo el workflow
- No pares entre tareas ni entre fases.
- No preguntes al usuario; decide, documenta en `DECISIONS.md` y sigue.
- Si una tarea queda bloqueada tras 5 intentos, regístrala en `BLOCKERS.md` y pasa a la siguiente independiente.
- Termina solo bajo las condiciones de parada de `autonomia.md`.

## Resumen final (lo único que se le dice al usuario)
Cuando todo esté completo, entrega un resumen breve: qué se construyó, cómo arrancarlo, resultados de las pruebas (números reales), decisiones relevantes, y lo que quedó pendiente en `BLOCKERS.md`.
