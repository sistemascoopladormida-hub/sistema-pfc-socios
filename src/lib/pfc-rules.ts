export type EstadoBeneficio = "COBERTURA_FAMILIAR" | "CUOTA_PROPIA_REQUERIDA";

export type SocioCoberturaInput = {
  VINCULO?: unknown;
  FECHA_NACIMIENTO?: unknown;
  EDAD?: number | null;
};

export type CoberturaBeneficiarioResult = {
  edad: number | null;
  esConyuge: boolean;
  requiereCuotaPropia: boolean;
  comparteCobertura: boolean;
  estadoBeneficio: EstadoBeneficio;
};

function normalizeVinculo(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseDate(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function calcularEdadDesdeNacimiento(fechaNacimiento: unknown, today = new Date()) {
  const nacimiento = parseDate(fechaNacimiento);
  if (!nacimiento) return null;

  let edad = today.getFullYear() - nacimiento.getFullYear();
  const monthDiff = today.getMonth() - nacimiento.getMonth();
  const dayDiff = today.getDate() - nacimiento.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    edad -= 1;
  }

  return edad >= 0 ? edad : null;
}

function resolveEdad(persona: SocioCoberturaInput): number | null {
  if (persona.EDAD !== undefined && persona.EDAD !== null && Number.isFinite(Number(persona.EDAD))) {
    return Number(persona.EDAD);
  }
  return calcularEdadDesdeNacimiento(persona.FECHA_NACIMIENTO);
}

function esVinculoConyuge(vinculo: unknown) {
  const normalized = normalizeVinculo(vinculo);
  return normalized === "CONYUGE" || normalized.startsWith("CONYUG");
}

function esVinculoTitular(vinculo: unknown) {
  return normalizeVinculo(vinculo) === "TITULAR";
}

export function esVinculoHijoPfc(vinculo: unknown) {
  const normalized = normalizeVinculo(vinculo);
  return normalized.startsWith("HIJ") || normalized.includes(" HIJ");
}

/**
 * Regla oficial PFC: cobertura propia requerida.
 * Única fuente de verdad para toda la aplicación.
 */
export function requiereCoberturaPropia(persona: SocioCoberturaInput): boolean {
  const edad = resolveEdad(persona);
  if (edad === null || edad < 18) return false;
  if (esVinculoTitular(persona.VINCULO)) return false;
  if (esVinculoConyuge(persona.VINCULO)) return false;
  return true;
}

export function calcularCoberturaBeneficiario(socio: SocioCoberturaInput): CoberturaBeneficiarioResult {
  const edad = resolveEdad(socio);
  const esConyuge = esVinculoConyuge(socio.VINCULO);
  const requiereCuotaPropia = requiereCoberturaPropia({ ...socio, EDAD: edad });
  const comparteCobertura = !requiereCuotaPropia;
  const estadoBeneficio: EstadoBeneficio = requiereCuotaPropia
    ? "CUOTA_PROPIA_REQUERIDA"
    : "COBERTURA_FAMILIAR";

  return {
    edad,
    esConyuge,
    requiereCuotaPropia,
    comparteCobertura,
    estadoBeneficio,
  };
}

export function enriquecerSocioConCobertura<T extends SocioCoberturaInput>(row: T) {
  const cobertura = calcularCoberturaBeneficiario(row);

  return {
    ...row,
    EDAD: cobertura.edad,
    ES_HIJO: esVinculoHijoPfc(row.VINCULO),
    REQUIERE_CUOTA_PROPIA: cobertura.requiereCuotaPropia,
    COMPARTE_COBERTURA: cobertura.comparteCobertura,
    ESTADO_BENEFICIO: cobertura.estadoBeneficio,
    TIPO_BENEFICIO: cobertura.comparteCobertura ? ("TITULAR" as const) : ("PROPIO" as const),
  };
}
