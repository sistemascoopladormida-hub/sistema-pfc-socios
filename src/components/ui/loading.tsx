import { Loader2 } from "lucide-react";

type LoadingProps = {
  label?: string;
};

export function Loading({ label = "Cargando datos..." }: LoadingProps) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl bg-white ring-1 ring-slate-200">
      <Loader2 className="h-7 w-7 animate-spin text-coopGreen" />
      <p className="text-sm text-slate-600">{label}</p>
    </div>
  );
}
