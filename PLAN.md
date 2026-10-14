# PLAN — SGEC Release 1.0

Marca `[x]` al terminar cada tarea (y solo si cumple su «Listo cuando»). Las tareas nuevas que descubras se agregan al final de su fase con ID `Fx.y+`. Referencias: `SPEC.md` (§ = sección, `A-xx` = supuesto, `AC-xx` = criterio).

**Compuertas (G0…G5):** al final de cada fase se ejecuta `/verify-release`. No se avanza de fase con una compuerta en rojo.

## Reparto de agentes

| Agente | Responsable de | Carpetas propias (nadie más las toca) |
|---|---|---|
| **Orquestador** | Fases 0 y 1, integración, compuertas, commits en `release/1.0`, `PROGRESS.md` | `prisma/`, `src/shared/`, `src/config/`, `src/container.ts`, `package.json` |
| **Backend** | Casos de uso y repositorios de la Fase 2 | `src/modules/{auth,catalog,agenda,customers,rentals}/**` |
| **Documentos** | Plantillas y render de oficio, estudio previo y contrato | `src/modules/documents/**` |
| **UI** | Vistas, estilos, responsive, accesibilidad | `src/views/**`, `public/**` |
| **QA/Docs** | Pruebas de integración y E2E, documentación y entregables | `tests/**`, `docs/**`, `README.md` |

Reglas de paralelismo: las fases 0 y 1 las hace **solo el orquestador**, en orden. Desde la Fase 2 los agentes trabajan en paralelo respetando las carpetas propias. Si necesitas cambiar un archivo ajeno, no lo edites: anótalo en `PROGRESS.md` como petición para su dueño. Los cambios cruzados (por ejemplo, una columna nueva en `prisma/schema.prisma`) los hace el orquestador. Si el entorno no permite varios agentes, el orquestador ejecuta todo en secuencia siguiendo este mismo orden.

---

## Fase 0 — Base técnica (orquestador, secuencial)

- [x] **F0.1** Clonar/usar el repo `https://github.com/JuanArias0413/ProyectoIngesoft`; crear rama `release/1.0`; copiar `SPEC.md`, `PLAN.md`, `docs/`, `.agent/` si no existen; `.gitignore` (node_modules, dist, .env, storage, coverage, playwright-report). 
  *Listo cuando:* repo con primer commit `chore: bootstrap project`.
- [x] **F0.2** Inicializar proyecto: `.node-version` (22), `package.json` con scripts del §4, TypeScript estricto, ESLint (flat) + Prettier, Vitest, `tsx`. Instalar dependencias del §4.
  *Listo cuando:* `npm run lint`, `typecheck` y `test` (con una prueba trivial) pasan.
- [ ] **F0.3** `config/env.ts` (Zod), `.env.example`, generación de `.env` local detectando `whoami`; crear bases `sgec_dev` y `sgec_test` si no existen (`createdb`).
  *Listo cuando:* `psql "$DATABASE_URL" -c 'select 1'` funciona.
