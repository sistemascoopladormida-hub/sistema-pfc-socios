# Optimizacion de consultas - Socios e Historial

## Objetivo

Reducir la latencia percibida en:

- Modulo `Socios PFC`
- Vista `Historial del socio/paciente`

sin cambiar la logica funcional del sistema.

## Cambios aplicados

### 1) Debounce en busqueda de socios (frontend)

Archivo: `src/modules/socios/socios-page-client.tsx`

- Se agrego `debouncedQuery` con espera de `350ms`.
- La consulta a `/api/socios` ahora se dispara luego de la pausa de escritura.

**Impacto:** evita rafagas de requests al escribir y reduce carga en SQL Server.

---

### 2) Limite explicito de resultados (backend + frontend)

Archivos:

- `src/app/api/socios/route.ts`
- `src/modules/socios/socios-page-client.tsx`

- Se agrego parametro `limit` al endpoint.
- Valor por defecto: `2500`.
- Tope maximo permitido: `5000`.

**Impacto:** se evita traer volumen ilimitado por request y se mantiene cobertura suficiente para el escenario actual.

---

### 3) Consulta de socios mas eficiente

Archivo: `src/app/api/socios/route.ts`

- Se prioriza coincidencia por `COD_SOC` exacto.
- Se usa prefijo para apellido (`APELLIDOS LIKE @buscar + '%'`) para mejorar selectividad.
- Se mantiene soporte por DNI.
- Se agrego orden por relevancia de coincidencia.

**Impacto:** respuestas mas rapidas y resultados mas relevantes.

---

### 4) Cache en memoria para consultas repetidas de socios

Archivos:

- `src/app/api/socios/route.ts`
- `src/app/api/socios/[cod_soc]/route.ts`

- Cache por clave de busqueda/ID.
- TTL corto:
  - Busqueda socios: `20s`
  - Grupo familiar por socio: `30s`

**Impacto:** repeticion de consultas frecuentes con menor costo en BD.

---

### 5) Menos roundtrips en historial (frontend)

Archivo: `src/app/socios/[id]/[adherente]/historial/page.tsx`

- Antes: 2 fetch secuenciales (`/api/historial-completo` + `/api/socios/:cod_soc`).
- Ahora: 1 fetch (`/api/historial-completo`) con info del paciente incluida.

**Impacto:** menor tiempo de espera total al abrir historial.

---

### 6) Endpoint de historial enriquecido con datos del paciente

Archivo: `src/app/api/historial-completo/route.ts`

- Se incluye `paciente` en la respuesta:
  - `codSoc`
  - `adherenteCodigo`
  - `nombre`
  - `vinculo`
  - `dni`
  - `edad`

**Impacto:** evita consultas adicionales en UI y simplifica render.

---

### 7) Cache de metadatos de columnas (INFORMATION_SCHEMA)

Archivo: `src/app/api/historial-completo/route.ts`

- Se cachea listado de columnas por tabla (TTL: `10 minutos`).
- Reutilizado por `resolveColumnByAliases`.

**Impacto:** elimina consultas repetitivas a metadatos en cada request del historial.

---

## Validacion realizada

- Linter/diagnosticos: sin errores en archivos modificados.
- Build de produccion (`npm run build`): OK.

## Recomendaciones adicionales (opcional, siguiente etapa)

Para seguir mejorando rendimiento en SQL Server:

1. Crear indices en tablas operativas:
   - `turnos(cod_soc, adherente_codigo, fecha, estado)`
   - `turnos(profesional_id, fecha, hora)`
   - `historial_atencion(turno_id, estado, fecha)`
2. Medir tiempos con query plans sobre:
   - busqueda de socios
   - historial completo por paciente
3. Si se requiere, separar endpoint de busqueda y endpoint de resumen estadistico para `Socios`.

