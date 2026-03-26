import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

import { Skeleton } from "@/components/ui/skeleton";

type LoadingProps = {
  label?: string;
};

export function Loading({ label = "Cargando datos..." }: LoadingProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-2xl bg-white p-6 ring-1 ring-slate-200"
    >
      <Loader2 className="h-7 w-7 animate-spin text-coopGreen" />
      <p className="text-sm text-slate-600">{label}</p>
      <div className="w-full max-w-xl space-y-2 pt-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </motion.div>
  );
}
