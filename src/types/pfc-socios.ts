export type SocioAdherente = {
  codigo: number;
  nombre: string;
  vinculo: string;
  dni: string;
};

export type SocioPFC = {
  codSoc: number;
  numeroCuenta: number;
  titular: string;
  dni: string;
  movil: string;
  direccion: string;
  email: string;
  adherentes: SocioAdherente[];
};

export type PfcSociosApiResponse = {
  success: boolean;
  rows: SocioPFC[];
  error?: string;
};
