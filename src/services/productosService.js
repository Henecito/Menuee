import { supabase } from "../supabaseClient";

/* ========= OBTENER SOLO ACTIVOS ========= */

export async function getProductos(sucursalId) {
  const { data, error } = await supabase
    .from("productos")
    .select("*")
    .eq("activo", true)
    .eq("sucursal_id", sucursalId)
    .order("id", { ascending: false });

  if (error) {
    console.error("Error al obtener productos:", error);
    throw error;
  }

  return data || [];
}

/* ========= OBTENER TODOS ========= */

export async function getTodosProductos(sucursalId) {
  const { data, error } = await supabase
    .from("productos")
    .select("*")
    .eq("sucursal_id", sucursalId)
    .order("id", { ascending: false });

  if (error) {
    console.error("Error al obtener todos los productos:", error);
    throw error;
  }

  return data || [];
}

/* ========= CREAR ========= */

export async function addProducto({
  nombre,
  descripcion = null,
  precio,
  categoria = null,
  sucursal_id = null,
  activo = true,
}) {
  const { data, error } = await supabase
    .from("productos")
    .insert([
      {
        nombre,
        descripcion,
        precio,
        categoria,
        sucursal_id,
        activo,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error al crear producto:", error);
    throw error;
  }

  return data;
}

/* ========= CREAR MASIVO (NUEVO) ========= */

export async function addProductosBatch(productos) {
  const payload = productos.map((p) => ({
    ...p,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from("productos")
    .insert(payload);

  if (error) {
    console.error("Error al insertar productos en lote:", error);
    throw error;
  }

  return data;
}

/* ========= EDITAR ========= */

export async function updateProducto(id, updates) {
  const { data, error } = await supabase
    .from("productos")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error al actualizar producto:", error);
    throw error;
  }

  return data;
}

/* ========= DESACTIVAR ========= */

export async function deleteProducto(id) {
  const { error } = await supabase
    .from("productos")
    .update({
      activo: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Error al desactivar producto:", error);
    throw error;
  }
}
