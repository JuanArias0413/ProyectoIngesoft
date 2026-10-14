# PROGRESS — SGEC Release 1.0

Bitácora viva. Solo se **agrega** al final de cada sección; no se reescribe el historial.

## Estado actual
- **Fase en curso:** Fase 3 (Integración y pulido)
- **Última tarea completada:** F2.9 (Auth / RBAC por ruta) & Compuerta G2
- **Último commit verde:** f0cbb48
- **Resultado de pruebas:** 779 pruebas pasadas (19 archivos)
- **Siguiente tarea:** F3.1

## Bitácora (una línea por tarea terminada)
`AAAA-MM-DD HH:MM · Fx.y · agente · resumen · hash del commit`
2026-10-13 22:50 · F0.1 · orquestador · Verificación de repositorio, rama release/1.0 y .gitignore · 532dab1
2026-10-13 22:51 · F0.2 · orquestador · Inicialización de proyecto con scripts, TS estricto, ESLint, Prettier y Vitest · 41f26c1
2026-10-13 22:53 · F0.3 · orquestador · Validación de variables de entorno con Zod y gestión de bases de datos · 35c10c8
2026-10-13 22:55 · F0.4 · orquestador · App Express 5, logger pino, helmet, Nunjucks, errores tipados y /health · 6e1bd63
2026-10-13 22:58 · F0.5 · orquestador · Schema Prisma completo, migración btree_gist, tabla session y helper auditoría · 7284a21
2026-10-13 23:02 · F0.6 · orquestador · Auth y RBAC con sesiones postgres, bcryptjs, CSRF, rate limit y middlewares · 56f3f99
2026-10-13 23:03 · F0.7 · orquestador · Seed mínimo 6 roles y utilidades de prueba (db helper, factories, loginAs) · 9a9a333
2026-10-13 23:05 · F1.1 · orquestador · Catálogo con entidades de dominio, repositorios y seed completo §13 · 6579870
2026-10-13 23:10 · F1.2 · orquestador · Estrategia de precios (HourlyPricing, DailyPricing) y utilidad amountToWords con pruebas unitarias · 2a0c816
2026-10-13 23:14 · F1.3 · orquestador · Repositorio de reservas, servicio de disponibilidad (semiabierto A-05) y traducción de 23P01 a ConflictError · bf50bd8
2026-10-13 23:22 · F1.4 · orquestador · Máquina de estados (patrón State), 10 estados, tabla exhaustiva de 618 pruebas y ARCHITECTURE.md · a03fdc1
2026-10-13 23:30 · F2.14 · qa-docs · Borrador de TRAZABILIDAD.md y esqueleto de PROTOCOLO_ACEPTACION.md (37 ACs) · 7b2650e
2026-10-13 23:36 · F2.1 · backend · T1 register, clientes find-or-create, reserva HELD, checklist documental y pruebas AC-01.x · 43de8a1
2026-10-13 23:39 · F2.10 · documentos · Servicio DocumentRenderer, snapshots versionados, plantillas Nunjucks A4 e integración HTTP · 0054b2b
2026-10-13 23:41 · F2.11 · ui · Layout base, navegación por rol, login institucional, dashboard y mensajes flash · cfca816
2026-10-13 23:41 · F2.12 · ui · Pantallas completas con disponibilidad HTMX, listado filtrable, detalle con modales de acción por rol, agenda 30d y tarifas · cfca816
2026-10-13 23:48 · F2.2 · backend · T2 respond con cálculo de tarifa, congelamiento de cotización, radicado y generación de oficio · 4485b54
2026-10-14 00:01 · F2.3 · backend · Documentos del cliente, subida, verificación, T3 verifyDocuments y descarga autenticada · d3a9488
2026-10-14 00:10 · F2.4 · backend · T4 draftContract, edición de objeto/cláusulas, versiones incrementales e imprimibles (CAR-05) · a53d096
2026-10-14 00:19 · F2.5 · backend · T5 registerPayment y T6 submitToLegal con validación de cotización, soporte y transición a revisión jurídica · d96d048
2026-10-14 00:25 · F2.6 · backend · T7 approveLegal, T8 returnLegal y T9 resubmitToLegal con rondas y verificación de 3 checks (CAR-07) · 2207918
2026-10-14 00:32 · F2.7 · backend · T10 signAndNumber atómico (ARR-AAAA-NNNN) y T11 cancel con liberación de reserva y nota A-11 · 1971ffa
2026-10-14 00:41 · F2.8 · backend · Consultas: listado filtrable/paginado y detalle con línea de tiempo y allowedTransitions (CAR-09) · 6959f2f
2026-10-14 00:49 · F2.9 · auth · Permisos por ruta RBAC completos y verificados con 20 intentos no autorizados (CAR-19, AC-19.2) · f0cbb48

