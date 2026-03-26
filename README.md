# Documentacion Completa - Sistema Gestion PFC

## 1) Proposito del software

`Gestion PFC` es un sistema web interno para una cooperativa electrica, orientado a gestionar el **Plan de Financiamiento Colectivo (PFC)** desde una operacion diaria real:

- administrar socios y adherentes del plan,
- registrar y gestionar turnos medicos,
- controlar coberturas y reglas del plan,
- administrar profesionales, especialidades y agenda,
- ofrecer trazabilidad de atenciones e historial por paciente,
- visualizar indicadores gerenciales en dashboard.

El objetivo principal es combinar:

1. **Datos reales de facturacion/socios** (solo lectura),
2. **Operacion medica del PFC** (lectura/escritura total),
3. **Reglas de negocio del plan** para evitar errores operativos.

---

## 2) Alcance funcional actual

El sistema ya implementa estos modulos:

- **Dashboard**
- **Socios PFC**
- **Turnos**
- **Agenda Profesional**
- **Profesionales**
- **Especialidades**
- **Prestaciones**
- **Historial de socio/paciente**

Ademas, incluye endpoints de soporte para pruebas tecnicas y compatibilidad.

---

## 3) Arquitectura general

### 3.1 Frontend

- Framework: **Next.js 14 (App Router)**
- UI: **React + Tailwind CSS**
- Componentes: base UI/shadcn-style components
- Animaciones: **Framer Motion**
- Notificaciones: **Sonner**
- Iconos: **Lucide React**

### 3.2 Backend (BFF/API)

- API routes de Next.js en `src/app/api/**/route.ts`
- Driver SQL Server: **mssql**
- Validaciones y reglas de negocio en servidor (evita dependencia exclusiva del frontend)

### 3.3 Bases de datos

El sistema trabaja con **2 bases SQL Server**:

1. **Base de facturacion/cooperativa (solo lectura)**  
   Fuente principal de socios/adherentes del plan.

2. **Base PFC operativa (lectura/escritura)**  
   Gestiona turnos, agendas, coberturas, historial, profesionales y catalogos.

---

## 4) Conexion a SQL Server y pools

Archivo clave: `src/lib/sqlserver.ts`

Se usa estrategia de pools separados para evitar mezclar contexto de BD:

- `getSqlConnection()` -> pool **read-only**
- `getSqlConnectionPfc()` -> pool **PFC**

Variables de entorno requeridas:

- BD lectura:
  - `USER_DATABASE`
  - `PASSWORD_DATABASE`
  - `SERVER_DATABASE`
  - `DATABASE_NAME`
- BD PFC:
  - `USER_DATABASE_PFC`
  - `PASSWORD_DATABASE_PFC`
  - `SERVER_DATABASE_PFC`
  - `DATABASE_NAME_PFC`

Esto permite aislar claramente:

- consultas de socios (sin riesgo de escritura),
- operacion de turnos y cobertura (con control total en BD PFC).

---

## 5) Modelo de datos operativo (resumen)

## 5.1 Base de facturacion (read-only)

Vista usada como fuente principal:

- `PR_DORM.dbo.vw_socios_adherentes`

Campos funcionales relevantes:

- `COD_SOC`
- `ADHERENTE_CODIGO`
- `APELLIDOS`
- `ADHERENTE_NOMBRE`
- `VINCULO` (TITULAR, CONYUGE, HIJO/A, OTROS...)
- `DNI_ADHERENTE`
- `DES_CAT` (categoria del plan)
- `FECHA_NACIMIENTO` (usada para reglas por edad)

## 5.2 Base PFC (operativa)

Tablas principales:

- `turnos`
- `historial_atencion`
- `profesionales`
- `especialidades`
- `prestaciones`
- `agenda_profesional`
- `cobertura_anual`
- `cobertura_total_anual`

---

## 6) Modulos frontend y para que sirve cada uno

## 6.1 Dashboard

Proporciona una vision ejecutiva y operativa:

- personas cubiertas,
- titulares/adherentes,
- turnos del dia,
- profesionales activos,
- prestaciones del mes,
- clasificacion adherentes (hijo mayor de 18, menor de 18, beneficio titular),
- actividad reciente,
- tabla de turnos recientes.

Uso principal: direccion, coordinacion y recepcion para lectura rapida de estado.

## 6.2 Socios PFC

Permite:

- buscar por apellido, DNI o codigo,
- visualizar vinculo, categoria, edad, reglas de beneficio,
- abrir grupo familiar,
- navegar al historial completo por integrante,
- iniciar flujo de creacion de turno desde socio/adherente.

Incluye regla visual y de negocio para diferenciar:

