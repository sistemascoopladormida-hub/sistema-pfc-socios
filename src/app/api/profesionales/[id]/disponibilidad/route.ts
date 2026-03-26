import sql from "mssql";
import { NextResponse } from "next/server";

import { getSqlConnectionPfc } from "@/lib/sqlserver";

type Params = {
  params: {
    id: string;
  };
};

function dayToAgenda(fecha: string) {
  const day = new Date(`${fecha}T00:00:00`).getDay();
  if (Number.isNaN(day)) return NaN;
  return day === 0 ? 7 : day;
}

function dayToSpanish(dia: number) {
  const map: Record<number, string> = {
    1: "Lunes",
    2: "Martes",
    3: "Miercoles",
    4: "Jueves",
    5: "Viernes",
    6: "Sabado",
    7: "Domingo",
  };
  return map[dia] ?? "";
}

function normalizeTime(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(11, 16);
  }
  const raw = String(value ?? "");
  const [hh = "00", mm = "00"] = raw.split(":");
  return `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}`;
}

function timeToMinutes(hora: string) {
  const [hh, mm] = hora.split(":").map(Number);
  return hh * 60 + mm;
}

function minutesToTime(total: number) {
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const profesionalId = Number(params.id);
    const fecha = String(new URL(request.url).searchParams.get("fecha") ?? "").trim();

    if (!Number.isInteger(profesionalId) || profesionalId <= 0) {
      return NextResponse.json({
        success: false,
        error: "profesional_id invalido",
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json({
        success: false,
        error: "fecha invalida. Usa YYYY-MM-DD",
      });
    }

    const diaSemana = dayToAgenda(fecha);
    if (!Number.isInteger(diaSemana)) {
      return NextResponse.json({
        success: false,
        error: "No se pudo calcular el dia de la semana",
      });
    }

    const pool = await getSqlConnectionPfc();
    const profesionalResult = await pool.request().input("id", sql.Int, profesionalId).query(`
      SELECT id, duracion_turno
      FROM profesionales
      WHERE id = @id
    `);
    const profesional = profesionalResult.recordset[0] as { duracion_turno: number } | undefined;
    if (!profesional || !Number.isInteger(Number(profesional.duracion_turno))) {
      return NextResponse.json({
        success: false,
        error: "Profesional sin duracion de turno valida",
      });
    }

    const agendaResult = await pool
      .request()
      .input("profesional_id", sql.Int, profesionalId)
      .input("dia_semana", sql.Int, diaSemana)
      .input("dia_semana_texto", sql.VarChar(20), dayToSpanish(diaSemana))
      .query(`
        SELECT hora_inicio, hora_fin
        FROM agenda_profesional
        WHERE profesional_id = @profesional_id
          AND (
            TRY_CAST(dia_semana as int) = @dia_semana
            OR LTRIM(RTRIM(CAST(dia_semana as varchar(20)))) COLLATE Latin1_General_CI_AI
               = @dia_semana_texto COLLATE Latin1_General_CI_AI
          )
        ORDER BY hora_inicio
      `);

    const ocupadosResult = await pool
      .request()
      .input("profesional_id", sql.Int, profesionalId)
      .input("fecha", sql.Date, fecha)
      .query(`
        SELECT hora
        FROM turnos
        WHERE profesional_id = @profesional_id
          AND fecha = @fecha
          AND estado IN ('RESERVADO','ATENDIDO')
      `);

    const ocupados = new Set(
      (ocupadosResult.recordset as Array<{ hora: unknown }>).map((item) => normalizeTime(item.hora))
    );

    const step = Number(profesional.duracion_turno);
    const disponibles: string[] = [];
    for (const bloque of agendaResult.recordset as Array<{ hora_inicio: unknown; hora_fin: unknown }>) {
      const inicio = timeToMinutes(normalizeTime(bloque.hora_inicio));
      const fin = timeToMinutes(normalizeTime(bloque.hora_fin));
      for (let current = inicio; current + step <= fin; current += step) {
        const time = minutesToTime(current);
        if (!ocupados.has(time)) {
          disponibles.push(time);
        }
      }
    }

    return NextResponse.json({
      success: true,
      disponibles,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}
