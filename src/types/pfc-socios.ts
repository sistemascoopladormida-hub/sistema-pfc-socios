export type SocioAdherente = {
  codigo: number;
  nombre: string;
  vinculo: string;
  dni: string;
  fechaNacimiento: string;
};

export type SocioPFC = {
  codSoc: number;
  numeroCuenta: number;
  titular: string;
  dni: string;
  cdi: string;
  movil: string;
  direccion: string;
  email: string;
  desCat: string;
  adherentes: SocioAdherente[];
};

export type PfcSociosApiResponse = {
  success: boolean;
  rows: SocioPFC[];
  error?: string;
};
