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
type TotalRow = {
  total: number | string;
};
type EstadoRow = {
  estado: string;
  total: number | string;
};
type UsoMensualRow = {
  mes: number | string;
  atendidos: number | string;
  total: number | string;
};
type ProfesionalUsoRow = {
  nombre: string;
  sesiones: number | string;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveYear(request: Request) {
  const currentYear = new Date().getFullYear();
  const { searchParams } = new URL(request.url);
  const requestedYear = Number(searchParams.get("anio"));
  if (!Number.isInteger(requestedYear) || requestedYear < 2020 || requestedYear > currentYear + 1) {
    return currentYear;
  }
  return requestedYear;
}

export async function GET(request: Request) {
  try {
    const anio = resolveYear(request);
    const billingPool = await getSqlConnection();
    const pfcPool = await getSqlConnectionPfc();

    const [
      prestacionesUsoAnioResult,
      consumoSociosAnioResult,
      totalSesionesAnioResult,
      totalSociosAnioResult,
      estadisticasResult,
      totalTurnosAnioResult,
      estadosTurnosAnioResult,
      usoMensualAnioResult,
      topProfesionalesAnioResult,
    ] = await Promise.all([
      pfcPool.request().input("anio", anio).query(`
        SELECT
          p.nombre,
          COUNT(*) as sesiones
        FROM turnos t
        JOIN prestaciones p ON p.id = t.prestacion_id
        WHERE
          t.estado = 'ATENDIDO'
          AND YEAR(t.fecha) = @anio
        GROUP BY p.nombre
        ORDER BY sesiones DESC
      `),
      pfcPool.request().input("anio", anio).query(`
        SELECT
          t.cod_soc,
          t.adherente_codigo,
          COUNT(*) as sesiones
        FROM turnos t
        WHERE
          t.estado = 'ATENDIDO'
          AND YEAR(t.fecha) = @anio
        GROUP BY t.cod_soc, t.adherente_codigo
        ORDER BY sesiones DESC
      `),
      pfcPool.request().input("anio", anio).query(`
        SELECT COUNT(*) as total
        FROM turnos t
        WHERE
          t.estado = 'ATENDIDO'
          AND YEAR(t.fecha) = @anio
      `),
      pfcPool.request().input("anio", anio).query(`
        SELECT COUNT(*) as total
        FROM (
          SELECT DISTINCT t.cod_soc, t.adherente_codigo
          FROM turnos t
          WHERE
            t.estado = 'ATENDIDO'
            AND YEAR(t.fecha) = @anio
        ) x
      `),
      pfcPool.request().input("anio", anio).query(`
        SELECT
          p.nombre as prestacion,
          COUNT(*) as sesiones_utilizadas,
          CAST(ROUND(COUNT(*) * 1.0 / NULLIF(MONTH(GETDATE()), 0), 1) as decimal(10,1)) as promedio_mensual
        FROM turnos t
        JOIN prestaciones p ON p.id = t.prestacion_id
        WHERE
          t.estado = 'ATENDIDO'
          AND YEAR(t.fecha) = @anio
        GROUP BY p.nombre
        ORDER BY sesiones_utilizadas DESC
      `),
      pfcPool.request().input("anio", anio).query(`
        SELECT COUNT(*) as total
        FROM turnos t
        WHERE YEAR(t.fecha) = @anio
      `),
      pfcPool.request().input("anio", anio).query(`
        SELECT t.estado, COUNT(*) as total
        FROM turnos t
        WHERE YEAR(t.fecha) = @anio
        GROUP BY t.estado
      `),
      pfcPool.request().input("anio", anio).query(`
        SELECT
          MONTH(t.fecha) as mes,
          SUM(CASE WHEN t.estado = 'ATENDIDO' THEN 1 ELSE 0 END) as atendidos,
          COUNT(*) as total
        FROM turnos t
        WHERE YEAR(t.fecha) = @anio
        GROUP BY MONTH(t.fecha)
        ORDER BY mes
      `),
      pfcPool.request().input("anio", anio).query(`
        SELECT TOP 8
          pr.nombre,
          COUNT(*) as sesiones
        FROM turnos t
        JOIN profesionales pr ON pr.id = t.profesional_id
        WHERE t.estado = 'ATENDIDO'
          AND YEAR(t.fecha) = @anio
        GROUP BY pr.nombre
        ORDER BY sesiones DESC
      `),
    ]);

    const prestacionesUsoAnio = (prestacionesUsoAnioResult.recordset as PrestacionUsoRow[]).map((row) => ({
      nombre: row.nombre,
      sesiones: toNumber(row.sesiones),
    }));
    const prestacionesUso = prestacionesUsoAnio;

    const consumoRows = consumoSociosAnioResult.recordset as ConsumoSocioRow[];
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

    const prestacionesTotalesAnio = toNumber((totalSesionesAnioResult.recordset[0] as TotalRow | undefined)?.total);
    const turnosTotalesAnio = toNumber((totalTurnosAnioResult.recordset[0] as TotalRow | undefined)?.total);
    const sociosQueUsaronPfc = toNumber((totalSociosAnioResult.recordset[0] as TotalRow | undefined)?.total);
    const promedioUsoSocio = sociosQueUsaronPfc > 0 ? prestacionesTotalesAnio / sociosQueUsaronPfc : 0;
    const estadosTurnos = (estadosTurnosAnioResult.recordset as EstadoRow[]).map((row) => ({
      estado: String(row.estado ?? "").toUpperCase() || "SIN_ESTADO",
      total: toNumber(row.total),
    }));
    const usoMensual = (usoMensualAnioResult.recordset as UsoMensualRow[]).map((row) => ({
      mes: toNumber(row.mes),
      atendidos: toNumber(row.atendidos),
      total: toNumber(row.total),
    }));
    const topProfesionales = (topProfesionalesAnioResult.recordset as ProfesionalUsoRow[]).map((row) => ({
      nombre: row.nombre,
      sesiones: toNumber(row.sesiones),
    }));

    return NextResponse.json({
      success: true,
      data: {
        anio,
        indicadores: {
          prestaciones_totales_mes: prestacionesTotalesAnio,
          socios_que_usaron_pfc: sociosQueUsaronPfc,
          promedio_uso_por_socio: Number(promedioUsoSocio.toFixed(1)),
          turnos_totales_anio: turnosTotalesAnio,
          prestaciones_distintas: prestacionesUso.length,
        },
        prestaciones_uso: prestacionesUso,
        consumo_socios: consumoSocios,
        estadisticas,
        estados_turnos: estadosTurnos,
        uso_mensual: usoMensual,
        top_profesionales: topProfesionales,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}

