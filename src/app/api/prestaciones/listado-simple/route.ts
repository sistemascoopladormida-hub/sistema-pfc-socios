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
        e.nombre as especialidad_nombre
      FROM prestaciones p
      JOIN especialidades e ON e.id = p.especialidad_id
      ORDER BY e.nombre ASC, p.nombre ASC
    `);

    return NextResponse.json({
      success: true,
      prestaciones: result.recordset,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}
