import { cn } from "@/lib/utils";

type DataBadgeKind =
  | "cat-basica"
  | "cat-plus"
  | "beneficio-titular"
  | "beneficio-propio"
  | "reservado"
  | "atendido"
  | "ausente"
  | "cancelado"
  | "warning"
  | "default";

type DataBadgeProps = {
  kind?: DataBadgeKind;
  children: React.ReactNode;
  className?: string;
};

const byKind: Record<DataBadgeKind, string> = {
  "cat-basica": "bg-[#E8F5F0] text-[#0D6E5A]",
  "cat-plus": "bg-[#EFE9FF] text-[#5B21B6]",
  "beneficio-titular": "bg-[#E6F4EF] text-[#0B5B4B]",
  "beneficio-propio": "bg-[#FEF3C7] text-[#92400E]",
  reservado: "bg-[#FEF3C7] text-[#92400E]",
  atendido: "bg-[#D1FAE5] text-[#065F46]",
  ausente: "bg-[#FEE2E2] text-[#991B1B]",
  cancelado: "bg-slate-200 text-slate-700",
  warning: "bg-amber-100 text-amber-800",
  default: "bg-slate-100 text-slate-700",
};

export function DataBadge({ kind = "default", children, className }: DataBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md px-2.5 text-[11px] font-semibold tracking-wide",
        byKind[kind],
        className
      )}
    >
      {children}
    </span>
  );
}
