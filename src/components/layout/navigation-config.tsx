"use client";

import type { ComponentType } from "react";
import {
  Activity,
  BarChart3,
  Calendar,
  CalendarClock,
  HeartPulse,
  LayoutDashboard,
  Layers,
  PackageOpen,
  Stethoscope,
  Users,
} from "lucide-react";

type AppModule =
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

export type NavigationItem = {
  label: string;
  href: string;
  module: AppModule;
  icon: ComponentType<{ className?: string }>;
  description: string;
  shortLabel?: string;
  badgeLabel?: string;
  group: "Core" | "Operaciones" | "Ortopedia" | "Analitica";
};

export const navigationItems: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    module: "dashboard",
    icon: LayoutDashboard,
    description: "Vista ejecutiva con KPIs, insights y actividad operativa.",
    shortLabel: "Inicio",
    group: "Core",
  },
  {
    label: "Socios",
    href: "/socios",
    module: "socios",
    icon: Users,
    description: "Cobertura, titulares, adherentes e historial de atención.",
    group: "Core",
  },
  {
    label: "Turnos",
    href: "/turnos",
    module: "turnos",
    icon: Calendar,
    description: "Agenda diaria, pendientes, ausencias y atención.",
    badgeLabel: "Live",
    group: "Operaciones",
  },
  {
    label: "Agenda profesional",
    href: "/agenda-profesional",
    module: "agenda-profesional",
    icon: CalendarClock,
    description: "Disponibilidad y planificación de profesionales.",
    group: "Operaciones",
  },
  {
    label: "Profesionales",
    href: "/profesionales",
    module: "profesionales",
    icon: Stethoscope,
    description: "Alta, gestión y seguimiento de especialistas.",
    group: "Operaciones",
  },
  {
    label: "Especialidades",
    href: "/especialidades",
    module: "especialidades",
    icon: Layers,
    description: "Configuración de catálogo clínico por especialidad.",
    group: "Operaciones",
  },
  {
    label: "Prestaciones",
    href: "/prestaciones",
    module: "prestaciones",
    icon: HeartPulse,
    description: "Control de prestaciones, uso y cobertura.",
    group: "Operaciones",
  },
  {
    label: "Gestión de elementos",
    href: "/ortopedia/gestion",
    module: "ortopedia-gestion",
    icon: PackageOpen,
    description: "ABM de elementos ortopédicos y catálogo.",
    group: "Ortopedia",
  },
  {
    label: "Asignación de elementos",
    href: "/ortopedia/asignacion",
    module: "ortopedia-asignacion",
    icon: Activity,
    description: "Flujo guiado de entrega y seguimiento.",
    group: "Ortopedia",
  },
  {
    label: "Stock ortopedia",
    href: "/ortopedia/stock",
    module: "ortopedia-stock",
    icon: PackageOpen,
    description: "Niveles, alertas críticas y reposición.",
    badgeLabel: "Stock",
    group: "Ortopedia",
  },
  {
    label: "Préstamos ortopedia",
    href: "/ortopedia/prestamos",
    module: "ortopedia-prestamos",
    icon: PackageOpen,
    description: "Préstamos, renovaciones, devoluciones y certificados.",
    badgeLabel: "Flow",
    group: "Ortopedia",
  },
  {
    label: "Reportes",
    href: "/reportes",
    module: "reportes",
    icon: BarChart3,
    description: "Análisis de negocio, uso y tendencias.",
    group: "Analitica",
  },
];
