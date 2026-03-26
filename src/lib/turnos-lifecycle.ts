import sql from "mssql";

type TurnoEstado = "RESERVADO" | "ATENDIDO" | "CANCELADO" | "AUSENTE";

type TurnoRow = {
  id: number;
  estado: string;
};

type TransitionRules = {
  allowedEstados?: TurnoEstado[];
  blockedEstados?: TurnoEstado[];
  invalidMessage: string;
};

type TransitionInput = {
  turnoId: number;
  nuevoEstado: TurnoEstado;
  observacionesHistorial: string;
  rules: TransitionRules;
};

type TransitionResult =
  | { success: true }
  | { success: false; error: string };

function normalizeEstado(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

export function parsePositiveInt(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

async function getTurnoById(pool: sql.ConnectionPool, turnoId: number): Promise<TurnoRow | null> {
  const result = await pool.request().input("id", sql.Int, turnoId).query(`
    SELECT TOP 1 id, estado
    FROM turnos
    WHERE id = @id
  `);

  return (result.recordset[0] as TurnoRow | undefined) ?? null;
}

function isEstadoValido(estadoActual: string, rules: TransitionRules) {
  if (rules.allowedEstados && !rules.allowedEstados.includes(estadoActual as TurnoEstado)) {
    return false;
  }
  if (rules.blockedEstados && rules.blockedEstados.includes(estadoActual as TurnoEstado)) {
    return false;
  }
  return true;
}

export async function transitionTurnoEstado(
  pool: sql.ConnectionPool,
  input: TransitionInput
): Promise<TransitionResult> {
  const turno = await getTurnoById(pool, input.turnoId);
  if (!turno) {
    return {
      success: false,
      error: "Turno no encontrado",
    };
  }

  const estadoActual = normalizeEstado(turno.estado);
  const estadoSiguiente = normalizeEstado(input.nuevoEstado);
  if (!isEstadoValido(estadoActual, input.rules)) {
    return {
      success: false,
      error: input.rules.invalidMessage,
    };
  }

  if (estadoActual === estadoSiguiente) {
    return {
      success: false,
      error: `El turno ya se encuentra en estado ${estadoSiguiente}`,
    };
  }

  const transaction = new sql.Transaction(pool);
  let started = false;

  try {
    await transaction.begin();
    started = true;

    await new sql.Request(transaction)
      .input("id", sql.Int, input.turnoId)
      .input("estado", sql.VarChar(20), estadoSiguiente)
      .query(`
        UPDATE turnos
        SET estado = @estado
        WHERE id = @id
      `);

    await new sql.Request(transaction)
      .input("id", sql.Int, input.turnoId)
      .input("estado", sql.VarChar(20), estadoSiguiente)
      .input("observaciones", sql.VarChar(255), input.observacionesHistorial)
      .query(`
        INSERT INTO historial_atencion
        (
          turno_id,
          cod_soc,
          adherente_codigo,
          especialidad_id,
          prestacion_id,
          profesional_id,
          fecha,
          hora,
          estado,
          diagnostico,
          observaciones,
          creado_en,
          usuario_carga
        )
        SELECT
          id,
          cod_soc,
          adherente_codigo,
          especialidad_id,
          prestacion_id,
          profesional_id,
          fecha,
          hora,
          @estado,
          '',
          @observaciones,
          GETDATE(),
          'recepcion'
        FROM turnos
        WHERE id = @id
      `);

    await transaction.commit();
    started = false;

    return { success: true };
  } catch (error) {
    if (started) {
      try {
        await transaction.rollback();
      } catch {
        // no-op
      }
    }

    return {
      success: false,
      error: String(error),
    };
  }
}
