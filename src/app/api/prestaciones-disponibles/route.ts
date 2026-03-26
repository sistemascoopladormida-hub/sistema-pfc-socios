import sql from "mssql";
import { NextResponse } from "next/server";

import { getSqlConnectionPfc } from "@/lib/sqlserver";

function normalizeCategoria(value: string) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const categoria = normalizeCategoria(String(params.get("categoria") ?? ""));
    const especialidadId = Number(params.get("especialidad_id") ?? "");

    if (!categoria) {
      return NextResponse.json({
        success: false,
        error: "categoria es obligatoria",
      });
    }

    const pool = await getSqlConnectionPfc();
    const dbRequest = pool.request().input("categoria", sql.VarChar(120), categoria);
    if (Number.isInteger(especialidadId) && especialidadId > 0) {
      dbRequest.input("especialidad_id", sql.Int, especialidadId);
    }

    const result = await dbRequest.query(`
      SELECT DISTINCT
        p.id,
        p.nombre,
        p.especialidad_id
      FROM prestaciones p
      JOIN cobertura_anual ca ON ca.prestacion_id = p.id
      WHERE
        ca.categoria COLLATE Latin1_General_CI_AI = @categoria COLLATE Latin1_General_CI_AI
        AND CAST(ca.cantidad_anual as int) > 0
        ${Number.isInteger(especialidadId) && especialidadId > 0 ? "AND p.especialidad_id = @especialidad_id" : ""}
      ORDER BY p.nombre
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
