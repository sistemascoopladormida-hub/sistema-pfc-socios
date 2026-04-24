import sql from "mssql";
import { NextResponse } from "next/server";

import { calcularEdad, esVinculoHijo, resolverBeneficio } from "@/lib/adherentes-beneficios";
import { getSqlConnection } from "@/lib/sqlserver";

type SocioRow = {
  COD_SOC: number | string;
  APELLIDOS: string;
  ADHERENTE_CODIGO: number | string;
  ADHERENTE_NOMBRE: string;
  VINCULO: string;
  DNI_ADHERENTE: string;
  DES_CAT: string;
  FECHA_NACIMIENTO: string | Date | null;
};

type ResumenRow = {
  total_resultados: number | string | null;
  titulares_total: number | string | null;
  hijos_mayores_18: number | string | null;
  hijos_menores_18: number | string | null;
  conyuges_total: number | string | null;
  otros_total: number | string | null;
};
type SegmentoFiltro = "HIJOS_MAYORES" | "HIJOS_MENORES" | "CONYUGES" | "OTROS" | "TITULARES";

/** Vista pesada: cache más largo en listado sin filtro acelera recargas y navegación. */
const SOCIOS_CACHE_TTL_MS_EMPTY = 45_000;
const SOCIOS_CACHE_TTL_MS_SEARCH = 25_000;
const sociosCache = new Map<
  string,
  {
    expiresAt: number;
    data: unknown[];
    resumen: {
      total_resultados: number;
      titulares_total: number;
      hijos_mayores_18: number;
      hijos_menores_18: number;
      conyuges_total: number;
      otros_total: number;
    };
  }
>();

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 3000;

const SELECT_LIST = `
  COD_SOC,
  APELLIDOS,
  ADHERENTE_CODIGO,
  ADHERENTE_NOMBRE,
  VINCULO,
  DNI_ADHERENTE,
  DES_CAT,
  FECHA_NACIMIENTO
`;

const FROM_SOCIOS = `FROM PR_DORM.dbo.vw_socios_adherentes WITH (NOLOCK)`;

const VINCULO_NORMALIZED_SQL = `UPPER(LTRIM(RTRIM(ISNULL(VINCULO, '')))) COLLATE Latin1_General_CI_AI`;
const EDAD_YEARS_SQL = `
  (
    DATEDIFF(YEAR, FECHA_NACIMIENTO, GETDATE())
    - CASE
        WHEN DATEADD(YEAR, DATEDIFF(YEAR, FECHA_NACIMIENTO, GETDATE()), FECHA_NACIMIENTO) > GETDATE()
          THEN 1
        ELSE 0
      END
  )
`;

function toPositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value ?? "");
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseSegmentoFiltro(value: string | null): SegmentoFiltro | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (
    normalized === "HIJOS_MAYORES" ||
    normalized === "HIJOS_MENORES" ||
    normalized === "CONYUGES" ||
    normalized === "OTROS" ||
    normalized === "TITULARES"
  ) {
    return normalized as SegmentoFiltro;
  }
  return null;
}

function segmentoWhereSql(segmento: SegmentoFiltro | null) {
  if (!segmento) return "";
  if (segmento === "TITULARES") return `${VINCULO_NORMALIZED_SQL} = 'TITULAR'`;
  if (segmento === "CONYUGES") return `${VINCULO_NORMALIZED_SQL} LIKE 'CONYUG%'`;
  if (segmento === "OTROS") return `${VINCULO_NORMALIZED_SQL} IN ('OTRO', 'OTROS')`;
  if (segmento === "HIJOS_MAYORES") {
    return `${VINCULO_NORMALIZED_SQL} LIKE 'HIJ%' AND FECHA_NACIMIENTO IS NOT NULL AND ${EDAD_YEARS_SQL} >= 18`;
  }
  return `${VINCULO_NORMALIZED_SQL} LIKE 'HIJ%' AND (FECHA_NACIMIENTO IS NULL OR ${EDAD_YEARS_SQL} < 18)`;
}

function isDigitsOnly(value: string) {
  return value.length > 0 && /^\d+$/.test(value);
}

