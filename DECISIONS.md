# DECISIONS — Registro de decisiones (ADR ligero)

Formato: `D-nn · fecha · contexto · decisión · alternativas · consecuencias`. Las decisiones técnicas relevantes de este proyecto alimentan `docs/ARCHITECTURE.md`.

## D-01 · 2026-10-13 · Estilo arquitectónico
- **Contexto:** proyecto académico de un solo desarrollador, MVP local, un único módulo del manual.
- **Decisión:** monolito modular en capas (presentación, aplicación, dominio, infraestructura), un solo proceso.
- **Alternativas:** microservicios (exceso de complejidad), NestJS (más pesado), SPA + API separada (dos procesos, CORS).
- **Consecuencias:** despliegue simple; los módulos quedan listos para crecer con los Releases 2.0 y 3.0.

## D-02 · 2026-10-13 · Patrón de diseño principal: State
- **Contexto:** el contrato atraviesa estados con reglas, roles y efectos distintos en cada uno.
- **Decisión:** State para el ciclo de vida de la solicitud/contrato; Repository para persistencia; Strategy para tarifas.
- **Alternativas:** `switch` por estado en servicios (rígido y propenso a errores), librería de máquinas de estado (oculta el patrón que el curso pide mostrar).
- **Consecuencias:** agregar un estado o transición toca pocos archivos; la máquina es 100% testeable sin BD.

## D-03 · 2026-10-13 · Interfaz con renderizado en servidor
- **Decisión:** Nunjucks + HTMX + Pico.css servidos localmente.
- **Alternativas:** React + Vite (más piezas), Next.js (mezcla capas).
- **Consecuencias:** un solo proceso, sin build de frontend, funciona sin internet.

## D-04 · 2026-10-13 · Anti-cruces en la base de datos
- **Decisión:** restricción de exclusión de PostgreSQL (`btree_gist` + `tstzrange`) además de la comprobación en el servicio.
- **Consecuencias:** garantiza ON-3 incluso con peticiones concurrentes.

## D-05 · 2026-10-13 · Supuestos por ausencia del Manual de Procedimientos
- **Decisión:** los supuestos A-01 a A-15 de `SPEC.md` sustituyen al manual. Formatos y tarifas son de ejemplo, claramente marcados.

## Decisiones del agente
## D-06 · 2026-10-13 · Estrategias de precios y conversión de montos a palabras
- **Contexto:** el Acuerdo de Tarifas fija cobros por hora o por día para eventos lucrativos y sin ánimo de lucro (A-07). La generación de oficios y contratos exige montos en letras (A-12).
- **Decisión:** `HourlyPricing` redondea fracciones hacia arriba por hora (`Math.ceil(diffMs / 3600000)`, mínimo 1 hora), admitiendo cruces de medianoche. `DailyPricing` factura bloques de 24 horas o fracción (`Math.ceil(diffHours / 24)`, mínimo 1 día) para no penalizar eventos nocturnos que concluyen en la madrugada del día siguiente. `amountToWords` implementa la gramática RAE (incluyendo la regla de «de pesos» para millones redondos) con sufijo predeterminado «pesos M/CTE» y rechazo estricto de negativos y decimales.
- **Alternativas:** cálculo de días por calendario local (castigaría con doble día un evento de 8 horas que termine a las 2 AM); usar librerías externas de números a letras (introducen dependencias innecesarias con acentos o formatos no colombianos).
- **Consecuencias:** cálculo exacto, predecible y testeable sin dependencias de base de datos ni de red.

## D-07 · 2026-10-13 · Detección de solapamiento y traducción de 23P01 en Agenda
- **Contexto:** dos reservas activas no pueden solaparse en el mismo espacio (A-05). La restricción de exclusión en Postgres (`reservation_no_overlap`) protege la base de datos contra condiciones de carrera.
- **Decisión:** `PrismaReservationRepository` y `AvailabilityService` operan sobre el rango semiabierto `[startsAt, endsAt)` mediante `startsAt < queryEnd AND endsAt > queryStart` filtrando únicamente estados activos (`HELD`, `CONFIRMED`), permitiendo franjas contiguas e ignorando reservas `RELEASED`. El repositorio inspecciona errores de base de datos capturando el código PostgreSQL `23P01`, `P2002` o menciones a la restricción de exclusión para transformarlos en `ConflictError` (HTTP 409). Se fijó `fileParallelism: false` en Vitest para aislar suites de integración sobre `sgec_test`.
- **Alternativas:** depender únicamente de validación en aplicación (vulnerable a concurrencia); bloqueos de tabla pesados.
- **Consecuencias:** garantiza el objetivo ON-3 sin condiciones de carrera y con mensajes amigables para el usuario.


