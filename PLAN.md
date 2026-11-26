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
- [x] **F0.3** `config/env.ts` (Zod), `.env.example`, generación de `.env` local detectando `whoami`; crear bases `sgec_dev` y `sgec_test` si no existen (`createdb`).
  *Listo cuando:* `psql "$DATABASE_URL" -c 'select 1'` funciona.
- [x] **F0.4** App Express 5: `app.ts`/`server.ts`, logger pino con id de petición, `helmet`, manejo central de errores (errores tipados `DomainError`, `ValidationError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `InvalidTransitionError`), páginas 403/404/500, `GET /health`, Nunjucks con layout base, vendor htmx y Pico.css en `public/vendor`.
  *Listo cuando:* `npm run dev` levanta en :3000 y `/health` responde 200.
- [x] **F0.5** Prisma: `schema.prisma` completo del §6, migración inicial, migración SQL manual (btree_gist + exclusión + tabla `session`), cliente en `infra/prisma.ts`, extensión/helper de auditoría (`createdById/updatedById`).
  *Listo cuando:* `npm run db:migrate` aplica limpio en `sgec_dev` y `sgec_test`.
- [x] **F0.6** Auth + RBAC: login/logout con sesiones en Postgres, bcryptjs, CSRF, rate limit, `permissions.ts` (mapa del §8), middlewares `requireAuth` y `requirePermission`.
  *Listo cuando:* prueba de integración: login correcto/incorrecto, acceso sin sesión → redirige, rol sin permiso → 403.
- [x] **F0.7** Seed mínimo (usuarios de los 6 roles) y utilidades de prueba (`tests/helpers`: BD de test, factories, login helper).
  *Listo cuando:* `npm run db:seed` es idempotente y `npm test` usa `sgec_test`.

**G0:** lint + typecheck + tests en verde; `npm run dev` arranca; login funciona con los 6 usuarios.

## Fase 1 — Dominio núcleo (orquestador, secuencial)

- [x] **F1.1** Catálogo: escenarios, espacios, tarifas y requisitos documentales (repositorios + seed completo del §13).
- [x] **F1.2** Estrategia de precios (`HourlyPricing`, `DailyPricing`, selección por `unit`) + `amountToWords`.
  *Listo cuando:* pruebas unitarias con casos límite (fracciones de hora, cruce de días, sin tarifa).
- [x] **F1.3** Agenda: repositorio de reservas, servicio de disponibilidad (rango semiabierto, A-05), traducción del error `23P01` a `ConflictError`.
  *Listo cuando:* pruebas de integración: libre, solapado, contiguo, liberado, y carrera concurrente (dos inserciones simultáneas → una falla).
- [x] **F1.4** Máquina de estados (patrón State): interfaz, estados concretos, fábrica, contexto, `StateTransition`, ejecución transaccional con efectos desacoplados.
  *Listo cuando:* pruebas table-driven de **todas** las combinaciones estado × transición × rol; cobertura 100% del módulo; documentado en `docs/ARCHITECTURE.md` (borrador con diagrama).

**G1:** compuerta en verde. Congela la forma de `RentalContext` y de los casos de uso (contrato para los demás agentes); anótala en `DECISIONS.md`.

## Fase 2 — Flujo del alquiler (agentes en paralelo)

**Backend**
- [x] **F2.1** T1 `register` + clientes (find-or-create) + reserva HELD + checklist documental. (CAR-01, AC-01.x)
- [x] **F2.2** T2 `respond`: cotización congelada + solicitud de generación del oficio. (CAR-03, AC-03.1, 03.3)
- [x] **F2.3** Documentos del cliente: marcar recibido, adjuntar, verificar; T3 `verifyDocuments`; almacenamiento y descarga autenticada. (CAR-04)
- [x] **F2.4** T4 `draftContract` + edición de objeto/cláusulas + versiones. (CAR-05)
- [x] **F2.5** T5 `registerPayment` + T6 `submitToLegal`. (CAR-06)
- [x] **F2.6** T7, T8, T9: revisión jurídica por rondas. (CAR-07)
- [x] **F2.7** T10 `signAndNumber` con numeración atómica + T11 `cancel`. (CAR-08, A-11)
- [x] **F2.8** Consultas: listado filtrable/paginado y detalle con línea de tiempo. (CAR-09)
- [x] **F2.9** Permisos por ruta completos y verificados (CAR-19, AC-19.2).

**Documentos**
- [x] **F2.10** Servicio `DocumentRenderer` + snapshot versionado; plantillas oficio, estudio previo y contrato con CSS de impresión A4 y pie del A-13. (AC-03.2, 03.4, 05.1, 05.3)

**UI**
- [x] **F2.11** Layout, navegación por rol, login, inicio con «pendientes para mí», formularios y mensajes flash.
- [x] **F2.12** Pantallas: registro (con disponibilidad HTMX), listado, detalle con acciones por rol, agenda, tarifas.

**QA/Docs**
- [x] **F2.13** Pruebas de integración por cada AC conforme el backend lo entrega (no esperar al final).
- [x] **F2.14** Borrador de `docs/TRAZABILIDAD.md` (CAR → AC → prueba) y esqueleto de `PROTOCOLO_ACEPTACION.md`.

**G2:** el flujo completo T1→T10 funciona de extremo a extremo por HTTP y por UI con los 4 roles del flujo.

## Fase 3 — Integración y pulido

- [x] **F3.1** Integrar piezas de los agentes, resolver costuras, eliminar duplicación y código muerto.
- [x] **F3.2** Responsive real (360 px), foco visible, etiquetas en formularios, contraste suficiente, insignias con texto.
- [x] **F3.3** Estados vacíos, errores y mensajes en español claros; confirmaciones en acciones irreversibles (firmar, cancelar).
- [x] **F3.4** Seed demo completo (solicitud en cada estado) y revisión visual de los 3 documentos impresos.

**G3:** compuerta + revisión visual manual de pantallas clave (capturas con Playwright).

## Fase 4 — Calidad y seguridad

- [x] **F4.1** E2E Playwright: camino feliz (auxiliar, jurídica, secretario; el jefe consulta), devolución de Jurídica, conflicto de agenda, cancelación.
- [x] **F4.2** Cobertura: unitaria ≥ 85% en dominio; reportar en `docs/`.
- [x] **F4.3** Revisión de seguridad con lista de verificación: CSRF en todos los POST, autorización en cada ruta, validación Zod en cada entrada, subida de archivos, cabeceras, secretos fuera del repo, `npm audit`.
- [x] **F4.4** Revisión de código por un agente que **no** escribió ese código (patrón State, capas, nombres, funciones largas, TODOs). Corregir hallazgos.

**G4:** todo en verde, sin hallazgos críticos abiertos.

## Fase 5 — Entregables académicos (QA/Docs)

- [x] **F5.1** `docs/ARCHITECTURE.md` final: vista de capas, estructura, diagrama de clases del State, diagrama de estados, patrones Repository y Strategy, decisiones y atributos de calidad.
- [x] **F5.2** `docs/MANUAL_TECNICO.md`.
- [x] **F5.3** `docs/MANUAL_USUARIO.md` con capturas (Playwright guarda en `docs/img/`).
- [x] **F5.4** `docs/PROTOCOLO_ACEPTACION.md` completo a partir de los AC (ID, CAR, precondiciones, pasos, resultado esperado, resultado obtenido, firma). Rellenar «resultado obtenido» ejecutando realmente cada caso.
- [x] **F5.5** `docs/TRAZABILIDAD.md` final, incluyendo tabla de actividades del procedimiento (Visión §2.1) vs. release que las cubre.
- [x] **F5.6** `docs/EXTENDING.md` y `README.md`.

**G5:** los documentos coinciden con el comportamiento real (verificar comandos y capturas ejecutándolos).

## Fase 6 — Cierre

- [x] **F6.1** Prueba de clon limpio: clonar en carpeta temporal, `fnm use 22 && npm install && npm run setup && npm run dev`, recorrer el flujo.
- [x] **F6.2** Ejecutar `/verify-release` completo; actualizar `PROGRESS.md` con el resumen final.
- [x] **F6.3** Árbol limpio, etiqueta `v1.0.0`, `BLOCKERS.md` actualizado y publicación de la rama si hay credenciales.

## Fase 7 — Rediseño Frontend e Identidad Visual de Pereira

- [x] **F7.1** Corrección de bugs frontend críticos:
  - Eliminar contenedores de alerta vacíos en `src/views/partials/flash.njk` validando `.length > 0` tanto para colecciones como para strings.
  - Forzar `data-theme="light"` en `src/views/layouts/base.njk` para evitar colisión de estilos oscuros de Pico.css con el tema de la aplicación.
  - Eliminar franjas oscuras en encabezados `<article > header>` y restablecer contraste en inputs y tablas.
- [x] **F7.2** Sistema de diseño institucional de Pereira en `public/css/app.css`:
  - Paleta cívica equilibrada: Rojo Pereirano (`#cf1020` / `#dc2626`), Amarillo/Oro Pereirano (`#f59e0b` / `#d97706`), neutros modernos (Slate `#0f172a`, `#334155`, `#e2e8f0`, `#f8fafc`), y acentos funcionales (Verde esmeralda y Azul corporativo).
  - Listón cívico Pereira (`linear-gradient(90deg, #cf1020 50%, #f59e0b 50%)`) de 4px en cabecera institucional.
  - Restablecimiento tipográfico y de componentes: botones primarios en Rojo Cívico con hover suave, enlaces y focos con contraste WCAG AAA, tarjetas con elevación sutil.
  - Tablas pulidas: cabeceras con fondo neutro `#f1f5f9`, texto `#475569`, filas uniformes sin rayas oscuras y hover `#f8fafc`.
- [x] **F7.3** Rediseño de pantalla de Inicio de Sesión (`src/views/pages/auth/login.njk`):
  - Tarjeta moderna centrada con borde superior cívico, isotipo institucional, inputs accesibles con foco claro y botón de acción cívico.
  - Selector plegable elegante para usuarios semilla con tipografía monospace limpia y fondo neutro.
- [x] **F7.4** Rediseño del Panel Principal (`src/views/pages/home/index.njk`):
  - Tarjetas de estadísticas con indicadores cívicos diferenciados (Rojo, Oro, Verde, Slate).
  - Bandeja "Pendientes para mí" rediseñada con estado vacío amigable, badges estandarizados y acciones directas.
- [x] **F7.5** Rediseño de Vistas de Solicitudes, Agenda y Tarifas:
  - Listado de solicitudes (`solicitudes/index.njk`): barra de búsqueda y filtros modernizada, paginación integrada y badges cívicos.
  - Detalle de solicitud (`solicitudes/detalle.njk`): línea de tiempo con nodos institucionales, pestañas/secciones limpias, acciones agrupadas con modales nativos.
  - Agenda (`agenda/index.njk`) y Tarifas (`tarifas/index.njk`): tablas claras, legibles y adaptadas a móvil.
- [x] **F7.6** Verificación integral y actualización de capturas:
  - Tests unitarios de vistas (`uiViews.test.ts`), lint, typecheck y tests de integración/E2E.
  - Regeneración de capturas de pantalla en `docs/img/` reflejando el nuevo diseño.
  - Registro de decisiones en `DECISIONS.md` y actualización en `PROGRESS.md`.

**G7:** Interfaz visualmente atractiva, armónica con la identidad de Pereira, sin errores visuales de contraste ni alertas vacías, 100% accesible y suite de tests en verde.


