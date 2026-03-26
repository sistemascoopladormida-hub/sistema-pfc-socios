import { NextResponse } from "next/server";

import { getSqlConnectionPfc } from "@/lib/sqlserver";

export async function GET() {
  try {
    const pool = await getSqlConnectionPfc();
    const result = await pool.request().query(`
      SELECT *
      FROM cobertura_anual
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
