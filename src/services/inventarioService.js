import { supabase } from "../supabaseClient";

const TABLA = "inventario";

function isTablaNoExiste(error) {
  return error?.code === "42P01";
}

export async function getInventario(sucursalId) {
  const { data, error } = await supabase
    .from(TABLA)
    .select("*")
    .eq("sucursal_id", sucursalId)
    .order("nombre", { ascending: true });

  if (error) {
    if (isTablaNoExiste(error)) {
      return { data: [], setupPendiente: true };
    }
    throw error;
  }

  return { data: data || [], setupPendiente: false };
}

export async function crearItemInventario(payload) {
  const { data, error } = await supabase
    .from(TABLA)
    .insert({
      nombre: payload.nombre,
      cantidad: payload.cantidad,
      unidad_control: payload.unidad_control,
      sucursal_id: payload.sucursal_id,
      actualizado_en: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function actualizarItemInventario(id, payload) {
  const { data, error } = await supabase
    .from(TABLA)
    .update({
      nombre: payload.nombre,
      cantidad: payload.cantidad,
      unidad_control: payload.unidad_control,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("sucursal_id", payload.sucursal_id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function eliminarItemInventario(id, sucursalId) {
  const { error } = await supabase
    .from(TABLA)
    .delete()
    .eq("id", id)
    .eq("sucursal_id", sucursalId);
  if (error) throw error;
}

