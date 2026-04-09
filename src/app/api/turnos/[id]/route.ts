import sql from "mssql";
import { NextResponse } from "next/server";

import { getSqlConnection, getSqlConnectionPfc } from "@/lib/sqlserver";

type Params = {
  params: {
    id: string;
  };
};

type UpdateTurnoBody = {
  profesional_id?: number;
  prestacion_id?: number;
  especialidad_id?: number;
  fecha?: string;
  hora?: string;
  estado?: "RESERVADO" | "ATENDIDO" | "AUSENTE" | "CANCELADO" | string;
  observaciones?: string;
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}$/;
const ESTADOS_VALIDOS = ["RESERVADO", "ATENDIDO", "AUSENTE", "CANCELADO"] as const;

function parsePositiveInt(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function isValidDate(value: string) {
  if (!DATE_REGEX.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function isValidTime(value: string) {
  if (!TIME_REGEX.test(value)) return false;
  const [hh, mm] = value.split(":").map(Number);
  return hh >= 0 && hh < 24 && mm >= 0 && mm < 60;
}

export async function GET(_: Request, { params }: Params) {
  try {
    const turnoId = parsePositiveInt(params.id);
    if (!turnoId) {
      return NextResponse.json({ success: false, error: "id de turno invalido" });
    }

    const pool = await getSqlConnectionPfc();
    const sociosPool = await getSqlConnection();

    const turnoResult = await pool.request().input("id", sql.Int, turnoId).query(`
      SELECT TOP 1
        t.id,
        t.cod_soc,
        t.adherente_codigo,
        t.profesional_id,
        t.especialidad_id,
        t.prestacion_id,
        t.fecha,
        t.hora,
        t.estado,
        t.observaciones,
        p.nombre as prestacion_nombre,
        pr.nombre as profesional_nombre,
        e.nombre as especialidad_nombre
      FROM turnos t
      JOIN prestaciones p ON p.id = t.prestacion_id
      JOIN profesionales pr ON pr.id = t.profesional_id
      JOIN especialidades e ON e.id = t.especialidad_id
      WHERE t.id = @id
    `);

    const turno = turnoResult.recordset[0] as
      | {
          id: number;
          cod_soc: number;
          adherente_codigo: number;
          profesional_id: number;
          especialidad_id: number;
          prestacion_id: number;
          fecha: string | Date;
          hora: string | Date;
          estado: string;
          observaciones: string | null;
          prestacion_nombre: string;
          profesional_nombre: string;
          especialidad_nombre: string;
        }
      | undefined;
    if (!turno) {
      return NextResponse.json({ success: false, error: "Turno no encontrado" });
    }

    const socioResult = await sociosPool
      .request()
      .input("cod_soc", sql.Int, Number(turno.cod_soc))
      .input("adherente_codigo", sql.Int, Number(turno.adherente_codigo))
      .query(`
        SELECT TOP 1
          ADHERENTE_NOMBRE,
          APELLIDOS
        FROM PR_DORM.dbo.vw_socios_adherentes
        WHERE COD_SOC = @cod_soc
          AND ADHERENTE_CODIGO = @adherente_codigo
      `);
    const socioNombre = String(
      socioResult.recordset[0]?.ADHERENTE_NOMBRE || socioResult.recordset[0]?.APELLIDOS || ""
    ).trim();

    return NextResponse.json({
      success: true,
      data: {
        ...turno,
        socio_nombre: socioNombre || `Socio ${turno.cod_soc}`,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) });
  }
}

export async function PUT(request: Request, { params }: Params) {
  const pool = await getSqlConnectionPfc();
  const transaction = new sql.Transaction(pool);
  let started = false;

  try {
    const turnoId = parsePositiveInt(params.id);
    if (!turnoId) {
      return NextResponse.json({ success: false, error: "id de turno invalido" });
    }

    const body = (await request.json()) as UpdateTurnoBody;
    const profesionalId = Number(body.profesional_id);
    const prestacionId = Number(body.prestacion_id);
    const especialidadIdRaw = Number(body.especialidad_id);
    const fecha = normalizeText(body.fecha);
    const hora = normalizeText(body.hora);
    const estado = normalizeText(body.estado).toUpperCase();
    const observaciones = normalizeText(body.observaciones);

    if (!Number.isInteger(profesionalId) || profesionalId <= 0) {
      return NextResponse.json({ success: false, error: "profesional_id invalido" });
    }
    if (!Number.isInteger(prestacionId) || prestacionId <= 0) {
      return NextResponse.json({ success: false, error: "prestacion_id invalido" });
    }
    if (!isValidDate(fecha)) {
      return NextResponse.json({ success: false, error: "fecha invalida. Usa YYYY-MM-DD" });
    }
    if (!isValidTime(hora)) {
      return NextResponse.json({ success: false, error: "hora invalida. Usa HH:mm" });
    }
    if (!ESTADOS_VALIDOS.includes(estado as (typeof ESTADOS_VALIDOS)[number])) {
      return NextResponse.json({ success: false, error: "estado invalido" });
    }

    const turnoActualResult = await pool.request().input("id", sql.Int, turnoId).query(`
      SELECT TOP 1 id, cod_soc, adherente_codigo, estado
      FROM turnos
      WHERE id = @id
    `);
    const turnoActual = turnoActualResult.recordset[0] as
      | { id: number; cod_soc: number; adherente_codigo: number; estado: string }
      | undefined;
    if (!turnoActual) {
      return NextResponse.json({ success: false, error: "Turno no encontrado" });
    }

    const profesionalResult = await pool
      .request()
      .input("id", sql.Int, profesionalId)
      .query("SELECT TOP 1 id, especialidad_id FROM profesionales WHERE id = @id");
    const profesional = profesionalResult.recordset[0] as { id: number; especialidad_id: number } | undefined;
    if (!profesional) {
      return NextResponse.json({ success: false, error: "Profesional no encontrado" });
    }

    const prestacionResult = await pool
      .request()
      .input("id", sql.Int, prestacionId)
      .query("SELECT TOP 1 id, especialidad_id FROM prestaciones WHERE id = @id");
    const prestacion = prestacionResult.recordset[0] as { id: number; especialidad_id: number } | undefined;
    if (!prestacion) {
      return NextResponse.json({ success: false, error: "Prestación no encontrada" });
    }

    const especialidadId = Number.isInteger(especialidadIdRaw) && especialidadIdRaw > 0
      ? especialidadIdRaw
      : Number(prestacion.especialidad_id);
    if (Number(profesional.especialidad_id) !== especialidadId || Number(prestacion.especialidad_id) !== especialidadId) {
      return NextResponse.json({
        success: false,
        error: "La prestación y el profesional deben pertenecer a la misma especialidad",
      });
    }

    const horaConSegundos = `${hora}:00`;
    const duplicadoResult = await pool
      .request()
      .input("id", sql.Int, turnoId)
      .input("profesional_id", sql.Int, profesionalId)
      .input("fecha", sql.Date, fecha)
      .input("hora", sql.VarChar(8), horaConSegundos)
      .query(`
        SELECT COUNT(*) as total
        FROM turnos
        WHERE id <> @id
          AND profesional_id = @profesional_id
          AND fecha = @fecha
          AND CAST(hora AS time) = CAST(@hora AS time)
          AND estado IN ('RESERVADO', 'ATENDIDO')
      `);
    if (Number(duplicadoResult.recordset[0]?.total ?? 0) > 0) {
      return NextResponse.json({
        success: false,
        error: "Ya existe otro turno en ese horario para el profesional",
      });
    }

    await transaction.begin();
    started = true;

    await new sql.Request(transaction)
      .input("id", sql.Int, turnoId)
      .input("profesional_id", sql.Int, profesionalId)
      .input("especialidad_id", sql.Int, especialidadId)
      .input("prestacion_id", sql.Int, prestacionId)
      .input("fecha", sql.Date, fecha)
      .input("hora", sql.VarChar(8), horaConSegundos)
      .input("estado", sql.VarChar(20), estado)
      .input("observaciones", sql.VarChar(sql.MAX), observaciones)
      .query(`
        UPDATE turnos
        SET
          profesional_id = @profesional_id,
          especialidad_id = @especialidad_id,
          prestacion_id = @prestacion_id,
          fecha = @fecha,
          hora = CAST(@hora AS time),
          estado = @estado,
          observaciones = @observaciones
        WHERE id = @id
      `);

    if (String(turnoActual.estado).toUpperCase() !== estado) {
      await new sql.Request(transaction)
        .input("turno_id", sql.Int, turnoId)
        .input("cod_soc", sql.Int, Number(turnoActual.cod_soc))
        .input("adherente_codigo", sql.Int, Number(turnoActual.adherente_codigo))
        .input("profesional_id", sql.Int, profesionalId)
        .input("especialidad_id", sql.Int, especialidadId)
        .input("prestacion_id", sql.Int, prestacionId)
        .input("estado", sql.VarChar(20), estado)
        .input("fecha", sql.Date, fecha)
        .input("hora", sql.VarChar(8), horaConSegundos)
        .input("observaciones", sql.VarChar(sql.MAX), `Estado actualizado manualmente a ${estado}`)
        .query(`
          INSERT INTO historial_atencion
          (
            turno_id,
            cod_soc,
            adherente_codigo,
            profesional_id,
            especialidad_id,
            prestacion_id,
            estado,
            diagnostico,
            observaciones,
            fecha,
            hora,
            creado_en,
            usuario_carga
          )
          VALUES
          (
            @turno_id,
            @cod_soc,
            @adherente_codigo,
            @profesional_id,
            @especialidad_id,
            @prestacion_id,
            @estado,
            '',
            @observaciones,
            @fecha,
            CAST(@hora AS time),
            GETDATE(),
            'recepcion'
          )
        `);
    }

    await transaction.commit();
    started = false;

    return NextResponse.json({ success: true, message: "Turno actualizado correctamente" });
  } catch (error) {
    if (started) {
      try {
        await transaction.rollback();
      } catch {
        // no-op
      }
    }
    return NextResponse.json({ success: false, error: String(error) });
  }
}
