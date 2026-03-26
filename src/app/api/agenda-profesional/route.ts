import sql from "mssql";
import { NextResponse } from "next/server";

import { getSqlConnectionPfc } from "@/lib/sqlserver";

type CreateAgendaBody = {
  profesional_id?: number;
  dia_semana?: number;
  hora_inicio?: string;
  hora_fin?: string;
};
type AgendaRow = {
  id: number;
  dia_semana: number;
  hora_inicio: unknown;
  hora_fin: unknown;
  profesional_id: number;
  profesional: string;
  pacientes_mensuales: number | null;
  especialidad: string;
};
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

function isValidHora(hora: string) {
  return /^\d{2}:\d{2}$/.test(hora);
}

function isValidDiaSemana(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 6;
}

function normalizeSqlTime(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(11, 19);
  }

  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
  if (raw.includes("T")) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(11, 19);
    }
  }

  return raw;
}

export async function GET() {
  try {
    const pool = await getSqlConnectionPfc();
    const pacientesColumn = await resolvePacientesColumn(pool);
    const pacientesSelect = pacientesColumn
      ? `p.${pacientesColumn} as pacientes_mensuales`
      : "CAST(NULL AS INT) as pacientes_mensuales";
    const result = await pool.request().query(`
      SELECT
        a.id,
        a.dia_semana,
        a.hora_inicio,
        a.hora_fin,
        p.id as profesional_id,
        p.nombre as profesional,
        ${pacientesSelect},
        e.nombre as especialidad
      FROM agenda_profesional a
      JOIN profesionales p ON p.id = a.profesional_id
      JOIN especialidades e ON e.id = p.especialidad_id
      ORDER BY p.nombre, a.dia_semana
    `);
    const data = (result.recordset as AgendaRow[]).map((row) => ({
      ...row,
      hora_inicio: normalizeSqlTime(row.hora_inicio),
      hora_fin: normalizeSqlTime(row.hora_fin),
    }));

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateAgendaBody;
    const profesionalId = Number(body.profesional_id);
    const diaSemana = Number(body.dia_semana);
    const horaInicio = String(body.hora_inicio ?? "").trim();
    const horaFin = String(body.hora_fin ?? "").trim();

    if (!Number.isInteger(profesionalId) || profesionalId <= 0) {
      return NextResponse.json({
        success: false,
        error: "profesional_id invalido",
      });
    }
    if (!isValidDiaSemana(diaSemana)) {
      return NextResponse.json({
        success: false,
        error: "dia_semana invalido",
      });
    }
    if (!isValidHora(horaInicio) || !isValidHora(horaFin)) {
      return NextResponse.json({
        success: false,
        error: "Hora invalida. Usa HH:mm",
      });
    }

    const pool = await getSqlConnectionPfc();
    await pool
      .request()
      .input("profesional_id", sql.Int, profesionalId)
      .input("dia_semana", sql.Int, diaSemana)
      .input("hora_inicio", sql.VarChar(5), horaInicio)
      .input("hora_fin", sql.VarChar(5), horaFin)
      .query(`
        INSERT INTO agenda_profesional
        (profesional_id, dia_semana, hora_inicio, hora_fin)
        VALUES
        (@profesional_id, @dia_semana, @hora_inicio, @hora_fin)
      `);

    return NextResponse.json({
      success: true,
      message: "Horario creado correctamente",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}
