import sql from "mssql";
import { NextResponse } from "next/server";

import { getSqlConnection, getSqlConnectionPfc, runMigrations } from "@/lib/sqlserver";

type CoberturaRow = {
  prestacion_id: number;
};

type PacienteLookupRow = {
  COD_SOC: number | string;
  ADHERENTE_CODIGO: number | string;
  ADHERENTE_NOMBRE: string | null;
  APELLIDOS: string | null;
  VINCULO: string | null;
  DES_CAT: string | null;
};

type TurnoRow = {
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
  adherente_codigo: number;
};

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

function buildInParams(
  request: sql.Request,
  prefix: string,
  values: number[],
  sqlType: typeof sql.Int = sql.Int
) {
  const uniques = [...new Set(values.filter((v) => Number.isInteger(v)))];
  const placeholders: string[] = [];
  uniques.forEach((value, index) => {
    const name = `${prefix}${index}`;
    request.input(name, sqlType, value);
    placeholders.push(`@${name}`);
  });
  return { sql: placeholders.length > 0 ? placeholders.join(", ") : "NULL", count: uniques.length };
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
        error: "Parámetros inválidos: cod_soc y adherente_codigo son obligatorios",
      });
    }

    const sociosPool = await getSqlConnection();
    const pfcPool = await getSqlConnectionPfc();

    const grupoResult = await sociosPool.request().input("cod_soc", sql.Int, codSoc).query(`
      SELECT
        COD_SOC,
        ADHERENTE_CODIGO,
        ADHERENTE_NOMBRE,
        APELLIDOS,
        VINCULO,
        DES_CAT
      FROM PR_DORM.dbo.vw_socios_adherentes
      WHERE COD_SOC = @cod_soc
    `);

    const grupoRows = grupoResult.recordset as PacienteLookupRow[];
    let pacienteRow =
      grupoRows.find((row) => Number(row.ADHERENTE_CODIGO) === adherenteCodigo) ?? null;
    if (!pacienteRow && adherenteCodigo === 0) {
      pacienteRow =
        grupoRows.find((row) => String(row.VINCULO ?? "").trim().toUpperCase() === "TITULAR") ?? null;
    }

    let categoriaPaciente = String(pacienteRow?.DES_CAT ?? "").trim();
    if (!categoriaPaciente) {
      const categoriaLookup = await sociosPool
        .request()
        .input("cod_soc", sql.Int, codSoc)
        .input("adherente_codigo", sql.Int, adherenteCodigo)
        .query(`
          SELECT TOP 1 DES_CAT
          FROM PR_DORM.dbo.vw_socios_adherentes
          WHERE COD_SOC = @cod_soc
            AND ADHERENTE_CODIGO = @adherente_codigo
        `);
      categoriaPaciente = String(categoriaLookup.recordset[0]?.DES_CAT ?? "").trim();
    }

    const categoriaNormalized = normalizeCategoria(categoriaPaciente);

    const coberturaResult = await pfcPool.request().input("categoria", sql.VarChar(120), categoriaNormalized).query(`
      SELECT ca.prestacion_id
      FROM cobertura_anual ca
      WHERE ca.categoria COLLATE Latin1_General_CI_AI = @categoria COLLATE Latin1_General_CI_AI
    `);

    const coberturaRows = coberturaResult.recordset as CoberturaRow[];
    const prestacionIds = coberturaRows
      .map((row) => Number(row.prestacion_id))
      .filter((id) => Number.isInteger(id) && id > 0);

    const otrosAdherentes = grupoRows
      .map((row) => Number(row.ADHERENTE_CODIGO))
      .filter((adh) => Number.isInteger(adh) && adh >= 0 && adh !== adherenteCodigo);

    const nombrePorAdherente = new Map<number, string>();
    const vinculoPorAdherente = new Map<number, string>();
    for (const row of grupoRows) {
      const adh = Number(row.ADHERENTE_CODIGO);
      if (!Number.isInteger(adh) || adh < 0) continue;
      const nombre = String(row.ADHERENTE_NOMBRE || row.APELLIDOS || "").trim() || `Adherente ${adh}`;
      nombrePorAdherente.set(adh, nombre);
      vinculoPorAdherente.set(adh, String(row.VINCULO ?? "").trim() || "—");
    }

    if (otrosAdherentes.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          items: [] as unknown[],
          categoria: categoriaPaciente || null,
          mensaje: "No hay otros integrantes en el grupo familiar para este socio.",
        },
      });
    }

    if (prestacionIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          items: [] as unknown[],
          categoria: categoriaPaciente || null,
          mensaje: "No hay prestaciones definidas en la cobertura del plan para filtrar el historial familiar.",
        },
      });
    }

    const req = pfcPool
      .request()
      .input("cod_soc", sql.Int, codSoc);

    const adhIn = buildInParams(req, "fam_adh_", otrosAdherentes);
    const prestIn = buildInParams(req, "fam_pr_", prestacionIds);

    const historialResult = await req.query(`
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
        h.estado as estado_atencion,
        t.adherente_codigo
      FROM turnos t
      OUTER APPLY (
        SELECT TOP 1 estado
        FROM historial_atencion h1
        WHERE h1.turno_id = t.id
        ORDER BY h1.creado_en DESC, h1.id DESC
      ) h
      JOIN prestaciones p ON p.id = t.prestacion_id
      JOIN profesionales pr ON pr.id = t.profesional_id
      WHERE
        t.cod_soc = @cod_soc
        AND t.adherente_codigo IN (${adhIn.sql})
        AND t.prestacion_id IN (${prestIn.sql})
      ORDER BY t.fecha DESC, t.hora DESC
    `);

    const rows = historialResult.recordset as TurnoRow[];
    const items = rows.map((row) => {
      const adh = Number(row.adherente_codigo);
      return {
        turno_id: row.turno_id,
        fecha: row.fecha,
        hora: row.hora,
        estado_turno: row.estado_turno,
        es_carga_manual: row.es_carga_manual,
        prestacion_id: row.prestacion_id,
        prestacion: row.prestacion,
        profesional_id: row.profesional_id,
        profesional: row.profesional,
        estado_atencion: row.estado_atencion,
        adherente_codigo: adh,
        familiar_nombre: nombrePorAdherente.get(adh) ?? `Adherente ${adh}`,
        familiar_vinculo: vinculoPorAdherente.get(adh) ?? "—",
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        items,
        categoria: categoriaPaciente || null,
        mensaje: null as string | null,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}
