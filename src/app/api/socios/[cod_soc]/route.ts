import sql from "mssql";
import { NextResponse } from "next/server";

import { enriquecerSocioConCobertura } from "@/lib/pfc-rules";
import { getSqlConnection } from "@/lib/sqlserver";

type Params = {
  params: {
    cod_soc: string;
  };
};

type SocioGrupoRow = {
  COD_SOC: number | string;
  APELLIDOS: string;
  ADHERENTE_CODIGO: number | string;
  ADHERENTE_NOMBRE: string;
  VINCULO: string;
  DNI_ADHERENTE: string;
  DES_CAT: string;
  FECHA_NACIMIENTO: string | Date | null;
};

const SOCIO_GRUPO_CACHE_TTL_MS = 30_000;
const grupoCache = new Map<number, { expiresAt: number; data: unknown[] }>();

export async function GET(_: Request, { params }: Params) {
  try {
    const codSoc = Number(params.cod_soc);
    if (!Number.isInteger(codSoc) || codSoc <= 0) {
      return NextResponse.json({
        success: false,
        error: "cod_soc invalido",
      });
    }

    const now = Date.now();
    const cached = grupoCache.get(codSoc);
    if (cached && cached.expiresAt > now) {
      return NextResponse.json({
        success: true,
        data: cached.data,
      });
    }

    const pool = await getSqlConnection();
    const result = await pool.request().input("cod_soc", sql.Int, codSoc).query(`
      SELECT
        COD_SOC,
        APELLIDOS,
        ADHERENTE_CODIGO,
        ADHERENTE_NOMBRE,
        VINCULO,
        DNI_ADHERENTE,
        DES_CAT,
        FECHA_NACIMIENTO
      FROM PR_DORM.dbo.vw_socios_adherentes
      WHERE COD_SOC = @cod_soc
      ORDER BY
        CASE WHEN VINCULO = 'TITULAR' THEN 0 ELSE 1 END,
        ADHERENTE_NOMBRE
    `);

    const data = (result.recordset as SocioGrupoRow[]).map((row) => enriquecerSocioConCobertura(row));

    grupoCache.set(codSoc, {
      expiresAt: now + SOCIO_GRUPO_CACHE_TTL_MS,
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
