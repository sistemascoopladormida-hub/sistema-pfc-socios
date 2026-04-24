"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Command } from "lucide-react";

import { navigationItems } from "@/components/layout/navigation-config";
import { Button } from "@/components/ui/button";
import { turnos } from "@/data/turnos";
import { canAccessModule, useUser } from "@/lib/user-context";
import { cn } from "@/lib/utils";

type SidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenCommandPalette: () => void;
};

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
  onOpenCommandPalette,
}: SidebarProps) {
  const pathname = usePathname();
  const { role } = useUser();
  const todayIso = new Date().toISOString().slice(0, 10);
  const turnosFuturos = turnos.filter((turno) => String(turno.fecha) > todayIso).length;

  const visibleItems = useMemo(
    () => navigationItems.filter((item) => canAccessModule(role, item.module)),
    [role]
  );

  return (
    <>
      {mobileOpen ? (
        <button
          aria-label="Cerrar navegación"
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={onCloseMobile}
        />
      ) : null}

      <aside
        className={cn(
          "glass-panel fixed inset-y-0 left-0 z-40 flex h-dvh flex-col border-r border-border text-foreground transition-[width,transform] duration-300 md:static md:min-h-screen md:translate-x-0",
          collapsed ? "w-[92px]" : "w-[280px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="border-b border-border px-4 py-4">
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
              <Image src="/logocooptransparente.png" alt="PFC" width={50} height={50} priority />
            </div>

            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-foreground">PFC</p>
                <p className="text-sm text-muted-foreground">Sistema administrativo</p>
              </div>
            ) : null}

            <Button
              size="icon-sm"
              variant="ghost"
              className="hidden md:inline-flex"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>

          {!collapsed ? (
            <button
              onClick={onOpenCommandPalette}
              className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-foreground">
                <Command className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-medium text-foreground">Buscar</span>
                <span className="block text-xs text-muted-foreground">Ir rápido a una pantalla</span>
              </span>
            </button>
          ) : null}
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const badgeValue = item.module === "turnos" && turnosFuturos > 0 ? turnosFuturos : null;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors",
                  isActive ? "pill-active text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                    isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>

                {!collapsed ? (
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{item.label}</span>
                      {badgeValue ? (
                        <span className="rounded-full bg-amber-400/12 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                          {badgeValue}
                        </span>
                      ) : null}
                    </span>
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
