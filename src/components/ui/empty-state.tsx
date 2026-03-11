import { Inbox } from "lucide-react";

type EmptyStateProps = {
  message?: string;
};

export function EmptyState({ message = "No hay datos disponibles" }: EmptyStateProps) {
  return (
    <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 text-center ring-1 ring-slate-200">
      <Inbox className="h-7 w-7 text-slate-400" />
      <p className="text-sm text-slate-600">{message}</p>
    </div>
  );
}
