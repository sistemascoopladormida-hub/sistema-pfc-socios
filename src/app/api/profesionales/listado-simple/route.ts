import { NextResponse } from "next/server";

import { getSqlConnectionPfc } from "@/lib/sqlserver";

export async function GET() {
  try {
    const pool = await getSqlConnectionPfc();
    const result = await pool.request().query(`
      SELECT id, nombre, especialidad_id
      FROM profesionales
      ORDER BY nombre ASC
    `);

    return NextResponse.json({
      success: true,
      profesionales: result.recordset,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}
