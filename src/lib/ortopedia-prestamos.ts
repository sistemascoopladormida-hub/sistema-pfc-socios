import sql from "mssql";

import { calcularEdadDesdeNacimiento } from "@/lib/pfc-rules";
import { getSqlConnection } from "@/lib/sqlserver";

export type PrestamoDbRow = {
  id: number;
  elemento_id: number;
  elemento_nombre: string;
  cod_soc: number;
  adherente_codigo: number;
  paciente_nombre: string;
  fecha_prestamo: string | Date;
  fecha_vencimiento: string | Date;
  fecha_devolucion: string | Date | null;
  estado: string;
  observaciones: string | null;
  certificado_presentado: boolean | number;
  renovaciones: number | string;
  certificado_url: string | null;
  fecha_certificado: string | Date | null;
  certificado_ruta: string | null;
  certificado_nombre: string | null;
  tramite_nombre: string | null;
  tramite_dni: string | null;
  tramite_telefono: string | null;
  tramite_vinculo: string | null;
};

export type PrestamoEnriched = {
  id: number;
  elemento_id: number;
  elemento_nombre: string;
  cod_soc: number;
  adherente_codigo: number;
  paciente_nombre: string;
  fecha_prestamo: string | Date;
  fecha_vencimiento: string | Date;
  fecha_devolucion: string | Date | null;
  estado: string;
  observaciones: string;
  certificado_presentado: boolean;
  renovaciones: number;
  certificado_url: string | null;
  fecha_certificado: string | Date | null;
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

type SocioLookupRow = {
  COD_SOC: number | string;
  ADHERENTE_CODIGO: number | string;
  ADHERENTE_NOMBRE: string;
  APELLIDOS: string;
  VINCULO: string;
  DNI_ADHERENTE: string;
  DES_CAT: string;
  FECHA_NACIMIENTO: string | Date | null;
};

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeVinculo(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isTitularTramite(vinculo: string | null, nombre: string | null) {
  const v = normalizeVinculo(vinculo);
  if (v === "TITULAR") return true;
  if (!v && !nombre) return true;
  return false;
}

function diffDays(start: string | Date, end: string | Date) {
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const ms = b.getTime() - a.getTime();
  return Math.max(Math.round(ms / (1000 * 60 * 60 * 24)), 0);
}

function resolveCertificadoHref(row: PrestamoDbRow) {
  if (row.certificado_url) return row.certificado_url;
  if (row.certificado_ruta) return `/api/ortopedia/prestamos/${row.id}/certificado`;
  return null;
}

function isImageCertificado(href: string | null, nombre: string | null) {
  const target = `${href ?? ""} ${nombre ?? ""}`.toLowerCase();
  return /\.(png|jpe?g)(\?|$)/i.test(target) || target.includes("image/");
}

export function mapPrestamoRow(row: PrestamoDbRow, socio?: SocioLookupRow, titular?: SocioLookupRow): PrestamoEnriched {
  const beneficiario = socio;
  const titularRow = titular ?? (normalizeVinculo(beneficiario?.VINCULO) === "TITULAR" ? beneficiario : undefined);
  const certificadoHref = resolveCertificadoHref(row);

  return {
    id: row.id,
    elemento_id: row.elemento_id,
    elemento_nombre: row.elemento_nombre,
    cod_soc: row.cod_soc,
    adherente_codigo: row.adherente_codigo,
    paciente_nombre: row.paciente_nombre,
    fecha_prestamo: row.fecha_prestamo,
    fecha_vencimiento: row.fecha_vencimiento,
    fecha_devolucion: row.fecha_devolucion,
    estado: row.estado,
    observaciones: row.observaciones ?? "",
    certificado_presentado: Boolean(row.certificado_presentado),
    renovaciones: toNumber(row.renovaciones),
    certificado_url: row.certificado_url,
    fecha_certificado: row.fecha_certificado,
    certificado_ruta: row.certificado_ruta,
    certificado_nombre: row.certificado_nombre,
    tramite_nombre: row.tramite_nombre,
    tramite_dni: row.tramite_dni,
    tramite_telefono: row.tramite_telefono,
    tramite_vinculo: row.tramite_vinculo,
    tramite_es_titular: isTitularTramite(row.tramite_vinculo, row.tramite_nombre),
    beneficiario_vinculo: String(beneficiario?.VINCULO ?? "").trim() || "-",
    beneficiario_edad: calcularEdadDesdeNacimiento(beneficiario?.FECHA_NACIMIENTO),
    beneficiario_dni: String(beneficiario?.DNI_ADHERENTE ?? "").trim() || "-",
    socio_categoria: String(beneficiario?.DES_CAT ?? titularRow?.DES_CAT ?? "").trim() || "-",
    titular_nombre: String(titularRow?.ADHERENTE_NOMBRE || titularRow?.APELLIDOS || "").trim() || "-",
    duracion_dias: diffDays(row.fecha_prestamo, row.fecha_vencimiento),
    certificado_href: certificadoHref,
    certificado_es_imagen: isImageCertificado(certificadoHref, row.certificado_nombre),
  };
}

export const PRESTAMOS_SELECT_SQL = `
  SELECT
    p.id,
    p.elemento_id,
    e.nombre AS elemento_nombre,
    p.cod_soc,
    p.adherente_codigo,
    p.paciente_nombre,
    p.fecha_prestamo,
    p.fecha_vencimiento,
    p.fecha_devolucion,
    p.estado,
    p.observaciones,
    p.certificado_presentado,
    p.renovaciones,
    p.certificado_url,
    p.fecha_certificado,
    p.tramite_nombre,
    p.tramite_dni,
    p.tramite_telefono,
    p.tramite_vinculo,
    c.archivo_ruta AS certificado_ruta,
    c.nombre_original AS certificado_nombre
  FROM ortopedia_prestamos p
  JOIN ortopedia_elementos e ON e.id = p.elemento_id
  OUTER APPLY (
    SELECT TOP 1
      oc.archivo_ruta,
      oc.nombre_original
    FROM ortopedia_certificados oc
    WHERE oc.prestamo_id = p.id
    ORDER BY oc.creado_en DESC, oc.id DESC
  ) c
`;

export async function enrichPrestamosRows(rows: PrestamoDbRow[]) {
  if (rows.length === 0) return [] as PrestamoEnriched[];

  const codSocs = [...new Set(rows.map((row) => row.cod_soc))].filter((id) => id > 0);
  const sociosByKey = new Map<string, SocioLookupRow>();
  const titularByCodSoc = new Map<number, SocioLookupRow>();

  if (codSocs.length > 0) {
    try {
      const pool = await getSqlConnection();
      const result = await pool.query(`
        SELECT
          COD_SOC,
          ADHERENTE_CODIGO,
          ADHERENTE_NOMBRE,
          APELLIDOS,
          VINCULO,
          DNI_ADHERENTE,
          DES_CAT,
          FECHA_NACIMIENTO
        FROM PR_DORM.dbo.vw_socios_adherentes WITH (NOLOCK)
        WHERE COD_SOC IN (${codSocs.join(",")})
      `);

      for (const row of result.recordset as SocioLookupRow[]) {
        const codSoc = Number(row.COD_SOC);
        const adherente = Number(row.ADHERENTE_CODIGO);
        sociosByKey.set(`${codSoc}-${adherente}`, row);
        if (normalizeVinculo(row.VINCULO) === "TITULAR") {
          titularByCodSoc.set(codSoc, row);
        }
      }
    } catch {
      // Si falla el enriquecimiento, devolvemos datos base del prestamo.
    }
  }

  return rows.map((row) => {
    const socio =
      sociosByKey.get(`${row.cod_soc}-${row.adherente_codigo}`) ??
      sociosByKey.get(`${row.cod_soc}-0`);
    const titular = titularByCodSoc.get(row.cod_soc);
    return mapPrestamoRow(row, socio, titular);
  });
}

export async function refreshPrestamosVencidos(pool: sql.ConnectionPool) {
  await pool.request().query(`
    UPDATE ortopedia_prestamos
    SET estado = 'VENCIDO',
        actualizado_en = GETDATE()
    WHERE estado = 'ACTIVO'
      AND fecha_devolucion IS NULL
      AND fecha_vencimiento < CAST(GETDATE() AS DATE)
  `);
}
