import { enriquecerSocioConCobertura } from "@/lib/pfc-rules";

/** Fecha de migración desde el sistema anterior; no implica baja del servicio. */
export const FECHA_MIGRACION_PFC = "1901-01-01";

export type EstadoServicioPfc = "ACTIVO" | "BAJA" | "PENDIENTE" | "REVISAR";

export type SocioServicioPfcInput = {
  FECHA_ALTA?: unknown;
  FECHA_BAJA?: unknown;
  ES_MIGRADO?: unknown;
  ESTADO_SERVICIO?: unknown;
  SERVICIO_ACTIVO?: unknown;
};

export type SocioServicioPfcFields = {
  FECHA_ALTA: string | null;
  FECHA_BAJA: string | null;
  ES_MIGRADO: boolean;
  ESTADO_SERVICIO: EstadoServicioPfc;
  SERVICIO_ACTIVO: boolean;
  fecha_alta: string | null;
  fecha_baja: string | null;
  es_migrado: boolean;
  estado_servicio: EstadoServicioPfc;
  servicio_activo: boolean;
};

/** Columnas mínimas de vw_socios_adherentes para vigencia (el resto se calcula en backend). */
export const VW_SOCIOS_SERVICIO_SELECT_SQL = `
  FECHA_ALTA,
  FECHA_BAJA
`;

/** Filtro SQL cuando la VIEW expone SERVICIO_ACTIVO calculado. */
export const VW_SOCIOS_SERVICIO_ACTIVO_WHERE_SQL = `SERVICIO_ACTIVO = 1`;

function toDateOnly(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    const date = new Date(`${isoMatch[1]}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

export function fechaServicioToIso(value: unknown): string | null {
  const date = toDateOnly(value);
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function obtenerFechaReferenciaServicioPfc(referenceDate = new Date()): Date {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  return today;
}

export function esFechaMigracionPfc(fechaAlta: unknown): boolean {
  return fechaServicioToIso(fechaAlta) === FECHA_MIGRACION_PFC;
}

export function calcularEstadoServicioPfc(
  fechaAlta: unknown,
  fechaBaja: unknown,
  referenceDate = obtenerFechaReferenciaServicioPfc()
): EstadoServicioPfc {
  const alta = toDateOnly(fechaAlta);
  if (!alta) return "REVISAR";
  if (alta.getTime() > referenceDate.getTime()) return "PENDIENTE";

  const baja = toDateOnly(fechaBaja);
  if (baja && baja.getTime() < referenceDate.getTime()) return "BAJA";

  return "ACTIVO";
}

export function servicioPfcActivo(
  fechaAlta: unknown,
  fechaBaja: unknown,
  referenceDate = obtenerFechaReferenciaServicioPfc()
): boolean {
  return calcularEstadoServicioPfc(fechaAlta, fechaBaja, referenceDate) === "ACTIVO";
}

export function calcularCamposServicioPfc(
  row: SocioServicioPfcInput,
  referenceDate = obtenerFechaReferenciaServicioPfc()
): SocioServicioPfcFields {
  const fechaAltaIso = fechaServicioToIso(row.FECHA_ALTA);
  const fechaBajaIso = fechaServicioToIso(row.FECHA_BAJA);
  const esMigrado = esFechaMigracionPfc(row.FECHA_ALTA);
  const estadoServicio = calcularEstadoServicioPfc(row.FECHA_ALTA, row.FECHA_BAJA, referenceDate);
  const activo = servicioPfcActivo(row.FECHA_ALTA, row.FECHA_BAJA, referenceDate);

  return {
    FECHA_ALTA: fechaAltaIso,
    FECHA_BAJA: fechaBajaIso,
    ES_MIGRADO: esMigrado,
    ESTADO_SERVICIO: estadoServicio,
    SERVICIO_ACTIVO: activo,
    fecha_alta: fechaAltaIso,
    fecha_baja: fechaBajaIso,
    es_migrado: esMigrado,
    estado_servicio: estadoServicio,
    servicio_activo: activo,
  };
}

export function enriquecerSocioConServicioPfc<T extends SocioServicioPfcInput>(
  row: T,
  referenceDate = obtenerFechaReferenciaServicioPfc()
) {
  return {
    ...row,
    ...calcularCamposServicioPfc(row, referenceDate),
  };
}

export function enriquecerSocioCompleto(
  row: Record<string, unknown>,
  referenceDate = obtenerFechaReferenciaServicioPfc()
) {
  const withCobertura = enriquecerSocioConCobertura(row as Parameters<typeof enriquecerSocioConCobertura>[0]);
  return enriquecerSocioConServicioPfc(
    {
      ...withCobertura,
      FECHA_ALTA: row.FECHA_ALTA,
      FECHA_BAJA: row.FECHA_BAJA,
    },
    referenceDate
  );
}

export type ValidacionServicioPfcResult =
  | { ok: true; estado: EstadoServicioPfc }
  | { ok: false; error: string; estado: EstadoServicioPfc };

export function validarServicioPfcParaNuevaOperacion(
  row: SocioServicioPfcInput | null | undefined,
  referenceDate = obtenerFechaReferenciaServicioPfc()
): ValidacionServicioPfcResult {
  if (!row) {
    return {
      ok: false,
      estado: "REVISAR",
      error: "No se encontró el servicio PFC del paciente en la base oficial.",
    };
  }

  const estado = calcularEstadoServicioPfc(row.FECHA_ALTA, row.FECHA_BAJA, referenceDate);

  if (estado === "ACTIVO") {
    return { ok: true, estado };
  }

  if (estado === "BAJA") {
    const fechaBaja = fechaServicioToIso(row.FECHA_BAJA);
    return {
      ok: false,
      estado,
      error: fechaBaja
        ? `El servicio PFC se encuentra dado de baja (fecha de baja: ${fechaBaja}). No es posible registrar nuevos turnos ni utilizar cobertura vigente.`
        : "El servicio PFC se encuentra dado de baja. No es posible registrar nuevos turnos ni utilizar cobertura vigente.",
    };
  }

  if (estado === "PENDIENTE") {
    const fechaAlta = fechaServicioToIso(row.FECHA_ALTA);
    return {
      ok: false,
      estado,
      error: fechaAlta
        ? `El servicio PFC aún no está vigente (alta programada: ${fechaAlta}). No es posible registrar nuevos turnos.`
        : "El servicio PFC aún no está vigente. No es posible registrar nuevos turnos.",
    };
  }

  return {
    ok: false,
    estado,
    error: "No se pudo verificar la vigencia del servicio PFC. No es posible registrar nuevos turnos.",
  };
}

export function filtrarFilasServicioPfcActivo<T extends SocioServicioPfcInput>(
  rows: T[],
  referenceDate = obtenerFechaReferenciaServicioPfc()
): T[] {
  return rows.filter((row) => servicioPfcActivo(row.FECHA_ALTA, row.FECHA_BAJA, referenceDate));
}
