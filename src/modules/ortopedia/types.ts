export type PrestamoExpediente = {
  id: number;
  elemento_id: number;
  elemento_nombre: string;
  cod_soc: number;
  adherente_codigo: number;
  paciente_nombre: string;
  fecha_prestamo: string;
  fecha_vencimiento: string;
  fecha_devolucion: string | null;
  estado: string;
  observaciones: string;
  certificado_presentado: boolean;
  renovaciones: number;
  certificado_url: string | null;
  fecha_certificado: string | null;
  certificado_ruta: string | null;
  certificado_nombre: string | null;
  tramite_nombre: string | null;
  tramite_dni: string | null;
  tramite_telefono: string | null;
  tramite_vinculo: string | null;
  tramite_es_titular: boolean;
  beneficiario_vinculo: string;
  beneficiario_edad: number | null;
  beneficiario_dni: string;
  socio_categoria: string;
  titular_nombre: string;
  duracion_dias: number | null;
  certificado_href: string | null;
  certificado_es_imagen: boolean;
};

export type SocioGrupoRow = {
  COD_SOC: number | string;
  ADHERENTE_CODIGO: number | string;
  ADHERENTE_NOMBRE: string;
  APELLIDOS: string;
  VINCULO: string;
  DNI_ADHERENTE: string;
  DES_CAT: string;
  FECHA_NACIMIENTO?: string | Date | null;
};

export type SocioSearchRow = SocioGrupoRow;

export type Elemento = {
  id: number;
  nombre: string;
  descripcion: string;
  stock_total: number;
  stock_disponible: number;
  activo: boolean;
};
