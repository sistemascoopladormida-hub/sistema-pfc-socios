"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { ROLES, ROLE_USERS } from "@/lib/roles";
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
  | "ortopedia-gestion"
  | "ortopedia-asignacion"
  | "ortopedia-stock"
  | "ortopedia-prestamos"
  | "agenda-profesional"
  | "profesionales"
  | "especialidades"
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
  admin: [
    "dashboard",
    "socios",
    "turnos",
    "agenda-profesional",
    "profesionales",
    "especialidades",
    "prestaciones",
  ],
  directivo: ["dashboard", "reportes"],
  ortopedia_admin: [
    "ortopedia-gestion",
    "ortopedia-asignacion",
    "ortopedia-stock",
    "ortopedia-prestamos",
  ],
};

export const roleLabel: Record<UserRole, string> = {
  admin: "Administrador",
  directivo: "Directivo",
  ortopedia_admin: "Admin Ortopedia",
};

export const simulatedUserByRole: Record<UserRole, string> = {
  admin: ROLE_USERS.admin,
  directivo: ROLE_USERS.directivo,
  ortopedia_admin: ROLE_USERS.ortopedia_admin,
};

const UserContext = createContext<UserContextValue | null>(null);

type UserProviderProps = {
  children: ReactNode;
  initialRole?: UserRole;
};

export function UserProvider({ children, initialRole }: UserProviderProps) {
  const [role, setRole] = useState<UserRole>(initialRole ?? ROLES.DIRECTIVO);
  const [specialistUsuario, setSpecialistUsuario] = useState<string>(specialistAccounts[0].usuario);
  useEffect(() => {
    const storedRole = localStorage.getItem("rol");
    if (
      storedRole === ROLES.ADMIN ||
      storedRole === ROLES.DIRECTIVO ||
      storedRole === ROLES.ORTOPEDIA_ADMIN
    ) {
      setRole(storedRole);
      return;
    }
    if (storedRole === "recepcion") {
      setRole(ROLES.ADMIN);
      localStorage.setItem("rol", ROLES.ADMIN);
      localStorage.setItem("usuario", ROLE_USERS.admin);
      return;
    }
    if (initialRole) {
      localStorage.setItem("rol", initialRole);
      localStorage.setItem("usuario", ROLE_USERS[initialRole]);
    }
  }, [initialRole]);

  useEffect(() => {
    const syncRole = () => {
      const storedRole = localStorage.getItem("rol");
      if (
        storedRole === ROLES.ADMIN ||
        storedRole === ROLES.DIRECTIVO ||
        storedRole === ROLES.ORTOPEDIA_ADMIN
      ) {
        setRole(storedRole);
      }
    };
    window.addEventListener("storage", syncRole);
    window.addEventListener("roles:changed", syncRole as EventListener);
    return () => {
      window.removeEventListener("storage", syncRole);
      window.removeEventListener("roles:changed", syncRole as EventListener);
    };
  }, []);


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
