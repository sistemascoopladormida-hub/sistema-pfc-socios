"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { UserRole } from "@/types/roles";

export type SpecialistAccount = {
  usuario: string;
  rol: "especialista";
  profesional_id: string;
};

type UserContextValue = {
  role: UserRole;
  setRole: (role: UserRole) => void;
  specialistAccount: SpecialistAccount;
  setSpecialistAccount: (usuario: string) => void;
};

type AppModule =
  | "dashboard"
  | "socios"
  | "turnos"
  | "profesionales"
  | "prestaciones"
  | "reportes"
  | "especialista";

export const specialistAccounts: SpecialistAccount[] = [
  {
    usuario: "juan.perez",
    rol: "especialista",
    profesional_id: "1",
  },
  {
    usuario: "maria.lopez",
    rol: "especialista",
    profesional_id: "2",
  },
];

const roleModuleAccess: Record<UserRole, AppModule[]> = {
  recepcion: ["dashboard", "socios", "turnos", "profesionales"],
  profesional: ["dashboard", "profesionales", "turnos"],
  directivo: ["dashboard", "reportes", "prestaciones"],
  especialista: ["especialista"],
};

export const roleLabel: Record<UserRole, string> = {
  recepcion: "Recepcion",
  profesional: "Profesional",
  directivo: "Directivo",
  especialista: "Especialista",
};

export const simulatedUserByRole: Record<UserRole, string> = {
  recepcion: "Maria Lopez",
  profesional: "Dr. Martinez",
  directivo: "Administracion",
  especialista: "Especialista",
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>("recepcion");
  const [specialistUsuario, setSpecialistUsuario] = useState<string>(specialistAccounts[0].usuario);

  const specialistAccount =
    specialistAccounts.find((item) => item.usuario === specialistUsuario) ?? specialistAccounts[0];

  const value = useMemo(
    () => ({
      role,
      setRole,
      specialistAccount,
      setSpecialistAccount: setSpecialistUsuario,
    }),
    [role, specialistAccount]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within UserProvider");
  }
  return context;
}

export function canAccessModule(role: UserRole, module: AppModule) {
  return roleModuleAccess[role].includes(module);
}
