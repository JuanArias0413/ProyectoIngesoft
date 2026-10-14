# SPEC — SGEC Release 1.0 (Trámite de alquiler y contrato)

> Fuente de verdad funcional: `docs/Vision_y_Alcance_SGEC_Escenarios_v1_0.md`.
> Este SPEC la concreta en decisiones técnicas y criterios de aceptación. Si hay conflicto, gana el documento de Visión; registra la discrepancia en `DECISIONS.md`.

---

## 1. Contexto

SGEC es el Sistema de Gestión de Escenarios y Bienes Culturales de la Secretaría de Cultura de Pereira. Es un proyecto académico (curso de Arquitectura de Software) de un solo estudiante desarrollador. El Manual de Procedimientos original **no está disponible**: todo lo que el documento de Visión no define se resuelve con los supuestos de la sección 3.

**Objetivo del Release 1.0:** un MVP funcional que corre 100% en localhost y permite tramitar un alquiler de escenario de punta a punta: desde registrar la solicitud hasta dejar el contrato firmado y numerado (legalizado). Debe quedar preparado para añadir los Releases 2.0 y 3.0 sin reescribir.

**Criterios del curso:** (a) software funcional, (b) al menos un patrón de diseño correctamente implementado y documentado. El patrón principal es **State** (ciclo de vida del contrato).

---

## 2. Alcance

### 2.1 Incluido en 1.0

| Prioridad | Característica |
|---|---|
| MUST | CAR-01 Registrar solicitud de alquiler (verbal, escrita, correo) y dejarla en agenda |
| MUST | CAR-02 Consultar disponibilidad por escenario, fecha y franja |
| MUST | CAR-03 Generar oficio de respuesta con requisitos y valor a consignar |
| MUST | CAR-04 Registrar y verificar documentos exigidos al cliente |
| MUST | CAR-05 Elaborar estudio previo y contrato de arrendamiento |
| MUST | CAR-06 Registrar recibo de pago, comprobante de consignación y factura |
| MUST | CAR-07 Flujo de revisión jurídica |
| MUST | CAR-08 Firma del Secretario y numeración (estado legalizado) |
| MUST | CAR-09 Consultar estado de cada solicitud/contrato |
| MUST | CAR-19 Perfiles de usuario (RBAC) |
| SHOULD | Pantalla para que el Jefe de Oficina consulte y edite tarifas vigentes |

### 2.2 Excluido de 1.0 (NO construir)

CAR-10 a CAR-14 (Release 2.0) y CAR-15 a CAR-18 (Release 3.0). Tampoco: pago en línea, portal para clientes externos, gestión de usuarios por interfaz (los usuarios se crean por seed), integración real con SAIA, envío real de correos, dashboards, IA.

### 2.3 Preparación obligatoria para 2.0 y 3.0 (solo cimientos, sin funcionalidad)

- Todos los roles ya existen (incluidos técnico operativo y técnico de mantenimiento) con usuarios semilla.
- Todas las tablas de negocio llevan `createdAt`, `updatedAt`, `createdById`, `updatedById`, rellenados automáticamente (cimiento de CAR-20).
- `Reservation` ya es entidad propia, separada de la solicitud (base de CAR-10).
- Estructura modular por carpetas: agregar un módulo nuevo no debe tocar los existentes salvo el registro de rutas y la navegación.
- `docs/EXTENDING.md` explica paso a paso cómo añadir un módulo, un estado, un rol y un documento generado.

---

## 3. Supuestos (el agente debe respetarlos y citarlos como `A-xx`)