function mapSociosRows(rows: SocioRow[]) {
  return rows.map((row) => {
    const edad = calcularEdad(row.FECHA_NACIMIENTO);
    const esHijo = esVinculoHijo(row.VINCULO);
    const beneficio = resolverBeneficio(row.VINCULO, row.FECHA_NACIMIENTO);
    return {
      ...row,
      EDAD: edad,
      ES_HIJO: esHijo,
      ES_HIJO_MAYOR_18: esHijo && Number(edad) >= 18,
      REQUIERE_CUOTA_PROPIA: beneficio === "PROPIO",
      TIPO_BENEFICIO: beneficio,
    };
  });
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const buscarRaw = String(searchParams.get("buscar") ?? "").trim();
    const buscar = buscarRaw.length > 120 ? buscarRaw.slice(0, 120) : buscarRaw;
    const segmento = parseSegmentoFiltro(searchParams.get("segmento"));
    const segmentoSql = segmentoWhereSql(segmento);
    const limit = Math.min(toPositiveInt(searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);
    const cacheKey = `${buscar.toUpperCase()}::${limit}::${segmento ?? "TODOS"}`;
    const now = Date.now();
    const cached = sociosCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return NextResponse.json({
        success: true,
        data: cached.data,
        resumen: cached.resumen,
      });
    }

    const pool = await getSqlConnection();
    let result: sql.IResult<SocioRow>;
    let resumenResult: sql.IResult<ResumenRow>;

    if (buscar === "") {
      // Sin filtro: evitar OR + ORDER BY complejo sobre toda la vista; orden estable por claves.
      if (segmentoSql) {
        result = await pool.request().query(`
          SELECT
            ${SELECT_LIST}
          ${FROM_SOCIOS}
          WHERE ${segmentoSql}
          ORDER BY COD_SOC, ADHERENTE_CODIGO
        `);
      } else {
        result = await pool.request().input("limit", sql.Int, limit).query(`
          SELECT TOP (@limit)
            ${SELECT_LIST}
          ${FROM_SOCIOS}
          ORDER BY COD_SOC, ADHERENTE_CODIGO
        `);
      }
      resumenResult = await pool.request().query(`
        SELECT
          COUNT(*) AS total_resultados,
          SUM(CASE WHEN ${VINCULO_NORMALIZED_SQL} = 'TITULAR' THEN 1 ELSE 0 END) AS titulares_total,
          SUM(CASE WHEN ${VINCULO_NORMALIZED_SQL} LIKE 'HIJ%' AND FECHA_NACIMIENTO IS NOT NULL AND ${EDAD_YEARS_SQL} >= 18 THEN 1 ELSE 0 END) AS hijos_mayores_18,
          SUM(CASE WHEN ${VINCULO_NORMALIZED_SQL} LIKE 'HIJ%' AND (FECHA_NACIMIENTO IS NULL OR ${EDAD_YEARS_SQL} < 18) THEN 1 ELSE 0 END) AS hijos_menores_18,
          SUM(CASE WHEN ${VINCULO_NORMALIZED_SQL} LIKE 'CONYUG%' THEN 1 ELSE 0 END) AS conyuges_total,
          SUM(CASE WHEN ${VINCULO_NORMALIZED_SQL} IN ('OTROS', 'OTRO') THEN 1 ELSE 0 END) AS otros_total
        ${FROM_SOCIOS}
      `);
    } else if (isDigitsOnly(buscar)) {
      // Solo dígitos: igualdad en COD_SOC (sargable) + DNI por prefijo (mejor que '%' a ambos lados).
      const codSocCandidate = Number(buscar);
      const codSocOk =
        Number.isInteger(codSocCandidate) &&
        codSocCandidate > 0 &&
        codSocCandidate <= 2_147_483_647;

      const req = pool
        .request()
        .input("limit", sql.Int, limit)
        .input("dni_prefix", sql.VarChar(121), `${buscar}%`);

      if (codSocOk) {
        req.input("cod_soc", sql.Int, codSocCandidate);
        result = await req.query(`
          SELECT TOP (@limit)
            ${SELECT_LIST}
          ${FROM_SOCIOS}
          WHERE
            (COD_SOC = @cod_soc OR DNI_ADHERENTE LIKE @dni_prefix)
            ${segmentoSql ? `AND (${segmentoSql})` : ""}
          ORDER BY
            CASE WHEN COD_SOC = @cod_soc THEN 0 ELSE 1 END,
            APELLIDOS,
            ADHERENTE_NOMBRE
        `);
        resumenResult = await pool
          .request()
          .input("cod_soc", sql.Int, codSocCandidate)
          .input("dni_prefix", sql.VarChar(121), `${buscar}%`)
          .query(`
            SELECT
              COUNT(*) AS total_resultados,
              SUM(CASE WHEN ${VINCULO_NORMALIZED_SQL} = 'TITULAR' THEN 1 ELSE 0 END) AS titulares_total,
              SUM(CASE WHEN ${VINCULO_NORMALIZED_SQL} LIKE 'HIJ%' AND FECHA_NACIMIENTO IS NOT NULL AND ${EDAD_YEARS_SQL} >= 18 THEN 1 ELSE 0 END) AS hijos_mayores_18,
              SUM(CASE WHEN ${VINCULO_NORMALIZED_SQL} LIKE 'HIJ%' AND (FECHA_NACIMIENTO IS NULL OR ${EDAD_YEARS_SQL} < 18) THEN 1 ELSE 0 END) AS hijos_menores_18,
              SUM(CASE WHEN ${VINCULO_NORMALIZED_SQL} LIKE 'CONYUG%' THEN 1 ELSE 0 END) AS conyuges_total,
              SUM(CASE WHEN ${VINCULO_NORMALIZED_SQL} IN ('OTROS', 'OTRO') THEN 1 ELSE 0 END) AS otros_total
            ${FROM_SOCIOS}
            WHERE
              (COD_SOC = @cod_soc OR DNI_ADHERENTE LIKE @dni_prefix)
          `);
      } else {
        result = await req.query(`
          SELECT TOP (@limit)
            ${SELECT_LIST}
          ${FROM_SOCIOS}
          WHERE DNI_ADHERENTE LIKE @dni_prefix
            ${segmentoSql ? `AND (${segmentoSql})` : ""}
          ORDER BY APELLIDOS, ADHERENTE_NOMBRE
        `);
        resumenResult = await pool
          .request()
          .input("dni_prefix", sql.VarChar(121), `${buscar}%`)
          .query(`
            SELECT
              COUNT(*) AS total_resultados,
              SUM(CASE WHEN ${VINCULO_NORMALIZED_SQL} = 'TITULAR' THEN 1 ELSE 0 END) AS titulares_total,
              SUM(CASE WHEN ${VINCULO_NORMALIZED_SQL} LIKE 'HIJ%' AND FECHA_NACIMIENTO IS NOT NULL AND ${EDAD_YEARS_SQL} >= 18 THEN 1 ELSE 0 END) AS hijos_mayores_18,
              SUM(CASE WHEN ${VINCULO_NORMALIZED_SQL} LIKE 'HIJ%' AND (FECHA_NACIMIENTO IS NULL OR ${EDAD_YEARS_SQL} < 18) THEN 1 ELSE 0 END) AS hijos_menores_18,
              SUM(CASE WHEN ${VINCULO_NORMALIZED_SQL} LIKE 'CONYUG%' THEN 1 ELSE 0 END) AS conyuges_total,
              SUM(CASE WHEN ${VINCULO_NORMALIZED_SQL} IN ('OTROS', 'OTRO') THEN 1 ELSE 0 END) AS otros_total
            ${FROM_SOCIOS}
            WHERE DNI_ADHERENTE LIKE @dni_prefix
          `);
      }
    } else {
      // Texto: prefijos en apellido y nombre (permite uso de índice si existe; evita scan por DNI con %...%).
      const req = pool
        .request()
        .input("limit", sql.Int, limit)
        .input("prefix", sql.VarChar(121), `${buscar}%`);

      result = await req.query(`
        SELECT TOP (@limit)
          ${SELECT_LIST}
        ${FROM_SOCIOS}
        WHERE
          (APELLIDOS LIKE @prefix OR ADHERENTE_NOMBRE LIKE @prefix)
          ${segmentoSql ? `AND (${segmentoSql})` : ""}
        ORDER BY APELLIDOS, ADHERENTE_NOMBRE
      `);
      resumenResult = await pool
        .request()
        .input("prefix", sql.VarChar(121), `${buscar}%`)
        .query(`
          SELECT
            COUNT(*) AS total_resultados,
            SUM(CASE WHEN ${VINCULO_NORMALIZED_SQL} = 'TITULAR' THEN 1 ELSE 0 END) AS titulares_total,
            SUM(CASE WHEN ${VINCULO_NORMALIZED_SQL} LIKE 'HIJ%' AND FECHA_NACIMIENTO IS NOT NULL AND ${EDAD_YEARS_SQL} >= 18 THEN 1 ELSE 0 END) AS hijos_mayores_18,
            SUM(CASE WHEN ${VINCULO_NORMALIZED_SQL} LIKE 'HIJ%' AND (FECHA_NACIMIENTO IS NULL OR ${EDAD_YEARS_SQL} < 18) THEN 1 ELSE 0 END) AS hijos_menores_18,
            SUM(CASE WHEN ${VINCULO_NORMALIZED_SQL} LIKE 'CONYUG%' THEN 1 ELSE 0 END) AS conyuges_total,
            SUM(CASE WHEN ${VINCULO_NORMALIZED_SQL} IN ('OTROS', 'OTRO') THEN 1 ELSE 0 END) AS otros_total
          ${FROM_SOCIOS}
          WHERE
            (APELLIDOS LIKE @prefix OR ADHERENTE_NOMBRE LIKE @prefix)
        `);
    }

    const data = mapSociosRows(result.recordset as SocioRow[]);
    const resumenRow = (resumenResult.recordset[0] as ResumenRow | undefined) ?? null;
    const resumen = {
      total_resultados: toNumber(resumenRow?.total_resultados),
      titulares_total: toNumber(resumenRow?.titulares_total),
      hijos_mayores_18: toNumber(resumenRow?.hijos_mayores_18),
      hijos_menores_18: toNumber(resumenRow?.hijos_menores_18),
      conyuges_total: toNumber(resumenRow?.conyuges_total),
      otros_total: toNumber(resumenRow?.otros_total),
    };

    sociosCache.set(cacheKey, {
      expiresAt: now + (buscar === "" ? SOCIOS_CACHE_TTL_MS_EMPTY : SOCIOS_CACHE_TTL_MS_SEARCH),
      data,
      resumen,
    });

    return NextResponse.json({
      success: true,
      data,
      resumen,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}
