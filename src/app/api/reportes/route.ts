import { NextResponse } from "next/server";

import { getSqlConnection, getSqlConnectionPfc } from "@/lib/sqlserver";

type PrestacionUsoRow = {
  nombre: string;
  sesiones: number | string;
};

type ConsumoSocioRow = {
  cod_soc: number | string;
  adherente_codigo: number | string;
  sesiones: number | string;
};

type SocioLookupRow = {
  COD_SOC: number | string;
  ADHERENTE_CODIGO: number | string;
  ADHERENTE_NOMBRE: string | null;
  APELLIDOS: string | null;
  VINCULO: string | null;
};

type EstadisticaRow = {
  prestacion: string;
  sesiones_utilizadas: number | string;
  promedio_mensual: number | string;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET() {
  try {
    const billingPool = await getSqlConnection();
    const pfcPool = await getSqlConnectionPfc();

    const [
      prestacionesUsoMesResult,
      prestacionesUsoAnioResult,
      prestacionesUsoHistoricoResult,
      consumoSociosMesResult,
      consumoSociosAnioResult,
      consumoSociosHistoricoResult,
      estadisticasResult,
    ] = await Promise.all([
      pfcPool.request().query(`
        SELECT TOP 10
          p.nombre,
          COUNT(*) as sesiones
        FROM turnos t
        JOIN prestaciones p ON p.id = t.prestacion_id
        WHERE
          t.estado = 'ATENDIDO'
          AND MONTH(t.fecha) = MONTH(GETDATE())
          AND YEAR(t.fecha) = YEAR(GETDATE())
        GROUP BY p.nombre
        ORDER BY sesiones DESC
      `),
      pfcPool.request().query(`
        SELECT TOP 10
          p.nombre,
          COUNT(*) as sesiones
        FROM turnos t
        JOIN prestaciones p ON p.id = t.prestacion_id
        WHERE
          t.estado = 'ATENDIDO'
          AND YEAR(t.fecha) = YEAR(GETDATE())
        GROUP BY p.nombre
        ORDER BY sesiones DESC
      `),
      pfcPool.request().query(`
        SELECT TOP 10
          p.nombre,
          COUNT(*) as sesiones
        FROM turnos t
        JOIN prestaciones p ON p.id = t.prestacion_id
        WHERE t.estado = 'ATENDIDO'
        GROUP BY p.nombre
        ORDER BY sesiones DESC
      `),
      pfcPool.request().query(`
        SELECT TOP 8
          t.cod_soc,
          t.adherente_codigo,
          COUNT(*) as sesiones
        FROM turnos t
        WHERE
          t.estado = 'ATENDIDO'
          AND MONTH(t.fecha) = MONTH(GETDATE())
          AND YEAR(t.fecha) = YEAR(GETDATE())
        GROUP BY t.cod_soc, t.adherente_codigo
        ORDER BY sesiones DESC
      `),
      pfcPool.request().query(`
        SELECT TOP 8
          t.cod_soc,
          t.adherente_codigo,
          COUNT(*) as sesiones
        FROM turnos t
        WHERE
          t.estado = 'ATENDIDO'
          AND YEAR(t.fecha) = YEAR(GETDATE())
        GROUP BY t.cod_soc, t.adherente_codigo
        ORDER BY sesiones DESC
      `),
      pfcPool.request().query(`
        SELECT TOP 8
          t.cod_soc,
          t.adherente_codigo,
          COUNT(*) as sesiones
        FROM turnos t
        WHERE t.estado = 'ATENDIDO'
        GROUP BY t.cod_soc, t.adherente_codigo
        ORDER BY sesiones DESC
      `),
      pfcPool.request().query(`
        SELECT
          p.nombre as prestacion,
          COUNT(*) as sesiones_utilizadas,
          CAST(ROUND(COUNT(*) * 1.0 / NULLIF(MONTH(GETDATE()), 0), 1) as decimal(10,1)) as promedio_mensual
        FROM turnos t
        JOIN prestaciones p ON p.id = t.prestacion_id
        WHERE
          t.estado = 'ATENDIDO'
          AND YEAR(t.fecha) = YEAR(GETDATE())
        GROUP BY p.nombre
        ORDER BY sesiones_utilizadas DESC
      `),
    ]);

    const prestacionesUsoMes = (prestacionesUsoMesResult.recordset as PrestacionUsoRow[]).map((row) => ({
      nombre: row.nombre,
      sesiones: toNumber(row.sesiones),
    }));
    const prestacionesUsoAnio = (prestacionesUsoAnioResult.recordset as PrestacionUsoRow[]).map((row) => ({
      nombre: row.nombre,
      sesiones: toNumber(row.sesiones),
    }));
    const prestacionesUsoHistorico = (
      prestacionesUsoHistoricoResult.recordset as PrestacionUsoRow[]
    ).map((row) => ({
      nombre: row.nombre,
      sesiones: toNumber(row.sesiones),
    }));
    const prestacionesUso =
      prestacionesUsoMes.length > 0
        ? prestacionesUsoMes
        : prestacionesUsoAnio.length > 0
          ? prestacionesUsoAnio
          : prestacionesUsoHistorico;

    const consumoRows =
      (consumoSociosMesResult.recordset as ConsumoSocioRow[]).length > 0
        ? (consumoSociosMesResult.recordset as ConsumoSocioRow[])
        : (consumoSociosAnioResult.recordset as ConsumoSocioRow[]).length > 0
          ? (consumoSociosAnioResult.recordset as ConsumoSocioRow[])
          : (consumoSociosHistoricoResult.recordset as ConsumoSocioRow[]);
    const codSocList = [
      ...new Set(consumoRows.map((item) => Number(item.cod_soc)).filter((value) => Number.isInteger(value))),
    ];
    const socioNombreMap = new Map<string, string>();

    if (codSocList.length > 0) {
      const sociosResult = await billingPool.request().query(`
        SELECT
          COD_SOC,
          ADHERENTE_CODIGO,
          ADHERENTE_NOMBRE,
          APELLIDOS,
          VINCULO
        FROM PR_DORM.dbo.vw_socios_adherentes
        WHERE COD_SOC IN (${codSocList.join(",")})
      `);

      for (const row of sociosResult.recordset as SocioLookupRow[]) {
        const codSoc = Number(row.COD_SOC);
        const adherenteCodigo = Number(row.ADHERENTE_CODIGO);
        const nombre = String(row.ADHERENTE_NOMBRE || row.APELLIDOS || "").trim();
        if (!nombre) continue;
        socioNombreMap.set(`${codSoc}-${adherenteCodigo}`, nombre);
        if (String(row.VINCULO ?? "").trim().toUpperCase() === "TITULAR") {
          socioNombreMap.set(`${codSoc}-0`, nombre);
        }
      }
    }

    const consumoSocios = consumoRows.map((row) => ({
      socio:
        socioNombreMap.get(`${Number(row.cod_soc)}-${Number(row.adherente_codigo)}`) ??
        socioNombreMap.get(`${Number(row.cod_soc)}-0`) ??
        `Socio ${row.cod_soc}`,
      sesiones: toNumber(row.sesiones),
    }));

    const estadisticas = (estadisticasResult.recordset as EstadisticaRow[]).map((row) => ({
      prestacion: row.prestacion,
      sesiones: toNumber(row.sesiones_utilizadas),
      promedioMensual: `${toNumber(row.promedio_mensual).toFixed(1)} / mes`,
      estado: "Activo",
    }));

    const prestacionesTotalesMes = prestacionesUso.reduce(
      (acc, item) => acc + Number(item.sesiones ?? 0),
      0
    );
    const sociosQueUsaronPfc = consumoSocios.length;
    const promedioUsoSocio = sociosQueUsaronPfc > 0 ? prestacionesTotalesMes / sociosQueUsaronPfc : 0;

    return NextResponse.json({
      success: true,
      data: {
        indicadores: {
          prestaciones_totales_mes: prestacionesTotalesMes,
          socios_que_usaron_pfc: sociosQueUsaronPfc,
          promedio_uso_por_socio: Number(promedioUsoSocio.toFixed(1)),
        },
        prestaciones_uso: prestacionesUso,
        consumo_socios: consumoSocios,
        estadisticas,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}