| ID | Supuesto |
|---|---|
| A-01 | Solo personal interno inicia sesión. El auxiliar registra todo a nombre del cliente. |
| A-02 | El número de radicado lo genera SAIA (externo). El sistema solo lo registra. Es opcional al registrar la solicitud y **obligatorio** al marcar la solicitud como respondida. |
| A-03 | El número de contrato se asigna al firmar, con formato `ARR-{AÑO}-{CONSECUTIVO 4 dígitos}` (ej. `ARR-2026-0001`), consecutivo reiniciado cada año, asignado de forma atómica. |
| A-04 | Registrar la solicitud crea una **reserva provisional** (HELD) que bloquea el espacio. Se confirma (CONFIRMED) al legalizar y se libera (RELEASED) al cancelar. No hay vencimiento automático de reservas provisionales en 1.0. |
| A-05 | Dos reservas activas (HELD o CONFIRMED) no pueden solaparse en el mismo espacio. Rango semiabierto `[inicio, fin)`: terminar a las 14:00 y empezar a las 14:00 no es conflicto. |
| A-06 | Duración máxima de una reserva: 7 días. Mínima: 1 hora. Debe empezar en el futuro al registrarse. |
| A-07 | El valor se calcula con el Acuerdo de Tarifas (datos de ejemplo, ficticios) según espacio, propósito del evento (lucrativo / sin ánimo de lucro) y unidad de cobro (por hora o por día). |
| A-08 | El valor cotizado se congela al responder (snapshot) y el pago debe ser exactamente ese valor. |
| A-09 | Los documentos exigidos al cliente dependen de su tipo (persona natural / persona jurídica). La lista es de ejemplo y vive en base de datos. |
| A-10 | La revisión jurídica tiene 3 verificaciones obligatorias (ver CAR-07). Si Jurídica devuelve el contrato, este vuelve al auxiliar con observaciones y se reenvía; el historial se conserva. |
| A-11 | Cancelar es posible desde cualquier estado no terminal. Cancelar después del pago solo deja una nota de que podría requerir devolución (fuera del alcance). |
| A-12 | Moneda COP en pesos enteros. Fechas guardadas en UTC (`timestamptz`) y mostradas en `America/Bogota`. |
| A-13 | Los formatos (oficio, estudio previo, contrato) son **de ejemplo**: redacción formal verosímil, sin logos, escudos ni firmas reales, sin números de artículos ni de actos administrativos inventados. Cada documento lleva un pie discreto: «Formato generado por SGEC — proyecto académico». |
| A-14 | Los archivos adjuntos (PDF/JPG/PNG, máx. 5 MB) se guardan en disco local en `storage/` (fuera de `public/`) y solo se sirven por una ruta autenticada. |
| A-15 | Los documentos generados se guardan como **snapshot HTML** al generarse (no se recalculan), con versión incremental. |

---

## 4. Stack y convenciones