## Compuertas
### Compuerta G0 · 2026-10-13 23:03
- **Estado:** PASÓ (Verde)
- **Verificaciones automáticas:**
  - `npm run lint`: 0 errores, 0 advertencias
  - `npm run typecheck`: 0 errores
  - `npm test`: 23 pruebas pasadas en 8 archivos
- **Arranque real:** Servidor levanta en :3000, `GET /health` responde 200 `{ status: "ok" }`.
- **Autenticación:** Sesiones activas en PostgreSQL con tabla `session`, cookies httpOnly y sameSite, rate limiting y CSRF activo. Los 6 roles de usuario del SPEC §8/§13 verificados con contraseña `Cambiar123!`.
- **Hallazgos:** Ninguno. Procediendo a Fase 1.

### Compuerta G1 · 2026-10-13 23:25
- **Estado:** PASÓ (Verde)
- **Verificaciones automáticas:**
  - `npm run lint`: 0 errores, 0 advertencias
  - `npm run typecheck`: 0 errores
  - `npm test`: 679 pruebas pasadas en 13 archivos
  - Cobertura de la máquina de estados (`src/modules/rentals/domain/states`): 98.67% sentencias, 100% funciones, 618 pruebas unitarias table-driven que cubren el 100% de combinaciones (10 estados × 10 transiciones × 6 roles).
- **Pureza arquitectónica:**
  - `src/modules/*/domain`: 0 imports de Express, Prisma, Nunjucks, `fs`. Modelo 100% puro en memoria.
  - La mutación de `status` está encapsulada estrictamente en `RentalContext.transition()`.
  - 0 usos de `any`, 0 `console.log`, 0 `TODO`, 0 pruebas omitidas (`.skip` o `.only`).
- **Contratos congelados:**
  - `RentalContext` y su método `transition(transition, role, payload, actorId)` (D-08).
  - Estrategias de precios `PricingStrategy` (`HourlyPricing`, `DailyPricing`) y `amountToWords` (D-06).
  - Servicios de agenda `AvailabilityService` e interfaz `ReservationRepository` con manejo de `23P01` (D-07).
  - Documentación arquitectónica consolidada en `docs/ARCHITECTURE.md`.
- **Hallazgos:** Ninguno. Dominio núcleo cerrado con éxito. Listo para abordar Fase 2.

### Compuerta G2 · 2026-10-14 00:50
- **Estado:** PASÓ (Verde)
- **Verificaciones automáticas:**
  - `npm run lint`: 0 errores, 0 advertencias
  - `npm run typecheck`: 0 errores
  - `npm test`: 779 pruebas pasadas en 19 archivos
- **Criterio de aceptación de G2:**
  - El flujo completo T1→T10 funciona de extremo a extremo por HTTP y por UI con los 4 roles del flujo:
    1. Auxiliar Administrativo (`ADMIN_ASSISTANT`): registra solicitud T1 (con disponibilidad HTMX y checklist documental), emite respuesta T2 (cotización congelada y oficio), gestiona y verifica documentos del cliente T3, redacta contrato T4 (estudio previo y minuta versionada), registra soporte de pago T5 y radica a jurídica T6.
    2. Asesor Jurídico (`LEGAL`): recibe en su bandeja, revisa los 3 checks obligatorios (estudio previo, minuta, pago), devuelve con observaciones T8 o aprueba concepto jurídico T7 en rondas con historial.
    3. Secretario de Cultura (`SECRETARY`): recibe contrato aprobado, firma y numera atómicamente T10 con consecutivo institucional único anual (`ARR-AAAA-NNNN`), actualizando la reserva de HELD a CONFIRMED.
    4. Jefe de Oficina de Escenarios (`OFFICE_HEAD`): supervisa el listado con filtros, consulta detalle con línea de tiempo, actualiza tarifas y puede cancelar T11 liberando la agenda y registrando la nota de cancelación (A-11).
  - RBAC verificado exhaustivamente a nivel de servidor: 20 intentos de acceso con roles no autorizados devuelven HTTP 403 Forbidden.
  - Documentos imprimibles CSS A4 generados y vinculados en el ciclo de vida: Oficio de Respuesta, Estudio Previo de Oportunidad y Conveniencia, y Minuta del Contrato de Arrendamiento.
- **Hallazgos:** Ninguno. Fase 2 completada satisfactoriamente. Procediendo a Fase 3 (Integración y pulido).

## Peticiones entre agentes
`de → para · petición · estado (abierta/hecha)`
backend → orquestador · Montar createRentalRouter() en src/app.ts · hecha


## Reanudaciones
(Se anota cada uso de `/resume`.)
