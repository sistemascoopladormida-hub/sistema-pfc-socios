export type Socio = {
  id: number;
  nombre: string;
  dni: string;
  numeroSocio: string;
  pfcActivo: boolean;
  telefono: string;
};

export const socios: Socio[] = [
  {
    id: 1,
    nombre: "Juan Perez",
    dni: "30123456",
    numeroSocio: "SOC-1023",
    pfcActivo: true,
    telefono: "3521-555555",
  },
  {
    id: 2,
    nombre: "Maria Gomez",
    dni: "28999888",
    numeroSocio: "SOC-1041",
    pfcActivo: true,
    telefono: "3521-123456",
  },
  {
    id: 3,
    nombre: "Carlos Rodriguez",
    dni: "32444555",
    numeroSocio: "SOC-1102",
    pfcActivo: false,
    telefono: "3521-888999",
  },
];
