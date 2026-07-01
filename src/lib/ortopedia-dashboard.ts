import sql from "mssql";

import { refreshPrestamosVencidos } from "@/lib/ortopedia-prestamos";
import { getSqlConnectionPfc } from "@/lib/sqlserver";

export type OrtopediaDashboardMetricas = {
  elementos: number;
  stock_disponible: number;
  prestados: number;
  vencidos: number;
  certificados_por_vencer: number;
  renovaciones: number;
};

export type OrtopediaDashboardAlerta = {
  id: string;
  tipo:
    | "prestamo_vencido"
    | "certificado_por_vencer"
    | "certificado_vencido"
    | "stock_critico"
    | "stock_bajo"
    | "prestamo_por_vencer";
  prioridad: "alta" | "media" | "baja";
  titulo: string;
  subtitulo: string;
  mensaje: string;
  href: string;
  prestamo_id?: number;
  elemento_id?: number;
};

export type OrtopediaDashboardActividad = {
  id: string;
  fecha: string;
  tipo: "entrega" | "devolucion" | "renovacion" | "certificado";
  mensaje: string;
  prestamo_id?: number;
};

export type OrtopediaDashboardData = {
  metricas: OrtopediaDashboardMetricas;
  graficos: {
    prestamos_mes: Array<{ mes: string; anio: number; mes_num: number; total: number }>;
    top_elementos: Array<{ nombre: string; total: number }>;
    estado_prestamos: Array<{ estado: string; total: number }>;
    stock_elementos: Array<{ nombre: string; stock_total: number; disponible: number; prestado: number }>;
  };
  actividad_reciente: OrtopediaDashboardActividad[];
  alertas: OrtopediaDashboardAlerta[];
};

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function daysDiff(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function formatRelativeDays(target: string | Date, today = new Date()) {
  const date = new Date(target);
  if (Number.isNaN(date.getTime())) return "";
  const diff = daysDiff(today, date);
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff === -1) return "ayer";
  if (diff > 0) return `en ${diff} dias`;
  return `hace ${Math.abs(diff)} dias`;
}

function weekdayLabel(date: string | Date) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("es-AR", { weekday: "long", timeZone: "UTC" });
}

