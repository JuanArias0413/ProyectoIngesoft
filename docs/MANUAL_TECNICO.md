# Manual Técnico de Instalación, Operación y Mantenimiento — SGEC Release 1.0

Sistema de Gestión de Escenarios y Bienes Culturales  
Secretaría de Cultura de Pereira — Proyecto Académico

---

## 1. Requisitos del Sistema

### 1.1 Entorno de Ejecución
- **Sistema Operativo:** macOS (arm64/x64) o Linux (Ubuntu 22.04+ / Debian 12+).
- **Node.js:** Versión `22.x LTS` (probado y certificado en `v22.23.3`). Se recomienda el uso de `fnm` (Fast Node Manager).
- **Gestor de Paquetes:** `npm` versión `10.x` o superior.
- **Base de Datos:** PostgreSQL versión `16` o `17` con la extensión `btree_gist` instalada y habilitada.
- **Memoria RAM Mínima:** 2 GB (4 GB recomendados).
- **Almacenamiento:** Mínimo 1 GB de espacio libre en disco para base de datos y adjuntos locales (`storage/`).

---

## 2. Variables de Entorno (`.env`)

El sistema utiliza Zod (`src/config/env.ts`) para validar de forma estricta las variables de entorno al iniciar el servidor. Si falta alguna variable obligatoria, el proceso aborta inmediatamente con un reporte detallado.

| Variable | Descripción | Ejemplo / Valor por defecto |
|---|---|---|
| `NODE_ENV` | Entorno de ejecución (`development`, `test`, `production`) | `development` |
| `PORT` | Puerto HTTP donde escuchará Express | `3000` |
| `DATABASE_URL` | Cadena de conexión PostgreSQL (base de desarrollo) | `postgresql://<usuario>@localhost:5432/sgec_dev` |
| `SESSION_SECRET` | Clave secreta para firma de cookies de sesión | Cadena aleatoria de al menos 32 caracteres |
| `CSRF_SECRET` | Clave secreta para tokens CSRF | Cadena aleatoria de al menos 32 caracteres |
| `LOG_LEVEL` | Nivel de logging Pino (`fatal`, `error`, `warn`, `info`, `debug`) | `info` |
| `STORAGE_DIR` | Ruta local para adjuntos de clientes y comprobantes | `./storage` |

### Ejemplo de archivo `.env`:
```bash
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://pitoparker@localhost:5432/sgec_dev"
SESSION_SECRET="sgec-super-secret-session-key-dev-32chars-min"
CSRF_SECRET="sgec-super-secret-csrf-key-dev-32chars-min"
LOG_LEVEL=info
STORAGE_DIR="./storage"
```

---

## 3. Instalación y Puesta en Marcha

### Paso 1: Configurar la versión de Node.js
```bash
eval "$(fnm env)"
fnm use 22
node -v # Debe indicar v22.x
```

### Paso 2: Instalar dependencias
```bash
npm install
```

### Paso 3: Inicializar bases de datos y extensiones
Asegúrese de que el servicio PostgreSQL se encuentre en ejecución localmente. Cree las bases de datos de desarrollo y pruebas si aún no existen:
```bash
createdb sgec_dev
createdb sgec_test
```

### Paso 4: Configurar variables locales y ejecutar migraciones
Ejecute el script de setup automatizado o aplique las migraciones manualmente:
```bash
npm run setup
```
O de forma manual:
```bash
npm run db:migrate
npm run db:seed
```

### Paso 5: Iniciar el servidor en modo desarrollo
```bash
npm run dev
```
El servidor arrancará en `http://localhost:3000`. Puede verificar su estado accediendo a `http://localhost:3000/health`, el cual responderá con:
```json
{
  "status": "ok",
  "uptimeSeconds": 1.25,
  "timestamp": "2026-10-15T17:00:00.000Z",
  "database": "connected"
}
```

---

## 4. Usuarios de Prueba y Roles Preconfigurados

El comando `npm run db:seed` crea 6 cuentas de usuario institucionales (una para cada rol del sistema). Todos los usuarios comparten la contraseña inicial `Cambiar123!`:

