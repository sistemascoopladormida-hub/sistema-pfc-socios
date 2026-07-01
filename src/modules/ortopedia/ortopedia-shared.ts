import type { PrestamoEnriched } from "@/lib/ortopedia-prestamos";

export type { PrestamoEnriched };

export type Elemento = {
  id: number;
  nombre: string;
  descripcion: string;
  stock_total: number;
  stock_disponible: number;
  activo: boolean;
};

export type SocioSearchRow = {
  COD_SOC: number | string;
  ADHERENTE_CODIGO: number | string;
  ADHERENTE_NOMBRE: string;
  APELLIDOS: string;
  VINCULO: string;
  DNI_ADHERENTE: string;
  DES_CAT: string;
  FECHA_NACIMIENTO?: string | null;
};

export type TitularInfo = {
  nombre: string;
  dni: string;
  telefono: string;
};

export function formatDate(value: string | Date | null) {
  if (!value) return "-";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("es-AR", { timeZone: "UTC" });
}

export function formatDni(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "-";
  if (digits.length <= 8) {
    return digits.replace(/(\d{1,2})(\d{3})(\d{3})/, "$1.$2.$3").replace(/\.$/, "");
  }
  return digits;
}

export function estadoPrestamoLabel(estado: string) {
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

export function estadoPrestamoVariant(estado: string): "default" | "secondary" | "destructive" | "outline" {
  switch (estado.toUpperCase()) {
    case "ACTIVO":
      return "default";
    case "DEVUELTO":
      return "secondary";
    case "VENCIDO":
      return "destructive";
    case "RESERVADO":
      return "outline";
    default:
      return "outline";
  }
}

export function inputClassName(disabled?: boolean) {
  return `h-11 w-full rounded-2xl border border-border bg-input px-4 text-sm text-foreground outline-none transition-colors focus:border-primary/50 ${disabled ? "opacity-60" : ""}`;
}

export function textareaClassName(disabled?: boolean) {
  return `min-h-28 w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary/50 ${disabled ? "opacity-60" : ""}`;
}