- **HIJO/A mayor de 18** -> beneficio propio,
- **HIJO/A menor de 18 + CONYUGE + OTROS** -> beneficio del titular.

## 6.3 Turnos

Permite:

- listar turnos con estado,
- crear nuevos turnos (flujo guiado),
- marcar `ATENDIDO`, `AUSENTE`, `CANCELADO` segun reglas,
- impedir acciones fuera de horario o estado invalido.

## 6.4 Agenda Profesional

Gestiona disponibilidad semanal:

- dia de semana,
- hora inicio/fin,
- multiplicidad de bloques por profesional.

Base para calcular horarios disponibles.

## 6.5 Profesionales

ABM de profesionales:

- nombre, especialidad, duracion de turno,
- cupo/pacientes mensuales,
- visualizacion de usados/restantes por mes.

## 6.6 Especialidades y Prestaciones

Catalogos funcionales para:

- asociar prestaciones a especialidades,
- seleccionar opciones validas en turno,
- aplicar coberturas por categoria.

## 6.7 Historial de socio/paciente

Muestra:

- historial de turnos,
- resumen de estados,
- cobertura por prestacion,
- usadas/restantes,
- casos sin acceso (“No accede”).

---

## 7) Backend API - estructura y endpoints

Directorio base: `src/app/api`

### 7.1 Endpoints principales de operacion

- `GET /api/dashboard`
- `GET /api/socios?buscar=...`
- `GET /api/socios/[cod_soc]`
- `GET /api/socios/[cod_soc]/historial`
- `GET /api/historial-completo?cod_soc=&adherente_codigo=`
- `GET /api/turnos`
- `POST /api/turnos`
- `PUT/PATCH /api/turnos/[id]/atender`
- `PUT/PATCH /api/turnos/[id]/ausente`
- `PUT/PATCH /api/turnos/[id]/cancelar`
- `GET/POST /api/profesionales`
- `PUT/DELETE /api/profesionales/[id]`
- `GET /api/profesionales/[id]/disponibilidad?fecha=YYYY-MM-DD`
- `GET /api/agenda-profesional`
- `GET /api/agenda-profesional/[id]`
- `GET /api/especialidades`
- `GET /api/especialidades/[id]/prestaciones`
- `GET /api/prestaciones`
- `GET /api/prestaciones-disponibles?categoria=&especialidad_id=`

### 7.2 Endpoints auxiliares / compatibilidad / test

- `GET /api/test-sql`
- `GET /api/test-sql-pfc`
- `GET /api/test-table`
- `GET /api/agenda`
- `GET /api/cobertura`
- `GET /api/historial`

---

## 8) Consultas clave y logica SQL (resumen funcional)

## 8.1 Socios y adherentes (read-only)

Patron general:

- `SELECT ... FROM PR_DORM.dbo.vw_socios_adherentes`
- filtro por `buscar` (apellido, DNI, cod socio),
- orden por titular + adherentes.

Se calcula en backend:

- edad desde `FECHA_NACIMIENTO`,
- flags de hijo mayor de 18,
- tipo de beneficio (`PROPIO` / `TITULAR`).

## 8.2 Dashboard

Combina queries de ambas bases:

- conteos de personas/titulares/adherentes desde vista read-only,
- KPI operativos desde `turnos`, `agenda_profesional`,
- top prestaciones desde `turnos + prestaciones`,
- turnos recientes con joins a profesional/prestacion.

## 8.3 Disponibilidad de turnos

Para una fecha/profesional:

1. consulta agenda (bloques inicio-fin),
2. consulta ocupados en `turnos`,
3. genera slots por `duracion_turno`,
4. elimina slots ocupados.

## 8.4 Creacion de turno (POST /api/turnos)

Flujo validado en backend:

1. validar payload (soc, adherente, fecha, hora, profesional, etc.),
2. obtener categoria real del paciente desde vista de socios,
3. validar agenda profesional para ese dia/hora,
4. validar que el horario no este ocupado,
5. validar cupo mensual del profesional,
6. validar cobertura anual por prestacion (`cobertura_anual`),
7. validar cobertura total anual por especialidad (`cobertura_total_anual`),
8. insertar turno en `turnos`,
9. registrar evento en `historial_atencion`,
10. commit transaccional.

## 8.5 Ciclo de vida del turno

Estados activos:

- `RESERVADO`
- `ATENDIDO`
- `AUSENTE`
- `CANCELADO`

Cada cambio relevante:

- actualiza `turnos.estado`,
- inserta log en `historial_atencion` dentro de transaccion.

Reglas de tiempo:

