# Matriz de Trazabilidad — SGEC Release 1.0

Borrador inicial elaborado en Fase 2 (F2.14). Se completará y verificará de forma integral en Fase 5 (F5.5).

---

## 1. CAR → AC → Prueba

Mapeo exhaustivo de las características incluidas en el Release 1.0, sus criterios de aceptación y las pruebas correspondientes (unitarias, integración y E2E).

| CAR | AC | Descripción | Tipo prueba | Archivo | Test ID / Nombre |
|---|---|---|---|---|---|
| CAR-01 | AC-01.1 | Auxiliar registra solicitud válida → estado `REGISTERED`, reserva `HELD`, visible en agenda | Integración | `tests/integration/rentalFlow.test.ts` | `AC-01.1: Auxiliar registra solicitud válida` |
| CAR-01 | AC-01.2 | Misma cédula/NIT del cliente → reutiliza cliente (no duplica) y actualiza contacto | Integración | `tests/integration/rentalFlow.test.ts` | `AC-01.2: Reutiliza cliente existente por documento sin duplicar` |
| CAR-01 | AC-01.3 | Rango horario inválido (fin <= inicio, <1h, >7d, en el pasado) → error 400 con mensaje claro | Integración | `tests/integration/rentalFlow.test.ts` | `AC-01.3: Rechaza rango horario inválido con 400 y mensaje en español` |
| CAR-01 | AC-01.4 | Rango solapado con reserva activa del mismo espacio → error 409 conflicto | Integración | `tests/integration/rentalFlow.test.ts` | `AC-01.4: Rechaza solicitud con rango solapado con 409` |
| CAR-01 | AC-01.5 | Registro con radicado inicial guarda radicado; sin radicado no falla | Integración | `tests/integration/rentalFlow.test.ts` | `AC-01.5: Radicado opcional en registro se persiste si se informa` |
| CAR-02 | AC-02.1 | Consulta de disponibilidad por espacio, fecha y franja → libre / no libre con detalle de bloqueo | Integración | `tests/integration/rentalFlow.test.ts` | `AC-02.1: GET /agenda/disponibilidad responde disponibilidad y reserva bloqueante` |
| CAR-02 | AC-02.2 | Consulta de disponibilidad asíncrona mediante HTMX en formulario de registro sin recargar | E2E | `tests/e2e/rentalFlow.spec.ts` | `AC-02.2: Verificación de disponibilidad HTMX en formulario` |
| CAR-02 | AC-02.3 | Reservas liberadas (`RELEASED`) o franjas contiguas no bloquean disponibilidad | Integración | `tests/integration/agenda.test.ts` | `AC-02.3: Franjas contiguas y reservas RELEASED no generan conflicto` |
| CAR-02 | AC-02.4 | Vista de agenda por escenario con listado de próximos 30 días de solo lectura | Integración | `tests/integration/rentalFlow.test.ts` | `AC-02.4: GET /agenda lista reservas del mes por escenario` |
| CAR-03 | AC-03.1 | Auxiliar responde con radicado → calcula tarifa, congela valor (A-08) y genera oficio | Integración | `tests/integration/rentalFlow.test.ts` | `AC-03.1: T2 respond calcula valor, congela y genera snapshot oficio` |
| CAR-03 | AC-03.2 | Contenido completo del oficio: datos, requisitos según cliente, valor en letras y números | Integración | `tests/integration/rentalFlow.test.ts` | `AC-03.2: Oficio contiene requisitos, valor en letras y datos bancarios` |
| CAR-03 | AC-03.3 | Transición T2 sin radicado o sin tarifa vigente → rechaza con error 400 | Integración | `tests/integration/rentalFlow.test.ts` | `AC-03.3: T2 sin radicado o sin tarifa vigente responde 400` |
| CAR-03 | AC-03.4 | Oficio imprimible en formato A4 con pie de página institucional A-13 | Integración | `tests/integration/rentalFlow.test.ts` | `AC-03.4: GET /solicitudes/:id/documentos/RESPONSE_LETTER renderiza A4` |
| CAR-04 | AC-04.1 | Checklist documental autogenerado al registrar según tipo de cliente (NATURAL / LEGAL) | Integración | `tests/integration/rentalFlow.test.ts` | `AC-04.1: Checklist de documentos se genera según tipo de cliente` |
| CAR-04 | AC-04.2 | Auxiliar marca recibido, adjunta archivo permitido (<=5MB) y verifica documento | Integración | `tests/integration/rentalFlow.test.ts` | `AC-04.2: Marcar recibido, adjuntar soporte y verificar documento` |
| CAR-04 | AC-04.3 | Carga de archivo con tipo no permitido o tamaño superior a 5 MB → rechaza con 400 | Integración | `tests/integration/rentalFlow.test.ts` | `AC-04.3: Rechazo de archivo inválido o mayor a 5MB` |
| CAR-04 | AC-04.4 | Transición T3 `verifyDocuments` con documento obligatorio sin verificar → rechaza 400 | Integración | `tests/integration/rentalFlow.test.ts` | `AC-04.4: T3 bloqueada si existen documentos obligatorios sin verificar` |
| CAR-04 | AC-04.5 | Descarga de archivos adjuntos solo accesible con sesión activa y permiso | Integración | `tests/integration/rentalFlow.test.ts` | `AC-04.5: GET /archivos/:key sin sesión responde 401/302` |
| CAR-05 | AC-05.1 | Transición T4 `draftContract` genera contrato y estudio previo (v1) con snapshot | Integración | `tests/integration/rentalFlow.test.ts` | `AC-05.1: T4 draftContract crea contrato, estudio previo y snapshot` |
| CAR-05 | AC-05.2 | Edición de `object` y `additionalClauses` genera nueva versión del documento | Integración | `tests/integration/rentalFlow.test.ts` | `AC-05.2: Edición de cláusulas genera versión incremental de contrato` |
| CAR-05 | AC-05.3 | Estudio previo y contrato renderizan con diseño A4 y pie académico A-13 | Integración | `tests/integration/rentalFlow.test.ts` | `AC-05.3: Estudio previo y contrato tienen formato imprimible A4` |
| CAR-06 | AC-06.1 | Registro de pago con recibo, banco, consignación, factura y soporte → estado `PAID` | Integración | `tests/integration/rentalFlow.test.ts` | `AC-06.1: T5 registerPayment con campos requeridos actualiza a PAID` |
| CAR-06 | AC-06.2 | Monto consignado diferente al valor cotizado congelado → rechaza 400 explicando diferencia | Integración | `tests/integration/rentalFlow.test.ts` | `AC-06.2: Monto diferente a cotización rechaza con 400 y detalle de discrepancia` |
| CAR-06 | AC-06.3 | Tras registrar pago exitoso, la solicitud pasa a estado `PAID` | Unitaria / Int | `tests/unit/rentalState.test.ts` | `AC-06.3: Transición T5 actualiza status a PAID` |
| CAR-07 | AC-07.1 | Auxiliar remite a Jurídica (T6); usuario Jurídica visualiza bandeja en revisión | Integración | `tests/integration/rentalFlow.test.ts` | `AC-07.1: T6 submitToLegal remite a jurídica y aparece en bandeja` |
| CAR-07 | AC-07.2 | Jurídica aprueba marcando las 3 verificaciones obligatorias → `PENDING_SIGNATURE` | Integración | `tests/integration/rentalFlow.test.ts` | `AC-07.2: T7 approveLegal con 3 checks avanza a PENDING_SIGNATURE` |
| CAR-07 | AC-07.3 | Jurídica devuelve con observación (>=10 car) → `RETURNED_BY_LEGAL`; auxiliar ve observación | Integración | `tests/integration/rentalFlow.test.ts` | `AC-07.3: T8 returnLegal devuelve con observación y registra ronda` |
| CAR-07 | AC-07.4 | Intento de aprobación/devolución por rol no-legal → error 403 Prohibido | Integración | `tests/integration/rentalFlow.test.ts` | `AC-07.4: Usuario sin rol LEGAL recibe 403 al intentar revisar` |
| CAR-08 | AC-08.1 | Secretario firma (T10); contrato recibe número `ARR-AAAA-NNNN` atómico y consecutivo | Integración | `tests/integration/rentalFlow.test.ts` | `AC-08.1: T10 signAndNumber asigna consecutivo anual ARR-YYYY-NNNN` |
| CAR-08 | AC-08.2 | Estado `LEGALIZED`, reserva `CONFIRMED`, contrato y snapshots finales inmutables | Integración | `tests/integration/rentalFlow.test.ts` | `AC-08.2: Firma legaliza trámite, confirma reserva e inmoviliza contrato` |
| CAR-08 | AC-08.3 | Dos firmas concurrentes (`Promise.all`) nunca asignan el mismo número consecutivo | Integración | `tests/integration/rentalFlow.test.ts` | `AC-08.3: Firmas concurrentes garantizan números consecutivos únicos` |
| CAR-09 | AC-09.1 | Listado de solicitudes con filtro de estado, búsqueda por texto y paginación | Integración | `tests/integration/rentalFlow.test.ts` | `AC-09.1: GET /solicitudes soporta filtros, búsqueda y paginación` |
| CAR-09 | AC-09.2 | Detalle de solicitud muestra línea de tiempo (`StateTransition`), documentos y pagos | Integración | `tests/integration/rentalFlow.test.ts` | `AC-09.2: GET /solicitudes/:id expone historial de transiciones y soportes` |
| CAR-09 | AC-09.3 | Detalle muestra únicamente las acciones disponibles para el rol y estado actual | Integración | `tests/integration/rentalFlow.test.ts` | `AC-09.3: Acciones restringidas en interfaz según rol autenticado` |
| CAR-19 | AC-19.1 | Autenticación con email/password, logout y expiración de sesión por inactividad | Integración | `tests/integration/auth.test.ts` | `AC-19.1: Login, logout y expiración de sesión` |
| CAR-19 | AC-19.2 | Verificación de autorización en servidor: rol sin permiso recibe 403 en cada ruta protegida | Integración | `tests/integration/rentalFlow.test.ts` | `AC-19.2: Rutas protegidas responden 403 ante rol sin autorización` |
| CAR-19 | AC-19.3 | Token CSRF requerido en peticiones POST y limitador de intentos de login | Integración | `tests/integration/auth.test.ts` | `AC-19.3: Protección CSRF y rate limit en endpoints POST` |

