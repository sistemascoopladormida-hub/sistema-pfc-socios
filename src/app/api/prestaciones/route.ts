import sql from "mssql";
import { NextResponse } from "next/server";

import { getSqlConnectionPfc } from "@/lib/sqlserver";

export async function GET() {
  try {
    const pool = await getSqlConnectionPfc();
    const result = await pool.request().query(`
      SELECT
        p.id,
        p.nombre,
        p.especialidad_id,
        e.nombre as especialidad
      FROM prestaciones p
      JOIN especialidades e ON e.id = p.especialidad_id
      ORDER BY e.nombre, p.nombre
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

type CreatePrestacionBody = {
  nombre?: string;
  especialidad_id?: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreatePrestacionBody;
    const nombre = String(body.nombre ?? "").trim();
    const especialidadId = Number(body.especialidad_id);

    if (!nombre || !Number.isInteger(especialidadId) || especialidadId <= 0) {
      return NextResponse.json({
        success: false,
        error: "Datos invalidos. Envia nombre y especialidad_id",
      });
    }

    const pool = await getSqlConnectionPfc();
    await pool
      .request()
      .input("nombre", sql.VarChar(255), nombre)
      .input("especialidad_id", sql.Int, especialidadId)
      .query(`
        INSERT INTO prestaciones
        (nombre, especialidad_id)
        VALUES
        (@nombre, @especialidad_id)
      `);

    return NextResponse.json({
      success: true,
      message: "Prestacion creada correctamente",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}
