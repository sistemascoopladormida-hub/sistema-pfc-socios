import sql from "mssql";
import { NextResponse } from "next/server";

import { getSqlConnectionPfc } from "@/lib/sqlserver";

type Params = {
  params: {
    id: string;
  };
};

type UpdateAgendaBody = {
  dia_semana?: number;
  hora_inicio?: string;
  hora_fin?: string;
};
type AgendaByProfesionalRow = {
  id: number;
  dia_semana: number;
  hora_inicio: unknown;
  hora_fin: unknown;
};

function parsePositiveInt(raw: string) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
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

// GET usa [id] como profesional_id (segun requerimiento).
export async function GET(_: Request, { params }: Params) {
  try {
    const profesionalId = parsePositiveInt(params.id);
    if (!profesionalId) {
      return NextResponse.json({
        success: false,
        error: "profesional_id invalido",
      });
    }

    const pool = await getSqlConnectionPfc();
    const result = await pool.request().input("profesional_id", sql.Int, profesionalId).query(`
      SELECT
        id,
        dia_semana,
        hora_inicio,
        hora_fin
      FROM agenda_profesional
      WHERE profesional_id = @profesional_id
      ORDER BY dia_semana
    `);
    const data = (result.recordset as AgendaByProfesionalRow[]).map((row) => ({
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

// PUT/DELETE usan [id] como id del registro de agenda.
export async function PUT(request: Request, { params }: Params) {
  try {
    const agendaId = parsePositiveInt(params.id);
    if (!agendaId) {
      return NextResponse.json({
        success: false,
        error: "id invalido",
      });
    }

    const body = (await request.json()) as UpdateAgendaBody;
    const diaSemana = Number(body.dia_semana);
    const horaInicio = String(body.hora_inicio ?? "").trim();
    const horaFin = String(body.hora_fin ?? "").trim();

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
      .input("id", sql.Int, agendaId)
      .input("dia_semana", sql.Int, diaSemana)
      .input("hora_inicio", sql.VarChar(5), horaInicio)
      .input("hora_fin", sql.VarChar(5), horaFin)
      .query(`
        UPDATE agenda_profesional
        SET
          dia_semana = @dia_semana,
          hora_inicio = @hora_inicio,
          hora_fin = @hora_fin
        WHERE id = @id
      `);

    return NextResponse.json({
      success: true,
      message: "Horario actualizado",
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
    const agendaId = parsePositiveInt(params.id);
    if (!agendaId) {
      return NextResponse.json({
        success: false,
        error: "id invalido",
      });
    }

    const pool = await getSqlConnectionPfc();
    await pool.request().input("id", sql.Int, agendaId).query(`
      DELETE FROM agenda_profesional
      WHERE id = @id
    `);

    return NextResponse.json({
      success: true,
      message: "Horario eliminado",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}
