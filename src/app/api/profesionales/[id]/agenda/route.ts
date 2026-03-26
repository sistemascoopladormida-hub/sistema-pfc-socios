import sql from "mssql";
import { NextResponse } from "next/server";

import { getSqlConnectionPfc } from "@/lib/sqlserver";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_: Request, { params }: RouteContext) {
  try {
    const profesionalId = Number(params.id);
    if (!Number.isInteger(profesionalId) || profesionalId <= 0) {
      return NextResponse.json({
        success: false,
        error: "El id del profesional es invalido",
      });
    }

    const pool = await getSqlConnectionPfc();
    const result = await pool
      .request()
      .input("id", sql.Int, profesionalId)
      .query(`
        SELECT
          a.id,
          a.profesional_id,
          a.dia_semana,
          a.hora_inicio,
          a.hora_fin,
          p.nombre,
          p.duracion_turno
        FROM agenda_profesional a
        JOIN profesionales p ON p.id = a.profesional_id
        WHERE a.profesional_id = @id
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