- `ATENDIDO` / `AUSENTE` solo cuando la hora del turno ya paso.

---

## 9) Reglas de negocio importantes

## 9.1 Cobertura por plan y categoria

No se permite reservar si:

- la prestacion no tiene cobertura para la categoria,
- la especialidad excedio limite total anual,
- la prestacion excedio limite anual.

## 9.2 Cupo mensual profesional

Cada profesional tiene un maximo mensual (`pacientes_mensuales` o alias compatible).  
Si alcanza limite, se bloquea reserva adicional.

## 9.3 Regla adherente HIJO/A por edad

- `HIJO/A >= 18`: debe pagar cuota propia y tener beneficios propios.
- `HIJO/A < 18`: mantiene beneficios del titular.
- `CONYUGE` y `OTROS`: beneficio del titular.

Esta regla hoy impacta especialmente en:

- dashboard (metricas),
- socios (identificacion visual y operativa).

---

## 10) Frontend UX/UI y experiencia de uso

El sistema fue evolucionado a un lenguaje visual institucional moderno:

- layout con sidebar/header consistente,
- jerarquia de informacion por tarjetas, tablas y badges,
- feedback inmediato (toasts, estados de carga, vacios),
- animaciones sutiles con Framer Motion,
- tipografia optimizada (Geist + display),
- navegacion orientada a recepcion para reducir errores.

Puntos de usabilidad clave:

- accion rapida desde socio a crear turno,
- historial accesible por integrante,
- mensajes de error claros para cobertura y reglas,
- botones de estado contextuales segun hora real y estado actual.

---

## 11) Seguridad funcional y robustez tecnica

- validaciones de negocio en backend (no solo frontend),
- uso de transacciones para cambios de estado criticos,
- pools separados por base para evitar mezcla de contexto,
- uso de `requireEnv` para variables obligatorias,
- normalizacion de fecha/hora para evitar errores de parsing SQL/JS,
- manejo de errores uniforme (`success: false`, `error` descriptivo).

---

## 12) Flujo operativo recomendado (recepcion)

1. Buscar socio/adherente en `Socios PFC`.
2. Verificar regla de beneficio (titular/propio) y categoria.
3. Crear turno desde ficha/lista.
4. Seleccionar especialidad, prestacion y profesional disponible.
5. Confirmar reserva (queda `RESERVADO`).
6. Al pasar hora real:
   - marcar `ATENDIDO` o `AUSENTE`,
   - o `CANCELADO` segun corresponda.
7. Consultar historial completo para auditoria y cobertura remanente.

---

## 13) Estructura tecnica relevante

Archivos nucleares:

- `src/lib/sqlserver.ts` -> conexion y pools
- `src/lib/turnos-lifecycle.ts` -> transiciones de estado de turnos
- `src/app/api/**/route.ts` -> capa API
- `src/modules/socios/socios-page-client.tsx` -> UX principal de socios
- `src/app/turnos/page.tsx` y `src/app/turnos/nuevo/page.tsx` -> operacion de turnos
- `src/app/dashboard/page.tsx` + `src/app/api/dashboard/route.ts` -> vista ejecutiva

---

## 14) Instalacion y ejecucion

Requisitos:

- Node.js 18+
- acceso de red al SQL Server de cooperativa
- variables `.env` correctas para ambas bases

Comandos:

```bash
npm install
npm run dev
```

Compilacion productiva:

```bash
npm run build
npm run start
```

---

## 15) Problemas comunes y resolucion

### Error de conexion SQL

- verificar variables de entorno y credenciales,
- verificar acceso de red al servidor SQL,
- confirmar permisos sobre vista/tablas necesarias.

### Errores por diferencias de esquema

El sistema incluye resolucion dinamica de algunos nombres de columnas (alias), pero si cambia el esquema:

- revisar queries en `api/turnos`, `api/profesionales`, `api/historial-completo`.

### Turno no permite estado ATENDIDO/AUSENTE

- validar que hora del turno sea pasada respecto a hora actual,
- revisar parsing de fecha/hora en endpoints de estado.

---

## 16) Valor institucional del sistema

Este software convierte un proceso operativo sensible en un flujo controlado y auditable:

- mejora la calidad de atencion administrativa,
- reduce errores manuales en cobertura y beneficios,
- da trazabilidad medica-operativa por paciente,
- entrega visibilidad ejecutiva con datos reales de cooperativa,
- prepara una base escalable para evolucion futura (integraciones, automatizaciones, analitica avanzada).

En resumen: `Gestion PFC` es una plataforma administrativa-medica orientada a produccion real, con foco en control de cobertura, eficiencia operativa y claridad gerencial.

