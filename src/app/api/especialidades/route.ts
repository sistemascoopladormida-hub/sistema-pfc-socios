import sql from "mssql";
import { NextResponse } from "next/server";

import { getSqlConnectionPfc } from "@/lib/sqlserver";

export async function GET() {
  try {
    const pool = await getSqlConnectionPfc();
    const result = await pool.request().query(`
      SELECT
        id,
        nombre
      FROM especialidades
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

type CreateEspecialidadBody = {
  nombre?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateEspecialidadBody;
    const nombre = String(body.nombre ?? "").trim();

    if (!nombre) {
      return NextResponse.json({
        success: false,
        error: "El nombre es obligatorio",
      });
    }

    const pool = await getSqlConnectionPfc();
    await pool.request().input("nombre", sql.VarChar(255), nombre).query(`
      INSERT INTO especialidades
      (nombre)
      VALUES
      (@nombre)
    `);

    return NextResponse.json({
      success: true,
      message: "Especialidad creada",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}
