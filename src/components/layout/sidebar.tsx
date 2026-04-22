"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Calendar,
  CalendarClock,
  ChevronsLeft,
  ChevronsRight,
  HeartPulse,
  LayoutDashboard,
  Layers,
  PackageOpen,
  Stethoscope,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { turnos } from "@/data/turnos";
import { useMotionSettings } from "@/hooks/use-motion-settings";
import { canAccessModule, useUser } from "@/lib/user-context";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/roles";

type MenuItem = {
  label: string;
  href: string;
  module:
  | "dashboard"
  | "socios"
  | "turnos"
  | "ortopedia-gestion"
  | "ortopedia-asignacion"
  | "ortopedia-stock"
  | "ortopedia-prestamos"
  | "agenda-profesional"
  | "profesionales"
  | "especialidades"
  | "prestaciones"
  | "reportes";
  icon: React.ComponentType<{ className?: string }>;
};

const menuItems: MenuItem[] = [
  { label: "Dashboard", href: "/dashboard", module: "dashboard", icon: LayoutDashboard },
  { label: "Socios PFC", href: "/socios", module: "socios", icon: Users },
  { label: "Turnos", href: "/turnos", module: "turnos", icon: Calendar },
  {
    label: "Gestión de elementos",
    href: "/ortopedia/gestion",
    module: "ortopedia-gestion",
    icon: PackageOpen,
  },
  {
    label: "Asignación de elementos",
    href: "/ortopedia/asignacion",
    module: "ortopedia-asignacion",
    icon: PackageOpen,
  },
  {
    label: "Stock ortopedia",
    href: "/ortopedia/stock",
    module: "ortopedia-stock",
    icon: PackageOpen,
  },
  {
    label: "Préstamos ortopedia",
    href: "/ortopedia/prestamos",
    module: "ortopedia-prestamos",
    icon: PackageOpen,
  },
  {
    label: "Agenda Profesional",
    href: "/agenda-profesional",
    module: "agenda-profesional",
    icon: CalendarClock,
  },
  { label: "Profesionales", href: "/profesionales", module: "profesionales", icon: Stethoscope },
  { label: "Especialidades", href: "/especialidades", module: "especialidades", icon: Layers },
  { label: "Prestaciones", href: "/prestaciones", module: "prestaciones", icon: HeartPulse },
  { label: "Reportes", href: "/reportes", module: "reportes", icon: BarChart3 },
];

type SidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const motionSettings = useMotionSettings();
  const pathname = usePathname();
  const { role } = useUser();
  const visibleItems = menuItems.filter((item) => canAccessModule(role as UserRole, item.module));
  const todayIso = new Date().toISOString().slice(0, 10);
  const turnosFuturos = turnos.filter((turno) => String(turno.fecha) > todayIso).length;

  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Cerrar menu lateral"
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px] md:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 h-dvh overflow-y-auto border-r border-white/10 bg-[#0A1F1A] text-white transition-[width,transform] duration-300 md:static md:h-auto md:min-h-screen md:translate-x-0",
          collapsed ? "w-[84px]" : "w-[240px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            <Image
              src="/logocooptransparente.png"
              alt="Cooperativa"
              width={collapsed ? 42 : 54}
              height={collapsed ? 42 : 54}
              priority
              className="drop-shadow-md"
            />
            {!collapsed && (
              <div className="leading-tight">
                <p className="text-sm font-semibold tracking-wide">Gestion PFC</p>
                <p className="text-xs text-white/80">Cooperativa</p>
              </div>
            )}
          </div>
          <Button
            size="icon-sm"
            variant="ghost"
            className="hidden text-white hover:bg-white/10 hover:text-white md:inline-flex"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expandir menu" : "Colapsar menu"}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </Button>
        </div>

        <div className="px-3 pt-4 text-[10px] uppercase tracking-[0.2em] text-[#3D6B5C]">
          {!collapsed ? "Navegacion" : ""}
        </div>

        <nav className="space-y-2 p-3">
          {visibleItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <motion.div
                key={item.href}
                initial={motionSettings.item.initial}
                animate={motionSettings.item.animate}
                transition={{ duration: 0.18, delay: idx * 0.05 }}
              >
                <Link
                  href={item.href}
                  onClick={onCloseMobile}
                  className={cn(
                    "group relative flex h-10 items-center justify-between gap-3 rounded-lg px-3 text-sm font-medium text-white/85 transition-all duration-150 hover:bg-[#142D24] hover:text-white",
                    isActive && "border-l-2 border-emerald-400 bg-[#1A3D32] text-white"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="flex items-center gap-3">
                    <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "opacity-100" : "opacity-70")} />
                    {!collapsed && <span>{item.label}</span>}
                  </span>
                  {!collapsed && item.module === "turnos" && (
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{turnosFuturos}</span>
                  )}
                </Link>
              </motion.div>
            );
          })}
        </nav>

        <div className="mt-auto p-3 text-center text-xs text-white/75">
          {!collapsed ? "Sistema interno PFC" : "PFC"}
        </div>
      </aside>
    </>
  );
}
