import { NextResponse } from "next/server";

import { getSqlConnection } from "@/lib/sqlserver";
import type { SocioAdherente, SocioPFC } from "@/types/pfc-socios";

type SqlRow = Record<string, unknown>;
type NormalizedRow = Record<string, unknown>;

function toText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toDateText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return toText(value);
}

function toNumber(value: unknown) {
  const normalized = toText(value);
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function getNormalizedRow(row: SqlRow): NormalizedRow {
  return Object.entries(row).reduce<NormalizedRow>((acc, [key, value]) => {
    acc[normalizeKey(key)] = value;
    return acc;
  }, {});
}

function pickByAliases(
  row: SqlRow,
  normalizedRow: NormalizedRow,
  aliases: string[],
  partialAliases: string[] = []
) {
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null && toText(row[alias]) !== "") {
      return row[alias];
    }
  }

  for (const alias of aliases.map(normalizeKey)) {
    if (
      normalizedRow[alias] !== undefined &&
      normalizedRow[alias] !== null &&
      toText(normalizedRow[alias]) !== ""
    ) {
      return normalizedRow[alias];
    }
  }

  for (const [key, value] of Object.entries(normalizedRow)) {
    if (value === null || value === undefined || toText(value) === "") continue;
    if (partialAliases.some((partial) => key.includes(normalizeKey(partial)))) {
      return value;
    }
  }

  return "";
}

function normalizeRow(row: SqlRow) {
  const normalizedRow = getNormalizedRow(row);
  return {
    codSoc: toNumber(
      pickByAliases(row, normalizedRow, ["COD_SOC", "CODSOC", "CODIGO_SOCIO"], ["codsoc", "socio"])
    ),
    numeroCuenta: toNumber(
      pickByAliases(
        row,
        normalizedRow,
        ["NRO_CTA", "NUMERO_CUENTA", "CUENTA", "NROCTA"],
        ["cuenta", "nrocta", "numcta"]
      )
    ),
    titular: toText(
      pickByAliases(
        row,
        normalizedRow,
        ["TITULAR", "NOMBRE_TITULAR", "SOCIO_TITULAR", "APENOM_TITULAR", "NOMBRE_SOCIO", "APELLIDOS"],
        ["titular", "apenomtitular", "apellidonombre", "apellidos"]
      )
    ),
    titularDni: toText(
      pickByAliases(
        row,
        normalizedRow,
        ["DNI_TITULAR", "DOC_TITULAR", "DNI_SOCIO", "NRO_DOC_TITULAR", "NUM_DNI"],
        ["dnititular", "doctitular", "nrodoc", "numdni"]
      )
    ),
    cdi: toText(
      pickByAliases(row, normalizedRow, ["CDI", "CUIL"], ["cdi", "cuil", "cuit"])
    ),
    movil: toText(
      pickByAliases(
        row,
        normalizedRow,
        ["MOVIL", "CELULAR", "TEL_MOVIL", "TELEFONO_MOVIL"],
        ["movil", "celular"]
      )
    ),
    direccion: toText(
      pickByAliases(
        row,
        normalizedRow,
        ["DIRECCION", "DOMICILIO", "DOMICILIO_POSTAL", "OBS_POSTAL"],
        ["direccion", "domicilio", "obspostal", "postal"]
      )
    ),
    email: toText(
      pickByAliases(
        row,
        normalizedRow,
        ["EMAIL", "CORREO", "MAIL", "EMAIL_SOCIO"],
        ["correo", "email", "mail"]
      )
    ),
    desCat: toText(
      pickByAliases(
        row,
        normalizedRow,
        ["DES_CAT", "DESCRIPCION_CATEGORIA", "CATEGORIA"],
        ["descat", "categoria", "cat"]
      )
    ),
    adherenteCodigo: toNumber(
      pickByAliases(
        row,
        normalizedRow,
        [
          "COD_ADH",
          "COD_ADHERENTE",
          "CODIGO_ADHERENTE",
          "CODIGO",
          "COD_FLIAR",
          "ADHERENTE_CODIGO",
        ],
        ["codadh", "codigoadherente", "adherentecodigo", "codfliar"]
      )
    ),
    adherenteNombre: toText(
      pickByAliases(
        row,
        normalizedRow,
        [
          "ADHERENTE",
          "NOMBRE_ADHERENTE",
          "NOMBRE",
          "APENOM_ADHERENTE",
          "NOM_FLIAR",
          "APENOM",
          "ADHERENTE_NOMBRE",
        ],
        ["nombreadherente", "adherentenombre", "nomfliar", "apenomadherente"]
      )
    ),
    adherenteVinculo: toText(
      pickByAliases(row, normalizedRow, ["VINCULO", "PARENTESCO", "TIPO_VINCULO"], ["vinculo", "parentesco"])
    ),
    adherenteDni: toText(
      pickByAliases(
        row,
        normalizedRow,
        ["DNI_ADHERENTE", "DOC_ADHERENTE", "DNI", "NRO_DOC_ADHERENTE", "DOC_FLIAR"],
        ["dniadh", "docadh", "docfliar", "dni"]
      )
    ),
    adherenteFechaNacimiento: toDateText(
      pickByAliases(
        row,
        normalizedRow,
        ["FECHA_NACIMIENTO", "FEC_NACIMIENTO", "FEC_NAC", "NACIMIENTO"],
        ["fechanacimiento", "fecnacimiento", "fecnac", "nacimiento"]
      )
    ),
  };
}

