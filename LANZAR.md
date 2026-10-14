# LANZAR.md — Cómo arrancar la ejecución autónoma en Antigravity

> Este archivo es para ti, no para los agentes. Puedes borrarlo del repo si quieres.

## 1. Preparar el repositorio (una sola vez)

```bash
git clone https://github.com/JuanArias0413/ProyectoIngesoft
cd ProyectoIngesoft
git checkout -b release/1.0
# Copia dentro del repo todo el contenido de este kit (incluidos los archivos ocultos .agent/, .gitignore, .node-version, .env.example)
git add -A && git commit -m "chore: add agent kit (spec, plan, rules, workflows)"

eval "$(fnm env)"
fnm use 22
brew services list | grep postgresql      # confirma que PostgreSQL esté corriendo
```

Si PostgreSQL no está corriendo: `brew services start postgresql@17` (el nombre exacto puede variar según tu instalación).

## 2. Configurar Antigravity

1. **Abre la carpeta del repo** como workspace.
2. **Settings → Advanced Settings → Agent:**
   - *Terminal execution policy*: **Turbo**.
   - *Review policy*: **Always Proceed**.
3. **Deny list** (comandos que nunca debe ejecutar aunque esté en Turbo): `sudo`, `rm -rf /`, `rm -rf ~`, `git push --force`, `git push -f`, `dropdb`, `DROP DATABASE`.
4. **Rules:** comprueba en el panel de Rules/Customizations que `autonomia.md` y `arquitectura.md` aparezcan y estén activas siempre. Si tu versión pide elegir el modo de activación de cada regla, elige «siempre activa».
5. Verifica que el navegador integrado esté disponible (los agentes lo usan para probar la interfaz).

La ubicación exacta de estas opciones puede cambiar entre versiones de Antigravity; si no las encuentras, búscalas por nombre.

## 3. Lanzar

En el Agent Manager, con el workspace seleccionado, abre una conversación nueva y escribe:

```
/build-project
```

Si tu versión no reconoce el workflow, pega este prompt:

> Lee AGENTS.md, SPEC.md y PLAN.md y ejecuta el workflow .agents/skills/build-project/SKILL.md de principio a fin. Trabaja de forma autónoma y continua: no te detengas al terminar una tarea ni una fase, no me hagas preguntas, y sigue las reglas de .agent/rules/. Delega en agentes por carpeta como indica el PLAN, verifica cada fase con /verify-release y avanza hasta completar la Fase 6. Solo detente cuando el proyecto esté terminado o haya un bloqueo real registrado en BLOCKERS.md.

**Recomendación:** déjalo correr los primeros 10–15 minutos mirándolo. Si Fase 0 compila, arranca y el login funciona, ya puedes dejarlo solo.

## 4. Si se detiene

Los agentes pueden detenerse por cuota del modelo, errores de herramientas o contexto lleno. No pierdes nada porque el estado vive en archivos y en git. Abre una conversación nueva y escribe:

```
/resume
```

o pega:

> Ejecuta .agents/skills/resume/SKILL.md: relee PROGRESS.md, PLAN.md, DECISIONS.md y BLOCKERS.md, revisa git status, y continúa con la primera tarea pendiente sin preguntarme nada.

## 5. Qué mirar cuando vuelvas

1. `PROGRESS.md` → resumen y resultados de cada compuerta.
2. `BLOCKERS.md` → lo que necesita tu decisión.
3. `DECISIONS.md` → decisiones tomadas por los agentes (revísalas: son tu defensa en clase).
4. `PLAN.md` → cuántas tareas faltan.
5. Prueba tú mismo: `npm install && npm run setup && npm run dev` y entra a http://localhost:3000 con `auxiliar@sgec.local` / `Cambiar123!`.

## 6. Límites realistas

- **No hay garantía de ejecución infinita.** Si ves que se detiene, `/resume` lo retoma.
- **Revisa lo que entrega**, sobre todo los documentos académicos: los agentes pueden equivocarse en algo que luego deberás defender en clase. Entiende el patrón State y la arquitectura antes de presentar.
- Los formatos legales son de ejemplo: no los uses fuera del contexto académico.
- Tu computador debe seguir encendido y con internet mientras corre (los modelos son remotos).
- Con Turbo, el agente ejecuta comandos solo. Por eso el trabajo vive en una rama, el repo es solo del proyecto y la deny list está activa.
