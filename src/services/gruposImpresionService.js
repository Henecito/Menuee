import { supabase } from "../supabaseClient";

/* ========= GRUPOS DE IMPRESIÓN ========= */

export async function getGruposImpresion(sucursalId) {
  const { data, error } = await supabase
    .from("grupos_impresion")
    .select("*")
    .eq("sucursal_id", sucursalId)
    .order("nombre", { ascending: true });

  if (error) {
    console.error("Error al obtener grupos de impresión:", error);
    throw error;
  }

  return data || [];
}

export async function createGrupoImpresion(sucursalId, nombre) {
  const { data, error } = await supabase
    .from("grupos_impresion")
    .insert({
      sucursal_id: sucursalId,
      nombre: nombre.trim(),
      activo: true,
    })
    .select()
    .single();

  if (error) {
    console.error("Error al crear grupo de impresión:", error);
    throw error;
  }

  return data;
}

export async function updateGrupoImpresion(id, updates) {
  const { data, error } = await supabase
    .from("grupos_impresion")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error al actualizar grupo de impresión:", error);
    throw error;
  }

  return data;
}

export async function deleteGrupoImpresion(id) {
  const { error } = await supabase.from("grupos_impresion").delete().eq("id", id);

  if (error) {
    console.error("Error al eliminar grupo de impresión:", error);
    throw error;
  }
}

/* ========= ASIGNACIÓN POR CATEGORÍA ========= */

/** @returns {Promise<Record<string, { id: number, nombre: string, activo: boolean }>>} */
export async function getMapaCategoriaGrupoImpresion(sucursalId) {
  const [grupos, asignaciones] = await Promise.all([
    getGruposImpresion(sucursalId),
    getAsignacionesCategorias(sucursalId),
  ]);

  const porId = {};
  for (const g of grupos) {
    porId[g.id] = g;
  }

  const mapa = {};
  for (const a of asignaciones) {
    const grupo = porId[a.grupo_impresion_id];
    if (grupo) {
      mapa[a.categoria] = grupo;
    }
  }

  return mapa;
}

export async function getAsignacionesCategorias(sucursalId) {
  const { data, error } = await supabase
    .from("categorias_grupos_impresion")
    .select("*")
    .eq("sucursal_id", sucursalId);

  if (error) {
    console.error("Error al obtener asignaciones categoría-grupo:", error);
    throw error;
  }

  return data || [];
}

export async function upsertAsignacionCategoria(sucursalId, categoria, grupoImpresionId) {
  const { data, error } = await supabase
    .from("categorias_grupos_impresion")
    .upsert(
      {
        sucursal_id: sucursalId,
        categoria,
        grupo_impresion_id: grupoImpresionId,
      },
      { onConflict: "sucursal_id,categoria" }
    )
    .select()
    .single();

  if (error) {
    console.error("Error al guardar asignación categoría-grupo:", error);
    throw error;
  }

  return data;
}

export async function getCategoriasProductos(sucursalId) {
  const { data, error } = await supabase
    .from("productos")
    .select("categoria")
    .eq("sucursal_id", sucursalId)
    .not("categoria", "is", null);

  if (error) {
    console.error("Error al obtener categorías de productos:", error);
    throw error;
  }

  const unicas = [
    ...new Set(
      (data || [])
        .map((r) => (r.categoria || "").trim())
        .filter(Boolean)
    ),
  ];

  return unicas.sort((a, b) => a.localeCompare(b, "es"));
}

export async function deleteAsignacionCategoria(sucursalId, categoria) {
  const { error } = await supabase
    .from("categorias_grupos_impresion")
    .delete()
    .eq("sucursal_id", sucursalId)
    .eq("categoria", categoria);

  if (error) {
    console.error("Error al quitar asignación categoría-grupo:", error);
    throw error;
  }
}
