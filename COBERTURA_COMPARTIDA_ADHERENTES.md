# Cobertura compartida por grupo familiar (Titular / Adherentes)

## Objetivo

Implementar la regla de negocio:

- **Comparte beneficios del titular**: `TITULAR`, `CONYUGE`, `OTROS`, `HIJO/A` menor de 18.
- **Beneficio propio**: `HIJO/A` mayor o igual a 18.

Esto aplica en:

1. Visualización de cobertura en historial del paciente.
2. Validación de cobertura al crear turnos.

---

## Cambios aplicados en código

### 1) Validación de cobertura en creación de turnos

Archivo: `src/app/api/turnos/route.ts`

- Se incorporó `resolverBeneficio()` para determinar el tipo de beneficio del paciente.
- Se consulta el grupo familiar completo del `cod_soc`.
- Se define el alcance de consumo:
  - **PROPIO**: solo `cod_soc + adherente_codigo`.
  - **TITULAR**: `cod_soc` + lista de adherentes que comparten beneficios del titular.
- Las consultas de consumo anual por prestación y por especialidad ahora usan ese alcance dinámico.

Resultado:

- Si el paciente es de beneficio compartido, consume del mismo cupo del grupo.
- Si el paciente es de beneficio propio, consume su cupo individual.

---

### 2) Cobertura en historial del paciente

Archivo: `src/app/api/historial-completo/route.ts`

- Se aplica la misma lógica de alcance (`PROPIO` vs `TITULAR`) para calcular sesiones utilizadas.
- El consumo mostrado en el historial ahora refleja correctamente el uso compartido del grupo cuando corresponde.
- Se agrega `tipoBeneficio` en el bloque `paciente` de la respuesta (informativo para frontend/debug).

Resultado:

- La tarjeta de cobertura en historial muestra valores reales según regla familiar.

---

## Archivos modificados

- `src/app/api/turnos/route.ts`
- `src/app/api/historial-completo/route.ts`
- `src/app/socios/[id]/[adherente]/historial/page.tsx` (tipado de respuesta)

---

## Ajustes recomendados en base de datos

## ¿Es obligatorio modificar BD?

**No obligatorio** para que funcione la regla ahora.  
Ya quedó resuelto por código.

## ¿Qué sí conviene agregar (recomendado)?

Para auditoría histórica y evitar ambigüedad cuando un hijo cumple 18 durante el año:

1. En `turnos`, agregar columna de snapshot:
   - `tipo_beneficio_al_momento` (`VARCHAR(20)`, valores: `TITULAR` / `PROPIO`).
2. En `turnos`, agregar columna de alcance:
   - `cobertura_scope` (`VARCHAR(20)`, valores: `COMPARTIDA` / `INDIVIDUAL`).
3. Opcional: guardar estos mismos datos en `historial_atencion` al registrar eventos.

Con eso, el cálculo de cobertura histórica no dependerá de la edad actual del paciente, sino del estado al momento de cada sesión.

---

## Índices recomendados (performance)

Para mejorar tiempos de consulta:

1. `turnos(cod_soc, adherente_codigo, estado, fecha)`
2. `turnos(cod_soc, estado, fecha, prestacion_id)`
3. `turnos(cod_soc, estado, fecha, especialidad_id)`

---

## Notas de negocio importantes

- El sistema sigue tomando categoría (`DES_CAT`) del paciente para resolver límites de plan.
- El consumo cambia según beneficio compartido/propio.
- El caso de transición de edad (cumple 18) queda mejor resuelto si se implementa snapshot en BD.
