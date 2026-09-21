# Desarrollo local y despliegue en servidor — Guía de referencia

Este documento explica **cómo funciona hoy el proyecto `pfc-gestion-system`** en desarrollo (PC de trabajo) y en el **servidor de la cooperativa**, con foco en **conexión a SQL Server**, variables de entorno y pasos para **replicar el mismo esquema en un segundo proyecto** con una base de datos nueva.

> **Seguridad:** no subas archivos `.env` / `.env.local` a Git. Usa contraseñas de ejemplo en documentación y credenciales reales solo en el servidor o en tu máquina local.

---

## 1. Resumen del stack

| Capa | Tecnología |
|------|------------|
| Aplicación | **Next.js 14** (App Router), React 18, TypeScript |
| API | Rutas en `src/app/api/**/route.ts` (Backend-for-Frontend) |
| Base de datos | **Microsoft SQL Server** vía paquete **`mssql`** |
| Estilos | Tailwind CSS 4 |
| Desarrollo | `npm run dev` (puerto **3000** por defecto) |
| Producción | `npm run build` + `npm run start` |

La aplicación **no embebe** la cadena de conexión en el código: todo sale de **variables de entorno** leídas en `src/lib/sqlserver.ts`.

---

## 2. Arquitectura de bases de datos (Gestión PFC)

Este proyecto usa **dos conexiones SQL Server** al **mismo servidor** (IP/host), pero **dos bases distintas** y **dos usuarios** recomendados:

```text
┌─────────────────────────────────────────────────────────────────┐
│  PC desarrollo / Servidor Windows (Node.js + Next.js)           │
│                                                                 │
│  getSqlConnection()      ──►  BD ERP / facturación (SOLO LECTURA) │
│  getSqlConnectionPfc()   ──►  BD PFC operativa (LECTURA/ESCR.)  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ TCP (típ. puerto 1433)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  SQL Server (ej. 192.168.x.x)                                   │
│                                                                 │
│  [DATABASE_NAME]        ej. PR_DORM  → vistas/tablas ERP        │
│  [DATABASE_NAME_PFC]    ej. PFC      → turnos, coberturas, etc. │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 Base ERP (solo lectura desde la app)

- **Función:** datos oficiales de socios, adherentes, categorías PFC.
- **En código:** `getSqlConnection()` en `src/lib/sqlserver.ts`.
- **Fuente principal:** vista `dbo.vw_socios_adherentes` (en la práctica se consulta como `PR_DORM.dbo.vw_socios_adherentes` cuando el nombre de base es `PR_DORM`).
- **Regla de negocio:** la aplicación **no debe escribir** en tablas ERP desde estos endpoints.

### 2.2 Base PFC (operativa)

- **Función:** turnos, profesionales, prestaciones, coberturas, historial, ortopedia, etc.
- **En código:** `getSqlConnectionPfc()`.
- **Migraciones ligeras:** `runMigrations()` en el mismo archivo puede ejecutar `ALTER TABLE` mínimos al arrancar ciertos flujos (ej. columna `es_carga_manual` en `turnos`).

### 2.3 Segundo proyecto (plantilla)

Si el nuevo sistema **solo necesita una base propia** (sin ERP):

1. Copiá el patrón de **`getSqlConnectionPfc()`** (un pool, un bloque de variables).
2. Opcional: mantené un segundo pool si también consumís datos de `PR_DORM` u otra base legacy.

Si el nuevo sistema **también consume ERP + base propia**:

1. Duplicá el esquema de variables: bloque `USER_DATABASE` / `USER_DATABASE_PFC` (podés renombrar sufijos, ej. `_APP` en lugar de `_PFC`).
2. Duplicá o generalizá `buildConfig()` en un `sqlserver.ts` del nuevo repo.
3. Creá en SQL Server **usuario con permisos mínimos**: `SELECT` en ERP, `db_owner` o rol custom en la base nueva.

---

## 3. Variables de entorno (detalle)

Next.js carga, en este orden de prioridad (simplificado):

1. `.env.local` (local, **no commitear**)
2. `.env`

Ambos archivos en la **raíz del proyecto** (`pfc-gestion-system/`).

### 3.1 Conexión base ERP (lectura)

| Variable | Significado | Ejemplo (placeholder) |
|----------|-------------|---------------------|
| `USER_DATABASE` | Login SQL Server | `usuario_erp_lectura` |
| `PASSWORD_DATABASE` | Contraseña | `********` |
| `SERVER_DATABASE` | Host o IP del SQL Server | `192.168.1.118` |
| `DATABASE_NAME` | Nombre de la base ERP | `PR_DORM` |

### 3.2 Conexión base operativa PFC

| Variable | Significado | Ejemplo (placeholder) |
|----------|-------------|---------------------|
| `USER_DATABASE_PFC` | Login SQL Server | `usuario_pfc_app` |
| `PASSWORD_DATABASE_PFC` | Contraseña | `********` |
| `SERVER_DATABASE_PFC` | Mismo servidor o instancia | `192.168.1.118` |
| `DATABASE_NAME_PFC` | Base operativa del sistema | `PFC` |

Para tu **nuevo proyecto**, reemplazá `DATABASE_NAME_PFC` por el nombre de la base que creaste (ej. `MI_NUEVO_SISTEMA`) y usá un login dedicado con permisos solo sobre esa base (y sobre ERP si aplica).

### 3.3 Cómo las usa el código

En `src/lib/sqlserver.ts`:

```typescript
// Pseudoconfiguración real del proyecto
options: {
  encrypt: false,
  trustServerCertificate: true,
}
```

- **`server`:** valor de `SERVER_DATABASE` / `SERVER_DATABASE_PFC` (IP, hostname o `HOST\INSTANCIA`).
- **`database`:** nombre exacto de la base en SQL Server.
- **`encrypt: false`:** habitual en red interna/LAN; si el servidor exige TLS, habría que ajustar (consultar con administración SQL).
- **`trustServerCertificate: true`:** acepta certificado del servidor sin cadena corporativa (típico en entornos internos).

Si falta cualquier variable, la app lanza:  
`Missing required environment variable: NOMBRE_VARIABLE`.

### 3.4 Plantilla `.env.local` (copiar y completar)

```env
# --- ERP / solo lectura ---
USER_DATABASE=usuario_erp
PASSWORD_DATABASE=contraseña_segura
SERVER_DATABASE=192.168.1.118
DATABASE_NAME=PR_DORM

