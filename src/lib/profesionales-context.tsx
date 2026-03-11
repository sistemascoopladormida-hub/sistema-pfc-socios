"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { type Profesional, profesionalesIniciales } from "@/data/profesionales";

type CreateProfesionalInput = Omit<Profesional, "id">;
type UpdateProfesionalInput = Omit<Profesional, "id">;

type ProfesionalesContextValue = {
  profesionales: Profesional[];
  createProfesional: (input: CreateProfesionalInput) => Profesional;
  updateProfesional: (id: string, input: UpdateProfesionalInput) => void;
  toggleEstadoProfesional: (id: string) => void;
};

const ProfesionalesContext = createContext<ProfesionalesContextValue | null>(null);

export function ProfesionalesProvider({ children }: { children: ReactNode }) {
  const [profesionales, setProfesionales] = useState<Profesional[]>(profesionalesIniciales);

  const createProfesional = (input: CreateProfesionalInput) => {
    const nextId =
      profesionales.length > 0
        ? String(Math.max(...profesionales.map((item) => Number(item.id))) + 1)
        : "1";

    const nuevoProfesional: Profesional = {
      id: nextId,
      ...input,
    };

    setProfesionales((prev) => [nuevoProfesional, ...prev]);
    return nuevoProfesional;
  };

  const updateProfesional = (id: string, input: UpdateProfesionalInput) => {
    setProfesionales((prev) => prev.map((item) => (item.id === id ? { id, ...input } : item)));
  };

  const toggleEstadoProfesional = (id: string) => {
    setProfesionales((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, estado: item.estado === "activo" ? "inactivo" : "activo" }
          : item
      )
    );
  };

  const value = useMemo(
    () => ({
      profesionales,
      createProfesional,
      updateProfesional,
      toggleEstadoProfesional,
    }),
    [profesionales]
  );

  return <ProfesionalesContext.Provider value={value}>{children}</ProfesionalesContext.Provider>;
}

export function useProfesionales() {
  const context = useContext(ProfesionalesContext);
  if (!context) {
    throw new Error("useProfesionales must be used within ProfesionalesProvider");
  }
  return context;
}
