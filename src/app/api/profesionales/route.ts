import sql from "mssql";
import { NextResponse } from "next/server";

import { getSqlConnectionPfc } from "@/lib/sqlserver";

type TotalColumnName = "pacientes_mensuales" | "paciente_mensuales";

async function resolvePacientesColumn(pool: sql.ConnectionPool): Promise<TotalColumnName | null> {
  const result = await pool.request().query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'profesionales'
      AND COLUMN_NAME IN ('pacientes_mensuales', 'paciente_mensuales')
  `);

  const rows = result.recordset as Array<{ COLUMN_NAME: string }>;
  if (rows.some((item) => item.COLUMN_NAME === "pacientes_mensuales")) {
    return "pacientes_mensuales";
  }
  if (rows.some((item) => item.COLUMN_NAME === "paciente_mensuales")) {
    return "paciente_mensuales";
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const especialidadParam = url.searchParams.get("especialidad_id");
    const especialidadId =
      especialidadParam && Number.isInteger(Number(especialidadParam))
        ? Number(especialidadParam)
        : null;

    const pool = await getSqlConnectionPfc();
    const pacientesColumn = await resolvePacientesColumn(pool);
    const pacientesExpr = pacientesColumn ? `p.${pacientesColumn}` : "CAST(NULL AS INT)";
    const pacientesSelect = `${pacientesExpr} as pacientes_mensuales`;

    const dbRequest = pool.request();
    if (especialidadId && especialidadId > 0) {
      dbRequest.input("especialidad_id", sql.Int, especialidadId);
    }

    const result = await dbRequest.query(`
      SELECT
        p.id,
        p.nombre,
        p.especialidad_id,
        ${pacientesSelect},
        ISNULL(tm.turnos_mes, 0) as turnos_mes,
        CASE
          WHEN ${pacientesExpr} IS NULL THEN NULL
          ELSE (${pacientesExpr} - ISNULL(tm.turnos_mes, 0))
        END as cupo_restante,
        p.activo,
        p.duracion_turno,
        e.nombre as especialidad
      FROM profesionales p
      JOIN especialidades e ON p.especialidad_id = e.id
      LEFT JOIN (
        SELECT
          profesional_id,
          COUNT(*) as turnos_mes
        FROM turnos
        WHERE
          estado IN ('RESERVADO','ATENDIDO')
          AND MONTH(fecha) = MONTH(GETDATE())
          AND YEAR(fecha) = YEAR(GETDATE())
        GROUP BY profesional_id
      ) tm ON tm.profesional_id = p.id
      ${especialidadId && especialidadId > 0 ? "WHERE p.especialidad_id = @especialidad_id" : ""}
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

type CreateProfesionalBody = {
  nombre?: string;
  especialidad_id?: number;
  duracion_turno?: number;
  pacientes_mensuales?: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateProfesionalBody;
    const nombre = String(body.nombre ?? "").trim();
    const especialidadId = Number(body.especialidad_id);
    const duracionTurno = Number(body.duracion_turno);
    const pacientesMensuales = Number(body.pacientes_mensuales ?? 0);

    if (!nombre || !Number.isInteger(especialidadId) || especialidadId <= 0) {
      return NextResponse.json({
        success: false,
        error: "Datos invalidos. Envia nombre y especialidad_id",
      });
    }

    if (!Number.isInteger(duracionTurno) || duracionTurno <= 0) {
      return NextResponse.json({
        success: false,
        error: "duracion_turno debe ser un numero entero mayor a 0",
      });
    }

    const pool = await getSqlConnectionPfc();
    const pacientesColumn = await resolvePacientesColumn(pool);
    if (pacientesColumn) {
      await pool
        .request()
        .input("nombre", sql.VarChar(255), nombre)
        .input("especialidad_id", sql.Int, especialidadId)
        .input("duracion_turno", sql.Int, duracionTurno)
        .input("pacientes_mensuales", sql.Int, Number.isInteger(pacientesMensuales) ? pacientesMensuales : 0)
        .query(`
          INSERT INTO profesionales
          (nombre, especialidad_id, duracion_turno, ${pacientesColumn})
          VALUES
          (@nombre, @especialidad_id, @duracion_turno, @pacientes_mensuales)
        `);
    } else {
      await pool
        .request()
        .input("nombre", sql.VarChar(255), nombre)
        .input("especialidad_id", sql.Int, especialidadId)
        .input("duracion_turno", sql.Int, duracionTurno)
        .query(`
          INSERT INTO profesionales
          (nombre, especialidad_id, duracion_turno)
          VALUES
          (@nombre, @especialidad_id, @duracion_turno)
        `);
    }

    return NextResponse.json({
      success: true,
      message: "Profesional creado correctamente",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}
