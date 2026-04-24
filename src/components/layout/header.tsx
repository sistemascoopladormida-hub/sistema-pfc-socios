"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, LogOut, Menu, Plus, Settings, UserCircle2 } from "lucide-react";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { navigationItems } from "@/components/layout/navigation-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { roleLabel, simulatedUserByRole, useUser } from "@/lib/user-context";

type HeaderProps = {
  onMenuClick: () => void;
  onOpenCommandPalette: () => void;
};

const pageTitles: Record<string, string> = {
  "/dashboard": "Inicio",
  "/socios": "Socios",
  "/turnos": "Turnos",
  "/turnos/nuevo": "Crear turno",
  "/ortopedia": "Ortopedia",
  "/ortopedia/gestion": "Gestión de elementos",
  "/ortopedia/asignacion": "Asignación de elementos",
  "/ortopedia/stock": "Stock",
  "/ortopedia/prestamos": "Préstamos",
  "/agenda-profesional": "Agenda profesional",
  "/profesionales": "Profesionales",
  "/especialidades": "Especialidades",
  "/prestaciones": "Prestaciones",
  "/reportes": "Reportes",
};

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { role } = useUser();
  const [elevated, setElevated] = useState(false);

  const title =
    pageTitles[pathname] ??
    Object.entries(pageTitles).find(([key]) => pathname.startsWith(`${key}/`))?.[1] ??
    "PFC";

  const breadcrumbs = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    return parts.map((part, index) => {
      const href = `/${parts.slice(0, index + 1).join("/")}`;
      const label = navigationItems.find((item) => item.href === href)?.label ?? part.replace(/-/g, " ");
      return { href, label };
    });
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setElevated(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleLogout() {
    localStorage.clear();
    document.cookie = "rol=; path=/; Max-Age=0";
    document.cookie = "usuario=; path=/; Max-Age=0";
    router.replace("/login");
    router.refresh();
  }

  return (
    <header
      className={`glass-header sticky top-0 z-20 border-b border-border px-4 py-4 md:px-6 ${
        elevated ? "shadow-[0_10px_24px_rgba(2,6,23,0.24)]" : ""
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onMenuClick}>
            <Menu className="h-4 w-4" />
          </Button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Inicio</span>
              {breadcrumbs.map((crumb) => (
                <span key={crumb.href} className="flex items-center gap-2">
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate">{crumb.label}</span>
                </span>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
              <Badge className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-foreground">
                {roleLabel[role]}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ThemeToggle />

          <Link href="/turnos/nuevo">
            <Button className="h-11 px-4">
              <Plus className="mr-2 h-4 w-4" />
              Crear turno
            </Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" className="h-11 px-3 text-foreground" />}
            >
              <div className="flex items-center gap-3">
                <span className="hidden text-left lg:block">
                  <span className="block text-sm font-medium text-foreground">{simulatedUserByRole[role]}</span>
                  <span className="block text-xs text-muted-foreground">{roleLabel[role]}</span>
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-foreground">
                  <UserCircle2 className="h-5 w-5" />
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-panel w-56 border-border bg-popover text-popover-foreground">
              <DropdownMenuItem className="text-popover-foreground focus:bg-muted focus:text-foreground">
                <Settings className="mr-2 h-4 w-4" />
                Configuracion
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                variant="destructive"
                onClick={handleLogout}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