function buildAdherente(row: ReturnType<typeof normalizeRow>): SocioAdherente | null {
  if (!row.adherenteNombre && !row.adherenteCodigo && !row.adherenteDni) {
    return null;
  }

  return {
    codigo: row.adherenteCodigo,
    nombre: row.adherenteNombre,
    vinculo: row.adherenteVinculo,
    dni: row.adherenteDni,
    fechaNacimiento: row.adherenteFechaNacimiento,
  };
}

export async function GET() {
  try {
    const pool = await getSqlConnection();

    const result = await pool.request().query(`
      SELECT
        APELLIDOS,
        TELEFONO,
        MOVIL,
        COD_SOC,
        NUMERO_CUENTA,
        NUM_DNI,
        CDI,
        OBS_POSTAL,
        EMAIL,
        ADHERENTE_CODIGO,
        ADHERENTE_NOMBRE,
        FECHA_NACIMIENTO,
        VINCULO,
        DNI_ADHERENTE,
        DES_CAT
      FROM dbo.vw_socios_adherentes
    `);

    const groupedMap = new Map<number, SocioPFC>();

    for (const rawRow of result.recordset as SqlRow[]) {
      const row = normalizeRow(rawRow);
      if (!row.codSoc) continue;

      if (!groupedMap.has(row.codSoc)) {
        groupedMap.set(row.codSoc, {
          codSoc: row.codSoc,
          numeroCuenta: row.numeroCuenta,
          titular: row.titular,
          dni: row.titularDni,
          cdi: row.cdi,
          movil: row.movil,
          direccion: row.direccion,
          email: row.email,
          desCat: row.desCat,
          adherentes: [],
        });
      }

      const currentSocio = groupedMap.get(row.codSoc);
      if (!currentSocio) continue;

      if (!currentSocio.titular && row.titular) currentSocio.titular = row.titular;
      if (!currentSocio.dni && row.titularDni) currentSocio.dni = row.titularDni;
      if (!currentSocio.cdi && row.cdi) currentSocio.cdi = row.cdi;
      if (!currentSocio.movil && row.movil) currentSocio.movil = row.movil;
      if (!currentSocio.direccion && row.direccion) currentSocio.direccion = row.direccion;
      if (!currentSocio.email && row.email) currentSocio.email = row.email;
      if (!currentSocio.desCat && row.desCat) currentSocio.desCat = row.desCat;
      if (!currentSocio.numeroCuenta && row.numeroCuenta) currentSocio.numeroCuenta = row.numeroCuenta;

      const adherente = buildAdherente(row);
      if (adherente) {
        const duplicate = currentSocio.adherentes.some(
          (item) =>
            item.codigo === adherente.codigo &&
            item.nombre === adherente.nombre &&
            item.dni === adherente.dni &&
            item.vinculo === adherente.vinculo
        );

        if (!duplicate) {
          currentSocio.adherentes.push(adherente);
        }
      }

      // Fallback: si no vienen campos de titular, tomarlos del adherente con vinculo TITULAR.
      if (!currentSocio.titular || !currentSocio.dni) {
        const titularAdherente = currentSocio.adherentes.find(
          (item) => item.vinculo.toUpperCase() === "TITULAR"
        );

        if (titularAdherente) {
          if (!currentSocio.titular) currentSocio.titular = titularAdherente.nombre;
          if (!currentSocio.dni) currentSocio.dni = titularAdherente.dni;
        }
      }
    }

    return NextResponse.json({
      success: true,
      rows: Array.from(groupedMap.values()),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}
