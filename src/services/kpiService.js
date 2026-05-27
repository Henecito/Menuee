import { supabase } from "../supabaseClient";
import {
  horariosUsablesParaTurnos,
  listarOpcionesTurnoDesdeHorarios,
  pedidoCoincideConTurno,
  agregarPedidoAPorTurno,
  porTurnoDesdeAcum,
  instanteReferenciaParaTurnoPedido,
} from "../utils/turnosReporte";

function getDayBounds(dateValue) {
  const d = new Date(dateValue);
  const start = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    0,
    0,
    0,
    0
  );
  const end = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    23,
    59,
    59,
    999
  );
  return { start, end };
}

function resolveDateRange({ rango = "hoy", fechaDesde = "", fechaHasta = "" } = {}) {
  const now = new Date();

  if (rango === "ayer") {
    const ayer = new Date(now);
    ayer.setDate(ayer.getDate() - 1);
    const { start, end } = getDayBounds(ayer);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }

  if (rango === "ultimos_7_dias") {
    const { end } = getDayBounds(now);
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6,
      0,
      0,
      0,
      0
    );
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }

  if (rango === "ultimos_30_dias") {
    const { end } = getDayBounds(now);
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 29,
      0,
      0,
      0,
      0
    );
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }

  if (rango === "personalizado" && fechaDesde && fechaHasta) {
    const { start } = getDayBounds(`${fechaDesde}T00:00:00`);
    const { end } = getDayBounds(`${fechaHasta}T00:00:00`);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }

  const { start, end } = getDayBounds(now);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

const PEDIDOS_KPIS_SELECT_CON_CERRADO =
  "creado_en, cerrado_en, total, propina, metodo_pago, estado";
const PEDIDOS_KPIS_SELECT_SIN_CERRADO = "creado_en, total, propina, metodo_pago, estado";

function pedidosKpisErrorFaltaCerradoEn(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = `${error.message || ""} ${error.details || ""}`.toLowerCase();
  if (code === "42703") return true;
  if (
    msg.includes("cerrado_en") &&
    (msg.includes("does not exist") ||
      msg.includes("could not find") ||
      msg.includes("no existe"))
  ) {
    return true;
  }
  return false;
}

async function queryPedidosParaKpisPorTurno(sucursalId, startDate, endDate) {
  let { data, error } = await supabase
    .from("pedidos")
    .select(PEDIDOS_KPIS_SELECT_CON_CERRADO)
    .eq("sucursal_id", sucursalId)
    .gte("creado_en", startDate)
    .lte("creado_en", endDate);

  if (error && pedidosKpisErrorFaltaCerradoEn(error)) {
    const second = await supabase
      .from("pedidos")
      .select(PEDIDOS_KPIS_SELECT_SIN_CERRADO)
      .eq("sucursal_id", sucursalId)
      .gte("creado_en", startDate)
      .lte("creado_en", endDate);
    data = second.data;
    error = second.error;
  }

  return { data, error };
}

function acumularPagosDesdePedidosCerrados(rows) {
  const pagosCantidad = {
    efectivo: 0,
    tarjeta: 0,
    debito: 0,
    credito: 0,
    transferencia: 0,
    otro: 0,
  };

  const pagosMonto = {
    efectivo: 0,
    tarjeta: 0,
    debito: 0,
    credito: 0,
    transferencia: 0,
    otro: 0,
  };

  (rows || []).forEach((p) => {
    const metodo = (p.metodo_pago || "").toLowerCase().trim();
    const monto = Number(p.total || 0);

    switch (metodo) {
      case "efectivo":
        pagosCantidad.efectivo++;
        pagosMonto.efectivo += monto;
        break;

      case "debito":
      case "tarjeta_debito":
        pagosCantidad.tarjeta++;
        pagosCantidad.debito++;
        pagosMonto.tarjeta += monto;
        pagosMonto.debito += monto;
        break;

      case "credito":
      case "tarjeta_credito":
        pagosCantidad.tarjeta++;
        pagosCantidad.credito++;
        pagosMonto.tarjeta += monto;
        pagosMonto.credito += monto;
        break;

      case "tarjeta":
        pagosCantidad.tarjeta++;
        pagosMonto.tarjeta += monto;
        break;

      case "transferencia":
      case "transfer":
        pagosCantidad.transferencia++;
        pagosMonto.transferencia += monto;
        break;

      default:
        pagosCantidad.otro++;
        pagosMonto.otro += monto;
        break;
    }
  });

  return { pagosCantidad, pagosMonto };
}

