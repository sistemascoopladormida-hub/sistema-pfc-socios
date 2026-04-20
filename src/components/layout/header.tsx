"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, LogOut, Menu, Settings, UserCircle2 } from "lucide-react";
import { motion } from "framer-motion";

import { roleLabel, simulatedUserByRole, useUser } from "@/lib/user-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const pageTitles: Record<string, string> = {
  "/dashboard": "Panel de control",
  "/socios": "Socios PFC",
  "/turnos": "Turnos",
  "/ortopedia": "Elementos Ortopédicos",
  "/agenda-profesional": "Agenda Profesional",
  "/profesionales": "Profesionales",
  "/especialidades": "Especialidades",
  "/prestaciones": "Prestaciones",
  "/reportes": "Reportes",
};

type HeaderProps = {
  onMenuClick: () => void;
};

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { role } = useUser();
  const [elevated, setElevated] = useState(false);

  const title =
    pageTitles[pathname] ??
    Object.entries(pageTitles).find(([key]) => pathname.startsWith(`${key}/`))?.[1] ??
    "Panel de Gestion";

  const userDisplay = `${roleLabel[role]} - ${simulatedUserByRole[role]}`;
  const breadcrumbs = useMemo(() => pathname.split("/").filter(Boolean), [pathname]);

  useEffect(() => {
    const onScroll = () => {
      setElevated(window.scrollY > 8);
    };
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
      className={`glass-header py-2 flex flex-row justify-between items-center sticky top-0 z-20 border-b border-pfcBorder px-6 transition-shadow ${
        elevated ? "shadow-sm" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-14 items-center gap-3">
          <Button variant="outline" size="icon-sm" className="md:hidden" onClick={onMenuClick}>
            <Menu className="h-4 w-4" />
          </Button>
          <div className="">
            <motion.h1
              key={title}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="font-display text-[22px] leading-none text-pfcText-primary"
            >
              {title}
            </motion.h1>
            <div className="mt-1 hidden items-center gap-1 text-[11px] text-pfcText-muted md:flex">
              <span>Inicio</span>
              {breadcrumbs.map((crumb) => (
                <span key={crumb} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  <span className="capitalize">{crumb.replace("-", " ")}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-14 items-center gap-3">
        <Badge className="rounded-lg bg-pfc-100 text-pfc-700">{roleLabel[role]}</Badge>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" className="gap-3 px-2" />}>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-pfcText-secondary lg:inline">{userDisplay}</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pfc-100 ring-1 ring-pfc-200">
                <UserCircle2 className="h-5 w-5 text-slate-700" />
              </div>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem>
              <UserCircle2 className="mr-2 h-4 w-4" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Configuracion
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
