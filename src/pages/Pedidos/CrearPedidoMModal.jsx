import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { useSucursal } from "../../context/SucursalContext";
import { getProductos } from "../../services/productosService";
import {
  createPedido,
  addPedidoItemFromProducto,
  recalcularTotalPedidoEdge,
  getPedidosByMesa,
} from "../../services/pedidosService";
import { imprimirPreCuentaMesa } from "../../utils/imprimirPreCuentaMesa";
import { imprimirComandasMesa } from "../../utils/imprimirComandasMesa";
import { pingComandaBridge } from "../../utils/comandaPrintClient";
import { trace, traceReturn, traceError } from "../../utils/comandaTrace";
import {
  puedeImprimirPrecuentas,
  puedeImprimirComandas,
} from "../../utils/impresionPermisos";
import "../../styles/pedidoEditor.css";

function aggregateProductosMesa(pedidosActivos) {
  const map = new Map();
  for (const pedido of pedidosActivos || []) {
    for (const it of pedido.pedido_items || []) {
      const key =
        it.producto_id != null && it.producto_id !== ""
          ? `id:${it.producto_id}`
          : `n:${String(it.nombre || "").trim().toLowerCase()}`;
      const cant = Number(it.cantidad) || 0;
      const precio = Number(it.precio) || 0;
      const sub = cant * precio;
      const cur = map.get(key);
      if (!cur) {
        map.set(key, {
          key,
          nombre: it.nombre || "Producto",
          cantidad: cant,
          subtotal: sub,
          comentarios: it.comentario ? [it.comentario] : [],
        });
      } else {
        cur.cantidad += cant;
        cur.subtotal += sub;
        if (it.comentario) {
          cur.comentarios.push(it.comentario);
        }
      }
    }
  }
  return Array.from(map.values()).map((row) => ({
    ...row,
    comentarios: Array.from(new Set(row.comentarios || [])),
  }));
}

