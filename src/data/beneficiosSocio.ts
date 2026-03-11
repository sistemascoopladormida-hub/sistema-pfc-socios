export type BeneficioSocio = {
  socioId: number;
  prestacion: string;
  usadas: number;
  disponibles: number;
};

export const beneficiosSocio: BeneficioSocio[] = [
  {
    socioId: 1,
    prestacion: "Fisioterapia",
    usadas: 2,
    disponibles: 3,
  },
  {
    socioId: 1,
    prestacion: "Psicologia",
    usadas: 1,
    disponibles: 3,
  },
  {
    socioId: 2,
    prestacion: "Fisioterapia",
    usadas: 4,
    disponibles: 1,
  },
];
