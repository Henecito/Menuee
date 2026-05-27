import { supabase } from "../supabaseClient";

export async function getZonasBySucursal(sucursalId) {
  const { data, error } = await supabase
    .from("zonas_local")
    .select("*")
    .eq("sucursal_id", sucursalId)
    .eq("activa", true)
    .order("orden", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function addZona(sucursalId, nombre) {
  const { error } = await supabase
    .from("zonas_local")
    .insert({
      sucursal_id: sucursalId,
      nombre,
    });

  if (error) throw error;
}

export async function deleteZona(id) {
  const { error } = await supabase
    .from("zonas_local")
    .update({ activa: false })
    .eq("id", id);

  if (error) throw error;
}
