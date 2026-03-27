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

const SOCIOS_CACHE_TTL_MS = 20_000;
const sociosCache = new Map<string, { expiresAt: number; data: unknown[] }>();

function toPositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value ?? "");
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const buscar = String(searchParams.get("buscar") ?? "").trim();
    const limit = Math.min(toPositiveInt(searchParams.get("limit"), 2500), 5000);
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
    const result = await pool
      .request()
      .input("buscar", sql.VarChar(120), buscar)
      .input("buscar_prefix", sql.VarChar(121), `${buscar}%`)
      .input("limit", sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          COD_SOC,
          APELLIDOS,
          ADHERENTE_CODIGO,
          ADHERENTE_NOMBRE,
          VINCULO,
          DNI_ADHERENTE,
          DES_CAT,
          FECHA_NACIMIENTO
        FROM PR_DORM.dbo.vw_socios_adherentes
        WHERE
          @buscar = ''
          OR CAST(COD_SOC AS VARCHAR(20)) = @buscar
          OR APELLIDOS LIKE @buscar_prefix
          OR DNI_ADHERENTE LIKE '%' + @buscar + '%'
        ORDER BY
          CASE
            WHEN CAST(COD_SOC AS VARCHAR(20)) = @buscar THEN 0
            WHEN APELLIDOS LIKE @buscar_prefix THEN 1
            WHEN DNI_ADHERENTE LIKE '%' + @buscar + '%' THEN 2
            ELSE 3
          END,
          APELLIDOS,
          ADHERENTE_NOMBRE
      `);

    const data = (result.recordset as SocioRow[]).map((row) => {
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

    sociosCache.set(cacheKey, {
      expiresAt: now + SOCIOS_CACHE_TTL_MS,
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
