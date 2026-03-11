export type EstadoTurno = "Programado" | "Atendido" | "No asistio" | "Cancelado";

export type Turno = {
  id: number;
  profesional_id: string;
  socio: string;
  socio_dni: string;
  socio_telefono: string;
  socio_cuenta: string;
  socio_domicilio: string;
  socio_correo: string;
  profesional: string;
  prestacion: string;
  fecha: string;
  hora: string;
  estado: EstadoTurno;
};

export const turnos: Turno[] = [
  {
    id: 1,
    profesional_id: "1",
    socio: "Juan Perez",
    socio_dni: "25256322",
    socio_telefono: "3521451453",
    socio_cuenta: "3580",
    socio_domicilio: "Juan M. de Rosas 750",
    socio_correo: "",
    profesional: "Dra. Laura Martinez",
    prestacion: "Consulta ginecologica",
    fecha: "2026-03-20",
    hora: "09:30",
    estado: "Programado",
  },
  {
    id: 2,
    profesional_id: "2",
    socio: "Maria Gomez",
    socio_dni: "28999888",
    socio_telefono: "3521123456",
    socio_cuenta: "4102",
    socio_domicilio: "San Martin 312",
    socio_correo: "maria@email.com",
    profesional: "Lic. Martin Lopez",
    prestacion: "Sesion psicologia",
    fecha: "2026-03-20",
    hora: "10:30",
    estado: "Atendido",
  },
  {
    id: 3,
    profesional_id: "3",
    socio: "Carlos Rodriguez",
    socio_dni: "32444555",
    socio_telefono: "3521888999",
    socio_cuenta: "5520",
    socio_domicilio: "Belgrano 88",
    socio_correo: "",
    profesional: "Lic. Ana Fernandez",
    prestacion: "Sesion fisioterapia",
    fecha: "2026-03-21",
    hora: "11:00",
    estado: "Programado",
  },
];