# --- Base operativa del sistema ---
USER_DATABASE_PFC=usuario_app
PASSWORD_DATABASE_PFC=contraseña_segura
SERVER_DATABASE_PFC=192.168.1.118
DATABASE_NAME_PFC=PFC
```

**Segundo proyecto:** mismo archivo en la raíz del nuevo repo, cambiando `DATABASE_NAME_PFC` y credenciales; si no usa ERP, podés eliminar el bloque superior y simplificar `sqlserver.ts` a un solo pool.

---

## 4. Desarrollo en tu PC (local) apuntando al SQL del servidor

Escenario habitual en este proyecto: **Node.js corre en tu notebook/PC**, pero **SQL Server está en la red de la cooperativa** (servidor `192.168.x.x`).

### 4.1 Requisitos en la PC de desarrollo

- **Node.js 18+** (recomendado LTS).
- Acceso de red al servidor SQL (VPN o LAN).
- Puerto **1433** (o el que use la instancia) **abierto** desde tu PC hacia el servidor.
- Clon del repo y carpeta de trabajo, ej. `Desktop\sistema PFC\pfc-gestion-system`.

### 4.2 Pasos

```powershell
cd "ruta\al\proyecto\pfc-gestion-system"
npm install
```

Creá o editá **`.env.local`** con las ocho variables (sección 3).

Arranque en desarrollo:

```powershell
npm run dev
```

Abrí en el navegador:

- App: `http://localhost:3000`
- Login: `http://localhost:3000/login` (roles definidos en `src/lib/roles.ts`, cookie `rol` para middleware).

### 4.3 Probar conexión SQL sin usar la UI

Los endpoints de prueba **no pasan por el middleware de login** (las rutas `/api/*` están excluidas del matcher de cookies).

| URL | Qué prueba |
|-----|------------|
| `http://localhost:3000/api/test-sql` | Pool ERP → `SELECT GETDATE()` |
| `http://localhost:3000/api/test-sql-pfc` | Pool PFC → `DB_NAME()`, `GETDATE()` |

Respuesta esperada:

```json
{
  "success": true,
  "message": "Conexion exitosa ...",
  "data": [ { "serverTime": "..." } ]
}
```

Si falla, revisá sección 8 (troubleshooting).

### 4.4 Qué ocurre al guardar código

- Next.js recarga rutas y API en caliente.
- Los **pools SQL** se reutilizan mientras el proceso `next dev` siga vivo; si cambiás `.env.local`, **reiniciá** `npm run dev`.

