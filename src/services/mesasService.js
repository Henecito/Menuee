import { supabase } from "../supabaseClient";

/* =========================
   GET MESAS POR ZONA + SUCURSAL
========================= */
export async function getMesasByZona(sucursalId, zonaId) {
  const { data, error } = await supabase
    .from("mesas")
    .select("*")
    .eq("sucursal_id", sucursalId)   // <- filtro clave
    .eq("zona_id", zonaId)
    .eq("activa", true)
    .order("numero", { ascending: true });

  if (error) throw error;
  return data || [];
}

/* =========================
   CREAR MESA
========================= */
export async function addMesa(sucursalId, zonaId, numero) {
  const { error } = await supabase
    .from("mesas")
    .insert({
      sucursal_id: sucursalId,
      zona_id: zonaId,
      numero,
      activa: true, // recomendable setear explícito
    });

  if (error) throw error;
}

/* =========================
   ELIMINAR (SOFT) + SUCURSAL
========================= */
export async function deleteMesa(id, sucursalId) {
  const { error } = await supabase
    .from("mesas")
    .update({ activa: false })
    .eq("id", id)
    .eq("sucursal_id", sucursalId); // <- evita borrar de otra sucursal

  if (error) throw error;
}

export async function updateMesaEstado(id, sucursalId, estado) {
  const { error } = await supabase
    .from("mesas")
    .update({ estado })
    .eq("id", id)
    .eq("sucursal_id", sucursalId);

  if (error) throw error;
}
