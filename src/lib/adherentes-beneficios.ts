export type TipoBeneficio = "PROPIO" | "TITULAR" | "NO_DEFINIDO";

function normalize(value: unknown) {
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

export function calcularEdad(fechaNacimiento: unknown, today = new Date()) {
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

export function esVinculoHijo(vinculo: unknown) {
  const v = normalize(vinculo);
  return v.startsWith("HIJ") || v.includes(" HIJ");
}

export function resolverBeneficio(vinculo: unknown, fechaNacimiento: unknown): TipoBeneficio {
  const edad = calcularEdad(fechaNacimiento);
  if (esVinculoHijo(vinculo)) {
    if (edad === null) return "NO_DEFINIDO";
    return edad >= 18 ? "PROPIO" : "TITULAR";
  }

  const v = normalize(vinculo);
  if (v === "CONYUGE" || v === "OTROS" || v === "OTRO" || v === "TITULAR") {
    return "TITULAR";
  }

  return "TITULAR";
}
