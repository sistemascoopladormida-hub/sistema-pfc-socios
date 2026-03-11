import { NextResponse } from "next/server";

import { getSqlConnection } from "@/lib/sqlserver";

export async function GET() {
  try {
    const pool = await getSqlConnection();

    const result = await pool.request().query(`
      SELECT GETDATE() as serverTime
    `);

    return NextResponse.json({
      success: true,
      message: "Conexion exitosa con SQL Server",
      data: result.recordset,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "Error conectando a SQL Server",
      error: String(error),
    });
  }
}
