import sql from "mssql";
import { NextResponse } from "next/server";

import { getSqlConnectionPfc } from "@/lib/sqlserver";

type Params = {
  params: {
    id: string;
  };
};

type UpdateProfesionalBody = {
  nombre?: string;
  especialidad_id?: number;
  duracion_turno?: number;
  pacientes_mensuales?: number;
};

type TotalColumnName = "pacientes_mensuales" | "paciente_mensuales";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

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

export async function PUT(request: Request, { params }: Params) {
  try {
    const id = parseId(params.id);
    if (!id) {
      return NextResponse.json({
        success: false,
        error: "ID invalido",
      });
    }

    const body = (await request.json()) as UpdateProfesionalBody;
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
        .input("id", sql.Int, id)
        .input("nombre", sql.VarChar(255), nombre)
        .input("especialidad_id", sql.Int, especialidadId)
        .input("duracion_turno", sql.Int, duracionTurno)
        .input("pacientes_mensuales", sql.Int, Number.isInteger(pacientesMensuales) ? pacientesMensuales : 0)
        .query(`
          UPDATE profesionales
          SET
            nombre = @nombre,
            especialidad_id = @especialidad_id,
            duracion_turno = @duracion_turno,
            ${pacientesColumn} = @pacientes_mensuales
          WHERE id = @id
        `);
    } else {
      await pool
        .request()
        .input("id", sql.Int, id)
        .input("nombre", sql.VarChar(255), nombre)
        .input("especialidad_id", sql.Int, especialidadId)
        .input("duracion_turno", sql.Int, duracionTurno)
        .query(`
          UPDATE profesionales
          SET
            nombre = @nombre,
            especialidad_id = @especialidad_id,
            duracion_turno = @duracion_turno
          WHERE id = @id
        `);
    }

    return NextResponse.json({
      success: true,
      message: "Profesional actualizado",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const id = parseId(params.id);
    if (!id) {
      return NextResponse.json({
        success: false,
        error: "ID invalido",
      });
    }

    const pool = await getSqlConnectionPfc();
    await pool.request().input("id", sql.Int, id).query(`
      DELETE FROM profesionales
      WHERE id = @id
    `);

    return NextResponse.json({
      success: true,
      message: "Profesional eliminado",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}
