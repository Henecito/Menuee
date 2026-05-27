import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { useSucursal } from "../../context/SucursalContext";
import { getProductos } from "../../services/productosService";
import {
  updatePedido,
  updatePedidoItem,
  deletePedidoItem,
  addPedidoItemFromProducto,
  recalcularTotalPedidoEdge,
} from "../../services/pedidosService";
import "../../styles/pedidoEditor.css";

export default function PedidoEditorModal({ pedido, onClose, onSaved }) {
  const { sucursalActiva } = useSucursal();

  const [nombre, setNombre] = useState("");
  const [items, setItems] = useState([]);
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(false);

  /* ===== cargar pedido ===== */
  useEffect(() => {
    if (!pedido) return;

    setNombre(pedido.cliente_nombre || "");

    setItems(
      (pedido.pedido_items || []).map((i) => ({
        ...i,
        _action: "keep",
      }))
    );
  }, [pedido]);

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

  /* ===== lógica ===== */

  function updateItem(id, field, value) {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              [field]: value,
              _action: i._action === "new" ? "new" : "update",
            }
          : i
      )
    );
  }

  function removeItem(id) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, _action: "delete" } : i))
    );
  }

  function addItemFromProducto(producto) {
    setItems((prev) => [
      ...prev,
      {
        id: "new-" + Date.now(),
        producto_id: producto.id,
        nombre: producto.nombre,
        precio: producto.precio,
        cantidad: 1,
        comentario: "",
        _action: "new",
      },
    ]);

    setBusqueda("");
  }

  const productosFiltrados = productos
    .filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    .slice(0, 8);

  /* ===== TOTAL EN VIVO ===== */

  const totalEnVivo = items
    .filter((i) => i._action !== "delete")
    .reduce((acc, i) => acc + Number(i.precio) * Number(i.cantidad), 0);

  /* ===== guardar ===== */

  async function guardar() {
    if (loading) return;

    if (items.filter((i) => i._action !== "delete").length === 0) {
      return Swal.fire(
        "Pedido vacío",
        "Debe haber al menos un producto",
        "warning"
      );
    }

    setLoading(true);

    try {
      // 1. actualizar cabecera
      await updatePedido(pedido.id, {
        cliente_nombre: nombre || null,
      });

      // 2. procesar items
      for (const item of items) {
        if (item._action === "update") {
          await updatePedidoItem(item.id, item);
        }

        if (item._action === "delete") {
          await deletePedidoItem(item.id);
        }

        if (item._action === "new") {
          await addPedidoItemFromProducto(pedido.id, item);
        }
      }

      // 3. recalcular total oficial (edge function)
      await recalcularTotalPedidoEdge(pedido.id);

      await Swal.fire({
        title: "Pedido actualizado",
        icon: "success",
        timer: 900,
        showConfirmButton: false,
      });

      onSaved();
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "No se pudo guardar el pedido", "error");
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
          <h3>Editar pedido #{pedido.id}</h3>
          <button className="pem-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* DATOS */}
        <div className="pem-section">
          <label>Nombre del cliente</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Juan Pérez"
          />
        </div>

        {/* BUSCADOR */}
        <div className="pem-section">
          <label>Agregar producto</label>
          <input
            className="pem-product-search"
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
                  onClick={() => addItemFromProducto(p)}
                >
                  <span>{p.nombre}</span>
                  <strong>${p.precio}</strong>
                </div>
              ))}
            </div>
          )}

          {busqueda && productosFiltrados.length === 0 && (
            <div className="pem-product-noresults">Sin resultados</div>
          )}
        </div>

        {/* ITEMS */}
        <div className="pem-section">
          <h4>Productos del pedido</h4>

          {items
            .filter((i) => i._action !== "delete")
            .map((item) => (
              <div key={item.id} className="pem-item">
                <input
                  className="pem-item-nombre"
                  value={item.nombre}
                  disabled
                />

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="pem-item-precio"
                  value={item.precio}
                  onChange={(e) =>
                    updateItem(item.id, "precio", Number(e.target.value))
                  }
                />

                <input
                  type="number"
                  min="1"
                  className="pem-item-cantidad"
                  value={item.cantidad}
                  onChange={(e) =>
                    updateItem(item.id, "cantidad", Number(e.target.value))
                  }
                />

                <input
                  className="pem-item-comentario"
                  placeholder="Comentario"
                  value={item.comentario || ""}
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

          {items.filter((i) => i._action !== "delete").length === 0 && (
            <p className="pem-empty">Sin productos</p>
          )}
        </div>

        {/* TOTAL EN VIVO */}
        <div className="pem-total-preview">
          Total actual: <strong>${totalEnVivo.toLocaleString()}</strong>
        </div>

        {/* FOOTER */}
        <div className="pem-footer">
          <button className="pem-cancel" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button className="pem-save" onClick={guardar} disabled={loading}>
            {loading ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
