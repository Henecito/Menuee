import { useEffect, useState, useCallback } from "react";
import { useSucursal } from "../context/SucursalContext";
import { getPedidosCocina } from "../services/pedidosService";
import "../styles/cocina.css";

export default function Cocina() {
  const { sucursalActiva } = useSucursal();
  const [pedidos, setPedidos] = useState([]);
  const [filtro, setFiltro] = useState("retiro_delivery");

  const load = useCallback(async () => {
    if (!sucursalActiva) return;

    try {
      const data = await getPedidosCocina(sucursalActiva.id, filtro);
      setPedidos(data || []);
    } catch (e) {
      console.error("Error cargando pedidos de cocina:", e);
    }
  }, [sucursalActiva, filtro]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="cocina-page">
      <div className="cocina-top">
        <div>
          <h2>Cocina</h2>
          <span className="cocina-sucursal">
            Sucursal: {sucursalActiva?.nombre || "---"}
          </span>
        </div>
        <div className="cocina-filtros">
          <button
            className={`cocina-filtro-btn ${
              filtro === "retiro_delivery" ? "active" : ""
            }`}
            onClick={() => setFiltro("retiro_delivery")}
          >
            Retiro + Domicilio
          </button>
          <button
            className={`cocina-filtro-btn ${
              filtro === "solo_mesas" ? "active" : ""
            }`}
            onClick={() => setFiltro("solo_mesas")}
          >
            Solo mesa
          </button>
        </div>
      </div>

      <div className="cocina-monitor">
        {pedidos.map((p) => (
          <div key={p.id} className="cocina-card">
            <div className="cocina-head">
              <div className="cocina-nombre">
                {p.cliente_nombre || `Pedido #${p.id}`}
              </div>
            </div>

<div className="cocina-items">
  {p.pedido_items?.map((item) => (
    <div key={item.id} className="cocina-item-block">
      <div className="cocina-item">
        {item.cantidad}x {item.nombre}
      </div>

      {item.comentario && (
        <div className="cocina-comentario">
          {item.comentario}
        </div>
      )}
    </div>
  ))}
</div>

          </div>
        ))}

        {pedidos.length === 0 && (
          <div className="cocina-empty">
            No hay pedidos confirmados en cocina.
          </div>
        )}
      </div>
    </div>
  );
}
