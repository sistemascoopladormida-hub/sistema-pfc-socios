import type { PrestamoExpediente } from "@/modules/ortopedia/types";

export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("es-AR", { timeZone: "UTC" });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("es-AR");
}

export function formatDni(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 7) return String(value ?? "-").trim() || "-";
  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function prestamoEstadoLabel(estado: string) {
  switch (estado.toUpperCase()) {
    case "ACTIVO":
      return "Prestado";
    case "DEVUELTO":
      return "Devuelto";
    case "VENCIDO":
      return "Vencido";
    case "RESERVADO":
      return "Reservado";
    default:
      return estado;
  }
}

export function prestamoEstadoVariant(estado: string): "default" | "secondary" | "destructive" | "outline" {
  switch (estado.toUpperCase()) {
    case "ACTIVO":
      return "default";
    case "DEVUELTO":
      return "secondary";
    case "VENCIDO":
      return "destructive";
    default:
      return "outline";
  }
}

export function resolveCertificadoHref(prestamo: PrestamoExpediente) {
  if (prestamo.certificado_href) return prestamo.certificado_href;
  if (prestamo.certificado_url) return prestamo.certificado_url;
  if (prestamo.certificado_ruta) return `/api/ortopedia/prestamos/${prestamo.id}/certificado`;
  return null;
}

export function tramiteDisplay(prestamo: PrestamoExpediente) {
  if (prestamo.tramite_es_titular || normalizeVinculo(prestamo.tramite_vinculo) === "TITULAR") {
    return {
      titulo: "Titular del servicio",
      nombre: prestamo.tramite_nombre || prestamo.titular_nombre,
      dni: prestamo.tramite_dni,
      telefono: prestamo.tramite_telefono,
      vinculo: "Titular",
      esTitular: true,
    };
  }

  return {
    titulo: "Tramite realizado por",
    nombre: prestamo.tramite_nombre || "-",
    dni: prestamo.tramite_dni,
    telefono: prestamo.tramite_telefono,
    vinculo: prestamo.tramite_vinculo || "-",
    esTitular: false,
  };
}

function normalizeVinculo(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export const CERTIFICADO_ACCEPT = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";
