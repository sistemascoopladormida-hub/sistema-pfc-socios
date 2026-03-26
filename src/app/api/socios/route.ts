import sql from "mssql";
import { NextResponse } from "next/server";

import { calcularEdad, esVinculoHijo, resolverBeneficio } from "@/lib/adherentes-beneficios";
import { getSqlConnection } from "@/lib/sqlserver";

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const buscar = String(searchParams.get("buscar") ?? "").trim();

    const pool = await getSqlConnection();
    const result = await pool.request().input("buscar", sql.VarChar(120), buscar).query(`
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
      WHERE
        @buscar = ''
        OR APELLIDOS LIKE '%' + @buscar + '%'
        OR DNI_ADHERENTE LIKE '%' + @buscar + '%'
        OR CAST(COD_SOC AS VARCHAR(20)) LIKE '%' + @buscar + '%'
      ORDER BY APELLIDOS
    `);

    const data = result.recordset.map((row) => {
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
