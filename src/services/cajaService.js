import { supabase } from "../supabaseClient";

const TABLA_CAJAS = "cajas";
const TABLA_MOV = "movimientos_caja";

export async function getCajaActiva(sucursal_id) {
  if (sucursal_id == null || sucursal_id === "") {
    return null;
  }

  const { data, error } = await supabase
    .from(TABLA_CAJAS)
    .select("*")
    .eq("sucursal_id", sucursal_id)
    .eq("estado", "abierta")
    .maybeSingle();

  console.log("getCajaActiva — sucursal_id:", sucursal_id, "data:", data, "error:", error);

  if (error) throw error;

  return data ?? null;
}

export async function getMovimientosPorCaja(caja_id) {
  if (caja_id == null || caja_id === "") {
    return [];
  }

  const { data, error } = await supabase
    .from(TABLA_MOV)
    .select("*")
    .eq("caja_id", caja_id)
    .order("id", { ascending: false });

  if (error) throw error;

  return data || [];
}

export async function abrirCaja({
  local_id,
  sucursal_id,
  usuario_id,
  monto_apertura,
}) {
  const payload = {
    local_id,
    sucursal_id,
    usuario_id,
    monto_apertura: Number(monto_apertura || 0),
    estado: "abierta",
  };

  const { data, error } = await supabase
    .from(TABLA_CAJAS)
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function registrarMovimiento({
  caja_id,
  tipo,
  monto,
  descripcion,
}) {
  const row = {
    caja_id,
    tipo,
    monto: Number(monto || 0),
    descripcion: descripcion || "",
  };

  const { data, error } = await supabase
    .from(TABLA_MOV)
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function cerrarCaja({ caja_id, monto_cierre }) {
  const { data, error } = await supabase
    .from(TABLA_CAJAS)
    .update({
      estado: "cerrada",
      monto_cierre: Number(monto_cierre ?? 0),
      cerrada_en: new Date().toISOString(),
    })
    .eq("id", caja_id)
    .eq("estado", "abierta")
    .select()
    .single();

  if (error) throw error;
  return data;
}
