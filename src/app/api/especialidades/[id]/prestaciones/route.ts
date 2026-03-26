import sql from "mssql";
import { NextResponse } from "next/server";

import { getSqlConnectionPfc } from "@/lib/sqlserver";

type Params = {
  params: {
    id: string;
  };
};

export async function GET(_: Request, { params }: Params) {
  try {
    const especialidadId = Number(params.id);
    if (!Number.isInteger(especialidadId) || especialidadId <= 0) {
      return NextResponse.json({
        success: false,
        error: "especialidad_id invalido",
      });
    }

    const pool = await getSqlConnectionPfc();
    const result = await pool.request().input("especialidad_id", sql.Int, especialidadId).query(`
      SELECT
        id,
        nombre,
        especialidad_id
      FROM prestaciones
      WHERE especialidad_id = @especialidad_id
      ORDER BY nombre
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