/** KPIs sin lógica de turnos (consultas originales). */
async function getKpisSinTurnos(sucursalId, startDate, endDate) {
  const { count: pedidosHoy, error: e1 } = await supabase
    .from("pedidos")
    .select("*", { count: "exact", head: true })
    .eq("sucursal_id", sucursalId)
    .gte("creado_en", startDate)
    .lte("creado_en", endDate)
    .neq("estado", "cancelado");

  if (e1) throw e1;

  const { data: ingresosData, error: e2 } = await supabase
    .from("pedidos")
    .select("total")
    .eq("sucursal_id", sucursalId)
    .gte("creado_en", startDate)
    .lte("creado_en", endDate)
    .in("estado", ["entregado", "enviado"]);

  if (e2) throw e2;

  const ingresosHoy = (ingresosData || []).reduce(
    (acc, p) => acc + Number(p.total || 0),
    0
  );

  const { data: propinasData, error: e3 } = await supabase
    .from("pedidos")
    .select("propina")
    .eq("sucursal_id", sucursalId)
    .gte("creado_en", startDate)
    .lte("creado_en", endDate)
    .in("estado", ["entregado", "enviado"]);

  if (e3) throw e3;

  const propinasHoy = (propinasData || []).reduce(
    (acc, p) => acc + Number(p.propina || 0),
    0
  );

  const { data: mesasData, error: e4 } = await supabase
    .from("mesas")
    .select("estado")
    .eq("sucursal_id", sucursalId)
    .eq("activa", true);

  if (e4) throw e4;

  const totalMesas = mesasData?.length || 0;

  const mesasOcupadas = (mesasData || []).filter((m) =>
    ["ocupada", "cuenta"].includes(m.estado)
  ).length;

  const { data: pagosData, error: e5 } = await supabase
    .from("pedidos")
    .select("metodo_pago, total")
    .eq("sucursal_id", sucursalId)
    .gte("creado_en", startDate)
    .lte("creado_en", endDate)
    .in("estado", ["entregado", "enviado"]);

  if (e5) throw e5;

  const { pagosCantidad, pagosMonto } = acumularPagosDesdePedidosCerrados(pagosData);

  return {
    pedidosHoy: pedidosHoy || 0,
    ingresosHoy,
    propinasHoy,
    mesasOcupadas,
    totalMesas,
    pagosCantidad,
    pagosMonto,
  };
}

async function getKpisConHorariosPorTurno(
  sucursalId,
  startDate,
  endDate,
  horariosRaw,
  filtroTurno
) {
  const { data: rows, error } = await queryPedidosParaKpisPorTurno(
    sucursalId,
    startDate,
    endDate
  );

  if (error) throw error;

  const all = rows || [];
  const activos = all.filter((p) => (p.estado || "").toLowerCase() !== "cancelado");

  const activosFiltradosTurno = activos.filter((p) =>
    pedidoCoincideConTurno(
      instanteReferenciaParaTurnoPedido(p),
      filtroTurno,
      horariosRaw
    )
  );

  const pedidosHoy = activosFiltradosTurno.length;

  const cerradosFiltrados = activosFiltradosTurno.filter((p) =>
    ["entregado", "enviado"].includes((p.estado || "").toLowerCase())
  );

  const ingresosHoy = cerradosFiltrados.reduce(
    (acc, p) => acc + Number(p.total || 0),
    0
  );
  const propinasHoy = cerradosFiltrados.reduce(
    (acc, p) => acc + Number(p.propina || 0),
    0
  );

  const { pagosCantidad, pagosMonto } = acumularPagosDesdePedidosCerrados(cerradosFiltrados);

  const { data: mesasData, error: e4 } = await supabase
    .from("mesas")
    .select("estado")
    .eq("sucursal_id", sucursalId)
    .eq("activa", true);

  if (e4) throw e4;

  const totalMesas = mesasData?.length || 0;
  const mesasOcupadas = (mesasData || []).filter((m) =>
    ["ocupada", "cuenta"].includes(m.estado)
  ).length;

  const acumPorTurno = {};
  activos.forEach((p) => agregarPedidoAPorTurno(acumPorTurno, p, horariosRaw));
  const porTurno = porTurnoDesdeAcum(acumPorTurno);

  return {
    pedidosHoy,
    ingresosHoy,
    propinasHoy,
    mesasOcupadas,
    totalMesas,
    pagosCantidad,
    pagosMonto,
    porTurno,
  };
}

/**
 * @param {string} sucursalId
 * @param {object} [filtrosFecha]
 * @param {object} [opcionesTurno] — `filtroTurno`: "" | "todos" | clave de turno (ver `turnosOpciones` en respuesta)
 */
export async function getKpisHoy(sucursalId, filtrosFecha = { rango: "hoy" }, opcionesTurno = {}) {
  const { startDate, endDate } = resolveDateRange(filtrosFecha);
  const filtroTurnoRaw = opcionesTurno.filtroTurno ?? "";
  const filtroTurno =
    filtroTurnoRaw === "todos" || filtroTurnoRaw === "" ? "" : filtroTurnoRaw;

  const { data: sucRow, error: eH } = await supabase
    .from("sucursales")
    .select("horarios")
    .eq("id", sucursalId)
    .maybeSingle();

  if (eH) throw eH;

  const horariosRaw = sucRow?.horarios;
  const horariosOk = horariosUsablesParaTurnos(horariosRaw);
  const turnosOpciones = listarOpcionesTurnoDesdeHorarios(horariosRaw);

  if (!horariosOk) {
    const base = await getKpisSinTurnos(sucursalId, startDate, endDate);
    return {
      ...base,
      turnosOpciones,
      porTurno: [],
      turnosDisponibles: false,
      filtroTurnoActivo: "",
    };
  }

  const datos = await getKpisConHorariosPorTurno(
    sucursalId,
    startDate,
    endDate,
    horariosRaw,
    filtroTurno
  );

  return {
    ...datos,
    turnosOpciones,
    turnosDisponibles: true,
    filtroTurnoActivo: filtroTurno,
  };
}
