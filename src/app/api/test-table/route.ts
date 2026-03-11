import { NextResponse } from "next/server";

import { getSqlConnection } from "@/lib/sqlserver";

export async function GET() {
  try {
    const pool = await getSqlConnection();

    const result = await pool.request().query(`
SELECT *
FROM [dbo].[SERSOC] ss
INNER JOIN [dbo].[SERVICIO] s 
    ON ss.cod_ser = s.cod_ser
INNER JOIN [dbo].[SOCIOS] so
    ON ss.cod_soc = so.cod_soc
INNER JOIN [dbo].[PERSONAS] p 
    ON so.cod_per = p.COD_PER
WHERE  ss.cod_ser = 4 AND P.APELLIDOS LIKE '%criza%'
ORDER BY FEC_REG ASC;
    `);

    return NextResponse.json({
      success: true,
      rows: result.recordset,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}
