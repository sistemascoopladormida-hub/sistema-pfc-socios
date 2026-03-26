import sql from "mssql";
import { NextResponse } from "next/server";

import { getSqlConnectionPfc } from "@/lib/sqlserver";

type RouteContext = {
  params: {
    id: string;
  };
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const profesionalId = Number(params.id);
    if (!Number.isInteger(profesionalId) || profesionalId <= 0) {
      return NextResponse.json({
        success: false,
        error: "El id del profesional es invalido",
      });
    }

    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get("fecha");

    if (!fecha || !DATE_REGEX.test(fecha)) {
      return NextResponse.json({
        success: false,
        error: "Debes enviar la fecha en formato YYYY-MM-DD",
      });
    }

    const pool = await getSqlConnectionPfc();
    const result = await pool
      .request()
      .input("id", sql.Int, profesionalId)
      .input("fecha", sql.Date, fecha)
      .query(`
        SELECT
          id,
          hora,
          estado,
          adherente_codigo
        FROM turnos
        WHERE profesional_id = @id
          AND fecha = @fecha
          AND estado IN ('RESERVADO', 'ATENDIDO')
        ORDER BY hora
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
