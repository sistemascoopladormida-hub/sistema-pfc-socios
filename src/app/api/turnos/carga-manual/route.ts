import sql from "mssql";
import { NextResponse } from "next/server";

import { resolverBeneficio } from "@/lib/adherentes-beneficios";
import { getSqlConnection, getSqlConnectionPfc, runMigrations } from "@/lib/sqlserver";

type EstadoManual = "ATENDIDO" | "AUSENTE" | "CANCELADO";

type CargaManualBody = {
  cod_soc?: number;
  adherente_codigo?: number;
  profesional_id?: number;
  prestacion_id?: number;
  fecha?: string;
  hora?: string;
  estado?: EstadoManual;
  observacion?: string;
};

const ESTADOS_VALIDOS: EstadoManual[] = ["ATENDIDO", "AUSENTE", "CANCELADO"];
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HORA_REGEX = /^\d{2}:\d{2}$/;

function toInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : NaN;
}

function normalizeText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function isValidFecha(fecha: string) {
  if (!FECHA_REGEX.test(fecha)) return false;
  const date = new Date(`${fecha}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

function isValidHora(hora: string) {
  if (!HORA_REGEX.test(hora)) return false;
  const [hh, mm] = hora.split(":").map(Number);
  return hh >= 0 && hh < 24 && mm >= 0 && mm < 60;
}

function isFutureDate(fecha: string) {
  const sessionDate = new Date(`${fecha}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return sessionDate.getTime() > today.getTime();
}

type PacienteContext = {
  categoria: string;
  tipoBeneficio: "PROPIO" | "TITULAR" | "NO_DEFINIDO";
  coberturaScope: "INDIVIDUAL" | "COMPARTIDA";
};

async function resolveColumnByAliases(
  pool: sql.ConnectionPool,
  tableName: string,
  aliases: string[]
): Promise<string | null> {
  const result = await pool.request().input("table_name", sql.VarChar(128), tableName).query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = @table_name
  `);

  const rows = result.recordset as Array<{ COLUMN_NAME: string }>;
  for (const alias of aliases) {
    const found = rows.find((row) => row.COLUMN_NAME.toLowerCase() === alias.toLowerCase());
    if (found) return found.COLUMN_NAME;
  }
  return null;
}

async function getPacienteContext(codSoc: number, adherenteCodigo: number): Promise<PacienteContext> {
  const sociosPool = await getSqlConnection();

  const result = await sociosPool
    .request()
    .input("cod_soc", sql.Int, codSoc)
    .input("adherente_codigo", sql.Int, adherenteCodigo)
    .query(`
      SELECT TOP 1
        DES_CAT,
        VINCULO,
        FECHA_NACIMIENTO
      FROM PR_DORM.dbo.vw_socios_adherentes
      WHERE COD_SOC = @cod_soc
        AND ADHERENTE_CODIGO = @adherente_codigo
    `);

  let categoria = normalizeText(result.recordset[0]?.DES_CAT);
  let vinculo = result.recordset[0]?.VINCULO;
  let fechaNacimiento = result.recordset[0]?.FECHA_NACIMIENTO;

  if (!categoria && adherenteCodigo === 0) {
    const fallback = await sociosPool.request().input("cod_soc", sql.Int, codSoc).query(`
      SELECT TOP 1
        DES_CAT,
        VINCULO,
        FECHA_NACIMIENTO
      FROM PR_DORM.dbo.vw_socios_adherentes
      WHERE COD_SOC = @cod_soc
        AND VINCULO = 'TITULAR'
    `);
    categoria = normalizeText(fallback.recordset[0]?.DES_CAT);
    vinculo = fallback.recordset[0]?.VINCULO;
    fechaNacimiento = fallback.recordset[0]?.FECHA_NACIMIENTO;
  }

  const tipoBeneficio = resolverBeneficio(vinculo, fechaNacimiento);
  return {
    categoria: categoria || "SIN_CATEGORIA",
    tipoBeneficio,
    coberturaScope: tipoBeneficio === "PROPIO" ? "INDIVIDUAL" : "COMPARTIDA",
  };
}

export async function POST(request: Request) {
  let transaction: sql.Transaction | null = null;
  let transactionStarted = false;

  try {
    await runMigrations();
    const pool = await getSqlConnectionPfc();
    transaction = new sql.Transaction(pool);

    const body = (await request.json()) as CargaManualBody;

    const codSoc = toInt(body.cod_soc);
    const adherenteCodigo = toInt(body.adherente_codigo);
    const profesionalId = toInt(body.profesional_id);
    const prestacionId = toInt(body.prestacion_id);
    const fecha = normalizeText(body.fecha);
    const hora = normalizeText(body.hora);
    const estado = normalizeText(body.estado).toUpperCase() as EstadoManual;
    const observacion = normalizeText(body.observacion).slice(0, 300);

    if (!Number.isInteger(codSoc) || codSoc <= 0) {
      return NextResponse.json({ success: false, error: "cod_soc es obligatorio y debe ser numerico" });
    }
    if (!Number.isInteger(adherenteCodigo) || adherenteCodigo < 0) {
      return NextResponse.json({
        success: false,
        error: "adherente_codigo es obligatorio y debe ser numerico",
      });
    }
    if (!Number.isInteger(profesionalId) || profesionalId <= 0) {
      return NextResponse.json({
        success: false,
        error: "profesional_id es obligatorio y debe ser numerico",
      });
    }
    if (!Number.isInteger(prestacionId) || prestacionId <= 0) {
      return NextResponse.json({
        success: false,
        error: "prestacion_id es obligatorio y debe ser numerico",
      });
    }
    if (!isValidFecha(fecha)) {
      return NextResponse.json({
        success: false,
        error: "fecha invalida. Usa formato YYYY-MM-DD",
      });
    }
    if (isFutureDate(fecha)) {
      return NextResponse.json({
        success: false,
        error: "No se pueden cargar sesiones con fecha futura",
      });
    }
    if (!isValidHora(hora)) {
      return NextResponse.json({
        success: false,
        error: "hora invalida. Usa formato HH:mm",
      });
    }
    if (!ESTADOS_VALIDOS.includes(estado)) {
      return NextResponse.json({
        success: false,
        error: "estado invalido. Valores permitidos: ATENDIDO, AUSENTE, CANCELADO",
      });
    }

    const profesionalResult = await pool
      .request()
      .input("id", sql.Int, profesionalId)
      .query("SELECT TOP 1 id, especialidad_id FROM profesionales WHERE id = @id");
    const profesional = profesionalResult.recordset[0] as
      | { id: number; especialidad_id: number }
      | undefined;
    if (!profesional) {
      return NextResponse.json({ success: false, error: "El profesional seleccionado no existe" });
    }

    const prestacionResult = await pool
      .request()
      .input("id", sql.Int, prestacionId)
      .query("SELECT TOP 1 id, especialidad_id FROM prestaciones WHERE id = @id");
    const prestacion = prestacionResult.recordset[0] as
      | { id: number; especialidad_id: number }
      | undefined;
    if (!prestacion) {
      return NextResponse.json({ success: false, error: "La prestación seleccionada no existe" });
    }
    if (Number(prestacion.especialidad_id) !== Number(profesional.especialidad_id)) {
      return NextResponse.json({
        success: false,
        error: "La prestación seleccionada no corresponde a la especialidad del profesional",
      });
    }

    const horaConSegundos = `${hora}:00`;
    const duplicadoResult = await pool
      .request()
      .input("cod_soc", sql.Int, codSoc)
      .input("adherente_codigo", sql.Int, adherenteCodigo)
      .input("profesional_id", sql.Int, profesionalId)
      .input("fecha", sql.Date, fecha)
      .input("hora", sql.VarChar(8), horaConSegundos)
      .query(`
        SELECT COUNT(*) as total
        FROM turnos
        WHERE cod_soc = @cod_soc
          AND adherente_codigo = @adherente_codigo
          AND profesional_id = @profesional_id
          AND fecha = @fecha
          AND CAST(hora AS time) = CAST(@hora AS time)
      `);

    const duplicados = Number(duplicadoResult.recordset[0]?.total ?? 0);
    if (duplicados > 0) {
      return NextResponse.json({
        success: false,
        error: "Ya existe una sesión registrada para ese paciente, profesional, fecha y hora",
      });
    }

    const turnosTipoBeneficioColumn = await resolveColumnByAliases(pool, "turnos", [
      "tipo_beneficio_al_momento",
    ]);
    const turnosCoberturaScopeColumn = await resolveColumnByAliases(pool, "turnos", [
      "cobertura_scope",
    ]);

    const pacienteContext = await getPacienteContext(codSoc, adherenteCodigo);
    const categoriaPaciente = pacienteContext.categoria;

    await transaction.begin();
    transactionStarted = true;

    const insertTurnoResult = await new sql.Request(transaction)
      .input("cod_soc", sql.Int, codSoc)
      .input("adherente_codigo", sql.Int, adherenteCodigo)
      .input("profesional_id", sql.Int, profesionalId)
      .input("especialidad_id", sql.Int, Number(prestacion.especialidad_id))
      .input("prestacion_id", sql.Int, prestacionId)
      .input("categoria", sql.VarChar(120), categoriaPaciente)
      .input("fecha", sql.Date, fecha)
      .input("hora", sql.VarChar(8), horaConSegundos)
      .input("estado", sql.VarChar(20), estado)
      .input(
        "tipo_beneficio_al_momento",
        sql.VarChar(20),
        pacienteContext.tipoBeneficio
      )
      .input("cobertura_scope", sql.VarChar(20), pacienteContext.coberturaScope)
      .input("observaciones", sql.VarChar(sql.MAX), observacion || "Carga manual de sesión")
      .query(`
        INSERT INTO turnos
        (
          cod_soc,
          adherente_codigo,
          profesional_id,
          especialidad_id,
          prestacion_id,
          categoria,
          fecha,
          hora,
          estado,
          observaciones,
          creado_en,
          es_carga_manual
          ${turnosTipoBeneficioColumn ? `, ${turnosTipoBeneficioColumn}` : ""}
          ${turnosCoberturaScopeColumn ? `, ${turnosCoberturaScopeColumn}` : ""}
        )
        OUTPUT INSERTED.id as turno_id
        VALUES
        (
          @cod_soc,
          @adherente_codigo,
          @profesional_id,
          @especialidad_id,
          @prestacion_id,
          @categoria,
          @fecha,
          CAST(@hora AS time),
          @estado,
          @observaciones,
          GETDATE(),
          1
          ${turnosTipoBeneficioColumn ? ", @tipo_beneficio_al_momento" : ""}
          ${turnosCoberturaScopeColumn ? ", @cobertura_scope" : ""}
        )
      `);

    const turnoId = Number(insertTurnoResult.recordset[0]?.turno_id ?? 0);
    if (!Number.isInteger(turnoId) || turnoId <= 0) {
      throw new Error("No se pudo obtener el id del turno cargado");
    }

    await new sql.Request(transaction)
      .input("turno_id", sql.Int, turnoId)
      .input("cod_soc", sql.Int, codSoc)
      .input("adherente_codigo", sql.Int, adherenteCodigo)
      .input("profesional_id", sql.Int, profesionalId)
      .input("especialidad_id", sql.Int, Number(prestacion.especialidad_id))
      .input("prestacion_id", sql.Int, prestacionId)
      .input("fecha", sql.Date, fecha)
      .input("hora", sql.VarChar(8), horaConSegundos)
      .input("estado", sql.VarChar(20), "CARGA_MANUAL")
      .input(
        "observaciones",
        sql.VarChar(sql.MAX),
        observacion || `Registro manual del estado ${estado}`
      )
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

    if (estado === "ATENDIDO") {
      await new sql.Request(transaction)
        .input("turno_id", sql.Int, turnoId)
        .input("cod_soc", sql.Int, codSoc)
        .input("adherente_codigo", sql.Int, adherenteCodigo)
        .input("profesional_id", sql.Int, profesionalId)
        .input("especialidad_id", sql.Int, Number(prestacion.especialidad_id))
        .input("prestacion_id", sql.Int, prestacionId)
        .input("fecha", sql.Date, fecha)
        .input("hora", sql.VarChar(8), horaConSegundos)
        .input("estado", sql.VarChar(20), "ATENDIDO")
        .input("observaciones", sql.VarChar(sql.MAX), "Atención registrada por carga manual")
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
    transactionStarted = false;

    return NextResponse.json({
      success: true,
      turno_id: turnoId,
    });
  } catch (error) {
    if (transactionStarted && transaction) {
      try {
        await transaction.rollback();
      } catch {
        // no-op
      }
    }

    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}
