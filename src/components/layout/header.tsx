"use client";

import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Menu, Settings, UserCircle2 } from "lucide-react";

import { roleLabel, specialistAccounts, useUser } from "@/lib/user-context";
import { useProfesionales } from "@/lib/profesionales-context";
import type { UserRole } from "@/types/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/socios": "Socios PFC",
  "/turnos": "Turnos",
  "/profesionales": "Profesionales",
  "/prestaciones": "Prestaciones",
  "/reportes": "Reportes",
  "/especialista": "Panel del Especialista",
};

type HeaderProps = {
  onMenuClick: () => void;
};

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const { role, setRole, specialistAccount, setSpecialistAccount } = useUser();
  const { profesionales } = useProfesionales();

  const title =
    pageTitles[pathname] ??
    Object.entries(pageTitles).find(([key]) => pathname.startsWith(`${key}/`))?.[1] ??
    "Panel de Gestion";

  const specialistName =
    profesionales.find((item) => item.id === specialistAccount.profesional_id)?.nombre ??
    specialistAccount.usuario;
  const userDisplay =
    role === "especialista"
      ? `${roleLabel[role]} - ${specialistName}`
      : `${roleLabel[role]} - ${role === "recepcion" ? "Maria Lopez" : role === "profesional" ? "Dr. Martinez" : "Administracion"}`;

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon-sm" className="md:hidden" onClick={onMenuClick}>
          <Menu className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-44">
          <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Seleccionar rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recepcion">Recepcion</SelectItem>
              <SelectItem value="profesional">Profesional</SelectItem>
              <SelectItem value="directivo">Directivo</SelectItem>
              <SelectItem value="especialista">Especialista</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {role === "especialista" && (
          <div className="w-44">
            <Select value={specialistAccount.usuario} onValueChange={setSpecialistAccount}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Especialista" />
              </SelectTrigger>
              <SelectContent>
                {specialistAccounts.map((account) => {
                  const profesional =
                    profesionales.find((item) => item.id === account.profesional_id)?.nombre ??
                    account.usuario;
                  return (
                    <SelectItem key={account.usuario} value={account.usuario}>
                      {profesional}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        <Badge className="bg-coopBlue text-white">{roleLabel[role]}</Badge>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" className="gap-3 px-2" />}>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-slate-700 lg:inline">{userDisplay}</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200">
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
            <DropdownMenuItem variant="destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
