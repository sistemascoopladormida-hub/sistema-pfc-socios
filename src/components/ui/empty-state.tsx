import { Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  title?: string;
  message?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
};

export function EmptyState({
  title = "Sin resultados",
  message = "No hay datos disponibles",
  ctaLabel,
  onCtaClick,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-pfcBorder bg-white text-center">
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-pfc-100 to-slate-100">
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-amber-400/70" />
        <Inbox className="h-7 w-7 text-pfc-700" />
      </div>
      <p className="text-sm font-semibold text-pfcText-primary">{title}</p>
      <p className="max-w-sm text-sm text-pfcText-secondary">{message}</p>
      {ctaLabel && onCtaClick ? (
        <Button variant="outline" onClick={onCtaClick}>
          {ctaLabel}
        </Button>
      ) : null}
    </div>
  );
}
