const ISO_CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function esFechaTurnoISOValida(value: string): boolean {
  if (!ISO_CALENDAR_DAY.test(value)) return false;
  const ts = Date.parse(`${value}T12:00:00`);
  return !Number.isNaN(ts);
}

/** Etiqueta “mes año” estable para la fecha ISO del turno. */
export function etiquetaMesAnioTurnoEs(fechaIso: string): string {
  const d = new Date(`${fechaIso}T12:00:00`);
  const texto = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(d);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
