"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { OrtopediaDashboardAlerta } from "@/lib/ortopedia-dashboard";
import { cn } from "@/lib/utils";

const alertEmoji: Record<OrtopediaDashboardAlerta["tipo"], string> = {
  prestamo_vencido: "🔴",
  certificado_por_vencer: "🟡",
  certificado_vencido: "🔴",
  stock_critico: "🔴",
  stock_bajo: "🟠",
  prestamo_por_vencer: "🔵",
};

const prioridadBadge: Record<OrtopediaDashboardAlerta["prioridad"], string> = {
  alta: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
  media: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
  baja: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
};

type OrtopediaAlertsPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alertas: OrtopediaDashboardAlerta[];
  loading: boolean;
  alertCount: number;
};

export function OrtopediaAlertsPanel({ open, onOpenChange, alertas, loading, alertCount }: OrtopediaAlertsPanelProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Cerrar panel de alertas"
            className="fixed inset-0 z-[200] bg-black/45 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Alertas de ortopedia"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed inset-y-0 right-0 z-[210] flex w-full max-w-md flex-col border-l border-border bg-background shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
                    <Bell className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Alertas de ortopedia</h2>
                    <p className="text-sm text-muted-foreground">{alertCount} alertas activas</p>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)} aria-label="Cerrar alertas">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 rounded-2xl" />
                  <Skeleton className="h-24 rounded-2xl" />
                  <Skeleton className="h-24 rounded-2xl" />
                </div>
              ) : alertas.length ? (
                <div className="space-y-3 pb-6">
                  {alertas.map((alerta) => (
                    <Link
                      key={alerta.id}
                      href={alerta.href}
                      onClick={() => onOpenChange(false)}
                      className="block rounded-2xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-500/30 hover:shadow-md"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-lg leading-none">{alertEmoji[alerta.tipo]}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-foreground">{alerta.titulo}</p>
                            <Badge className={cn("rounded-full border-0 px-2 py-0.5 text-[10px]", prioridadBadge[alerta.prioridad])}>
                              {alerta.prioridad}
                            </Badge>
                          </div>
                          {alerta.subtitulo ? (
                            <p className="mt-1 text-sm text-muted-foreground">{alerta.subtitulo}</p>
                          ) : null}
                          <p className="mt-2 text-sm leading-6 text-foreground">{alerta.mensaje}</p>
                          {alerta.prestamo_id ? (
                            <p className="mt-2 text-xs font-medium text-violet-600 dark:text-violet-300">Ver prestamo</p>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-6 text-center text-sm text-emerald-800 dark:text-emerald-100">
                  No hay alertas activas en este momento.
                </div>
              )}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

export function OrtopediaAlertsBell({ onClick, count }: { onClick: () => void; count: number }) {
  return (
    <Button
      variant="outline"
      className="relative h-11 px-3"
      onClick={onClick}
      title="Alertas de ortopedia"
      aria-label={`Alertas de ortopedia${count > 0 ? `, ${count} activas` : ""}`}
    >
      <Bell className="h-4 w-4" />
      <span className="ml-2 hidden sm:inline">Alertas</span>
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white ring-2 ring-background">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Button>
  );
}
