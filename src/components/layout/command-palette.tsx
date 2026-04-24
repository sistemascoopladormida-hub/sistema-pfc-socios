"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Command, Plus, Search } from "lucide-react";

import { navigationItems } from "@/components/layout/navigation-config";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { canAccessModule, useUser } from "@/lib/user-context";
import { cn } from "@/lib/utils";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const quickActions = [
  {
    label: "Crear turno",
    description: "Alta rápida de turnos.",
    href: "/turnos/nuevo",
    icon: Plus,
  },
  {
    label: "Ir al inicio",
    description: "Volver al dashboard.",
    href: "/dashboard",
    icon: Command,
  },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const pathname = usePathname();
  const { role } = useUser();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }

      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const items = useMemo(() => {
    const allowedNavigation = navigationItems
      .filter((item) => canAccessModule(role, item.module))
      .map((item) => ({
        label: item.label,
        description: item.description,
        href: item.href,
        icon: item.icon,
      }));

    const allItems = [...quickActions, ...allowedNavigation];
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return allItems;

    return allItems.filter((item) =>
      `${item.label} ${item.description} ${item.href}`.toLowerCase().includes(normalizedQuery)
    );
  }, [query, role]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 text-foreground" showCloseButton={false}>
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-3 text-lg">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Command className="h-5 w-5" />
            </span>
            Buscar
          </DialogTitle>
          <DialogDescription>Escribí el nombre de una pantalla o una acción.</DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-5 pt-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar pantalla o acción..."
              className="h-12 pl-11"
            />
          </div>

          <div className="mt-4 space-y-2">
            {items.length === 0 ? (
              <div className="surface-subtle rounded-2xl px-4 py-6 text-center text-sm text-slate-400">
                No encontramos resultados para esa búsqueda.
              </div>
            ) : (
              items.map((item) => {
                const Icon = item.icon;
                const isCurrent = pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={`${item.href}-${item.label}`}
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "flex items-center justify-between rounded-2xl border px-4 py-3 transition-colors",
                      isCurrent
                        ? "pill-active text-foreground"
                        : "border-border bg-card text-foreground hover:bg-muted"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-foreground">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-medium">{item.label}</span>
                        <span className="block text-xs text-slate-400">{item.description}</span>
                      </span>
                    </span>
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-400">
                      {isCurrent ? "Actual" : "Ir"}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