export async function buildOrtopediaDashboard(): Promise<OrtopediaDashboardData> {
  const pool = await getSqlConnectionPfc();
  await refreshPrestamosVencidos(pool);

  const [
    metricasResult,
    prestamosMesResult,
    topElementosResult,
    estadoPrestamosResult,
    stockElementosResult,
    actividadEntregasResult,
    actividadDevolucionesResult,
    actividadCertificadosResult,
    actividadRenovacionesResult,
    alertasPrestamosResult,
    alertasStockResult,
  ] = await Promise.all([
    pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM ortopedia_elementos) AS elementos,
        (SELECT ISNULL(SUM(stock_disponible), 0) FROM ortopedia_elementos) AS stock_disponible,
        (
          SELECT COUNT(*)
          FROM ortopedia_prestamos
          WHERE estado = 'ACTIVO' AND fecha_devolucion IS NULL
        ) AS prestados,
        (
          SELECT COUNT(*)
          FROM ortopedia_prestamos
          WHERE estado = 'VENCIDO' AND fecha_devolucion IS NULL
        ) AS vencidos,
        (
          SELECT COUNT(*)
          FROM ortopedia_prestamos
          WHERE estado = 'ACTIVO'
            AND fecha_devolucion IS NULL
            AND fecha_vencimiento BETWEEN CAST(GETDATE() AS DATE) AND DATEADD(DAY, 30, CAST(GETDATE() AS DATE))
        ) AS certificados_por_vencer,
        (
          SELECT COUNT(*)
          FROM ortopedia_prestamos
          WHERE estado = 'VENCIDO' AND fecha_devolucion IS NULL
        ) AS renovaciones
    `),
    pool.request().query(`
      SELECT
        YEAR(fecha_prestamo) AS anio,
        MONTH(fecha_prestamo) AS mes_num,
        COUNT(*) AS total
      FROM ortopedia_prestamos
      WHERE fecha_prestamo >= DATEADD(MONTH, -11, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
      GROUP BY YEAR(fecha_prestamo), MONTH(fecha_prestamo)
      ORDER BY anio, mes_num
    `),
    pool.request().query(`
      SELECT TOP 10
        e.nombre,
        COUNT(*) AS total
      FROM ortopedia_prestamos p
      JOIN ortopedia_elementos e ON e.id = p.elemento_id
      GROUP BY e.nombre
      ORDER BY total DESC, e.nombre
    `),
    pool.request().query(`
      SELECT
        SUM(CASE WHEN estado = 'ACTIVO' AND fecha_devolucion IS NULL THEN 1 ELSE 0 END) AS activos,
        SUM(CASE WHEN estado = 'DEVUELTO' OR fecha_devolucion IS NOT NULL THEN 1 ELSE 0 END) AS devueltos,
        SUM(CASE WHEN estado = 'VENCIDO' AND fecha_devolucion IS NULL THEN 1 ELSE 0 END) AS vencidos,
        SUM(CASE WHEN renovaciones > 0 AND fecha_devolucion IS NULL THEN 1 ELSE 0 END) AS renovados
      FROM ortopedia_prestamos
    `),
    pool.request().query(`
      SELECT
        nombre,
        stock_total,
        stock_disponible,
        CASE WHEN stock_total - stock_disponible < 0 THEN 0 ELSE stock_total - stock_disponible END AS prestado
      FROM ortopedia_elementos
      ORDER BY nombre
    `),
    pool.request().query(`
      SELECT TOP 8
        p.id,
        p.creado_en AS fecha,
        e.nombre AS elemento_nombre,
        p.paciente_nombre
      FROM ortopedia_prestamos p
      JOIN ortopedia_elementos e ON e.id = p.elemento_id
      ORDER BY p.creado_en DESC
    `),
    pool.request().query(`
      SELECT TOP 8
        p.id,
        p.fecha_devolucion AS fecha,
        e.nombre AS elemento_nombre,
        p.paciente_nombre
      FROM ortopedia_prestamos p
      JOIN ortopedia_elementos e ON e.id = p.elemento_id
      WHERE p.fecha_devolucion IS NOT NULL
      ORDER BY p.fecha_devolucion DESC, p.actualizado_en DESC
    `),
    pool.request().query(`
      SELECT TOP 8
        p.id,
        p.fecha_certificado AS fecha,
        e.nombre AS elemento_nombre,
        p.paciente_nombre
      FROM ortopedia_prestamos p
      JOIN ortopedia_elementos e ON e.id = p.elemento_id
      WHERE p.fecha_certificado IS NOT NULL
      ORDER BY p.fecha_certificado DESC
    `),
    pool.request().query(`
      SELECT TOP 8
        p.id,
        p.actualizado_en AS fecha,
        e.nombre AS elemento_nombre,
        p.paciente_nombre,
        p.renovaciones
      FROM ortopedia_prestamos p
      JOIN ortopedia_elementos e ON e.id = p.elemento_id
      WHERE p.renovaciones > 0
      ORDER BY p.actualizado_en DESC
    `),
    pool.request().query(`
      SELECT
        p.id,
        p.estado,
        p.fecha_vencimiento,
        p.paciente_nombre,
        e.id AS elemento_id,
        e.nombre AS elemento_nombre,
        e.stock_disponible,
        e.stock_total
      FROM ortopedia_prestamos p
      JOIN ortopedia_elementos e ON e.id = p.elemento_id
      WHERE p.fecha_devolucion IS NULL
        AND (
          p.estado = 'VENCIDO'
          OR (
            p.estado = 'ACTIVO'
            AND p.fecha_vencimiento <= DATEADD(DAY, 30, CAST(GETDATE() AS DATE))
          )
        )
      ORDER BY p.fecha_vencimiento ASC
    `),
    pool.request().query(`
      SELECT
        id,
        nombre,
        stock_total,
        stock_disponible
      FROM ortopedia_elementos
      WHERE activo = 1
        AND (
          stock_disponible = 0
          OR (
            stock_total > 0
            AND CAST(stock_disponible AS FLOAT) / NULLIF(stock_total, 0) < 0.2
          )
        )
      ORDER BY stock_disponible ASC, nombre
    `),
  ]);

  const monthLabels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const metricasRow = metricasResult.recordset[0] as Record<string, unknown>;
  const metricas: OrtopediaDashboardMetricas = {
    elementos: toNumber(metricasRow.elementos),
    stock_disponible: toNumber(metricasRow.stock_disponible),
    prestados: toNumber(metricasRow.prestados),
    vencidos: toNumber(metricasRow.vencidos),
    certificados_por_vencer: toNumber(metricasRow.certificados_por_vencer),
    renovaciones: toNumber(metricasRow.renovaciones),
  };

  const prestamosMes = (prestamosMesResult.recordset as Array<{ anio: number; mes_num: number; total: number }>).map(
    (row) => ({
      mes: monthLabels[row.mes_num - 1] ?? String(row.mes_num),
      anio: row.anio,
      mes_num: row.mes_num,
      total: toNumber(row.total),
    })
  );

  const topElementos = (topElementosResult.recordset as Array<{ nombre: string; total: number }>).map((row) => ({
    nombre: row.nombre,
    total: toNumber(row.total),
  }));

  const estadoRow = estadoPrestamosResult.recordset[0] as Record<string, unknown>;
  const estadoPrestamos = [
    { estado: "Activos", total: toNumber(estadoRow.activos) },
    { estado: "Devueltos", total: toNumber(estadoRow.devueltos) },
    { estado: "Vencidos", total: toNumber(estadoRow.vencidos) },
    { estado: "Renovados", total: toNumber(estadoRow.renovados) },
  ].filter((item) => item.total > 0);

  const stockElementos = (
    stockElementosResult.recordset as Array<{
      nombre: string;
      stock_total: number;
      stock_disponible: number;
      prestado: number;
    }>
  ).map((row) => ({
    nombre: row.nombre,
    stock_total: toNumber(row.stock_total),
    disponible: toNumber(row.stock_disponible),
    prestado: toNumber(row.prestado),
  }));

  const actividadRaw: OrtopediaDashboardActividad[] = [];

  for (const row of actividadEntregasResult.recordset as Array<{
    id: number;
    fecha: string | Date;
    elemento_nombre: string;
  }>) {
    actividadRaw.push({
      id: `entrega-${row.id}-${String(row.fecha)}`,
      fecha: String(row.fecha),
      tipo: "entrega",
      mensaje: `Se entrego ${row.elemento_nombre}`,
      prestamo_id: row.id,
    });
  }

  for (const row of actividadDevolucionesResult.recordset as Array<{
    id: number;
    fecha: string | Date;
    elemento_nombre: string;
  }>) {
    actividadRaw.push({
      id: `devolucion-${row.id}-${String(row.fecha)}`,
      fecha: String(row.fecha),
      tipo: "devolucion",
      mensaje: `Se devolvio ${row.elemento_nombre}`,
      prestamo_id: row.id,
    });
  }

  for (const row of actividadRenovacionesResult.recordset as Array<{
    id: number;
    fecha: string | Date;
    elemento_nombre: string;
  }>) {
    actividadRaw.push({
      id: `renovacion-${row.id}-${String(row.fecha)}`,
      fecha: String(row.fecha),
      tipo: "renovacion",
      mensaje: `Se renovo el prestamo de ${row.elemento_nombre}`,
      prestamo_id: row.id,
    });
  }

  for (const row of actividadCertificadosResult.recordset as Array<{
    id: number;
    fecha: string | Date;
    elemento_nombre: string;
  }>) {
    actividadRaw.push({
      id: `certificado-${row.id}-${String(row.fecha)}`,
      fecha: String(row.fecha),
      tipo: "certificado",
      mensaje: `Se cargo un certificado para ${row.elemento_nombre}`,
      prestamo_id: row.id,
    });
  }

  const actividad_reciente = actividadRaw
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, 12);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const alertas: OrtopediaDashboardAlerta[] = [];

  for (const row of alertasPrestamosResult.recordset as Array<{
    id: number;
    estado: string;
    fecha_vencimiento: string | Date;
    paciente_nombre: string;
    elemento_id: number;
    elemento_nombre: string;
  }>) {
    const vencimiento = new Date(row.fecha_vencimiento);
    const dias = daysDiff(today, vencimiento);
    const href = `/ortopedia/prestamos?id=${row.id}`;

    if (row.estado === "VENCIDO") {
      alertas.push({
        id: `prestamo-vencido-${row.id}`,
        tipo: "prestamo_vencido",
        prioridad: "alta",
        titulo: row.elemento_nombre,
        subtitulo: row.paciente_nombre,
        mensaje: `Vencio ${formatRelativeDays(vencimiento, today)}.`,
        href,
        prestamo_id: row.id,
        elemento_id: row.elemento_id,
      });
      alertas.push({
        id: `certificado-vencido-${row.id}`,
        tipo: "certificado_vencido",
        prioridad: "alta",
        titulo: row.paciente_nombre,
        subtitulo: row.elemento_nombre,
        mensaje: "Debe presentar nuevo certificado.",
        href,
        prestamo_id: row.id,
        elemento_id: row.elemento_id,
      });
      continue;
    }

    if (dias >= 0 && dias <= 7) {
      alertas.push({
        id: `prestamo-por-vencer-${row.id}`,
        tipo: "prestamo_por_vencer",
        prioridad: "baja",
        titulo: row.elemento_nombre,
        subtitulo: row.paciente_nombre,
        mensaje: `Devolver el ${weekdayLabel(vencimiento) || formatRelativeDays(vencimiento, today)}.`,
        href,
        prestamo_id: row.id,
        elemento_id: row.elemento_id,
      });
    }

    if (dias >= 0 && dias <= 30) {
      alertas.push({
        id: `certificado-por-vencer-${row.id}`,
        tipo: "certificado_por_vencer",
        prioridad: "media",
        titulo: row.paciente_nombre,
        subtitulo: row.elemento_nombre,
        mensaje: `Certificado vence ${formatRelativeDays(vencimiento, today)}.`,
        href,
        prestamo_id: row.id,
        elemento_id: row.elemento_id,
      });
    }
  }

  for (const row of alertasStockResult.recordset as Array<{
    id: number;
    nombre: string;
    stock_total: number;
    stock_disponible: number;
  }>) {
    const disponible = toNumber(row.stock_disponible);
    const total = toNumber(row.stock_total);
    if (disponible === 0) {
      alertas.push({
        id: `stock-critico-${row.id}`,
        tipo: "stock_critico",
        prioridad: "alta",
        titulo: row.nombre,
        subtitulo: "Stock critico",
        mensaje: `No quedan ${row.nombre.toLowerCase()}.`,
        href: "/ortopedia/stock",
        elemento_id: row.id,
      });
    } else if (total > 0 && disponible / total < 0.2) {
      alertas.push({
        id: `stock-bajo-${row.id}`,
        tipo: "stock_bajo",
        prioridad: "media",
        titulo: row.nombre,
        subtitulo: "Stock bajo",
        mensaje: `Quedan solamente ${disponible} unidades.`,
        href: "/ortopedia/stock",
        elemento_id: row.id,
      });
    }
  }

  const prioridadOrden = { alta: 0, media: 1, baja: 2 } as const;
  alertas.sort((a, b) => prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad]);

  return {
    metricas,
    graficos: {
      prestamos_mes: prestamosMes,
      top_elementos: topElementos,
      estado_prestamos: estadoPrestamos,
      stock_elementos: stockElementos,
    },
    actividad_reciente,
    alertas,
  };
}