---

## 5. Ejecución en el servidor (producción / intranet)

En el servidor donde debe quedar el sistema accesible para usuarios internos:

### 5.1 Requisitos en el servidor

- **Node.js 18+** instalado.
- Código del proyecto (Git clone, copia o despliegue).
- **SQL Server accesible desde el mismo servidor** (localhost `127.0.0.1` o IP interna) — suele ser más estable que depender de otra máquina.
- Variables de entorno en **`.env.local`** o **`.env`** en la raíz del proyecto (mismas claves que en desarrollo).
- Carpeta **`uploads/`** con permiso de escritura si el módulo usa archivos (ortopedia: `uploads/ortopedia/`).

### 5.2 Build y start

```powershell
cd "ruta\en\servidor\pfc-gestion-system"
npm install
npm run build
npm run start
```

Por defecto Next escucha en **puerto 3000**. Para otro puerto:

```powershell
$env:PORT=8080; npm run start
```

### 5.3 Exponer a la red interna

Opciones habituales (elegir una según infraestructura):

1. **Acceso directo:** `http://IP-DEL-SERVidor:3000` (firewall Windows: regla entrante TCP 3000).
2. **Reverse proxy:** IIS + ARR, nginx o Caddy delante de Node (`proxy_pass` a `localhost:3000`).
3. **Servicio Windows:** NSSM / PM2 para que `npm run start` reinicie si cae.

Este repo **no incluye** Dockerfile ni script de IIS; la convención actual es Node + `next start`.

### 5.4 Diferencia local vs servidor

| Aspecto | PC desarrollo | Servidor |
|---------|---------------|----------|
| Comando | `npm run dev` | `npm run build` + `npm run start` |
| Hot reload | Sí | No |
| `.env.local` | Tu copia | Copia del servidor (credenciales de prod) |
| SQL `SERVER_*` | IP del SQL en LAN | A menudo misma IP o `localhost` si SQL está en el mismo host |
| Rendimiento | Aceptable para dev | Usar build de producción |

---

## 6. Configuración en SQL Server (administración)

Pasos que debe hacer quien administra SQL Server (para PFC o para la **nueva base** del segundo proyecto).

### 6.1 Instancia y conectividad

1. **SQL Server Configuration Manager** → Protocolos → **TCP/IP habilitado**.
2. Puerto **1433** (o anotar el dinámico si aplica).
3. **Firewall Windows** en el servidor SQL: permitir TCP entrante al puerto de la instancia.
4. **SQL Server Browser** (opcional): necesario si conectás con `SERVIDOR\NOMBREINSTANCIA` en lugar de IP + puerto fijo.

### 6.2 Crear la base del nuevo proyecto

```sql
CREATE DATABASE MI_NUEVO_SISTEMA;
GO
```

Restaurar backup, ejecutar scripts `sql/*.sql` del nuevo repo, o migrar esquema desde PFC si es un clon funcional.

### 6.3 Crear login y usuario

Ejemplo **solo base operativa** (recomendado para la app):

```sql
-- En master: login de servidor
CREATE LOGIN usuario_app WITH PASSWORD = 'ContraseñaFuerte123!';
GO

USE MI_NUEVO_SISTEMA;
CREATE USER usuario_app FOR LOGIN usuario_app;
ALTER ROLE db_owner ADD MEMBER usuario_app;  -- o rol más restrictivo según política
GO
```

Ejemplo **lectura ERP** (como en PFC):

```sql
CREATE LOGIN usuario_erp_lectura WITH PASSWORD = 'OtraContraseñaFuerte!';
GO

USE PR_DORM;
CREATE USER usuario_erp_lectura FOR LOGIN usuario_erp_lectura;
GRANT SELECT ON SCHEMA::dbo TO usuario_erp_lectura;
-- Si usan vistas concretas:
GRANT SELECT ON dbo.vw_socios_adherentes TO usuario_erp_lectura;
GO
```

### 6.4 Autenticación

El driver `mssql` usa **autenticación SQL** (usuario/contraseña), no Windows integrated auth, salvo que modifiquen `sqlserver.ts` para `options.trustedConnection`.

### 6.5 Permisos mínimos recomendados

| Base | Usuario app | Permisos |
|------|-------------|----------|
| ERP | `usuario_erp_lectura` | `SELECT` en vistas/tablas necesarias |
| Operativa | `usuario_app` | `SELECT/INSERT/UPDATE/DELETE` según tablas; DDL solo si usan migraciones automáticas |