export default function CrearPedidoModal({
  onClose,
  onCreated,
  pedidoOverrides = {},
  titulo = "Nuevo pedido",
  clientePlaceholder = "Opcional",
  mesaFlow = null,
}) {
  const { sucursalActiva, permisos, rol } = useSucursal();
  const permitirPrecuenta = puedeImprimirPrecuentas(permisos, rol);
  const permitirComandas = puedeImprimirComandas(permisos, rol);

  const [cliente, setCliente] = useState("");
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);

  /* ===== cargar carta ===== */
  useEffect(() => {
    async function loadProductos() {
      if (!sucursalActiva) return;
      try {
        const data = await getProductos(sucursalActiva.id);
        setProductos(data);
      } catch (e) {
        console.error(e);
      }
    }

    loadProductos();
  }, [sucursalActiva]);

  /* ===== agregar producto ===== */
  function addItem(producto) {
    setItems((prev) => [
      ...prev,
      {
        id: "new-" + Date.now(),
        producto_id: producto.id,
        nombre: producto.nombre,
        precio: producto.precio,
        cantidad: 1,
        comentario: "",
      },
    ]);
    setBusqueda("");
  }

  function updateItem(id, field, value) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const productosFiltrados = productos
    .filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    .slice(0, 8);

  /* ===== TOTAL ===== */
  const total = items.reduce(
    (acc, i) => acc + Number(i.precio) * Number(i.cantidad),
    0
  );

  const productosMesaAgregados = useMemo(
    () => aggregateProductosMesa(mesaFlow?.pedidosActivos),
    [mesaFlow?.pedidosActivos]
  );

  async function handleImprimirCuenta() {
    if (!mesaFlow) return;

    if (!permitirPrecuenta) {
      return;
    }

    const tieneConsumo =
      (mesaFlow.pedidosActivos || []).length > 0 &&
      Number(mesaFlow.totalMesa || 0) > 0;

    if (!tieneConsumo) {
      Swal.fire(
        "Sin consumo",
        "No hay productos en la mesa para imprimir la cuenta.",
        "warning"
      );
      return;
    }

    if (imprimiendo) return;

    setImprimiendo(true);
    try {
      await imprimirPreCuentaMesa({
        restaurante: sucursalActiva?.nombre || "RESTAURANTE",
        mesaNumero: mesaFlow.mesaNumero,
        pedidosActivos: mesaFlow.pedidosActivos,
        totalMesa: mesaFlow.totalMesa,
        configTicket: sucursalActiva,
      });
    } catch (e) {
      console.error("[pre-cuenta]", e);
      Swal.fire(
        "Error de impresión",
        e?.message || "No se pudo imprimir la cuenta. Intentá de nuevo.",
        "error"
      );
    } finally {
      setImprimiendo(false);
    }
  }

  /* ===== CREAR PEDIDO ===== */
  async function guardar() {
    trace("save triggered", {
      itemsEnCarrito: items.length,
      pedidoOverrides,
      mesaFlow: mesaFlow
        ? { mesaNumero: mesaFlow.mesaNumero, tienePedidosActivos: !!mesaFlow.pedidosActivos }
        : null,
      bridgeEnv: process.env.REACT_APP_COMANDA_PRINT_URL ?? "(undefined en bundle)",
    });

    if (items.length === 0) {
      traceReturn("guardar", "carrito vacío");
      return Swal.fire("Pedido vacío", "Agrega productos", "warning");
    }

    setLoading(true);

    try {
      // 1. crear pedido
      const pedido = await createPedido({
        sucursal_id: sucursalActiva.id,
        cliente_nombre: cliente || "Cliente presencial",
        modo_entrega: "retiro",
        estado: "confirmado",
        ...pedidoOverrides,
      });

      // 2. insertar items
      for (const item of items) {
        await addPedidoItemFromProducto(pedido.id, item);
      }

      // 3. recalcular total
      await recalcularTotalPedidoEdge(pedido.id);

      const esPedidoMesa = Boolean(pedidoOverrides?.mesa_id);
      trace("evaluación mesa tras crear pedido", {
        esPedidoMesa,
        mesa_id: pedidoOverrides?.mesa_id,
        modo_entrega: pedidoOverrides?.modo_entrega,
        mesaNumero: mesaFlow?.mesaNumero,
        pedidoId: pedido?.id,
      });

      if (!esPedidoMesa) {
        traceReturn(
          "guardar",
          "NO es pedido de mesa (falta pedidoOverrides.mesa_id) — comandas omitidas"
        );
      } else {
        const mesaNumero =
          mesaFlow?.mesaNumero ??
          pedidoOverrides.mesa_numero ??
          null;

        if (mesaNumero == null || mesaNumero === "") {
          traceReturn(
            "guardar",
            "pedido mesa sin mesaNumero — pasá mesaFlow={{ mesaNumero: N }}"
          );
        } else if (!permitirComandas) {
          traceReturn(
            "guardar",
            "sin permiso permisos.impresion.comandas — comandas omitidas"
          );
        } else {
          try {
            trace("ping bridge antes de imprimir…");
            await pingComandaBridge();

            trace("cargando pedidos de mesa para comandas…", {
              sucursalId: sucursalActiva.id,
              mesa_id: pedidoOverrides.mesa_id,
            });

            const pedidosMesa = await getPedidosByMesa(
              sucursalActiva.id,
              pedidoOverrides.mesa_id
            );

            const pedidosActivos = (pedidosMesa || []).filter(
              (p) => p.estado !== "cancelado" && p.estado !== "entregado"
            );

            trace("pedidos mesa obtenidos", {
              total: pedidosMesa?.length,
              activos: pedidosActivos.length,
            });

            const categoriaPorProductoId = new Map(
              productos.map((p) => [p.id, (p.categoria || "").trim()])
            );

            trace("llamando imprimirComandasMesa…");
            await imprimirComandasMesa({
              mesaNumero,
              pedidosActivos,
              categoriaPorProductoId,
              sucursalId: sucursalActiva.id,
            });
            trace("imprimirComandasMesa terminó OK");
          } catch (printErr) {
            traceError("guardar — bloque comandas", printErr);
          }
        }
      }

      await Swal.fire({
        title: "Pedido creado",
        icon: "success",
        timer: 900,
        showConfirmButton: false,
      });

      setItems([]);
      setBusqueda("");
      onCreated(pedido);
    } catch (e) {
      traceError("guardar — catch general", e);
      Swal.fire("Error", "No se pudo crear el pedido", "error");
    } finally {
      setLoading(false);
    }
  }

  /* ===== UI ===== */

  return (
    <div className="pem-backdrop">
      <div className="pem-card">

        {/* HEADER */}
        <div className="pem-header">
          <h3>{titulo}</h3>
          <button className="pem-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* CLIENTE */}
        <div className="pem-section">
          <label>Nombre del cliente</label>
          <input
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            placeholder={clientePlaceholder}
          />
        </div>

        {/* BUSCADOR PRODUCTO */}
        <div className="pem-section">
          <label>Agregar producto</label>
          <input
            placeholder="Buscar producto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          {busqueda && productosFiltrados.length > 0 && (
            <div className="pem-product-results">
              {productosFiltrados.map((p) => (
                <div
                  key={p.id}
                  className="pem-product-result"
                  onClick={() => addItem(p)}
                >
                  <span>{p.nombre}</span>
                  <strong>${p.precio}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PEDIDO ACTUAL */}
        <div className="pem-section">
          <h4>Pedido actual</h4>

          {items.map((item) => (
            <div key={item.id} className="pem-item">
              <input value={item.nombre} disabled />

              <input
                type="number"
                value={item.precio}
                onChange={(e) =>
                  updateItem(item.id, "precio", Number(e.target.value))
                }
              />

              <input
                type="number"
                value={item.cantidad}
                onChange={(e) =>
                  updateItem(item.id, "cantidad", Number(e.target.value))
                }
              />

              <input
                placeholder="Comentario"
                value={item.comentario}
                onChange={(e) =>
                  updateItem(item.id, "comentario", e.target.value)
                }
              />

              <button
                className="pem-delete"
                onClick={() => removeItem(item.id)}
              >
                🗑
              </button>
            </div>
          ))}

          {items.length === 0 && (
            <p className="pem-empty">Sin productos</p>
          )}
        </div>

        {/* TOTAL */}
        <div className="pem-total-preview">
          Total pedido actual: <strong>${total.toLocaleString()}</strong>
        </div>

        {mesaFlow && (
          <div className="pem-section">
            <label>Consumo de la mesa</label>
            <div className="pem-product-results pem-mesa-productos-list">
              {productosMesaAgregados.length === 0 && (
                <div className="pem-product-result pem-mesa-producto-line">
                  <span>Sin productos en la mesa</span>
                </div>
              )}
              {productosMesaAgregados.map((row) => (
                <div
                  key={row.key}
                  className="pem-product-result pem-mesa-producto-line"
                >
                  <div>
                    <span>
                      {row.cantidad}x {row.nombre}
                    </span>
                    {(row.comentarios || []).map((c, idx) => (
                      <div key={`${row.key}-c-${idx}`} className="pem-mesa-comentario">
                        {c}
                      </div>
                    ))}
                  </div>
                  <strong>${Number(row.subtotal || 0).toLocaleString("es-CL")}</strong>
                </div>
              ))}
            </div>
            <div className="pem-total-preview">
              Total mesa:{" "}
              <strong>
                ${Number(mesaFlow.totalMesa || 0).toLocaleString("es-CL")}
              </strong>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="pem-footer">
          <button
            className={mesaFlow ? "pem-danger" : "pem-cancel"}
            onClick={onClose}
          >
            Cancelar
          </button>

          {mesaFlow && permitirPrecuenta && (
            <button
              type="button"
              className="pem-print"
              onClick={handleImprimirCuenta}
              disabled={loading || imprimiendo}
            >
              <i className="fa-solid fa-print" aria-hidden="true" />{" "}
              {imprimiendo ? "Imprimiendo…" : "Imprimir cuenta"}
            </button>
          )}

          {mesaFlow && (
            <button
              className="pem-danger"
              onClick={mesaFlow.onAbrirCierreModal}
              disabled={loading || imprimiendo}
            >
              Cerrar mesa
            </button>
          )}

          <button
            className={mesaFlow ? "pem-positive" : "pem-save"}
            onClick={guardar}
            disabled={loading}
          >
            {loading ? "Guardando..." : mesaFlow ? "Guardar pedido" : "Crear pedido"}
          </button>
        </div>
      </div>
    </div>
  );
}
