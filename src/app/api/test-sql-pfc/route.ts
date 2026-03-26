import { NextResponse } from "next/server";

import { getSqlConnectionPfc } from "@/lib/sqlserver";

export async function GET() {
  try {
    const pool = await getSqlConnectionPfc();

    const result = await pool.request().query(`
      SELECT
        DB_NAME() AS databaseName,
        GETDATE() AS serverTime
    `);

    return NextResponse.json({
      success: true,
      message: "Conexion exitosa con la base PFC",
      data: result.recordset,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "Error conectando a la base PFC",
      error: String(error),
    });
  }
}
