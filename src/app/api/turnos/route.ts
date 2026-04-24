import sql from "mssql";
import { NextResponse } from "next/server";

import { resolverBeneficio } from "@/lib/adherentes-beneficios";
import { getSqlConnection, getSqlConnectionPfc } from "@/lib/sqlserver";

type CrearTurnoBody = {
  cod_soc: number;
  adherente_codigo: number;
  profesional_id: number;
  especialidad_id: number;
  prestacion_id: number;
  categoria: string;
  fecha: string;
  hora: string;
  observaciones?: string;
};

type AgendaRow = {
  hora_inicio: string | Date;
  hora_fin: string | Date;
};

type TurnoPayload = {
  codSoc: number;
  adherenteCodigo: number;
  profesionalId: number;
  especialidadId: number;
  prestacionId: number;
  categoria: string;
  fecha: string;
  hora: string;
  observaciones: string;
};

type BodyValidationResult =
  | { ok: false; error: string }
  | { ok: true; data: TurnoPayload };
type CupoColumnName = "cupo_mensual" | "pacientes_mensuales" | "paciente_mensuales";
type TurnoListadoRow = {
  id: number;
  fecha: string | Date;
  hora: string | Date;
  estado: string;
  cod_soc: number;
  adherente_codigo: number;
  prestacion: string;
  profesional: string;
};
type SocioLookupRow = {
  COD_SOC: number;
  ADHERENTE_CODIGO: number;
  ADHERENTE_NOMBRE: string;
  APELLIDOS: string;
};

type SocioBeneficioRow = {
  COD_SOC: number | string;
  ADHERENTE_CODIGO: number | string;
  VINCULO: string | null;
  FECHA_NACIMIENTO: string | Date | null;
  DES_CAT: string | null;
};

const ESTADOS_OCUPADOS = ["RESERVADO", "ATENDIDO"] as const;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}$/;

function toInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : NaN;
}

function normalizeText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function normalizeHora(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString().slice(11, 16);
  }
  const [hh = "00", mm = "00"] = String(value).split(":");
  return `${pad2(Number(hh))}:${pad2(Number(mm))}`;
}

function horaToMinutes(hora: string) {
  const [hh, mm] = hora.split(":").map(Number);
  return hh * 60 + mm;
}

function obtenerDiaSemana(fecha: string) {
  const date = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(date.getTime())) return NaN;
  const day = date.getDay();
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

function normalizeCategoria(value: string) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeSearchText(value: string) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function categoriaPlanLabel(value: string) {
  const normalized = normalizeCategoria(value);
  if (normalized.includes("BASICA")) return "Plan Básico";
  if (normalized.includes("PLUS")) return "Plan Plus";
  return value;
}

function isCategoriaBasica(value: string) {
  return normalizeCategoria(value).includes("BASICA");
}

function buildInList(values: number[]) {
  const uniques = [...new Set(values.filter((value) => Number.isInteger(value) && value >= 0))];
  if (uniques.length === 0) return "NULL";
  return uniques.join(", ");
}

function buildCoverageScopeWhere(
  tipoBeneficio: "PROPIO" | "TITULAR" | "NO_DEFINIDO",
  coberturaScopeColumn: string | null,
  sharedAdherentesSql: string
) {
  const byCodigo = "t.cod_soc = @cod_soc AND t.adherente_codigo = @adherente_codigo";
  const byShared = `t.cod_soc = @cod_soc AND t.adherente_codigo IN (${sharedAdherentesSql})`;

  if (!coberturaScopeColumn) {
    return tipoBeneficio === "PROPIO" ? byCodigo : byShared;
  }

  if (tipoBeneficio === "PROPIO") {
    return `t.cod_soc = @cod_soc
      AND (
        (${coberturaScopeColumn} = 'INDIVIDUAL' AND t.adherente_codigo = @adherente_codigo)
        OR (${coberturaScopeColumn} IS NULL AND t.adherente_codigo = @adherente_codigo)
      )`;
  }

  return `t.cod_soc = @cod_soc
    AND (
      (${coberturaScopeColumn} = 'COMPARTIDA')
      OR (${coberturaScopeColumn} IS NULL AND t.adherente_codigo IN (${sharedAdherentesSql}))
    )`;
}

