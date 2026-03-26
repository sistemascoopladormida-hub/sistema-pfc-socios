import { NextResponse } from "next/server";

import { getSqlConnectionPfc } from "@/lib/sqlserver";
import { parsePositiveInt, transitionTurnoEstado } from "@/lib/turnos-lifecycle";

type Params = {
  params: {
    id: string;
  };
};

type TurnoTimeRow = {
  fecha: string | Date;
  hora: string | Date;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function normalizeFecha(fechaRaw: string | Date) {
  if (fechaRaw instanceof Date) {
    return `${fechaRaw.getFullYear()}-${pad2(fechaRaw.getMonth() + 1)}-${pad2(fechaRaw.getDate())}`;
  }
  const raw = String(fechaRaw ?? "").trim();
  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
  }
  return "";
}

function normalizeHora(horaRaw: string | Date) {
  if (horaRaw instanceof Date) {
    return `${pad2(horaRaw.getHours())}:${pad2(horaRaw.getMinutes())}:${pad2(horaRaw.getSeconds())}`;
  }
  const raw = String(horaRaw ?? "").trim();
  const match = raw.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    return `${match[1]}:${match[2]}:${match[3] ?? "00"}`;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}:${pad2(parsed.getSeconds())}`;
  }
  return "";
}

function toDateTime(fechaRaw: string | Date, horaRaw: string | Date) {
  const fecha = normalizeFecha(fechaRaw);
  const hora = normalizeHora(horaRaw);
  if (!fecha || !hora) return null;
  const [year, month, day] = fecha.split("-").map(Number);
  const [hh, mm, ss] = hora.split(":").map(Number);
  const parsed = new Date(year, month - 1, day, hh, mm, ss);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function handleAusente(_: Request, { params }: Params) {
  try {
    const turnoId = parsePositiveInt(params.id);
    if (!turnoId) {
      return NextResponse.json({
        success: false,
        error: "ID de turno invalido",
      });
    }

    const pool = await getSqlConnectionPfc();
    const turnoResult = await pool.request().input("id", turnoId).query(`
      SELECT TOP 1 fecha, hora
      FROM turnos
      WHERE id = @id
    `);
    const turno = turnoResult.recordset[0] as TurnoTimeRow | undefined;
    if (!turno) {
      return NextResponse.json({
        success: false,
        error: "Turno no encontrado",
      });
    }

    const turnoDateTime = toDateTime(turno.fecha, turno.hora);
    if (!turnoDateTime) {
      return NextResponse.json({
        success: false,
        error: "No se pudo validar la fecha/hora del turno",
      });
    }
    if (turnoDateTime.getTime() > Date.now()) {
      return NextResponse.json({
        success: false,
        error: "Solo se puede marcar como AUSENTE cuando el horario ya pasó",
      });
    }

    const result = await transitionTurnoEstado(pool, {
      turnoId,
      nuevoEstado: "AUSENTE",
      observacionesHistorial: "Paciente ausente",
      rules: {
        allowedEstados: ["RESERVADO"],
        invalidMessage: "Solo se pueden marcar ausentes turnos reservados",
      },
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Turno marcado como ausente",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}

export async function PATCH(request: Request, context: Params) {
  return handleAusente(request, context);
}

export async function PUT(request: Request, context: Params) {
  return handleAusente(request, context);
}
