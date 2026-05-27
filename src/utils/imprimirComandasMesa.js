/**
 * Comandas cocina/barra por grupo de impresión (incremental: solo pedido_items con impreso_cocina_en NULL).
 */

import { getMapaCategoriaGrupoImpresion } from "../services/gruposImpresionService";
import { marcarPedidoItemsImpresosCocina } from "../services/pedidosService";
import { enviarComandaSilenciosa } from "./comandaPrintClient";
import { trace, traceReturn, traceError } from "./comandaTrace";

const SIN_GRUPO_KEY = "__sin_grupo__";
const SIN_GRUPO_LABEL = "SIN GRUPO";

function fmtFechaHora(date = new Date()) {
  return date.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Solo ítems pendientes de comanda (impreso_cocina_en IS NULL). */
function flattenItemsPendientesImpresion(pedidosActivos = []) {
  const items = [];

  for (const pedido of pedidosActivos) {
    if (pedido.estado === "cancelado" || pedido.estado === "entregado") {
      continue;
    }

    for (const it of pedido.pedido_items || []) {
      if (it.impreso_cocina_en) continue;

      const cantidad = Number(it.cantidad) || 0;
      if (cantidad <= 0) continue;

      items.push({
        pedidoItemId: it.id,
        nombre: it.nombre || "Producto",
        cantidad,
        comentario: (it.comentario || "").trim(),
        producto_id: it.producto_id,
      });
    }
  }

  return items;
}

function resolverCategoria(item, categoriaPorProductoId) {
  if (!categoriaPorProductoId) return "";

  if (categoriaPorProductoId instanceof Map) {
    return (categoriaPorProductoId.get(item.producto_id) || "").trim();
  }

  return (categoriaPorProductoId[item.producto_id] || "").trim();
}

function agruparItemsPorGrupo(items, mapaCategoriaGrupo, categoriaPorProductoId) {
  const buckets = new Map();

  for (const item of items) {
    const categoria = resolverCategoria(item, categoriaPorProductoId);
    const grupo = mapaCategoriaGrupo[categoria];
    const key = grupo ? String(grupo.id) : SIN_GRUPO_KEY;
    const label = grupo ? grupo.nombre : SIN_GRUPO_LABEL;

    if (!buckets.has(key)) {
      buckets.set(key, { key, label, lineas: [] });
    }

    buckets.get(key).lineas.push(item);
  }

  return Array.from(buckets.values()).sort((a, b) => {
    if (a.key === SIN_GRUPO_KEY) return 1;
    if (b.key === SIN_GRUPO_KEY) return -1;
    return a.label.localeCompare(b.label, "es");
  });
}

function consolidarLineas(lineas) {
  const map = new Map();

  for (const item of lineas) {
    const key =
      item.producto_id != null && item.producto_id !== ""
        ? `id:${item.producto_id}`
        : `n:${String(item.nombre || "").trim().toLowerCase()}`;
    const cur = map.get(key);

    if (!cur) {
      map.set(key, {
        nombre: item.nombre,
        cantidad: item.cantidad,
        comentario: item.comentario || "",
        producto_id: item.producto_id,
        pedidoItemIds: item.pedidoItemId ? [item.pedidoItemId] : [],
      });
      continue;
    }

    cur.cantidad += item.cantidad;
    if (item.pedidoItemId) {
      cur.pedidoItemIds.push(item.pedidoItemId);
    }
    if (item.comentario && item.comentario !== cur.comentario) {
      cur.comentario = [cur.comentario, item.comentario]
        .filter(Boolean)
        .join(" · ");
    }
  }

  return Array.from(map.values());
}

function buildTicketPayload({ grupoNombre, mesaNumero, fechaHora, lineas }) {
  return {
    titulo: `COMANDA - ${String(grupoNombre || "").toUpperCase()}`,
    mesaNumero: String(mesaNumero),
    fechaHora,
    lineas: (lineas || []).map((row) => ({
      cantidad: row.cantidad,
      nombre: row.nombre,
      comentario: row.comentario || "",
    })),
  };
}

/**
 * Imprime comandas solo de ítems nuevos (impreso_cocina_en NULL) y los marca tras éxito.
 */
export async function imprimirComandasMesa({
  mesaNumero,
  pedidosActivos = [],
  categoriaPorProductoId,
  sucursalId,
  mapaCategoriaGrupo: mapaPrecargado,
}) {
  trace("imprimirComandasMesa — inicio (incremental)", {
    mesaNumero,
    pedidosCount: pedidosActivos?.length ?? 0,
    sucursalId,
  });

  const items = flattenItemsPendientesImpresion(pedidosActivos);
  trace("productos pendientes de comanda (impreso_cocina_en NULL)", {
    count: items.length,
    items: items.map((i) => ({
      id: i.pedidoItemId,
      linea: `${i.cantidad}x ${i.nombre}`,
    })),
  });

  if (!items.length) {
    traceReturn(
      "imprimirComandasMesa",
      "sin ítems nuevos para imprimir (todos ya tienen impreso_cocina_en)"
    );
    return { impresos: 0, itemIds: [] };
  }

  if (mesaNumero == null || mesaNumero === "") {
    traceReturn("imprimirComandasMesa", "mesaNumero vacío");
    throw new Error("[comandas] mesaNumero vacío");
  }

  let mapaCategoriaGrupo = mapaPrecargado;
  try {
    mapaCategoriaGrupo =
      mapaPrecargado || (await getMapaCategoriaGrupoImpresion(sucursalId));
  } catch (err) {
    traceError("imprimirComandasMesa — getMapaCategoriaGrupoImpresion", err);
    throw err;
  }

  const grupos = agruparItemsPorGrupo(
    items,
    mapaCategoriaGrupo,
    categoriaPorProductoId
  );

  trace("grupos generados (solo ítems nuevos)", {
    count: grupos.length,
    grupos: grupos.map((g) => ({
      label: g.label,
      lineas: g.lineas.length,
    })),
  });

  if (!grupos.length) {
    traceReturn("imprimirComandasMesa", "agrupación devolvió 0 grupos");
    return { impresos: 0, itemIds: [] };
  }

  const fechaHora = fmtFechaHora();
  const itemIdsParaMarcar = new Set();
  let comandasEnviadas = 0;

  for (const grupo of grupos) {
    const lineasConsolidadas = consolidarLineas(grupo.lineas);
    const ticket = buildTicketPayload({
      grupoNombre: grupo.label,
      mesaNumero,
      fechaHora,
      lineas: lineasConsolidadas,
    });

    trace(`enviando comanda incremental grupo "${grupo.label}"`, ticket);

    try {
      await enviarComandaSilenciosa({
        grupo: grupo.label,
        ticket,
      });
      comandasEnviadas += 1;

      for (const linea of lineasConsolidadas) {
        for (const id of linea.pedidoItemIds || []) {
          itemIdsParaMarcar.add(id);
        }
      }
    } catch (err) {
      traceError(`imprimirComandasMesa — grupo "${grupo.label}"`, err);
      throw err;
    }
  }

  const itemIds = [...itemIdsParaMarcar];
  trace("marcando ítems como impresos cocina", { itemIds });

  try {
    await marcarPedidoItemsImpresosCocina(itemIds);
  } catch (err) {
    traceError("imprimirComandasMesa — marcarPedidoItemsImpresosCocina", err);
    throw err;
  }

  trace("imprimirComandasMesa — fin OK incremental", {
    comandasEnviadas,
    itemsMarcados: itemIds.length,
  });

  return { impresos: comandasEnviadas, itemIds };
}
