import { NextResponse } from "next/server";

import { calcularEdad } from "@/lib/adherentes-beneficios";
import { requiereCoberturaPropia } from "@/lib/pfc-rules";
import { getSqlConnection, getSqlConnectionPfc } from "@/lib/sqlserver";

type TotalRow = {
  total: number | string | null;
};

type SocioClasificacionRow = {
  VINCULO: string | null;
  FECHA_NACIMIENTO: string | Date | null;
};

type PrestacionTopRow = {
  nombre: string;
  total: number | string;
};

type TurnosPorMesRow = {
  anio: number | string;
  mes: number | string;
  total: number | string;
};

/** Cantidad de prestaciones con más atenciones que se envían al gráfico circular. */
const PRESTACIONES_TOP_GRAFICO = 7;
const ANIO_EN_CURSO = new Date().getFullYear();

type TurnoRecienteRow = {
  id: number;
  fecha: string;
  hora: string;
  estado: string;
  cod_soc: number | string;
  adherente_codigo: number | string;
  prestacion: string;
  profesional: string;
};

type TurnoOperacionHoyRow = TurnoRecienteRow;

type EstadoHoyRow = {
  estado: string;
  total: number | string;
};

type SocioLookupRow = {
  COD_SOC: number | string;
  ADHERENTE_CODIGO: number | string;
  ADHERENTE_NOMBRE: string | null;
  APELLIDOS: string | null;
  VINCULO: string | null;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeHoraDashboard(raw: string | Date) {
  if (raw instanceof Date) {
    return raw.toISOString().slice(11, 16);
  }
  const trimmed = String(raw ?? "").trim();
  const match = trimmed.match(/(\d{2}):(\d{2})/);
  if (!match) return trimmed;
  return `${match[1]}:${match[2]}`;
}

async function buildSocioNombreMap(
  billingPool: Awaited<ReturnType<typeof getSqlConnection>>,
  codSocList: number[]
) {
  const socioNombreMap = new Map<string, string>();
  if (codSocList.length === 0) return socioNombreMap;

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

  for (const socio of sociosResult.recordset as SocioLookupRow[]) {
    const codSoc = Number(socio.COD_SOC);
    const adherenteCodigo = Number(socio.ADHERENTE_CODIGO);
    const nombre = String(socio.ADHERENTE_NOMBRE || socio.APELLIDOS || "").trim();
    if (!nombre) continue;
    socioNombreMap.set(`${codSoc}-${adherenteCodigo}`, nombre);
    if (String(socio.VINCULO ?? "").trim().toUpperCase() === "TITULAR") {
      socioNombreMap.set(`${codSoc}-0`, nombre);
    }
  }

  return socioNombreMap;
}

function mapTurnoConSocio(
  row: TurnoOperacionHoyRow,
  socioNombreMap: Map<string, string>
) {
  const codSoc = Number(row.cod_soc);
  const adherente = Number(row.adherente_codigo);
  return {
    id: row.id,
    hora: normalizeHoraDashboard(row.hora),
    estado: String(row.estado).toUpperCase(),
    socio:
      socioNombreMap.get(`${codSoc}-${adherente}`) ??
      socioNombreMap.get(`${codSoc}-0`) ??
      `Socio ${codSoc}`,
    cod_soc: row.cod_soc,
    adherente_codigo: row.adherente_codigo,
    prestacion: row.prestacion,
    profesional: row.profesional,
  };
}

export async function GET() {
  try {
    const billingPool = await getSqlConnection();
    const pfcPool = await getSqlConnectionPfc();

    const [
      clasificacionSociosResult,
    ] = await Promise.all([
      billingPool.request().query(`
        SELECT
          VINCULO,
          FECHA_NACIMIENTO
        FROM PR_DORM.dbo.vw_socios_adherentes
      `),
    ]);

    const [
      turnosAnioResult,
      profesionalesActivosResult,
      prestacionesAnioResult,
      turnosRecientesResult,
      turnosPorMesResult,
      turnosReservadosVencidosResult,
      turnosEstadoHoyResult,
      turnosPorCerrarHoyResult,
      turnosProximosHoyResult,
    ] = await Promise.all([
      pfcPool.request().input("anio", ANIO_EN_CURSO).query(`
        SELECT COUNT(*) as total
        FROM turnos
        WHERE YEAR(fecha) = @anio
      `),
      pfcPool.request().query(`
        SELECT COUNT(DISTINCT profesional_id) as total
        FROM agenda_profesional
      `),
      pfcPool.request().input("anio", ANIO_EN_CURSO).query(`
        SELECT COUNT(*) as total
        FROM turnos
        WHERE estado = 'ATENDIDO'
          AND YEAR(fecha) = @anio
      `),
      pfcPool.request().query(`
        SELECT TOP 5
          t.id,
          t.fecha,
          t.hora,
          t.estado,
          t.cod_soc,
          t.adherente_codigo,
          p.nombre as prestacion,
          pr.nombre as profesional
        FROM turnos t
        JOIN prestaciones p ON p.id = t.prestacion_id
        JOIN profesionales pr ON pr.id = t.profesional_id
        ORDER BY t.creado_en DESC
      `),
      pfcPool.request().query(`
        SELECT
          YEAR(fecha) AS anio,
          MONTH(fecha) AS mes,
          COUNT(*) AS total
        FROM turnos
        WHERE fecha >= DATEADD(MONTH, -11, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
        GROUP BY YEAR(fecha), MONTH(fecha)
        ORDER BY anio ASC, mes ASC
      `),
      pfcPool.request().query(`
        SELECT COUNT(*) AS total
        FROM turnos
        WHERE estado = 'RESERVADO'
          AND (
            fecha < CAST(GETDATE() AS date)
            OR (
              fecha = CAST(GETDATE() AS date)
              AND CAST(hora AS time) < CAST(GETDATE() AS time)
            )
          )
      `),
      pfcPool.request().query(`
        SELECT estado, COUNT(*) AS total
        FROM turnos
        WHERE fecha = CAST(GETDATE() AS date)
        GROUP BY estado
      `),
      pfcPool.request().query(`
        SELECT COUNT(*) AS total
        FROM turnos
        WHERE fecha = CAST(GETDATE() AS date)
          AND estado = 'RESERVADO'
          AND CAST(hora AS time) < CAST(GETDATE() AS time)
      `),
      pfcPool.request().query(`
        SELECT TOP 3
          t.id,
          t.fecha,
          t.hora,
          t.estado,
          t.cod_soc,
          t.adherente_codigo,
          p.nombre as prestacion,
          pr.nombre as profesional
        FROM turnos t
        JOIN prestaciones p ON p.id = t.prestacion_id
        JOIN profesionales pr ON pr.id = t.profesional_id
        WHERE t.fecha = CAST(GETDATE() AS date)
          AND t.estado = 'RESERVADO'
          AND CAST(t.hora AS time) >= CAST(GETDATE() AS time)
        ORDER BY t.hora ASC
      `),
    ]);

    const sociosRows = clasificacionSociosResult.recordset as SocioClasificacionRow[];
    const resumenSocios = sociosRows.reduce(
      (acc, row) => {
        const vinculoNormalizado = String(row.VINCULO ?? "")
          .trim()
          .toUpperCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        const esTitular = vinculoNormalizado === "TITULAR";
        const edad = calcularEdad(row.FECHA_NACIMIENTO);

        acc.personasCubiertas += 1;
        if (esTitular) {
          acc.sociosTitulares += 1;
        } else {
          acc.sociosAdherentes += 1;
        }
        if (
          requiereCoberturaPropia({
            VINCULO: row.VINCULO,
            FECHA_NACIMIENTO: row.FECHA_NACIMIENTO,
            EDAD: edad,
          })
        ) {
          acc.beneficiariosCoberturaPropia += 1;
        }
        if (
          !requiereCoberturaPropia({
            VINCULO: row.VINCULO,
            FECHA_NACIMIENTO: row.FECHA_NACIMIENTO,
            EDAD: edad,
          }) &&
          !esTitular
        ) {
          acc.adherentesBeneficioTitular += 1;
        }
        return acc;
      },
      {
        personasCubiertas: 0,
        sociosTitulares: 0,
        sociosAdherentes: 0,
        adherentesBeneficioTitular: 0,
        beneficiariosCoberturaPropia: 0,
      }
    );

    const personasCubiertas = resumenSocios.personasCubiertas;
    const sociosTitulares = resumenSocios.sociosTitulares;
    const sociosAdherentes = resumenSocios.sociosAdherentes;
    const adherentesBeneficioTitular = resumenSocios.adherentesBeneficioTitular;
    const beneficiariosCoberturaPropia = resumenSocios.beneficiariosCoberturaPropia;
    const turnosHoy = toNumber((turnosAnioResult.recordset[0] as TotalRow | undefined)?.total);
    const profesionalesActivos = toNumber(
      (profesionalesActivosResult.recordset[0] as TotalRow | undefined)?.total
    );
    const prestacionesAnio = toNumber((prestacionesAnioResult.recordset[0] as TotalRow | undefined)?.total);
    const turnosReservadosVencidos = toNumber(
      (turnosReservadosVencidosResult.recordset[0] as TotalRow | undefined)?.total
    );
    const prestacionesMes = prestacionesAnio;
    const periodoPrestacionesUso: "anio" = "anio";

    const prestacionesUsoResult = await pfcPool.request().input("anio", ANIO_EN_CURSO).query(`
      SELECT
        p.nombre,
        COUNT(t.id) AS total
      FROM prestaciones p
      LEFT JOIN turnos t ON t.prestacion_id = p.id
        AND t.estado = 'ATENDIDO'
        AND YEAR(t.fecha) = @anio
      GROUP BY p.id, p.nombre
      ORDER BY total DESC, p.nombre ASC
    `);

    const prestacionesUso = (prestacionesUsoResult.recordset as PrestacionTopRow[]).map((row) => ({
      nombre: row.nombre,
      total: toNumber(row.total),
    }));

    const prestacionesTop = prestacionesUso
      .filter((row) => row.total > 0)
      .slice(0, PRESTACIONES_TOP_GRAFICO);

    const turnosPorMesMap = new Map<string, number>();
    for (const row of turnosPorMesResult.recordset as TurnosPorMesRow[]) {
      const key = `${Number(row.anio)}-${String(Number(row.mes)).padStart(2, "0")}`;
      turnosPorMesMap.set(key, toNumber(row.total));
    }

    const turnosPorMes = Array.from({ length: 12 }, (_, index) => {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - (11 - index));
      const anio = date.getFullYear();
      const mes = date.getMonth() + 1;
      const key = `${anio}-${String(mes).padStart(2, "0")}`;

      return {
        anio,
        mes,
        total: turnosPorMesMap.get(key) ?? 0,
      };
    });

    const turnosRows = turnosRecientesResult.recordset as TurnoRecienteRow[];
    const proximosRows = turnosProximosHoyResult.recordset as TurnoOperacionHoyRow[];

    const estadoHoyMap = (turnosEstadoHoyResult.recordset as EstadoHoyRow[]).reduce(
      (acc, row) => {
        const key = String(row.estado ?? "").toUpperCase();
        acc[key] = toNumber(row.total);
        return acc;
      },
      {} as Record<string, number>
    );

    const operacionHoy = {
      programados: estadoHoyMap.RESERVADO ?? 0,
      atendidos: estadoHoyMap.ATENDIDO ?? 0,
      ausentes: estadoHoyMap.AUSENTE ?? 0,
      cancelados: estadoHoyMap.CANCELADO ?? 0,
      total:
        (estadoHoyMap.RESERVADO ?? 0) +
        (estadoHoyMap.ATENDIDO ?? 0) +
        (estadoHoyMap.AUSENTE ?? 0) +
        (estadoHoyMap.CANCELADO ?? 0),
      por_cerrar: toNumber((turnosPorCerrarHoyResult.recordset[0] as TotalRow | undefined)?.total),
    };

    const codSocList = [
      ...new Set(
        [...turnosRows, ...proximosRows]
          .map((item) => Number(item.cod_soc))
          .filter((value) => Number.isInteger(value))
      ),
    ];
    const socioNombreMap = await buildSocioNombreMap(billingPool, codSocList);

    const turnosRecientes = turnosRows.map((row) => ({
      ...mapTurnoConSocio(row, socioNombreMap),
      fecha: new Date(row.fecha).toISOString().split("T")[0],
    }));

    const proximos_turnos_hoy = proximosRows.map((row) => mapTurnoConSocio(row, socioNombreMap));

    return NextResponse.json({
      success: true,
      data: {
        personas_cubiertas: personasCubiertas,
        socios_titulares: sociosTitulares,
        socios_adherentes: sociosAdherentes,
        adherentes_beneficio_titular: adherentesBeneficioTitular,
        beneficiarios_cobertura_propia: beneficiariosCoberturaPropia,
        alertas: {
          turnos_vencidos: turnosReservadosVencidos,
          beneficiarios_cobertura_propia: beneficiariosCoberturaPropia,
        },
        turnos_hoy: turnosHoy,
        profesionales_activos: profesionalesActivos,
        prestaciones_mes: prestacionesMes,
        prestaciones_top: prestacionesTop,
        prestaciones_uso: prestacionesUso,
        prestaciones_periodo: periodoPrestacionesUso,
        turnos_por_mes: turnosPorMes,
        turnos_recientes: turnosRecientes,
        turnos_reservados_vencidos: turnosReservadosVencidos,
        operacion_hoy: operacionHoy,
        proximos_turnos_hoy: proximos_turnos_hoy,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}
