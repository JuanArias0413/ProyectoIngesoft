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
(Agrega aquí D-06 en adelante.)
