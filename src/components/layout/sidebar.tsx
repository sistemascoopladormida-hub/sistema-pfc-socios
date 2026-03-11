"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Calendar,
  HeartPulse,
  LayoutDashboard,
  ShieldUser,
  Stethoscope,
  Users,
} from "lucide-react";

import { canAccessModule, useUser } from "@/lib/user-context";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/roles";
import { turnos } from "@/data/turnos";

type MenuItem = {
  label: string;
  href: string;
  module:
    | "dashboard"
    | "socios"
    | "turnos"
    | "profesionales"
    | "prestaciones"
    | "reportes"
    | "especialista";
  icon: React.ComponentType<{ className?: string }>;
};

const menuItems: MenuItem[] = [
  { label: "Socios PFC", href: "/socios", module: "socios", icon: Users },
  { label: "Turnos", href: "/turnos", module: "turnos", icon: Calendar },
  { label: "Profesionales", href: "/profesionales", module: "profesionales", icon: Stethoscope },
  { label: "Prestaciones", href: "/prestaciones", module: "prestaciones", icon: HeartPulse },
  { label: "Reportes", href: "/reportes", module: "reportes", icon: BarChart3 },
  { label: "Dashboard", href: "/dashboard", module: "dashboard", icon: LayoutDashboard },
  { label: "Panel Especialista", href: "/especialista", module: "especialista", icon: ShieldUser },
];

type SidebarProps = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

const TURNOS_HOY_MOCK = "2026-03-20";

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { role } = useUser();
  const visibleItems = menuItems.filter((item) => canAccessModule(role as UserRole, item.module));
  const turnosHoy = turnos.filter((turno) => turno.fecha === TURNOS_HOY_MOCK).length;

  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Cerrar menu lateral"
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 h-dvh w-64 overflow-y-auto border-r border-white/20 bg-coopBlue text-white shadow-2xl transition-transform duration-300 md:static md:h-auto md:min-h-screen md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col items-center border-b border-white/20 py-7">
          <Image
            src="/logocooptransparente.png"
            alt="Cooperativa"
            width={96}
            height={96}
            priority
            className="drop-shadow-md"
          />
          <p className="mt-2 text-base font-semibold">Gestion PFC</p>
        </div>

        <nav className="space-y-3 p-3">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-blue-200/30",
                  isActive && "bg-white/25 text-white hover:bg-white/25"
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </span>
                {item.module === "turnos" && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{turnosHoy}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