| Aspecto | Decisión |
|---|---|
| Runtime | Node 22 (fnm). Archivo `.node-version` con `22`. |
| Lenguaje | TypeScript estricto (`"strict": true`, sin `any` salvo justificación comentada). ESM. |
| Dev runner | `tsx` (`npm run dev` = `tsx watch src/server.ts`). Build con `tsc`. |
| Web | Express 5 (los errores async se propagan solos), `helmet`, `express-session` + `connect-pg-simple`, `csrf-csrf` (u otra protección CSRF equivalente), `express-rate-limit` en login, `multer` para archivos, `pino` para logs. |
| Vistas | Nunjucks (render en servidor) + HTMX (actualizaciones parciales) + Pico.css. Dependencias instaladas por npm y servidas desde `public/vendor` (sin CDN, debe funcionar sin internet). Responsive para móvil. |
| BD | PostgreSQL 17 local. Bases `sgec_dev` y `sgec_test`. |
| ORM | Prisma (fijar versión estable actual; verificar que `migrate dev` y `generate` funcionan antes de seguir). SQL crudo permitido solo en migraciones y en la consulta de numeración. |
| Validación | Zod en la frontera HTTP y para variables de entorno. |
| Contraseñas | `bcryptjs` (sin binarios nativos). |
| Pruebas | Vitest (unitarias e integración con Supertest), Playwright (E2E). |
| Calidad | ESLint (flat config) + Prettier; `npm run lint`, `typecheck` y `test` deben pasar antes de cada commit. |
| Git | Rama `release/1.0`. Commits convencionales (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`), pequeños y frecuentes. Nunca `--force`. |
| Idioma | Interfaz y documentación en español. Código, commits y nombres técnicos en inglés. |

**Scripts requeridos en `package.json`:** `dev`, `build`, `start`, `lint`, `format`, `typecheck`, `test`, `test:unit`, `test:int`, `test:e2e`, `db:migrate`, `db:seed`, `db:reset` (solo dev/test), `setup` (crea BD si no existe, migra y siembra).

**Arranque esperado del usuario:**
```
eval "$(fnm env)"
fnm use 22
npm install
npm run setup
npm run dev     # http://localhost:3000
```

**PostgreSQL de Homebrew:** por defecto el superusuario es el usuario del sistema operativo, sin contraseña, puerto 5432. `DATABASE_URL=postgresql://<usuario_so>@localhost:5432/sgec_dev`. El agente debe detectar el usuario con `whoami` y generar `.env` a partir de `.env.example` (nunca versionar `.env`). Si la conexión falla, probarlo con `psql -l` y documentarlo en `BLOCKERS.md`.

---

## 5. Arquitectura

**Estilo:** monolito modular en capas, un solo proceso.

```
Presentación (routes + controllers + views)
        ↓ DTOs validados con Zod
Aplicación  (services / use cases; orquestan transacciones y reglas)
        ↓
Dominio     (entidades, máquina de estados, estrategias de precio, errores)
        ↓ interfaces (puertos)
Infraestructura (repositories Prisma, almacenamiento de archivos, render de documentos)
```

Regla de dependencias: las capas solo dependen hacia abajo; el **dominio no importa Express, Prisma ni Nunjucks**. Los servicios reciben sus dependencias por constructor (composición manual en `src/container.ts`, sin librerías de DI).

### 5.1 Estructura de carpetas

```
src/
  server.ts            # arranque
  app.ts               # configuración de Express
  container.ts         # composición de dependencias
  config/              # env (Zod), constantes
  shared/              # errores, middlewares, logger, utilidades de fecha/dinero, auditoría
  infra/               # prisma client, storage de archivos
  modules/
    auth/              # login, sesión, RBAC (permisos por rol)
    catalog/           # escenarios, espacios, tarifas, tipos de documento exigido
    agenda/            # reservas y disponibilidad
    customers/         # arrendatarios
    rentals/           # solicitud + contrato + pago + revisión jurídica
      domain/          # estados (State), transiciones, pricing (Strategy)
      application/     # un caso de uso por transición
      infra/           # repositories
      http/            # rutas, controladores, esquemas Zod
    documents/         # render y snapshot de oficio, estudio previo y contrato
  views/               # layouts, parciales y páginas Nunjucks
prisma/                # schema, migraciones, seed
public/                # css, vendor (htmx, pico)
storage/               # adjuntos (git-ignored)
tests/                 # unit/, integration/, e2e/, helpers/
docs/                  # documentación y entregables
```

### 5.2 Patrones de diseño

| Patrón | Dónde | Por qué |
|---|---|---|
| **State** (principal) | `rentals/domain/states/` | Cada estado del trámite decide qué transiciones permite, qué rol puede ejecutarlas y qué precondiciones exige. Evita `if/switch` gigantes. |
| **Repository** | `modules/*/infra/` | Aísla Prisma del dominio; permite pruebas con dobles. |
| **Strategy** | `rentals/domain/pricing/` | `HourlyPricing` y `DailyPricing` calculan el valor según la unidad de la tarifa. |
| Middleware (cadena) | `shared/middleware`, `auth` | Autenticación → permiso por rol → validación → auditoría. |

No añadir más patrones «porque sí». Cada uno debe quedar documentado en `docs/ARCHITECTURE.md` con un diagrama Mermaid (clases del State y flujo de transiciones).

### 5.3 Diseño del patrón State

- Interfaz `RentalState` con: `name`, `allowedTransitions(): TransitionName[]`, `can(transition, actorRole): Result` y `apply(context, transition, payload): NextState`.
- Un archivo por estado concreto. Una fábrica `stateFor(status)` los instancia.
- `RentalContext` (la solicitud) delega en el estado actual; **nunca** se cambia `status` fuera de la máquina.
- Cada transición se ejecuta dentro de una **transacción** que: valida rol + precondiciones, aplica efectos (reserva, documentos, numeración), actualiza el estado y escribe una fila en `StateTransition`.
- Transiciones inválidas lanzan `InvalidTransitionError` (HTTP 409); rol sin permiso lanza `ForbiddenError` (HTTP 403).
- Pruebas unitarias table-driven que cubren **todas** las combinaciones estado × transición × rol (cobertura 100% de este módulo).

---

## 6. Modelo de dominio (resumen; nombres en inglés)

| Entidad | Campos clave |
|---|---|
| `User` | email (único), name, passwordHash, role (enum), active |
| `Venue` | name, address |
| `Space` | venueId, name, capacity, pricingUnit (HOUR / DAY), active |
| `Tariff` | spaceId, purpose (LUCRATIVE / NON_LUCRATIVE), unit, pricePesos, validFrom, validTo? |
| `DocumentRequirement` | customerType, code, name, mandatory |
| `Customer` | type (NATURAL / LEGAL), documentType, documentNumber (único con type), name, legalRepresentative?, email, phone, address |
| `RentalRequest` | id, status, customerId, spaceId, eventName, eventDescription, purpose, expectedAttendees, startsAt, endsAt, channel (VERBAL / WRITTEN / EMAIL), receivedAt, requestRadicado?, responseRadicado?, quotedAmountPesos?, quotedTariffId?, cancelReason? |
| `Reservation` | spaceId, rentalRequestId, startsAt, endsAt, status (HELD / CONFIRMED / RELEASED) |
| `RequestDocument` | rentalRequestId, requirementCode, receivedAt?, verifiedAt?, verifiedById?, fileKey?, notes |
| `Contract` | rentalRequestId (1:1), number? (único), object, valuePesos, additionalClauses, signedAt?, signedById? |
| `Payment` | rentalRequestId (1:1), receiptNumber, bankName, voucherNumber, paidAt, amountPesos, invoiceNumber, invoiceDate, voucherFileKey? |
| `LegalReview` | rentalRequestId, round, reviewerId, documentsOk, customerDataOk, clausesOk, decision (APPROVED / RETURNED), observations, reviewedAt |
| `GeneratedDocument` | rentalRequestId, kind (RESPONSE_LETTER / PRIOR_STUDY / CONTRACT), version, html, generatedById, generatedAt |
| `StateTransition` | rentalRequestId, fromStatus?, toStatus, transition, actorId, note, occurredAt |
| `ContractSequence` | year (único), lastValue |

Índices: `RentalRequest(status)`, `RentalRequest(customerId)`, `Reservation(spaceId, startsAt)`. Dinero siempre en enteros (pesos).

**Restricción anti-cruces a nivel de base de datos** (en una migración SQL manual):
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Reservation" ADD CONSTRAINT reservation_no_overlap
  EXCLUDE USING gist ("spaceId" WITH =, tstzrange("startsAt", "endsAt", '[)') WITH &&)
  WHERE ("status" IN ('HELD', 'CONFIRMED'));
```
El servicio comprueba disponibilidad antes (mensaje amigable) **y** captura el error `23P01` de Postgres como `ConflictError` (carrera entre dos usuarios).

Numeración de contrato: dentro de la transacción de firma, `INSERT ... ON CONFLICT (year) DO UPDATE SET lastValue = lastValue + 1 RETURNING lastValue`.

Sesiones: tabla `session` de `connect-pg-simple` creada por migración.

---

## 7. Máquina de estados

Estados (etiqueta en UI entre paréntesis):

`REGISTERED` (Registrada) · `RESPONDED` (Respondida) · `DOCUMENTS_VERIFIED` (Documentos verificados) · `CONTRACT_DRAFTED` (Contrato elaborado) · `PAID` (Pagado) · `LEGAL_REVIEW` (En revisión jurídica) · `RETURNED_BY_LEGAL` (Devuelto por Jurídica) · `PENDING_SIGNATURE` (Pendiente de firma) · `LEGALIZED` (Legalizado, terminal) · `CANCELLED` (Cancelada, terminal)

| # | Transición | De → A | Rol autorizado | Precondiciones | Efectos |
|---|---|---|---|---|---|
| T1 | `register` | — → REGISTERED | Auxiliar | Datos completos; espacio libre en el rango (A-05, A-06) | Crea/actualiza cliente, solicitud y reserva HELD; crea filas `RequestDocument` según tipo de cliente |
| T2 | `respond` | REGISTERED → RESPONDED | Auxiliar | Radicado del oficio informado (A-02); existe tarifa vigente | Calcula y congela valor (A-08); genera snapshot del oficio |
| T3 | `verifyDocuments` | RESPONDED → DOCUMENTS_VERIFIED | Auxiliar | Todos los documentos obligatorios con `verifiedAt` | — |
| T4 | `draftContract` | DOCUMENTS_VERIFIED → CONTRACT_DRAFTED | Auxiliar | — | Crea `Contract`; genera snapshots de estudio previo y contrato (v1) |
| T5 | `registerPayment` | CONTRACT_DRAFTED → PAID | Auxiliar | Recibo, comprobante y factura completos; monto = valor cotizado | Crea `Payment` |
| T6 | `submitToLegal` | PAID → LEGAL_REVIEW | Auxiliar | — | Abre ronda de revisión |
| T7 | `approveLegal` | LEGAL_REVIEW → PENDING_SIGNATURE | Jurídica | Las 3 verificaciones marcadas | Registra `LegalReview` APPROVED |
| T8 | `returnLegal` | LEGAL_REVIEW → RETURNED_BY_LEGAL | Jurídica | Observaciones ≥ 10 caracteres | Registra `LegalReview` RETURNED |
| T9 | `resubmitToLegal` | RETURNED_BY_LEGAL → LEGAL_REVIEW | Auxiliar | Texto del contrato puede haberse corregido | Nueva versión de contrato y nueva ronda |
| T10 | `signAndNumber` | PENDING_SIGNATURE → LEGALIZED | Secretario | — | Asigna número (A-03), `signedAt/By`; reserva → CONFIRMED; snapshot final del contrato con número |
| T11 | `cancel` | cualquier no terminal → CANCELLED | Auxiliar o Jefe | Motivo ≥ 10 caracteres | Reserva → RELEASED; nota de posible devolución si ya hubo pago (A-11) |

`LEGALIZED` y `CANCELLED` no admiten ninguna transición. Cada transición exitosa escribe `StateTransition`.

---

## 8. Roles y permisos (CAR-19)

| Rol (enum) | Perfil | Puede en 1.0 |
|---|---|---|
| `OFFICE_HEAD` | Jefe de Oficina | Ver todo; cancelar; consultar y editar tarifas |
| `ADMIN_ASSISTANT` | Auxiliar administrativo | T1–T6, T9, T11; ver todo |
| `LEGAL` | Oficina Jurídica | Ver solicitudes en revisión y su contrato; T7, T8 |
| `SECRETARY` | Secretario de Cultura | Ver contratos pendientes de firma y legalizados; T10 |
| `OPERATIONS_TECH` | Técnico operativo | Solo consultar agenda/disponibilidad (cimiento para 2.0) |
| `MAINTENANCE_TECH` | Técnico de mantenimiento | Solo iniciar sesión y ver inicio (cimiento para 3.0) |

Los permisos viven en un único mapa `rol → permisos` (`modules/auth/permissions.ts`). Se verifican **en el servidor** con middleware `requirePermission(...)` y además se ocultan en la UI. Un usuario sin permiso recibe 403 con página amable.

---

## 9. Requisitos funcionales y criterios de aceptación

Formato: Dado / Cuando / Entonces. Cada criterio `AC-xx` debe tener al menos una prueba automatizada (referenciada en `docs/TRAZABILIDAD.md`).

### CAR-01 Registrar solicitud
- **AC-01.1** Dado un auxiliar autenticado, cuando registra una solicitud válida (cliente, espacio, rango, propósito, canal), entonces queda en `REGISTERED`, con reserva `HELD` y aparece en la agenda.
- **AC-01.2** Cuando el documento del cliente ya existe, entonces se reutiliza el cliente (no se duplica) y se actualizan sus datos de contacto.
- **AC-01.3** Cuando el rango es inválido (fin ≤ inicio, < 1 h, > 7 días, en el pasado), entonces se rechaza con mensaje claro en español y no se crea nada.
- **AC-01.4** Cuando el rango se cruza con una reserva activa del mismo espacio, entonces se rechaza indicando el conflicto.
- **AC-01.5** Cuando se informa el radicado al registrar, entonces se guarda; si no, queda vacío sin error.

### CAR-02 Disponibilidad
- **AC-02.1** Dado un espacio, fecha y franja, cuando se consulta, entonces el sistema indica «Disponible» o «No disponible» con la reserva que lo bloquea (número de solicitud y estado).
- **AC-02.2** El resultado se actualiza sin recargar la página (HTMX) en el formulario de registro.
- **AC-02.3** Reservas `RELEASED` no bloquean; reservas contiguas (A-05) tampoco.
- **AC-02.4** Hay una vista de agenda por escenario (lista por día, próximos 30 días) de solo lectura.

### CAR-03 Oficio de respuesta
- **AC-03.1** Cuando el auxiliar responde informando el radicado, entonces se calcula el valor con el Acuerdo de Tarifas (estrategia por hora o por día), se congela y se genera el oficio.
- **AC-03.2** El oficio muestra: destinatario, asunto, escenario, fecha y franja solicitadas, **lista de requisitos según tipo de cliente**, valor a consignar en letras y números, datos de consignación de ejemplo y datos de contacto.
- **AC-03.3** Sin radicado o sin tarifa vigente, la transición se rechaza.
- **AC-03.4** El oficio se puede abrir en una página imprimible (A4) y guardar como PDF desde el navegador.

### CAR-04 Documentos del cliente
- **AC-04.1** Al registrar la solicitud se genera el checklist de documentos según el tipo de cliente.
- **AC-04.2** El auxiliar marca cada documento como recibido, opcionalmente adjunta archivo (PDF/JPG/PNG ≤ 5 MB) y luego lo verifica.
- **AC-04.3** Se rechazan archivos de tipo o tamaño no permitido.
- **AC-04.4** No se puede pasar a `DOCUMENTS_VERIFIED` con algún documento obligatorio sin verificar.
- **AC-04.5** Los archivos solo se descargan con sesión y permiso.

### CAR-05 Estudio previo y contrato
- **AC-05.1** Desde `DOCUMENTS_VERIFIED`, el auxiliar elabora el contrato: se generan estudio previo y contrato a partir de los datos de la solicitud (partes, objeto, escenario, fechas, valor, obligaciones, cláusulas, normatividad aplicable listada en el documento de Visión).
- **AC-05.2** El auxiliar puede editar `object` y `additionalClauses` antes de enviar a revisión; cada regeneración crea una versión nueva.
- **AC-05.3** Estudio previo y contrato son imprimibles (A4).

### CAR-06 Pago y facturación
- **AC-06.1** El auxiliar registra recibo, banco, número y fecha de consignación, monto, número y fecha de factura, y opcionalmente adjunta el comprobante.
- **AC-06.2** Si el monto ≠ valor cotizado, se rechaza explicando la diferencia.
- **AC-06.3** Tras registrar el pago el estado es `PAID`.

### CAR-07 Revisión jurídica
- **AC-07.1** El auxiliar envía a Jurídica; el usuario Jurídica ve su bandeja de «En revisión».
- **AC-07.2** Jurídica aprueba solo si marca las tres verificaciones: documentación completa y vigente; datos del arrendatario correspondientes; clausulado ajustado a la normatividad.
- **AC-07.3** Jurídica puede devolver con observaciones (≥ 10 caracteres); el auxiliar las ve, corrige y reenvía; el historial muestra cada ronda.
- **AC-07.4** Solo el rol Jurídica puede aprobar o devolver.

### CAR-08 Firma y numeración
- **AC-08.1** El Secretario ve los contratos en `PENDING_SIGNATURE` y registra la firma; el contrato recibe número `ARR-AAAA-NNNN` único y consecutivo.
- **AC-08.2** La solicitud queda `LEGALIZED`, la reserva `CONFIRMED` y el contrato final (con número) se vuelve inmutable.
- **AC-08.3** Dos firmas concurrentes nunca generan el mismo número (prueba de concurrencia).

### CAR-09 Consulta de estado
- **AC-09.1** Listado de solicitudes con filtro por estado, búsqueda por cliente, evento o número de contrato, paginado.
- **AC-09.2** Detalle con línea de tiempo (transición, actor, fecha, nota), documentos, pago, revisiones y documentos generados.
- **AC-09.3** El detalle muestra solo las acciones que el rol actual puede ejecutar en ese estado.

### CAR-19 Perfiles
- **AC-19.1** Login con email y contraseña; logout; sesión expira por inactividad (2 h).
- **AC-19.2** Un rol sin permiso no ve la acción en la UI y recibe 403 si accede por URL o POST directo (prueba por cada ruta protegida).
- **AC-19.3** Protección CSRF en todos los POST; límite de intentos de login.

---

## 10. Pantallas y rutas (guía)

| Ruta | Pantalla | Roles |
|---|---|---|
| `GET /login`, `POST /login`, `POST /logout` | Acceso | público / todos |
| `GET /` | Inicio con resumen de «pendientes para mí» según rol | todos |
| `GET /solicitudes` | Listado con filtros | Jefe, Auxiliar, Jurídica, Secretario |
| `GET/POST /solicitudes/nueva` | Registro (con consulta de disponibilidad HTMX) | Auxiliar |
| `GET /solicitudes/:id` | Detalle, línea de tiempo y acciones | según rol |
| `POST /solicitudes/:id/transiciones/:name` | Ejecuta una transición | según transición |
| `GET /solicitudes/:id/documentos/:kind` | Documento generado imprimible | Jefe, Auxiliar, Jurídica, Secretario |
| `GET /archivos/:key` | Descarga autenticada | idem |
| `GET /agenda` y `GET /agenda/disponibilidad` | Agenda y consulta | todos los roles internos |
| `GET/POST /tarifas` | Consulta/edición | Jefe (edición), Auxiliar (lectura) |

Interfaz sobria e institucional, legible, con foco en formularios claros; navegación según rol; mensajes flash; estados con insignias de color **y** texto; usable en móvil (≥ 360 px) y navegadores Chrome, Firefox y Edge.

---

## 11. Documentos generados (formatos de ejemplo)

Plantillas Nunjucks en `src/modules/documents/templates/`, con CSS de impresión A4. Estructura:

1. **Oficio de respuesta:** encabezado institucional (texto, sin logos), ciudad y fecha, radicado, destinatario, asunto, cuerpo (escenario, fecha, franja), requisitos, valor a consignar, forma de pago, cierre y firma tipográfica «Jefe de la Oficina de Administración de Escenarios y Bienes Culturales».
2. **Estudio previo:** descripción de la necesidad, objeto, justificación, análisis del valor (con la tarifa aplicada), plazo, obligaciones, riesgos básicos, normatividad aplicable (solo las normas listadas en la Visión, sin artículos).
3. **Contrato de arrendamiento:** partes, objeto, plazo (fechas y franja), valor y forma de pago, obligaciones del arrendador y del arrendatario, entrega y recibo del inmueble, responsabilidad por daños, cláusulas adicionales, jurisdicción, espacio para número y firmas (el número solo se muestra tras firmar).

Valor en letras: función utilitaria `amountToWords(pesos)` con pruebas unitarias.

---

## 12. Requisitos no funcionales

- **Seguridad:** hash bcrypt, cookies `httpOnly` + `sameSite=lax`, `helmet`, CSRF, validación de entradas, consultas parametrizadas (Prisma), autorización en servidor, sin secretos en el repo.
- **Integridad:** transacciones en cada transición; restricción de BD contra cruces; unicidad del número de contrato.
- **Mantenibilidad:** funciones cortas, nombres claros, sin duplicación, errores tipados, sin lógica de negocio en controladores ni vistas.
- **Observabilidad básica:** logs estructurados (pino) con id de petición; `GET /health` (verifica BD).
- **Rendimiento:** listados paginados (20 por página); suficiente para decenas de usuarios.
- **Usabilidad:** textos en español, errores accionables, sin jerga técnica.
- **Portabilidad:** todo configurable por `.env`; sin rutas absolutas.

---

## 13. Datos semilla (`npm run db:seed`, idempotente)

Todos ficticios y marcados como ejemplo en el README.

- **Usuarios** (contraseña de desarrollo `Cambiar123!`, solo local): `jefe@sgec.local`, `auxiliar@sgec.local`, `juridica@sgec.local`, `secretario@sgec.local`, `operativo@sgec.local`, `mantenimiento@sgec.local`.
- **Escenarios:** Centro Cultural Lucy Tejada (espacios: Auditorio Principal, Sala Múltiple; cobro por hora) y Teatro Municipal Santiago Londoño (Sala Principal; cobro por día). Capacidades y tarifas inventadas, p. ej. Auditorio Principal 450.000/h lucrativo y 250.000/h sin ánimo de lucro; Sala Principal 3.200.000/día lucrativo y 1.800.000/día sin ánimo de lucro.
- **Documentos exigidos:** persona natural (documento de identidad, RUT, descripción del evento); persona jurídica (certificado de existencia y representación legal vigente, RUT, documento del representante legal, descripción del evento).
- **Solicitudes demo:** al menos una en cada estado, con clientes de ejemplo, de modo que el recorrido completo pueda demostrarse en minutos.

---

## 14. Estrategia de pruebas

| Nivel | Herramienta | Qué cubre | Meta |
|---|---|---|---|
| Unitarias | Vitest | Máquina de estados (todas las combinaciones), estrategias de precio, `amountToWords`, validaciones, permisos | 100% en `rentals/domain`; ≥ 85% líneas en dominio |
| Integración | Vitest + Supertest + BD `sgec_test` | Cada transición vía HTTP, RBAC por ruta, restricción anti-cruces, concurrencia de numeración, subida de archivos | Todos los AC de la sección 9 |
| E2E | Playwright | Camino feliz completo (auxiliar, jurídica y secretario; el jefe consulta), camino con devolución de Jurídica, camino con conflicto de agenda, cancelación | 3–4 escenarios |

- La BD de pruebas se reinicia entre suites; hay *factories* para crear datos.
- `npm test` ejecuta unitarias + integración. Los E2E se ejecutan con `npm run test:e2e` contra el servidor local.
- Cada AC referencia su prueba en `docs/TRAZABILIDAD.md`.

---

## 15. Entregables y Definition of Done del Release 1.0

El release está terminado **solo si**:

1. `npm run lint`, `npm run typecheck` y `npm test` pasan en limpio; `npm run test:e2e` pasa.
2. Desde un clon limpio, los comandos de arranque de la sección 4 funcionan y el usuario puede completar el flujo con los usuarios semilla.
3. Todos los AC de la sección 9 están implementados y con prueba.
4. Existen y son coherentes con el código:
   - `README.md` (requisitos, instalación, usuarios semilla, comandos, estructura)
   - `docs/ARCHITECTURE.md` (capas, patrones con diagramas Mermaid, decisiones)
   - `docs/MANUAL_TECNICO.md` (instalación, configuración, BD, administración, copias de seguridad, resolución de problemas)
   - `docs/MANUAL_USUARIO.md` (por rol, paso a paso, con capturas generadas por Playwright cuando sea posible)
   - `docs/PROTOCOLO_ACEPTACION.md` (casos de prueba con ID, CAR, pasos, resultado esperado, columna de resultado y firma; basado en los AC)
   - `docs/TRAZABILIDAD.md` (CAR → AC → pruebas; y actividades del procedimiento del documento de Visión → qué parte las cubre en 1.0 / 2.0 / 3.0)
   - `docs/EXTENDING.md` (cómo construir 2.0 y 3.0 sobre esta base)
5. `DECISIONS.md` registra toda decisión no trivial; `BLOCKERS.md` está vacío o explica lo pendiente.
6. Árbol de git limpio, rama `release/1.0` con commits convencionales y etiqueta `v1.0.0`.
