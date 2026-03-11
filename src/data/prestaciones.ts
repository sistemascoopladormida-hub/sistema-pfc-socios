export type Prestacion = {
  id: number;
  nombre: string;
  sesionesMaximas: number;
  periodo: "mensual" | "anual";
};

export const prestaciones: Prestacion[] = [
  {
    id: 1,
    nombre: "Fisioterapia",
    sesionesMaximas: 5,
    periodo: "mensual",
  },
  {
    id: 2,
    nombre: "Psicologia",
    sesionesMaximas: 4,
    periodo: "mensual",
  },
  {
    id: 3,
    nombre: "Nutricion",
    sesionesMaximas: 2,
    periodo: "mensual",
  },
  {
    id: 4,
    nombre: "Consulta ginecologica",
    sesionesMaximas: 1,
    periodo: "mensual",
  },
  {
    id: 5,
    nombre: "Control diabetologico",
    sesionesMaximas: 1,
    periodo: "mensual",
  },
];