---

## 7. Replicar el patrón en un segundo proyecto Next.js

Checklist práctico:

1. **Crear repo/carpeta** del nuevo sistema (misma versión Node/Next si querés paridad).
2. **Copiar/adaptar** `src/lib/sqlserver.ts`:
   - Un pool → una base.
   - Dos pools → ERP + app (renombrar variables en `.env`).
3. **Archivo `.env.local`** en la raíz con todas las variables que llame `requireEnv`.
4. **Scripts SQL** iniciales en carpeta `sql/` y ejecutarlos en la base nueva.
5. **Probar** endpoints `GET /api/test-sql` y/o crear `test-sql-app` equivalente a `test-sql-pfc`.
6. **Red:** desde la PC de dev, ping/telnet al puerto SQL del servidor.
7. **No commitear** `.env` con secretos; usar `.gitignore` con `.env*.local`.

Si el segundo proyecto es **clon de PFC** con otra base:

- Cambiá solo `DATABASE_NAME_PFC` y credenciales PFC.
- Mantené ERP igual si sigue leyendo `vw_socios_adherentes`.
- Revisá scripts en `sql/` (ortopedia, turnos, etc.) y ejecutá los que correspondan a la nueva base vacía.

---

## 8. Solución de problemas

### 8.1 `Missing required environment variable`

- Falta una clave en `.env` / `.env.local`.
- Typo en el nombre (debe ser exacto: `SERVER_DATABASE_PFC`, etc.).
- Reiniciar `npm run dev` después de editar env.

### 8.2 `ConnectionError` / timeout / ESOCKET

- SQL Server apagado o instancia incorrecta.
- IP/host incorrecto en `SERVER_DATABASE*`.
- Firewall bloqueando 1433.
- TCP/IP deshabilitado en SQL Server.
- Probar desde la misma máquina con **SSMS** usando el mismo usuario/contraseña.

### 8.3 Login failed for user

- Contraseña incorrecta en `.env.local`.
- Login creado en master pero usuario no mapeado en la base (`USE MiBase; CREATE USER ...`).

### 8.4 Invalid object name / permiso denegado

- Base correcta en `DATABASE_NAME` / `DATABASE_NAME_PFC`.
- Usuario ERP sin `SELECT` sobre la vista.
- Vista `vw_socios_adherentes` no desplegada (ejecutar script en `sql/2026_vw_socios_adherentes_servicio_pfc.sql` en **PR_DORM**, no en PFC).

### 8.5 La app carga pero `/api/socios` falla

- Casi siempre pool ERP: red, permisos o vista inexistente.
- Revisar respuesta JSON `{ success: false, error: "..." }`.

### 8.6 Login web OK pero “no autorizado” en páginas

- Middleware (`middleware.ts`) exige cookie `rol` con valores permitidos.
- Login setea cookie en el navegador; dominio/puerto debe ser el mismo origen.

---

## 9. Archivos clave de referencia en este repo

| Archivo | Rol |
|---------|-----|
| `src/lib/sqlserver.ts` | Configuración `mssql`, pools, migración mínima |
| `.env` / `.env.local` | Credenciales (local/servidor) |
| `package.json` | Scripts `dev`, `build`, `start` |
| `middleware.ts` | Protección de rutas UI (no API) |
| `src/app/api/test-sql/route.ts` | Prueba pool ERP |
| `src/app/api/test-sql-pfc/route.ts` | Prueba pool operativo |
| `sql/*.sql` | Scripts a ejecutar en SQL Server (según módulo) |
| `README.md` | Documentación funcional ampliada |

---

## 10. Flujo mental rápido

```text
1. Definir qué bases usa el sistema (1 o 2).
2. Crear base + usuario SQL con permisos correctos.
3. Poner USER/PASSWORD/SERVER/DATABASE en .env.local.
4. npm install → npm run dev (local) o build+start (servidor).
5. GET /api/test-sql y /api/test-sql-pfc → success true.
6. Login → módulos que consumen API.
```

Con esto, **Gestión PFC** y un **segundo proyecto** pueden compartir la misma forma de trabajar: Next.js en Node, SQL Server en la red, configuración exclusivamente por variables de entorno y pools centralizados en `sqlserver.ts`.

---

*Documento generado para el equipo de desarrollo interno. Actualizar cuando cambien host SQL, nombres de base o variables de entorno.*
