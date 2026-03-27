import sql from "mssql";
import { NextResponse } from "next/server";

import { calcularEdad } from "@/lib/adherentes-beneficios";
import { getSqlConnection, getSqlConnectionPfc, runMigrations } from "@/lib/sqlserver";

type HistorialRow = {
  turno_id: number;
  fecha: string | Date;
  hora: string | Date;
  estado_turno: string;
  es_carga_manual: boolean | number;
  prestacion_id: number;
  prestacion: string;
  profesional_id: number;
  profesional: string;
  estado_atencion: string | null;
};

type CoberturaRow = {
  prestacion_id: number;
  prestacion: string;
  especialidad: string;
  cantidad_maxima: number;
  tipo?: string | null;
};

type ConsumoRow = {
  prestacion_id: number;
  utilizadas: number;
};

type CoberturaTotalRow = {
  prestacion_id?: number;
  cantidad_total?: number;
  total_anual?: number;
  categoria?: string;
  especialidad_id?: number;
};

type PacienteLookupRow = {
  COD_SOC: number | string;
  ADHERENTE_CODIGO: number | string;
  ADHERENTE_NOMBRE: string | null;
  APELLIDOS: string | null;
  VINCULO: string | null;
  DNI_ADHERENTE: string | null;
  FECHA_NACIMIENTO: string | Date | null;
  DES_CAT: string | null;
};

const TABLE_COLUMNS_TTL_MS = 10 * 60 * 1000;
const tableColumnsCache = new Map<string, { expiresAt: number; columns: string[] }>();

function parseIntParam(value: string | null, allowZero = false) {
  const parsed = Number(value ?? "");
  if (!Number.isInteger(parsed)) return null;
  if (allowZero) return parsed >= 0 ? parsed : null;
  return parsed > 0 ? parsed : null;
}