---

## 2. Actividades del procedimiento vs. Release

Cruce entre las actividades descritas en la sección §2.1 del documento de Visión y Alcance (`docs/Vision_y_Alcance_SGEC_Escenarios_v1_0.md`) y el release que las cubre:

| Actividad del procedimiento (Visión §2.1) | Release 1.0 | Release 2.0 | Release 3.0 | Módulos / CAR asociados |
|---|:---:|:---:|:---:|---|
| **Procedimiento 1: Alquiler de Escenarios Culturales** | | | | |
| Recepción de solicitud (verbal, escrita, correo) y registro en agenda digital | **X** | | | CAR-01, CAR-02 |
| Consulta de disponibilidad de escenarios y validación de franjas horarias | **X** | | | CAR-02 |
| Respuesta al cliente informando requisitos y valor a consignar (Tarifas + SAIA) | **X** | | | CAR-03 |
| Recepción y verificación de documentos exigidos al arrendatario | **X** | | | CAR-04 |
| Elaboración del estudio previo y contrato de arrendamiento | **X** | | | CAR-05 |
| Registro de recibo de pago, comprobante bancario y factura | **X** | | | CAR-06 |
| Revisión jurídica de documentación, arrendatario y clausulado normativo | **X** | | | CAR-07 |
| Firma del Secretario de Cultura y asignación de consecutivo (legalización) | **X** | | | CAR-08 |
| Consulta y seguimiento del estado de cada solicitud y contrato en trámite | **X** | | | CAR-09 |
| Programación de reservas y asignación de personal de acompañamiento logístico | | **X** | | CAR-10 |
| Registro del acta de entrega previa y acta de recibo posterior (estado físico) | | **X** | | CAR-11 |
| Aplicación y registro de encuesta de satisfacción del cliente | | **X** | | CAR-12 |
| Control de relación de entradas, registro de asistentes, ingresos y préstamos | | **X** | | CAR-13 |
| Generación de informes consolidados de ingresos, entradas y eventos sociales | | **X** | | CAR-14 |
| Trazabilidad de creación y modificación de registros (auditoría usuario/fecha) | Cimiento | **X** | | CAR-20 |
| **Procedimiento 2: Mantenimiento Preventivo y Correctivo** | | | | |
| Radicación de solicitudes de mantenimiento (canales SAIA, correo, teléfono) | | | **X** | CAR-15 |
| Clasificación de solicitudes (ejecución interna vs. elevación a otra dependencia) | | | **X** | CAR-16 |
| Registro de ejecución de mantenimiento y archivo de soporte fotográfico | | | **X** | CAR-17 |
| Programación y registro de revisiones periódicas de equipos e infraestructura crítica | | | **X** | CAR-18 |
| **Transversal: Seguridad y Perfiles** | | | | |
| Gestión de perfiles y permisos por rol (RBAC) conforme al procedimiento | **X** | **X** | **X** | CAR-19 |
