# SGEC — Sistema de Gestión de Escenarios y Bienes Culturales
### Release 1.0 · Secretaría de Cultura de Pereira

> **Proyecto Académico de Ingeniería de Software**  
> Implementación del procedimiento institucional de alquiler de escenarios culturales (Centro Cultural Lucy Tejada y Teatro Municipal Santiago Londoño), garantizando control de disponibilidad, verificación documental, liquidación tarifaria, revisión jurídica, firma electrónica y numeración atómica inmutable.

---

## 🚀 Resumen del Proyecto

SGEC Release 1.0 es un **monolito modular en capas** desarrollado en **Node.js 22 + TypeScript estricto**, con renderizado del lado del servidor (**SSR**) mediante **Nunjucks + HTMX + Pico.css**, base de datos relacional **PostgreSQL 17** y ORM **Prisma 6**.

### Características Destacadas
- **Máquina de Estados Finita (Patrón State):** Modela el ciclo de vida contractual con 10 estados concretos y transiciones transaccionales auditables (`REGISTERED` → `LEGALIZED`). 100% testeable en memoria.
- **Protección Anti-Cruces de Agenda a Doble Nivel (ON-3):** Rango semiabierto `[startsAt, endsAt)` en el servicio de aplicación y restricción de exclusión física `btree_gist` + `tstzrange` en PostgreSQL contra colisiones concurrentes (código `23P01` traducido a HTTP 409).
- **Estrategias de Precios (Patrón Strategy):** Liquidación exacta por hora (`HourlyPricing`) o por día (`DailyPricing`) según el Acuerdo de Tarifas, con conversión gramatical en español a pesos M/CTE (`amountToWords`).
- **Seguridad y Control de Acceso (RBAC):** Autenticación en PostgreSQL (`connect-pg-simple`), sesiones seguras httpOnly, protección CSRF (`csrf-csrf`), limitador de tasa (`express-rate-limit`) y cabeceras de seguridad estrictas con Helmet CSP.
- **Documentos Oficiales Versionados e Imprimibles:** Generación de snapshots inmutables HTML para Oficio de Respuesta, Estudio Previo de Conveniencia y Contrato de Arrendamiento, listos para impresión A4 (`@page { size: A4; margin: 2cm; }`).

---

## 🛠️ Requisitos e Instalación Rápida

### Requisitos Previos
- **Node.js:** Versión `22.x LTS` (usar `fnm use 22`).
- **PostgreSQL:** Versión `16` o `17` con extensión `btree_gist` instalada.
- **npm:** Versión `10.x` o superior.

### Arranque en un solo paso
```bash
# 1. Configurar entorno Node 22
eval "$(fnm env)" && fnm use 22

# 2. Instalar dependencias
npm install

# 3. Configurar base de datos, migraciones y seed demo
npm run setup

# 4. Iniciar servidor en modo desarrollo
npm run dev
```

El servidor estará disponible de inmediato en **`http://localhost:3000`** (con verificación de salud en `http://localhost:3000/health`).

---

## 👥 Cuentas de Acceso Institucional (Seed)

Todas las cuentas se crean automáticamente al ejecutar `npm run setup` o `npm run db:seed`. La contraseña para todas es **`Cambiar123!`**:

| Correo Institucional | Rol | Responsabilidades en el Trámite |
|---|---|---|
| `auxiliar@sgec.local` | `ADMIN_ASSISTANT` | Radicación T1, oficio T2, verificación documental T3, minuta T4, pago T5, envío a jurídica T6/T9. |
| `juridica@sgec.local` | `LEGAL` | Revisión jurídica, aprobación con 3 checks obligatorios T7 o devolución con observaciones T8. |
| `secretario@sgec.local` | `SECRETARY` | Firma institucional y numeración oficial atómica anual `ARR-AAAA-NNNN` T10. |
| `jefe@sgec.local` | `OFFICE_HEAD` | Supervisión general, cancelación formal de trámites T11 y administración de tarifas. |
| `operativo@sgec.local` | `OPERATIONS_TECH` | Consulta de la agenda general de escenarios y eventos programados. |
| `mantenimiento@sgec.local` | `MAINTENANCE_TECH` | Consulta de escenarios e infraestructura física. |

---

## 🧪 Pruebas Automatizadas y Calidad

El proyecto cuenta con un conjunto integral de **788 pruebas automatizadas** que garantizan la solidez y confiabilidad del software:

```bash
# Ejecutar verificación de estilo (ESLint)
npm run lint

# Ejecutar comprobación de tipos TypeScript
npm run typecheck

# Ejecutar todas las pruebas unitarias e integración (Vitest)
npm run test

# Ejecutar pruebas unitarias de dominio
npm run test:unit

# Ejecutar pruebas de integración HTTP
npm run test:int

# Ejecutar pruebas de extremo a extremo en navegador real (Playwright)
npm run test:e2e
```

### Métricas de Cobertura
- **Patrón State (`src/modules/rentals/domain/states/`):** 98.38% de sentencias (618 pruebas table-driven).
- **Patrón Strategy (`src/modules/rentals/domain/pricing/`):** 93.68% de sentencias.
- **Pruebas E2E:** 5 escenarios Playwright completos (Camino Feliz T1→T10, Devolución Jurídica, Conflicto de Agenda, Cancelación y Generación de Capturas).

---

## 📚 Documentación Técnica y Académica

Toda la documentación detallada del proyecto se encuentra en el directorio [`docs/`](docs/):

- 📐 [**Arquitectura del Sistema (`docs/ARCHITECTURE.md`)**](docs/ARCHITECTURE.md): Diagramas de capas, diagrama de clases del patrón State, diagrama de transiciones Mermaid, decisiones ADR y atributos de calidad.
- 🔧 [**Manual Técnico (`docs/MANUAL_TECNICO.md`)**](docs/MANUAL_TECNICO.md): Guía de instalación, variables de entorno, migraciones, respaldos (`pg_dump`) y solución de problemas.
- 📖 [**Manual de Usuario (`docs/MANUAL_USUARIO.md`)**](docs/MANUAL_USUARIO.md): Flujos paso a paso por cada uno de los roles con capturas de pantalla reales.
- ✅ [**Protocolo de Aceptación (`docs/PROTOCOLO_ACEPTACION.md`)**](docs/PROTOCOLO_ACEPTACION.md): 37 casos de prueba de aceptación certificados contra los criterios del pliego.
- 🔗 [**Matriz de Trazabilidad (`docs/TRAZABILIDAD.md`)**](docs/TRAZABILIDAD.md): Mapeo completo CAR → AC → Prueba y cobertura del procedimiento frente a releases 1.0, 2.0 y 3.0.
- 📊 [**Reporte de Cobertura (`docs/COVERAGE.md`)**](docs/COVERAGE.md): Desglose cuantitativo de cobertura por archivo y módulo.
- 🔮 [**Guía de Extensibilidad (`docs/EXTENDING.md`)**](docs/EXTENDING.md): Manual para desarrolladores sobre cómo agregar estados, estrategias y módulos hacia Release 2.0 y 3.0.

---

## 📄 Licencia y Créditos

Desarrollado como proyecto académico de Ingeniería de Software para la Secretaría de Cultura del Municipio de Pereira, Colombia. Todos los derechos reservados.
