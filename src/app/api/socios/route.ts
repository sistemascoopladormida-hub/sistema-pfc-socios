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

/** Vista pesada: cache más largo en listado sin filtro acelera recargas y navegación. */
const SOCIOS_CACHE_TTL_MS_EMPTY = 45_000;
const SOCIOS_CACHE_TTL_MS_SEARCH = 25_000;
const sociosCache = new Map<string, { expiresAt: number; data: unknown[] }>();

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

function toPositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value ?? "");
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
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

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const buscarRaw = String(searchParams.get("buscar") ?? "").trim();
    const buscar = buscarRaw.length > 120 ? buscarRaw.slice(0, 120) : buscarRaw;
    const limit = Math.min(toPositiveInt(searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);
    const cacheKey = `${buscar.toUpperCase()}::${limit}`;
    const now = Date.now();
    const cached = sociosCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return NextResponse.json({
        success: true,
        data: cached.data,
      });
    }

    const pool = await getSqlConnection();
    let result: sql.IResult<SocioRow>;

    if (buscar === "") {
      // Sin filtro: evitar OR + ORDER BY complejo sobre toda la vista; orden estable por claves.
      result = await pool.request().input("limit", sql.Int, limit).query(`
        SELECT TOP (@limit)
          ${SELECT_LIST}
        ${FROM_SOCIOS}
        ORDER BY COD_SOC, ADHERENTE_CODIGO
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
            COD_SOC = @cod_soc
            OR DNI_ADHERENTE LIKE @dni_prefix
          ORDER BY
            CASE WHEN COD_SOC = @cod_soc THEN 0 ELSE 1 END,
            APELLIDOS,
            ADHERENTE_NOMBRE
        `);
      } else {
        result = await req.query(`
          SELECT TOP (@limit)
            ${SELECT_LIST}
          ${FROM_SOCIOS}
          WHERE DNI_ADHERENTE LIKE @dni_prefix
          ORDER BY APELLIDOS, ADHERENTE_NOMBRE
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
          APELLIDOS LIKE @prefix
          OR ADHERENTE_NOMBRE LIKE @prefix
        ORDER BY APELLIDOS, ADHERENTE_NOMBRE
      `);
    }

    const data = mapSociosRows(result.recordset as SocioRow[]);

    sociosCache.set(cacheKey, {
      expiresAt: now + (buscar === "" ? SOCIOS_CACHE_TTL_MS_EMPTY : SOCIOS_CACHE_TTL_MS_SEARCH),
      data,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}
