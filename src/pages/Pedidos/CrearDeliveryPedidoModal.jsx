import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { useSucursal } from "../../context/SucursalContext";
import { getProductos } from "../../services/productosService";
import {
  createPedido,
  addPedidoItemFromProducto,
  recalcularTotalPedidoEdge,
} from "../../services/pedidosService";
import "../../styles/pedidoEditor.css";

export default function CrearDeliveryPedidoModal({ onClose, onCreated }) {
  const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
  const { sucursalActiva } = useSucursal();

  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);

  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sugerenciasDireccion, setSugerenciasDireccion] = useState([]);

  /* ================= GEOCODE FALLBACK ================= */

  async function geocodeDireccion(dir) {
    if (!dir || !MAPBOX_TOKEN) return false;

    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          dir,
        )}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=1&country=cl&language=es`,
      );
      const data = await res.json();

      if (data.features?.[0]) {
        const feature = data.features[0];
        const [lng, latitude] = feature.center || [];
        setLat(latitude);
        setLon(lng);
        setDireccion(feature.place_name || dir);
        return true;
      }
      return false;
    } catch (e) {
      console.error("Geocode error:", e);
      return false;
    }
  }

  /* ================= AUTOCOMPLETE MAPBOX ================= */

  useEffect(() => {
    if (!MAPBOX_TOKEN) return;

    const termino = (direccion || "").trim();
    if (termino.length < 3) {
      setSugerenciasDireccion([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            termino,
          )}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5&country=cl&language=es`,
        );
        const data = await res.json();
        setSugerenciasDireccion(data.features || []);
      } catch (e) {
        console.error("Autocomplete error:", e);
        setSugerenciasDireccion([]);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [direccion, MAPBOX_TOKEN]);

  /* ================= CARGAR PRODUCTOS ================= */

  useEffect(() => {
    async function loadProductos() {
      if (!sucursalActiva) return;
      const data = await getProductos(sucursalActiva.id);
      setProductos(data || []);
    }
    loadProductos();
  }, [sucursalActiva]);

  /* ================= ITEMS ================= */

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
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)),
    );
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const productosFiltrados = productos
    .filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    .slice(0, 8);

  const total = items.reduce(
    (acc, i) => acc + Number(i.precio) * Number(i.cantidad),
    0,
  );

  /* ================= GUARDAR ================= */

  async function guardar() {
    if (!direccion) {
      return Swal.fire(
        "Dirección requerida",
        "Ingresa una dirección",
        "warning",
      );
    }

    if (!lat || !lon) {
      const ok = await geocodeDireccion(direccion);
      if (!ok) {
        return Swal.fire(
          "Dirección inválida",
          "No se pudo ubicar la dirección",
          "warning",
        );
      }
    }

    if (items.length === 0) {
      return Swal.fire("Pedido vacío", "Agrega productos", "warning");
    }

    setLoading(true);

    try {
      const pedido = await createPedido({
        sucursal_id: sucursalActiva.id,
        cliente_nombre: cliente || "Cliente",
        cliente_telefono: telefono || null,

        direccion_entrega: direccion, // ← FIX
        cliente_lat: lat,
        cliente_lon: lon,

        modo_entrega: "domicilio",
        estado: "confirmado",
      });

      for (const item of items) {
        await addPedidoItemFromProducto(pedido.id, item);
      }

      await recalcularTotalPedidoEdge(pedido.id);

      await Swal.fire({
        title: "Pedido delivery creado",
        icon: "success",
        timer: 900,
        showConfirmButton: false,
      });

      onCreated(pedido);
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "No se pudo crear el pedido", "error");
    } finally {
      setLoading(false);
    }
  }

  /* ================= UI ================= */

  return (
    <div className="pem-backdrop">
      <div className="pem-card">
        <div className="pem-header">
          <h3>Nuevo pedido delivery</h3>
          <button className="pem-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="pem-section">
          <label>Cliente</label>
          <input value={cliente} onChange={(e) => setCliente(e.target.value)} />

          <label>Teléfono</label>
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />

          <label>Dirección</label>
          <input
            value={direccion}
            onChange={(e) => {
              setDireccion(e.target.value);
              setLat(null);
              setLon(null);
            }}
            placeholder="Buscar dirección..."
          />
          {sugerenciasDireccion.length > 0 && (
            <div className="pem-product-results">
              {sugerenciasDireccion.map((s) => (
                <div
                  key={s.id}
                  className="pem-product-result"
                  onClick={() => {
                    const [lng, latitude] = s.center || [];
                    setDireccion(s.place_name || "");
                    setLat(latitude);
                    setLon(lng);
                    setSugerenciasDireccion([]);
                  }}
                >
                  <span>{s.place_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pem-section">
          <label>Agregar producto</label>
          <input
            placeholder="Buscar..."
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

        <div className="pem-section">
          <h4>Productos</h4>

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
        </div>

        <div className="pem-total-preview">
          Total: <strong>${total.toLocaleString()}</strong>
        </div>

        <div className="pem-footer">
          <button className="pem-cancel" onClick={onClose}>
            Cancelar
          </button>

          <button className="pem-save" onClick={guardar} disabled={loading}>
            {loading ? "Creando..." : "Crear pedido"}
          </button>
        </div>
      </div>
    </div>
  );
}