- [ ] **F0.4** App Express 5: `app.ts`/`server.ts`, logger pino con id de petición, `helmet`, manejo central de errores (errores tipados `DomainError`, `ValidationError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `InvalidTransitionError`), páginas 403/404/500, `GET /health`, Nunjucks con layout base, vendor htmx y Pico.css en `public/vendor`.
  *Listo cuando:* `npm run dev` levanta en :3000 y `/health` responde 200.
- [ ] **F0.5** Prisma: `schema.prisma` completo del §6, migración inicial, migración SQL manual (btree_gist + exclusión + tabla `session`), cliente en `infra/prisma.ts`, extensión/helper de auditoría (`createdById/updatedById`).
  *Listo cuando:* `npm run db:migrate` aplica limpio en `sgec_dev` y `sgec_test`.
- [ ] **F0.6** Auth + RBAC: login/logout con sesiones en Postgres, bcryptjs, CSRF, rate limit, `permissions.ts` (mapa del §8), middlewares `requireAuth` y `requirePermission`.
  *Listo cuando:* prueba de integración: login correcto/incorrecto, acceso sin sesión → redirige, rol sin permiso → 403.
- [ ] **F0.7** Seed mínimo (usuarios de los 6 roles) y utilidades de prueba (`tests/helpers`: BD de test, factories, login helper).
  *Listo cuando:* `npm run db:seed` es idempotente y `npm test` usa `sgec_test`.

**G0:** lint + typecheck + tests en verde; `npm run dev` arranca; login funciona con los 6 usuarios.

## Fase 1 — Dominio núcleo (orquestador, secuencial)

- [ ] **F1.1** Catálogo: escenarios, espacios, tarifas y requisitos documentales (repositorios + seed completo del §13).
- [ ] **F1.2** Estrategia de precios (`HourlyPricing`, `DailyPricing`, selección por `unit`) + `amountToWords`.
  *Listo cuando:* pruebas unitarias con casos límite (fracciones de hora, cruce de días, sin tarifa).
- [ ] **F1.3** Agenda: repositorio de reservas, servicio de disponibilidad (rango semiabierto, A-05), traducción del error `23P01` a `ConflictError`.
  *Listo cuando:* pruebas de integración: libre, solapado, contiguo, liberado, y carrera concurrente (dos inserciones simultáneas → una falla).
- [ ] **F1.4** Máquina de estados (patrón State): interfaz, estados concretos, fábrica, contexto, `StateTransition`, ejecución transaccional con efectos desacoplados.
  *Listo cuando:* pruebas table-driven de **todas** las combinaciones estado × transición × rol; cobertura 100% del módulo; documentado en `docs/ARCHITECTURE.md` (borrador con diagrama).

**G1:** compuerta en verde. Congela la forma de `RentalContext` y de los casos de uso (contrato para los demás agentes); anótala en `DECISIONS.md`.

## Fase 2 — Flujo del alquiler (agentes en paralelo)

**Backend**
- [ ] **F2.1** T1 `register` + clientes (find-or-create) + reserva HELD + checklist documental. (CAR-01, AC-01.x)
- [ ] **F2.2** T2 `respond`: cotización congelada + solicitud de generación del oficio. (CAR-03, AC-03.1, 03.3)
- [ ] **F2.3** Documentos del cliente: marcar recibido, adjuntar, verificar; T3 `verifyDocuments`; almacenamiento y descarga autenticada. (CAR-04)
- [ ] **F2.4** T4 `draftContract` + edición de objeto/cláusulas + versiones. (CAR-05)
- [ ] **F2.5** T5 `registerPayment` + T6 `submitToLegal`. (CAR-06)
- [ ] **F2.6** T7, T8, T9: revisión jurídica por rondas. (CAR-07)
- [ ] **F2.7** T10 `signAndNumber` con numeración atómica + T11 `cancel`. (CAR-08, A-11)
- [ ] **F2.8** Consultas: listado filtrable/paginado y detalle con línea de tiempo. (CAR-09)
- [ ] **F2.9** Permisos por ruta completos y verificados (CAR-19, AC-19.2).

**Documentos**
- [ ] **F2.10** Servicio `DocumentRenderer` + snapshot versionado; plantillas oficio, estudio previo y contrato con CSS de impresión A4 y pie del A-13. (AC-03.2, 03.4, 05.1, 05.3)

**UI**
- [ ] **F2.11** Layout, navegación por rol, login, inicio con «pendientes para mí», formularios y mensajes flash.
- [ ] **F2.12** Pantallas: registro (con disponibilidad HTMX), listado, detalle con acciones por rol, agenda, tarifas.

**QA/Docs**
- [ ] **F2.13** Pruebas de integración por cada AC conforme el backend lo entrega (no esperar al final).
- [ ] **F2.14** Borrador de `docs/TRAZABILIDAD.md` (CAR → AC → prueba) y esqueleto de `PROTOCOLO_ACEPTACION.md`.

**G2:** el flujo completo T1→T10 funciona de extremo a extremo por HTTP y por UI con los 4 roles del flujo.

## Fase 3 — Integración y pulido

- [ ] **F3.1** Integrar piezas de los agentes, resolver costuras, eliminar duplicación y código muerto.
- [ ] **F3.2** Responsive real (360 px), foco visible, etiquetas en formularios, contraste suficiente, insignias con texto.
- [ ] **F3.3** Estados vacíos, errores y mensajes en español claros; confirmaciones en acciones irreversibles (firmar, cancelar).
- [ ] **F3.4** Seed demo completo (solicitud en cada estado) y revisión visual de los 3 documentos impresos.

**G3:** compuerta + revisión visual manual de pantallas clave (capturas con Playwright).

## Fase 4 — Calidad y seguridad

- [ ] **F4.1** E2E Playwright: camino feliz (auxiliar, jurídica, secretario; el jefe consulta), devolución de Jurídica, conflicto de agenda, cancelación.
- [ ] **F4.2** Cobertura: unitaria ≥ 85% en dominio; reportar en `docs/`.
- [ ] **F4.3** Revisión de seguridad con lista de verificación: CSRF en todos los POST, autorización en cada ruta, validación Zod en cada entrada, subida de archivos, cabeceras, secretos fuera del repo, `npm audit`.
- [ ] **F4.4** Revisión de código por un agente que **no** escribió ese código (patrón State, capas, nombres, funciones largas, TODOs). Corregir hallazgos.

**G4:** todo en verde, sin hallazgos críticos abiertos.

## Fase 5 — Entregables académicos (QA/Docs)

- [ ] **F5.1** `docs/ARCHITECTURE.md` final: vista de capas, estructura, diagrama de clases del State, diagrama de estados, patrones Repository y Strategy, decisiones y atributos de calidad.
- [ ] **F5.2** `docs/MANUAL_TECNICO.md`.
- [ ] **F5.3** `docs/MANUAL_USUARIO.md` con capturas (Playwright guarda en `docs/img/`).
- [ ] **F5.4** `docs/PROTOCOLO_ACEPTACION.md` completo a partir de los AC (ID, CAR, precondiciones, pasos, resultado esperado, resultado obtenido, firma). Rellenar «resultado obtenido» ejecutando realmente cada caso.
- [ ] **F5.5** `docs/TRAZABILIDAD.md` final, incluyendo tabla de actividades del procedimiento (Visión §2.1) vs. release que las cubre.
- [ ] **F5.6** `docs/EXTENDING.md` y `README.md`.

**G5:** los documentos coinciden con el comportamiento real (verificar comandos y capturas ejecutándolos).

## Fase 6 — Cierre

- [ ] **F6.1** Prueba de clon limpio: clonar en carpeta temporal, `fnm use 22 && npm install && npm run setup && npm run dev`, recorrer el flujo.
- [ ] **F6.2** Ejecutar `/verify-release` completo; actualizar `PROGRESS.md` con el resumen final.
- [ ] **F6.3** Árbol limpio, etiqueta `v1.0.0`, `BLOCKERS.md` actualizado y publicación de la rama si hay credenciales.
