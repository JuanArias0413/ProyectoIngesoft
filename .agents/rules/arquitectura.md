# Regla: arquitectura y calidad de código

Fuente: `SPEC.md` §4, §5 y §12. Esta regla resume lo que se revisa en cada compuerta.

## Estructura y dependencias

- Monolito modular en capas: **presentación → aplicación → dominio ← infraestructura**.
- El dominio (`src/modules/*/domain`) no importa Express, Prisma, Nunjucks ni `fs`. Solo TypeScript puro.
- Controladores: parsean y validan con Zod, llaman a un caso de uso, devuelven respuesta. Cero reglas de negocio.
- Casos de uso (`application/`): uno por transición o consulta; reciben dependencias por constructor; abren la transacción.
- Repositorios (`infra/`): único lugar que habla con Prisma. Devuelven objetos de dominio o DTOs simples, nunca tipos de Prisma hacia la capa HTTP.
- Composición manual de dependencias en `src/container.ts`.
- Un módulo nuevo no debe obligar a tocar módulos existentes (salvo registro de rutas y navegación).

## Patrones (solo los definidos en el SPEC)

- **State** para el ciclo de vida de la solicitud/contrato. Prohibido cambiar `status` fuera de la máquina de estados. Prohibidos los `switch` sobre el estado en servicios o controladores.
- **Repository** para persistencia.
- **Strategy** para el cálculo de tarifas.
- No introduzcas patrones adicionales sin una razón escrita en `DECISIONS.md`.

## Estilo de código

- TypeScript estricto; sin `any` (si es inevitable, comentario con la razón). Sin `// @ts-ignore`.
- Nombres descriptivos en inglés; vocabulario del dominio consistente (ver tabla de entidades del SPEC §6).
- Funciones cortas (objetivo < 30 líneas) con una sola responsabilidad. Sin duplicación: extrae.
- Errores tipados (`DomainError` y derivados); nunca lances strings. Nunca tragues errores en silencio.
- Dinero en pesos enteros; fechas en UTC y presentación en `America/Bogota`. Nunca uses `Date` ingenuo para mostrar.
- Sin números ni cadenas mágicas: constantes con nombre o enums.
- Comentarios solo para explicar el *por qué*; el *qué* lo dice el código.
- Sin `console.log` (usa el logger). Sin código muerto, sin `TODO` sin issue en `PLAN.md`.

## Seguridad

- Autorización siempre en servidor con `requirePermission`. La UI solo oculta.
- Toda entrada externa pasa por un esquema Zod. Consultas solo vía Prisma o SQL parametrizado.
- CSRF en todo POST; cookies `httpOnly`; archivos validados por tipo MIME real y tamaño; descarga solo autenticada.
- Nunca registres contraseñas, hashes ni tokens en logs.

## Interfaz

- Textos en español claro. Errores que dicen qué hacer.
- Accesible: etiquetas en campos, foco visible, estados con texto además de color.
- Responsive desde 360 px. Sin dependencia de CDNs externos.

## Pruebas

- Código nuevo con prueba nueva. Los AC del SPEC §9 son la lista de verificación.
- Unitarias para dominio; integración (Supertest + `sgec_test`) para casos de uso y rutas; E2E (Playwright) para recorridos.
- Pruebas deterministas e independientes entre sí (sin orden implícito, sin dormir con `sleep`).
- Una prueba que falla se arregla en su causa; no se borra ni se silencia.

## Git

- Rama `release/1.0`. Commits convencionales y pequeños (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`), uno por unidad lógica.
- Nunca commitear con lint, typecheck o tests en rojo.
- Nunca `--force`, nunca reescribir historia publicada.