async function resolveCupoColumn(pool: sql.ConnectionPool): Promise<CupoColumnName | null> {
  const result = await pool.request().query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'profesionales'
      AND COLUMN_NAME IN ('cupo_mensual', 'pacientes_mensuales', 'paciente_mensuales')
  `);

  const rows = result.recordset as Array<{ COLUMN_NAME: string }>;
  if (rows.some((item) => item.COLUMN_NAME === "cupo_mensual")) return "cupo_mensual";
  if (rows.some((item) => item.COLUMN_NAME === "pacientes_mensuales")) return "pacientes_mensuales";
  if (rows.some((item) => item.COLUMN_NAME === "paciente_mensuales")) return "paciente_mensuales";
  return null;
}

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
  const normalizedMap = new Map<string, string>();
  for (const row of rows) {
    normalizedMap.set(row.COLUMN_NAME.toLowerCase(), row.COLUMN_NAME);
  }

  for (const alias of aliases) {
    const found = normalizedMap.get(alias.toLowerCase());
    if (found) return found;
  }
  return null;
}

function isValidDate(fecha: string) {
  if (!DATE_REGEX.test(fecha)) return false;
  return !Number.isNaN(new Date(`${fecha}T00:00:00`).getTime());
}

function hasValidTimeFormat(hora: string) {
  if (!TIME_REGEX.test(hora)) return false;
  const [hh, mm] = hora.split(":").map(Number);
  return hh >= 0 && hh < 24 && mm >= 0 && mm < 60;
}

function pickNumberByAliases(row: Record<string, unknown> | undefined, aliases: string[]) {
  if (!row) return 0;
  for (const alias of aliases) {
    const direct = row[alias];
    if (direct !== undefined && direct !== null && direct !== "") {
      const parsed = Number(direct);
      if (Number.isFinite(parsed)) return parsed;
    }

    const key = Object.keys(row).find((k) => k.toLowerCase() === alias.toLowerCase());
    if (!key) continue;
    const parsed = Number(row[key]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function validarHorarioEnAgenda(
  horaSolicitada: string,
  agenda: AgendaRow[],
  duracionTurno: number
) {
  const horaMin = horaToMinutes(horaSolicitada);

  return agenda.some((bloque) => {
    const inicio = horaToMinutes(normalizeHora(bloque.hora_inicio));
    const fin = horaToMinutes(normalizeHora(bloque.hora_fin));
    const entraEnRango = horaMin >= inicio && horaMin + duracionTurno <= fin;
    const caeEnBloque = (horaMin - inicio) % duracionTurno === 0;
    return entraEnRango && caeEnBloque;
  });
}

function validarBody(body: Partial<CrearTurnoBody>): BodyValidationResult {
  const codSoc = toInteger(body.cod_soc);
  const adherenteCodigo = toInteger(body.adherente_codigo);
  const profesionalId = toInteger(body.profesional_id);
  const especialidadId = toInteger(body.especialidad_id);
  const prestacionId = toInteger(body.prestacion_id);
  const categoria = normalizeText(body.categoria);
  const fecha = normalizeText(body.fecha);
  const hora = normalizeText(body.hora);
  const observaciones = normalizeText(body.observaciones);

  if (!Number.isInteger(codSoc) || codSoc <= 0) {
    return { ok: false, error: "cod_soc es obligatorio y debe ser numerico" };
  }
  if (!Number.isInteger(adherenteCodigo) || adherenteCodigo < 0) {
    return { ok: false, error: "adherente_codigo es obligatorio y debe ser numerico" };
  }
  if (!Number.isInteger(profesionalId) || profesionalId <= 0) {
    return { ok: false, error: "profesional_id es obligatorio y debe ser numerico" };
  }
  if (!Number.isInteger(especialidadId) || especialidadId <= 0) {
    return { ok: false, error: "especialidad_id es obligatorio y debe ser numerico" };
  }
  if (!Number.isInteger(prestacionId) || prestacionId <= 0) {
    return { ok: false, error: "prestacion_id es obligatorio y debe ser numerico" };
  }
  if (!isValidDate(fecha)) {
    return { ok: false, error: "fecha invalida. Usa formato YYYY-MM-DD" };
  }
  if (!hasValidTimeFormat(hora)) {
    return { ok: false, error: "hora invalida. Usa formato HH:mm" };
  }

  return {
    ok: true,
    data: {
      codSoc,
      adherenteCodigo,
      profesionalId,
      especialidadId,
      prestacionId,
      categoria,
      fecha,
      hora,
      observaciones,
    },
  };
}

export async function GET() {
  try {
    const pool = await getSqlConnectionPfc();
    const sociosPool = await getSqlConnection();
    const turnosPrestacionColumn = await resolveColumnByAliases(pool, "turnos", [
      "prestacion_id",
      "id_prestacion",
      "cod_prestacion",
      "prestacion",
      "idprestacion",
    ]);
    const turnosProfesionalColumn = await resolveColumnByAliases(pool, "turnos", [
      "profesional_id",
      "id_profesional",
      "cod_profesional",
      "profesional",
      "idprofesional",
    ]);

    if (!turnosPrestacionColumn || !turnosProfesionalColumn) {
      return NextResponse.json({
        success: false,
        error:
          "No se pudieron resolver columnas de relacion en tabla turnos (prestacion/profesional). Verifica nombres reales.",
      });
    }

    const result = await pool.request().query(`
      SELECT
        t.id,
        t.fecha,
        t.hora,
        t.estado,
        t.cod_soc,
        t.adherente_codigo,
        p.nombre as prestacion,
        pr.nombre as profesional
      FROM turnos t
      JOIN prestaciones p ON p.id = t.${turnosPrestacionColumn}
      JOIN profesionales pr ON pr.id = t.${turnosProfesionalColumn}
      ORDER BY fecha DESC
    `);

    const turnos = result.recordset as TurnoListadoRow[];
    const codSocList = [...new Set(turnos.map((item) => Number(item.cod_soc)).filter(Number.isFinite))];
    const sociosMap = new Map<string, string>();

    if (codSocList.length > 0) {
      const sociosResult = await sociosPool.request().query(`
        SELECT
          COD_SOC,
          ADHERENTE_CODIGO,
          ADHERENTE_NOMBRE,
          APELLIDOS
        FROM PR_DORM.dbo.vw_socios_adherentes
        WHERE COD_SOC IN (${codSocList.join(",")})
      `);

      for (const row of sociosResult.recordset as SocioLookupRow[]) {
        const key = `${Number(row.COD_SOC)}-${Number(row.ADHERENTE_CODIGO)}`;
        const nombre = String(row.ADHERENTE_NOMBRE || row.APELLIDOS || "").trim();
        if (nombre) {
          sociosMap.set(key, nombre);
        }
      }
    }

    const data = turnos.map((item) => {
      const codSoc = Number(item.cod_soc);
      const adherente = Number(item.adherente_codigo);
      const nombre = sociosMap.get(`${codSoc}-${adherente}`) ?? `Socio ${codSoc}`;
      return {
        ...item,
        nombre,
      };
    });

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
  const pool = await getSqlConnectionPfc();
  const sociosPool = await getSqlConnection();
  const transaction = new sql.Transaction(pool);
  let transactionStarted = false;

  try {
    const body = (await request.json()) as Partial<CrearTurnoBody>;
    const validated = validarBody(body);

    if (!validated.ok) {
      return NextResponse.json({
        success: false,
        error: validated.error,
      });
    }

    const payload = validated.data;
    const turnosPrestacionColumn = await resolveColumnByAliases(pool, "turnos", [
      "prestacion_id",
      "id_prestacion",
      "cod_prestacion",
      "prestacion",
      "idprestacion",
    ]);
    const tipoBeneficioColumn = await resolveColumnByAliases(pool, "turnos", [
      "tipo_beneficio_al_momento",
    ]);
    const coberturaScopeColumn = await resolveColumnByAliases(pool, "turnos", ["cobertura_scope"]);
    if (!turnosPrestacionColumn) {
      return NextResponse.json({
        success: false,
        error:
          "No se encontro columna de prestacion en tabla turnos. Comparte columnas de la tabla para ajustarlo.",
      });
    }

    const perfilResult = await sociosPool
      .request()
      .input("cod_soc", sql.Int, payload.codSoc)
      .input("adherente_codigo", sql.Int, payload.adherenteCodigo)
      .query(`
        SELECT TOP 1
          COD_SOC,
          ADHERENTE_CODIGO,
          VINCULO,
          FECHA_NACIMIENTO,
          DES_CAT
        FROM PR_DORM.dbo.vw_socios_adherentes
        WHERE COD_SOC = @cod_soc
          AND ADHERENTE_CODIGO = @adherente_codigo
      `);

    let perfilPaciente = (perfilResult.recordset[0] as SocioBeneficioRow | undefined) ?? null;
    let categoriaPaciente = String(perfilPaciente?.DES_CAT ?? "").trim();
    if (!perfilPaciente && payload.adherenteCodigo === 0) {
      const titularFallback = await sociosPool
        .request()
        .input("cod_soc", sql.Int, payload.codSoc)
        .query(`
          SELECT TOP 1
            COD_SOC,
            ADHERENTE_CODIGO,
            VINCULO,
            FECHA_NACIMIENTO,
            DES_CAT
          FROM PR_DORM.dbo.vw_socios_adherentes
          WHERE COD_SOC = @cod_soc
            AND VINCULO = 'TITULAR'
        `);
      perfilPaciente = (titularFallback.recordset[0] as SocioBeneficioRow | undefined) ?? null;
      categoriaPaciente = String(perfilPaciente?.DES_CAT ?? "").trim();
    }

    if (!categoriaPaciente) {
      return NextResponse.json({
        success: false,
        error: "No se pudo determinar la categoría del paciente para validar cobertura",
      });
    }

    const tipoBeneficio = resolverBeneficio(
      perfilPaciente?.VINCULO ?? "TITULAR",
      perfilPaciente?.FECHA_NACIMIENTO
    );

    const grupoResult = await sociosPool.request().input("cod_soc", sql.Int, payload.codSoc).query(`
      SELECT
        COD_SOC,
        ADHERENTE_CODIGO,
        VINCULO,
        FECHA_NACIMIENTO,
        DES_CAT
      FROM PR_DORM.dbo.vw_socios_adherentes
      WHERE COD_SOC = @cod_soc
    `);
    const grupoRows = grupoResult.recordset as SocioBeneficioRow[];
    const adherentesConBeneficioTitular = grupoRows
      .filter(
        (row) => resolverBeneficio(row.VINCULO, row.FECHA_NACIMIENTO) === "TITULAR"
      )
      .map((row) => Number(row.ADHERENTE_CODIGO))
      .filter((value) => Number.isInteger(value) && value >= 0);

    const scopeWhere = buildCoverageScopeWhere(
      tipoBeneficio,
      coberturaScopeColumn,
      buildInList(adherentesConBeneficioTitular)
    );
    const coberturaScopeValue = tipoBeneficio === "PROPIO" ? "INDIVIDUAL" : "COMPARTIDA";

    const diaSemana = obtenerDiaSemana(payload.fecha);
    const diaSemanaTexto = dayToSpanish(diaSemana);
    if (!Number.isInteger(diaSemana)) {
      return NextResponse.json({
        success: false,
        error: "No se pudo calcular el dia de la fecha enviada",
      });
    }

    const cupoColumn = await resolveCupoColumn(pool);
    const cupoSelect = cupoColumn
      ? `${cupoColumn} as cupo_mensual`
      : "CAST(NULL AS INT) as cupo_mensual";

    const profesionalResult = await pool
      .request()
      .input("profesional", sql.Int, payload.profesionalId)
      .query(`
        SELECT id, nombre, duracion_turno, ${cupoSelect}
        FROM profesionales
        WHERE id = @profesional
      `);

    const profesional = profesionalResult.recordset[0] as
      | {
          id: number;
          nombre: string;
          duracion_turno: number;
          cupo_mensual: number | null;
        }
      | undefined;

    if (!profesional) {
      return NextResponse.json({
        success: false,
        error: "Profesional no encontrado",
      });
    }

    if (!Number.isInteger(profesional.duracion_turno) || profesional.duracion_turno <= 0) {
      return NextResponse.json({
        success: false,
        error: "El profesional no tiene una duracion de turno valida",
      });
    }

    const disponibilidadResult = await pool
      .request()
      .input("profesional", sql.Int, payload.profesionalId)
      .input("fecha", sql.Date, payload.fecha)
      .input("hora", sql.VarChar(5), payload.hora)
      .query(`
        SELECT COUNT(*) as total
        FROM turnos
        WHERE profesional_id = @profesional
          AND fecha = @fecha
          AND hora = @hora
          AND estado IN ('RESERVADO','ATENDIDO')
      `);

    const totalOcupados = Number(disponibilidadResult.recordset[0]?.total ?? 0);
    if (totalOcupados > 0) {
      return NextResponse.json({
        success: false,
        error: "El horario ya esta ocupado",
      });
    }

    const prestacionMetaValidacionResult = await pool
      .request()
      .input("prestacion", sql.Int, payload.prestacionId)
      .query(`
        SELECT TOP 1 nombre
        FROM prestaciones
        WHERE id = @prestacion
      `);
    const nombrePrestacionValidacion = String(prestacionMetaValidacionResult.recordset[0]?.nombre ?? "");
    const isPrestacionTraslado = normalizeSearchText(nombrePrestacionValidacion).includes("TRASLADO");

    if (!isPrestacionTraslado) {
      const agendaResult = await pool
        .request()
        .input("profesional", sql.Int, payload.profesionalId)
        .input("dia_semana", sql.Int, diaSemana)
        .input("dia_semana_texto", sql.VarChar(20), diaSemanaTexto)
        .query(`
          SELECT hora_inicio, hora_fin
          FROM agenda_profesional
          WHERE profesional_id = @profesional
            AND (
              TRY_CAST(dia_semana as int) = @dia_semana
              OR LTRIM(RTRIM(CAST(dia_semana as varchar(20)))) COLLATE Latin1_General_CI_AI
                 = @dia_semana_texto COLLATE Latin1_General_CI_AI
            )
        `);

      const agenda = agendaResult.recordset as AgendaRow[];
      if (agenda.length === 0) {
        return NextResponse.json({
          success: false,
          error: "El profesional no atiende en ese dia",
        });
      }

      const horarioValido = validarHorarioEnAgenda(payload.hora, agenda, profesional.duracion_turno);
      if (!horarioValido) {
        return NextResponse.json({
          success: false,
          error: "El horario no esta dentro de la agenda del profesional",
        });
      }

      const cupoMensualResult = await pool
        .request()
        .input("profesional", sql.Int, payload.profesionalId)
        .input("fecha", sql.Date, payload.fecha)
        .query(`
          SELECT COUNT(*) as total
          FROM turnos
          WHERE profesional_id = @profesional
            AND MONTH(fecha) = MONTH(@fecha)
            AND YEAR(fecha) = YEAR(@fecha)
            AND estado IN ('RESERVADO','ATENDIDO')
        `);

      const turnosDelMes = Number(cupoMensualResult.recordset[0]?.total ?? 0);
      const cupoMensual = Number(profesional.cupo_mensual ?? 0);
      if (cupoMensual > 0 && turnosDelMes >= cupoMensual) {
        return NextResponse.json({
          success: false,
          error: "El profesional alcanzo el cupo mensual",
        });
      }
    }

    const dobleTurnoResult = await pool
      .request()
      .input("cod_soc", sql.Int, payload.codSoc)
      .input("adherente_codigo", sql.Int, payload.adherenteCodigo)
      .input("prestacion", sql.Int, payload.prestacionId)
      .input("fecha", sql.Date, payload.fecha)
      .query(`
        SELECT COUNT(*) as total
        FROM turnos
        WHERE cod_soc = @cod_soc
          AND adherente_codigo = @adherente_codigo
          AND ${turnosPrestacionColumn} = @prestacion
          AND fecha = @fecha
          AND estado IN ('RESERVADO','ATENDIDO')
      `);

    const dobleTurno = Number(dobleTurnoResult.recordset[0]?.total ?? 0);
    if (dobleTurno > 0) {
      return NextResponse.json({
        success: false,
        error: "El paciente ya tiene un turno de esta prestacion en la fecha indicada",
      });
    }

    const coberturaUsadaResult = await pool
      .request()
      .input("cod_soc", sql.Int, payload.codSoc)
      .input("adherente_codigo", sql.Int, payload.adherenteCodigo)
      .input("prestacion", sql.Int, payload.prestacionId)
      .query(`
        SELECT COUNT(*) as usadas
        FROM turnos t
        WHERE ${scopeWhere}
          AND t.${turnosPrestacionColumn} = @prestacion
          AND t.estado = 'ATENDIDO'
          AND YEAR(t.fecha) = YEAR(GETDATE())
      `);

    const usadasPrestacion = Number(coberturaUsadaResult.recordset[0]?.usadas ?? 0);
    const prestacionMetaResult = await pool
      .request()
      .input("prestacion", sql.Int, payload.prestacionId)
      .query(`
        SELECT TOP 1 nombre
        FROM prestaciones
        WHERE id = @prestacion
      `);
    const nombrePrestacionSeleccionada = String(prestacionMetaResult.recordset[0]?.nombre ?? "");

    const coberturaAnualResult = await pool
      .request()
      .input("prestacion", sql.Int, payload.prestacionId)
      .input("categoria", sql.VarChar(120), categoriaPaciente)
      .query(`
        SELECT TOP 1
          CAST(cantidad_anual as int) as cantidad_anual
        FROM cobertura_anual
        WHERE prestacion_id = @prestacion
          AND categoria COLLATE Latin1_General_CI_AI = @categoria COLLATE Latin1_General_CI_AI
      `);

    const limiteAnualPrestacion = Number(coberturaAnualResult.recordset[0]?.cantidad_anual ?? 0);
    if (limiteAnualPrestacion <= 0) {
      return NextResponse.json({
        success: false,
        error: `El socio no tiene cobertura para esta prestación en su plan (${categoriaPlanLabel(categoriaPaciente)})`,
      });
    }

    if (limiteAnualPrestacion > 0 && usadasPrestacion >= limiteAnualPrestacion) {
      return NextResponse.json({
        success: false,
        error: "Cobertura anual alcanzada para esta prestacion",
      });
    }

    const esPsicologiaAdultoInfantil =
      normalizeCategoria(nombrePrestacionSeleccionada).includes("PSICOLOGIA") &&
      (normalizeCategoria(nombrePrestacionSeleccionada).includes("ADULTO") ||
        normalizeCategoria(nombrePrestacionSeleccionada).includes("INFANTIL"));
    if (isCategoriaBasica(categoriaPaciente) && esPsicologiaAdultoInfantil) {
      const psicologiaBasicaResult = await pool
        .request()
        .input("cod_soc", sql.Int, payload.codSoc)
        .input("adherente_codigo", sql.Int, payload.adherenteCodigo)
        .query(`
          SELECT COUNT(*) as usadas
          FROM turnos t
          JOIN prestaciones p ON p.id = t.${turnosPrestacionColumn}
          WHERE ${scopeWhere}
            AND t.estado = 'ATENDIDO'
            AND YEAR(t.fecha) = YEAR(GETDATE())
            AND p.nombre COLLATE Latin1_General_CI_AI LIKE '%PSICOLOGIA%'
            AND (
              p.nombre COLLATE Latin1_General_CI_AI LIKE '%ADULTO%'
              OR p.nombre COLLATE Latin1_General_CI_AI LIKE '%INFANTIL%'
            )
        `);
      const usadasPsicologiaBasica = Number(psicologiaBasicaResult.recordset[0]?.usadas ?? 0);
      if (usadasPsicologiaBasica >= 12) {
        return NextResponse.json({
          success: false,
          error:
            "El paciente alcanzó el límite anual compartido de Psicología Básica (12 sesiones entre Adulto e Infantil)",
        });
      }
    }

    const coberturaTotalUsadaResult = await pool
      .request()
      .input("cod_soc", sql.Int, payload.codSoc)
      .input("adherente_codigo", sql.Int, payload.adherenteCodigo)
      .input("especialidad_id", sql.Int, payload.especialidadId)
      .query(`
        SELECT COUNT(*) as usadas
        FROM turnos t
        WHERE ${scopeWhere}
          AND t.especialidad_id = @especialidad_id
          AND t.estado = 'ATENDIDO'
          AND YEAR(t.fecha) = YEAR(GETDATE())
      `);

    const usadasTotal = Number(coberturaTotalUsadaResult.recordset[0]?.usadas ?? 0);
    const coberturaTotalResult = await pool
      .request()
      .input("especialidad_id", sql.Int, payload.especialidadId)
      .input("categoria", sql.VarChar(120), categoriaPaciente)
      .query(`
        SELECT TOP 1
          CAST(total_anual as int) as total_anual
        FROM cobertura_total_anual
        WHERE especialidad_id = @especialidad_id
          AND categoria COLLATE Latin1_General_CI_AI = @categoria COLLATE Latin1_General_CI_AI
      `);

    const limiteTotalAnual = Number(coberturaTotalResult.recordset[0]?.total_anual ?? 0);
    if (limiteTotalAnual <= 0) {
      return NextResponse.json({
        success: false,
        error: `El socio no tiene cobertura para esta prestación en su plan (${categoriaPlanLabel(categoriaPaciente)})`,
      });
    }

    if (limiteTotalAnual > 0 && usadasTotal >= limiteTotalAnual) {
      return NextResponse.json({
        success: false,
        error: "El socio alcanzo el limite anual de consultas",
      });
    }

    await transaction.begin();
    transactionStarted = true;

    const insertTurnoResult = await new sql.Request(transaction)
      .input("cod_soc", sql.Int, payload.codSoc)
      .input("adherente", sql.Int, payload.adherenteCodigo)
      .input("profesional", sql.Int, payload.profesionalId)
      .input("especialidad", sql.Int, payload.especialidadId)
      .input("prestacion", sql.Int, payload.prestacionId)
      .input("categoria", sql.VarChar(120), categoriaPaciente)
      .input("fecha", sql.Date, payload.fecha)
      .input("hora", sql.VarChar(5), payload.hora)
      .input("tipo_beneficio_al_momento", sql.VarChar(20), tipoBeneficio)
      .input("cobertura_scope", sql.VarChar(20), coberturaScopeValue)
      .input("observaciones", sql.VarChar(sql.MAX), payload.observaciones)
      .query(`
        INSERT INTO turnos
        (
          cod_soc,
          adherente_codigo,
          profesional_id,
          especialidad_id,
          ${turnosPrestacionColumn},
          categoria,
          fecha,
          hora,
          estado,
          observaciones,
          creado_en
          ${tipoBeneficioColumn ? `, ${tipoBeneficioColumn}` : ""}
          ${coberturaScopeColumn ? `, ${coberturaScopeColumn}` : ""}
        )
        OUTPUT INSERTED.id as turno_id
        VALUES
        (
          @cod_soc,
          @adherente,
          @profesional,
          @especialidad,
          @prestacion,
          @categoria,
          @fecha,
          @hora,
          'RESERVADO',
          @observaciones,
          GETDATE()
          ${tipoBeneficioColumn ? ", @tipo_beneficio_al_momento" : ""}
          ${coberturaScopeColumn ? ", @cobertura_scope" : ""}
        )
      `);

    const turnoId = Number(insertTurnoResult.recordset[0]?.turno_id ?? 0);
    if (!Number.isInteger(turnoId) || turnoId <= 0) {
      throw new Error("No se pudo obtener el id del turno creado");
    }

    await new sql.Request(transaction)
      .input("turno_id", sql.Int, turnoId)
      .input("cod_soc", sql.Int, payload.codSoc)
      .input("adherente", sql.Int, payload.adherenteCodigo)
      .input("profesional", sql.Int, payload.profesionalId)
      .input("especialidad", sql.Int, payload.especialidadId)
      .input("prestacion", sql.Int, payload.prestacionId)
      .input("estado", sql.VarChar(20), "RESERVADO")
      .input("diagnostico", sql.VarChar(sql.MAX), "")
      .input("fecha", sql.Date, payload.fecha)
      .input("hora", sql.VarChar(8), `${payload.hora}:00`)
      .input("usuario_carga", sql.VarChar(100), "recepcion")
      .input(
        "observaciones",
        sql.VarChar(sql.MAX),
        payload.observaciones || "Turno reservado"
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
          @adherente,
          @profesional,
          @especialidad,
          @prestacion,
          @estado,
          @diagnostico,
          @observaciones,
          @fecha,
          CAST(@hora AS time),
          GETDATE(),
          @usuario_carga
        )
      `);

    await transaction.commit();
    transactionStarted = false;

    return NextResponse.json({
      success: true,
      message: "Turno creado correctamente",
      turno: {
        profesional_id: payload.profesionalId,
        fecha: payload.fecha,
        hora: payload.hora,
      },
    });
  } catch (error) {
    if (transactionStarted) {
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
