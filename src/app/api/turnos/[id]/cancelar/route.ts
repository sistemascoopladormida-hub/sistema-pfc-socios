import { NextResponse } from "next/server";

import { getSqlConnectionPfc } from "@/lib/sqlserver";
import { parsePositiveInt, transitionTurnoEstado } from "@/lib/turnos-lifecycle";

type Params = {
  params: {
    id: string;
  };
};

async function handleCancelar(_: Request, { params }: Params) {
  try {
    const turnoId = parsePositiveInt(params.id);
    if (!turnoId) {
      return NextResponse.json({
        success: false,
        error: "ID de turno invalido",
      });
    }

    const pool = await getSqlConnectionPfc();
    const result = await transitionTurnoEstado(pool, {
      turnoId,
      nuevoEstado: "CANCELADO",
      observacionesHistorial: "Turno cancelado",
      rules: {
        blockedEstados: ["CANCELADO", "ATENDIDO"],
        invalidMessage: "El turno no puede ser cancelado",
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
      message: "Turno cancelado correctamente",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}

export async function PATCH(request: Request, context: Params) {
  return handleCancelar(request, context);
}

export async function PUT(request: Request, context: Params) {
  return handleCancelar(request, context);
}