function normalizeCategoria(value: string) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function getTableColumns(pool: sql.ConnectionPool, tableName: string) {
  const cacheKey = tableName.toLowerCase();
  const now = Date.now();
  const cached = tableColumnsCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.columns;
  }

  const result = await pool.request().input("table_name", sql.VarChar(128), tableName).query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @table_name
    `);

  const columns = (result.recordset as Array<{ COLUMN_NAME: string }>).map((row) => row.COLUMN_NAME);
  tableColumnsCache.set(cacheKey, {
    expiresAt: now + TABLE_COLUMNS_TTL_MS,
    columns,
  });
  return columns;
}

async function resolveColumnByAliases(pool: sql.ConnectionPool, tableName: string, aliases: string[]) {
  const columns = await getTableColumns(pool, tableName);
  for (const alias of aliases) {
    const found = columns.find((column) => column.toLowerCase() === alias.toLowerCase());
    if (found) return found;
  }
  return null;
}

export async function GET(request: Request) {
  try {
    await runMigrations();

    const url = new URL(request.url);
    const codSoc = parseIntParam(url.searchParams.get("cod_soc"));
    const adherenteCodigo = parseIntParam(url.searchParams.get("adherente_codigo"), true);

    if (codSoc === null || adherenteCodigo === null) {
      return NextResponse.json({
        success: false,
        error: "Parametros invalidos: cod_soc y adherente_codigo son obligatorios",
      });
    }

    const pool = await getSqlConnectionPfc();
    const sociosPool = await getSqlConnection();

    const pacienteResult = await sociosPool
      .request()
      .input("cod_soc", sql.Int, codSoc)
      .input("adherente_codigo", sql.Int, adherenteCodigo)
      .query(`
        SELECT TOP 1
          COD_SOC,
          ADHERENTE_CODIGO,
          ADHERENTE_NOMBRE,
          APELLIDOS,
          VINCULO,
          DNI_ADHERENTE,
          FECHA_NACIMIENTO,
          DES_CAT
        FROM PR_DORM.dbo.vw_socios_adherentes
        WHERE COD_SOC = @cod_soc
          AND ADHERENTE_CODIGO = @adherente_codigo
      `);
    let pacienteRow = (pacienteResult.recordset[0] as PacienteLookupRow | undefined) ?? null;
    let categoriaPaciente = String(pacienteRow?.DES_CAT ?? "").trim();
    if (!pacienteRow && adherenteCodigo === 0) {
      const titularFallback = await sociosPool
        .request()
        .input("cod_soc", sql.Int, codSoc)
        .query(`
          SELECT TOP 1
            COD_SOC,
            ADHERENTE_CODIGO,
            ADHERENTE_NOMBRE,
            APELLIDOS,
            VINCULO,
            DNI_ADHERENTE,
            FECHA_NACIMIENTO,
            DES_CAT
          FROM PR_DORM.dbo.vw_socios_adherentes
          WHERE COD_SOC = @cod_soc
            AND VINCULO = 'TITULAR'
        `);
      pacienteRow = (titularFallback.recordset[0] as PacienteLookupRow | undefined) ?? null;
      categoriaPaciente = String(pacienteRow?.DES_CAT ?? "").trim();
    }
    const categoriaNormalized = normalizeCategoria(categoriaPaciente);

    const coberturaTotalPrestacionColumn = await resolveColumnByAliases(pool, "cobertura_total_anual", [
      "prestacion_id",
      "id_prestacion",
      "prestacion",
      "cod_prestacion",
    ]);
    const coberturaTotalCantidadColumn = await resolveColumnByAliases(pool, "cobertura_total_anual", [
      "cantidad_total",
      "total_anual",
      "cantidad_anual",
      "maximo",
    ]);
    const coberturaTotalCategoriaColumn = await resolveColumnByAliases(pool, "cobertura_total_anual", [
      "categoria",
      "tipo",
    ]);
    const coberturaTotalEspecialidadColumn = await resolveColumnByAliases(pool, "cobertura_total_anual", [
      "especialidad_id",
      "id_especialidad",
    ]);

    const coberturaTotalSelect = [
      coberturaTotalPrestacionColumn
        ? `${coberturaTotalPrestacionColumn} as prestacion_id`
        : "CAST(NULL AS INT) as prestacion_id",
      coberturaTotalCantidadColumn
        ? `CAST(${coberturaTotalCantidadColumn} as int) as cantidad_total`
        : "CAST(NULL AS INT) as cantidad_total",
      coberturaTotalCategoriaColumn
        ? `CAST(${coberturaTotalCategoriaColumn} as varchar(50)) as categoria`
        : "CAST(NULL AS varchar(50)) as categoria",
      coberturaTotalEspecialidadColumn
        ? `${coberturaTotalEspecialidadColumn} as especialidad_id`
        : "CAST(NULL AS INT) as especialidad_id",
    ].join(", ");

    const [historialResult, coberturaResult, coberturaTotalResult, consumoResult] = await Promise.all([
      pool
        .request()
        .input("cod_soc", sql.Int, codSoc)
        .input("adherente_codigo", sql.Int, adherenteCodigo)
        .query(`
          SELECT
            t.id as turno_id,
            t.fecha,
            t.hora,
            t.estado as estado_turno,
            ISNULL(t.es_carga_manual, 0) as es_carga_manual,
            p.id as prestacion_id,
            p.nombre as prestacion,
            pr.id as profesional_id,
            pr.nombre as profesional,
            h.estado as estado_atencion
          FROM turnos t
          OUTER APPLY (
            SELECT TOP 1 estado
            FROM historial_atencion h1
            WHERE h1.turno_id = t.id
            ORDER BY h1.creado_en DESC, h1.id DESC
          ) h
          JOIN prestaciones p
            ON p.id = t.prestacion_id
          JOIN profesionales pr
            ON pr.id = t.profesional_id
          WHERE
            t.cod_soc = @cod_soc
            AND t.adherente_codigo = @adherente_codigo
          ORDER BY t.fecha DESC, t.hora DESC
        `),
      pool.request().input("categoria", sql.VarChar(120), categoriaNormalized).query(`
        SELECT
          ca.prestacion_id,
          p.nombre as prestacion,
          e.nombre as especialidad,
          CAST(ca.cantidad_anual as int) as cantidad_maxima,
          CAST(ca.tipo as varchar(50)) as tipo
        FROM cobertura_anual ca
        JOIN prestaciones p ON p.id = ca.prestacion_id
        JOIN especialidades e ON e.id = p.especialidad_id
        WHERE ca.categoria COLLATE Latin1_General_CI_AI = @categoria COLLATE Latin1_General_CI_AI
      `),
      pool.request().input("categoria", sql.VarChar(120), categoriaNormalized).query(`
        SELECT
          ${coberturaTotalSelect}
        FROM cobertura_total_anual
        WHERE categoria COLLATE Latin1_General_CI_AI = @categoria COLLATE Latin1_General_CI_AI
      `),
      pool
        .request()
        .input("cod_soc", sql.Int, codSoc)
        .input("adherente_codigo", sql.Int, adherenteCodigo)
        .query(`
          SELECT
            t.prestacion_id,
            COUNT(*) as utilizadas
          FROM historial_atencion h
          JOIN turnos t ON t.id = h.turno_id
          WHERE
            t.cod_soc = @cod_soc
            AND t.adherente_codigo = @adherente_codigo
            AND (h.estado = 'ATENDIDO' OR (h.estado = 'CARGA_MANUAL' AND t.estado = 'ATENDIDO'))
          GROUP BY t.prestacion_id
        `),
    ]);

    const historial = historialResult.recordset as HistorialRow[];
    const coberturaBase = coberturaResult.recordset as CoberturaRow[];
    const coberturaTotal = coberturaTotalResult.recordset as CoberturaTotalRow[];
    const consumo = consumoResult.recordset as ConsumoRow[];

    const usadasPorPrestacion = new Map<number, number>();
    for (const item of consumo) {
      usadasPorPrestacion.set(Number(item.prestacion_id), Number(item.utilizadas ?? 0));
    }

    const cobertura = coberturaBase.map((item) => {
      const maximo = Number(item.cantidad_maxima ?? 0);
      const utilizadas = usadasPorPrestacion.get(Number(item.prestacion_id)) ?? 0;
      const restantes = Math.max(maximo - utilizadas, 0);
      return {
        prestacion_id: Number(item.prestacion_id),
        prestacion: item.prestacion,
        tipo: item.tipo ?? null,
        maximo,
        utilizadas,
        restantes,
      };
    });

    const resumen = historial.reduce(
      (acc, row) => {
        const estado = String(row.estado_turno ?? "").toUpperCase();
        acc.total_turnos += 1;
        if (estado === "ATENDIDO") acc.atendidos += 1;
        if (estado === "CANCELADO") acc.cancelados += 1;
        if (estado === "AUSENTE") acc.ausentes += 1;
        return acc;
      },
      {
        total_turnos: 0,
        atendidos: 0,
        cancelados: 0,
        ausentes: 0,
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        historial,
        cobertura,
        cobertura_total: coberturaTotal,
        categoria: categoriaPaciente || null,
        paciente: pacienteRow
          ? {
              codSoc: String(pacienteRow.COD_SOC ?? codSoc),
              adherenteCodigo: String(pacienteRow.ADHERENTE_CODIGO ?? adherenteCodigo),
              nombre: String(pacienteRow.ADHERENTE_NOMBRE || pacienteRow.APELLIDOS || "No registrado"),
              vinculo: String(pacienteRow.VINCULO || "No registrado"),
              dni: String(pacienteRow.DNI_ADHERENTE || "No registrado"),
              edad: calcularEdad(pacienteRow.FECHA_NACIMIENTO),
            }
          : null,
        resumen,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}
