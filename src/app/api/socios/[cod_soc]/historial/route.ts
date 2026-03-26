import sql from "mssql";
import { NextResponse } from "next/server";

import { getSqlConnectionPfc } from "@/lib/sqlserver";
import { parsePositiveInt } from "@/lib/turnos-lifecycle";

type Params = {
  params: {
    cod_soc: string;
  };
};

export async function GET(_: Request, { params }: Params) {
  try {
    const codSoc = parsePositiveInt(params.cod_soc);
    if (!codSoc) {
      return NextResponse.json({
        success: false,
        error: "cod_soc invalido",
      });
    }

    const pool = await getSqlConnectionPfc();
    const result = await pool.request().input("cod_soc", sql.Int, codSoc).query(`
      SELECT
        t.id,
        t.fecha,
        t.hora,
        t.estado,
        p.nombre AS profesional,
        e.nombre AS especialidad,
        pr.nombre AS prestacion
      FROM turnos t
      JOIN profesionales p ON p.id = t.profesional_id
      JOIN especialidades e ON e.id = t.especialidad_id
      JOIN prestaciones pr ON pr.id = t.prestacion_id
      WHERE t.cod_soc = @cod_soc
      ORDER BY t.fecha DESC, t.hora DESC
    `);

    return NextResponse.json({
      success: true,
      data: result.recordset,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}
