import { supabase } from "../supabaseClient";

const TABLA_CAJAS = "cajas";
const TABLA_MOV = "movimientos_caja";

const LIMITE = 20;
const BATCH = 80;

function sumPorTipo(movs, tipo) {
  const t = (tipo || "").toLowerCase();
  return (movs || []).reduce((acc, m) => {
    if ((m.tipo || "").toLowerCase() === t) {
      return acc + Number(m.monto || 0);
    }
    return acc;
  }, 0);
}

function fechaAperturaSort(c) {
  const raw = c.fecha_apertura || c.abierta_en || c.created_at || c.apertura_en;
  const ms = raw ? new Date(raw).getTime() : 0;
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Cajas cerradas de la sucursal con totales por tipo (movimientos_caja).
 * Orden: fecha_apertura (o equivalentes) descendente; máximo LIMITE filas.
 */
export async function getHistorialCajas(sucursal_id) {
  if (sucursal_id == null || sucursal_id === "") {
    return [];
  }

  const { data: cajasRaw, error: e1 } = await supabase
    .from(TABLA_CAJAS)
    .select("*")
    .eq("sucursal_id", sucursal_id)
    .eq("estado", "cerrada")
    .limit(BATCH);

  if (e1) throw e1;

  const cajasOrdenadas = [...(cajasRaw || [])]
    .sort((a, b) => fechaAperturaSort(b) - fechaAperturaSort(a))
    .slice(0, LIMITE);

  if (cajasOrdenadas.length === 0) {
    return [];
  }

  const ids = cajasOrdenadas.map((c) => c.id);
  const { data: movsRaw, error: e2 } = await supabase
    .from(TABLA_MOV)
    .select("*")
    .in("caja_id", ids);

  if (e2) throw e2;

  const byCajaId = {};
  (movsRaw || []).forEach((m) => {
    const cid = m.caja_id;
    if (!byCajaId[cid]) byCajaId[cid] = [];
    byCajaId[cid].push(m);
  });

  return cajasOrdenadas.map((caja) => {
    const movimientos = byCajaId[caja.id] || [];
    const total_ventas = sumPorTipo(movimientos, "venta");
    const total_ingresos = sumPorTipo(movimientos, "ingreso");
    const total_retiros = sumPorTipo(movimientos, "retiro");

    return {
      ...caja,
      movimientos,
      total_ventas,
      total_ingresos,
      total_retiros,
    };
  });
}
