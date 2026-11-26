# Reporte de Cobertura de Pruebas Unitarias — SGEC Release 1.0

Fecha: 2026-10-15  
Herramienta: Vitest v3.0 + @vitest/coverage-v8  
Criterio de Aceptación: Cobertura unitaria ≥ 85% de sentencias (statements) en el dominio núcleo (`src/modules/rentals/domain/`).

## Resumen Ejecutivo

| Módulo / Paquete | % Sentencias | % Ramas | % Funciones | % Líneas | Estado |
|---|---|---|---|---|---|
| **Dominio: Estados (`states/`)** | **98.38%** | **89.58%** | **97.82%** | **98.38%** | **CUMPLE (≥85%)** |
| **Dominio: Tarifas (`pricing/`)** | **93.68%** | **88.00%** | **100.00%** | **93.68%** | **CUMPLE (≥85%)** |
| **Utilidades: Letras (`amountToWords`)** | **94.73%** | **91.48%** | **100.00%** | **94.73%** | **CUMPLE** |
| **Documentos: Render (`documents/`)** | **86.98%** | **74.15%** | **90.47%** | **86.98%** | **CUMPLE** |
| **Total Global Dominio Núcleo** | **96.85%** | **89.20%** | **98.40%** | **96.85%** | **SUPERADO CON ÉXITO** |

---

## Detalle por Clase del Patrón State (`src/modules/rentals/domain/states/`)

| Archivo / Clase de Estado | % Sentencias | % Ramas | % Funciones | % Líneas | Casos No Cubiertos |
|---|---|---|---|---|---|
| `registeredState.ts` | 98.55% | 90.32% | 100% | 98.55% | Mensaje de transición no permitida fallback |
| `respondedState.ts` | 98.33% | 87.50% | 100% | 98.33% | Fallback |
| `documentsVerifiedState.ts` | 98.14% | 90.00% | 100% | 98.14% | Fallback |
| `contractDraftedState.ts` | 98.71% | 92.85% | 100% | 98.71% | Fallback |
| `paidState.ts` | 98.14% | 90.47% | 100% | 98.14% | Fallback |
| `legalReviewState.ts` | 98.55% | 87.09% | 100% | 98.55% | Fallback |
| `returnedByLegalState.ts` | 98.14% | 90.00% | 100% | 98.14% | Fallback |
| `pendingSignatureState.ts` | 98.14% | 90.00% | 100% | 98.14% | Fallback |
| `legalizedState.ts` | 100.00% | 100.00% | 100% | 100.00% | — (Estado terminal cubierto al 100%) |
| `cancelledState.ts` | 100.00% | 100.00% | 100% | 100.00% | — (Estado terminal cubierto al 100%) |
| `rentalContext.ts` | 96.84% | 80.00% | 80.00% | 96.84% | Guardias defensivas de nulo |
| `stateFactory.ts` | 100.00% | 100.00% | 100% | 100.00% | — |

---

## Estrategia de Pruebas Unitarias

Se cuenta con **618 pruebas unitarias table-driven** dedicadas exclusivamente a la matriz de combinaciones del patrón State:
- **10 estados concretos**
- **10 transiciones formales**
- **6 roles institucionales**
- **600 combinaciones teóricas** evaluadas para asegurar que únicamente los roles con permiso en el estado adecuado puedan ejecutar cada transición, arrojando errores tipados específicos (`InvalidTransitionError` 409 o `ForbiddenError` 403) ante cualquier intento inválido.
