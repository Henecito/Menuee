import { supabase } from "../supabaseClient";

/* =========================
   CREAR PEDIDO
========================= */

export async function createPedido(data) {
  const { data: pedido, error } = await supabase
    .from("pedidos")
    .insert({
      estado: "confirmado", 
      total: 0,
      creado_en: new Date().toISOString(),
      ...data,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creando pedido:", error);
    throw error;
  }

  return pedido;
}

/* =========================
   OBTENER PEDIDOS
========================= */

export async function getPedidosBySucursal(sucursalId, modo) {
  const { data, error } = await supabase
    .from("pedidos")
    .select(`
      *,
      pedido_items (
        id,
        pedido_id,
        producto_id,
        nombre,
        precio,
        cantidad,
        comentario
      )
    `)
    .eq("sucursal_id", sucursalId)
    .eq("modo_entrega", modo)
    .order("creado_en", { ascending: false });

  if (error) {
    console.error("Error obteniendo pedidos:", error);
    throw error;
  }

  return data || [];
}

export async function getPedidosByMesa(sucursalId, mesaId) {
  const { data, error } = await supabase
    .from("pedidos")
    .select(`
      *,
      pedido_items (
        id,
        pedido_id,
        producto_id,
        nombre,
        precio,
        cantidad,
        comentario,
        impreso_cocina_en
      )
    `)
    .eq("sucursal_id", sucursalId)
    .eq("mesa_id", mesaId)
    .order("creado_en", { ascending: false });

  if (error) {
    console.error("Error obteniendo pedidos por mesa:", error);
    throw error;
  }

  return data || [];
}

/* =========================
   CAMBIAR ESTADO PEDIDO
   (soporta metodo_pago y propina)
========================= */

function updateFalloPorColumnaCerradoEn(error) {
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

export async function updatePedidoEstado(id, estado, extra = {}) {
  const estadoNorm = String(estado || "").toLowerCase();
  const payload = { estado, ...extra };
  const estadosCierre = ["entregado", "enviado"];
  if (
    estadosCierre.includes(estadoNorm) &&
    !Object.prototype.hasOwnProperty.call(extra, "cerrado_en")
  ) {
    payload.cerrado_en = new Date().toISOString();
  }

  let { error } = await supabase.from("pedidos").update(payload).eq("id", id);

  if (
    error &&
    updateFalloPorColumnaCerradoEn(error) &&
    Object.prototype.hasOwnProperty.call(payload, "cerrado_en")
  ) {
    const { cerrado_en: _omit, ...sinCerradoEn } = payload;
    const second = await supabase.from("pedidos").update(sinCerradoEn).eq("id", id);
    error = second.error;
  }

  if (error) {
    console.error("Error actualizando estado:", error);
    throw error;
  }
}

/* =========================
   EDITAR PEDIDO
========================= */

export async function updatePedido(id, data) {
  const { error } = await supabase
    .from("pedidos")
    .update(data)
    .eq("id", id);

  if (error) {
    console.error("Error actualizando pedido:", error);
    throw error;
  }
}

/* =========================
   ITEMS PEDIDO
========================= */

export async function updatePedidoItem(id, data) {
  const { error } = await supabase
    .from("pedido_items")
    .update({
      cantidad: data.cantidad,
      comentario: data.comentario,
      precio: data.precio, // precio real cobrado
    })
    .eq("id", id);

  if (error) {
    console.error("Error actualizando item:", error);
    throw error;
  }
}

export async function deletePedidoItem(id) {
  const { error } = await supabase
    .from("pedido_items")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error eliminando item:", error);
    throw error;
  }
}

/* =========================
   AGREGAR ITEM DESDE PRODUCTO
========================= */

export async function addPedidoItemFromProducto(pedidoId, producto) {
  const { error } = await supabase
    .from("pedido_items")
    .insert({
      pedido_id: pedidoId,
      producto_id: producto.producto_id || producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      cantidad: producto.cantidad || 1,
      comentario: producto.comentario || null,
    });

  if (error) {
    console.error("Error agregando item:", error);
    throw error;
  }
}

/* =========================
   COMANDAS COCINA (incremental)
========================= */

export async function marcarPedidoItemsImpresosCocina(itemIds) {
  const ids = [...new Set((itemIds || []).filter(Boolean))];
  if (!ids.length) return;

  const { error } = await supabase
    .from("pedido_items")
    .update({ impreso_cocina_en: new Date().toISOString() })
    .in("id", ids);

  if (error) {
    console.error("Error marcando ítems impresos cocina:", error);
    throw error;
  }
}

/* =========================
   RECALCULAR TOTAL (EDGE FUNCTION)
========================= */

export async function recalcularTotalPedidoEdge(pedidoId) {
  const { data, error } = await supabase.functions.invoke("total", {
    body: { pedido_id: pedidoId },
  });

  if (error) {
    console.error("Error recalculando total:", error);
    throw error;
  }

  return data?.total || 0;
}

/* =========================
   COCINA
========================= */

export async function getPedidosCocina(sucursalId, filtro = "retiro_delivery") {
  let query = supabase
    .from("pedidos")
    .select(`
      id,
      estado,
      cliente_nombre,
      modo_entrega,
      pedido_items (
        id,
        nombre,
        cantidad,
        comentario
      )
    `)
    .eq("sucursal_id", sucursalId)
    .eq("estado", "confirmado");

  if (filtro === "solo_mesas") {
    query = query.eq("modo_entrega", "mesa");
  } else {
    query = query.in("modo_entrega", ["retiro", "domicilio"]);
  }

  const { data, error } = await query.order("creado_en", { ascending: true });

  if (error) {
    console.error("Error obteniendo pedidos cocina:", error);
    throw error;
  }

  return data || [];
}
