export type ProfesionalEstado = "activo" | "inactivo";

export type Profesional = {
  id: string;
  nombre: string;
  especialidad: string;
  dni: string;
  telefono: string;
  correo: string;
  direccion: string;
  matricula: string;
  estado: ProfesionalEstado;
};

export const profesionalesIniciales: Profesional[] = [
  {
    id: "1",
    nombre: "Dr. Juan Perez",
    especialidad: "Clinica Medica",
    dni: "25123456",
    telefono: "3521555555",
    correo: "juanperez@email.com",
    direccion: "Villa Tulumba",
    matricula: "MP 12345",
    estado: "activo",
  },
  {
    id: "2",
    nombre: "Lic. Maria Lopez",
    especialidad: "Psicologia",
    dni: "28222333",
    telefono: "3521444444",
    correo: "marialopez@email.com",
    direccion: "",
    matricula: "MP 22221",
    estado: "activo",
  },
];