| Correo Electrónico | Rol | Función Principal |
|---|---|---|
| `jefe@sgec.local` | `OFFICE_HEAD` | Consulta global, cancelación formal de solicitudes y actualización de tarifas. |
| `auxiliar@sgec.local` | `ADMIN_ASSISTANT` | Registro de solicitudes (T1), respuesta (T2), verificación documental (T3), elaboración de contratos (T4), registro de pagos (T5) y envío a jurídica (T6/T9). |
| `juridica@sgec.local` | `LEGAL` | Revisión jurídica del contrato, aprobación con 3 checks (T7) o devolución con observaciones (T8). |
| `secretario@sgec.local` | `SECRETARY` | Firma electrónica del contrato y asignación del consecutivo anual atómico `ARR-AAAA-NNNN` (T10). |
| `operativo@sgec.local` | `OPERATIONS_TECH` | Consulta de la agenda y estado de ocupación de espacios. |
| `mantenimiento@sgec.local` | `MAINTENANCE_TECH` | Consulta general del catálogo de escenarios y estado del sistema. |

---

## 5. Compilación y Despliegue en Producción

### Paso 1: Compilar TypeScript
```bash
npm run build
```
Esto generará los archivos JavaScript compilados en el directorio `dist/` a partir de `tsconfig.build.json`.

### Paso 2: Ejecutar en producción
```bash
NODE_ENV=production npm start
```

---

## 6. Procedimiento de Respaldo y Restauración (PostgreSQL)

### 6.1 Respaldo (Backup)
Para generar un volcado consistente de la base de datos `sgec_dev` incluyendo datos y esquemas:
```bash
pg_dump -Fc -v -d sgec_dev -f "sgec_backup_$(date +%Y%m%d_%H%M%S).dump"
```
Para respaldar adicionalmente los archivos adjuntos (documentos y soportes de pago):
```bash
tar -czvf "sgec_storage_$(date +%Y%m%d_%H%M%S).tar.gz" storage/
```

### 6.2 Restauración (Restore)
Para restaurar una copia de seguridad en una base de datos limpia:
```bash
pg_restore -v -d sgec_dev --clean --if-exists "sgec_backup_YYYYMMDD_HHMMSS.dump"
```

---

## 7. Solución de Problemas Comunes (Troubleshooting)

### 7.1 Error `EADDRINUSE: address already in use :::3000`
- **Causa:** Existe otro proceso o una instancia previa del servidor escuchando en el puerto 3000.
- **Solución:**
  Identifique y termine el proceso:
  ```bash
  lsof -i :3000
  kill -9 <PID>
  ```
  O configure un puerto alternativo en `.env`: `PORT=3001`.

### 7.2 Error de migración o Postgres `23P01` (Exclusion violation)
- **Causa:** La base de datos no tiene habilitada la extensión `btree_gist` o se intentó insertar dos reservas simultáneas en el mismo espacio y franja horaria.
- **Solución:**
  Verifique que la extensión esté activa conectándose con `psql`:
  ```sql
  CREATE EXTENSION IF NOT EXISTS btree_gist;
  ```
  Si el error ocurre durante el uso del sistema, es el comportamiento esperado anti-solapamiento (ON-3) que es interceptado y traducido a HTTP 409 (`ConflictError`).

### 7.3 Fallo de permisos en sesiones (`connect-pg-simple`)
- **Causa:** La tabla `session` no existe o no tiene permisos de lectura/escritura.
- **Solución:**
  La migración inicial `20261013000000_init` crea automáticamente la tabla `session`. Si fue eliminada manualmente, ejecute:
  ```sql
  CREATE TABLE IF NOT EXISTS "session" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
  );
  CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
  ```

### 7.4 Error de autenticación en tests E2E (`Demasiados intentos fallidos`)
- **Causa:** El limitador de tasa (`express-rate-limit`) se activa al realizar más de 10 peticiones de login consecutivas en un período corto.
- **Solución:**
  El sistema está configurado para permitir hasta 1000 intentos en entornos `development` y deshabilitar el limitador en `test`. Si se ejecuta contra una base local de pruebas, asegúrese de que `NODE_ENV=test` o reinicie el servidor de desarrollo para refrescar la ventana de tiempo.
