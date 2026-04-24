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
  "cat-basica": "border border-emerald-300/20 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300",
  "cat-plus": "border border-violet-300/20 bg-violet-400/10 text-violet-700 dark:text-violet-300",
  "beneficio-titular": "border border-sky-300/20 bg-sky-400/10 text-sky-700 dark:text-sky-300",
  "beneficio-propio": "border border-amber-300/20 bg-amber-400/10 text-amber-700 dark:text-amber-300",
  reservado: "border border-amber-300/20 bg-amber-400/10 text-amber-700 dark:text-amber-300",
  atendido: "border border-emerald-300/20 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300",
  ausente: "border border-rose-300/20 bg-rose-400/10 text-rose-700 dark:text-rose-300",
  cancelado: "border border-border bg-muted text-muted-foreground",
  warning: "border border-amber-300/20 bg-amber-400/10 text-amber-700 dark:text-amber-300",
  default: "border border-border bg-muted text-muted-foreground",
};

export function DataBadge({ kind = "default", children, className }: DataBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md px-2.5 text-[11px] font-semibold tracking-wide",
        "rounded-full px-3 uppercase tracking-[0.16em]",
        byKind[kind],
        className
      )}
    >
      {children}
    </span>
  );
}
