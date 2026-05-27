import { useEffect, useState, useCallback } from "react";
import Swal from "sweetalert2";
import { useSucursal } from "../../context/SucursalContext";
import {
  getPedidosBySucursal,
  updatePedidoEstado,
  updatePedido,
} from "../../services/pedidosService";
import PedidoEditorModal from "./PedidoEditorModal";
import PagoPedidoModal from "./PagoPedidoModal";
import { registrarVentaCajaSiAplica } from "../../utils/registrarVentaCajaSiAplica";
import CrearDeliveryPedidoModal from "./CrearDeliveryPedidoModal";
import { abrirWhatsAppDelivery } from "../../utils/whatsapp";
import "../../styles/delivery.css";

function getOpenStreetMapEmbedSrc(lat, lon) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  const delta = 0.01;
  const bbox = [
    longitude - delta,
    latitude - delta,
    longitude + delta,
    latitude + delta,
  ].join("%2C");

  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

function abrirGoogleMaps(lat, lon) {
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
    "_blank",
    "noopener,noreferrer"
  );
}

export default function Delivery() {
  const { sucursalActiva, sucursales } = useSucursal();
  const repartidoresDisponibles = Number(sucursalActiva?.cantidad_repartidores) || 0;

  const [pedidos, setPedidos] = useState([]);
  const [pedidoEditando, setPedidoEditando] = useState(null);
  const [pedidoPago, setPedidoPago] = useState(null);
  const [pedidoCreando, setPedidoCreando] = useState(false);
  const [vista, setVista] = useState("pendiente");

  /* ================= LOAD ================= */

  const load = useCallback(async () => {
    if (!sucursalActiva) return;

    try {
      const data = await getPedidosBySucursal(sucursalActiva.id, "domicilio");
      setPedidos(data || []);
    } catch (e) {
      console.error("Error cargando pedidos:", e);
    }
  }, [sucursalActiva]);

  useEffect(() => {
    load();
  }, [load]);

  /* ================= CAMBIAR ESTADO ================= */

  async function cambiarEstado(p, estado) {
    const res = await Swal.fire({
      title: `¿Cambiar a ${estado}?`,
      text: `Pedido #${p.id}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí",
      cancelButtonText: "Cancelar",
    });

    if (!res.isConfirmed) return;

    try {
      await updatePedidoEstado(p.id, estado);

      if (estado === "confirmado") {
        abrirWhatsAppDelivery(p);
      }

      await Swal.fire({
        title: "Estado actualizado",
        icon: "success",
        timer: 900,
        showConfirmButton: false,
      });

      load();
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "No se pudo actualizar el pedido", "error");
    }
  }

  async function derivarPedido(pedido) {
    if (pedido.estado !== "pendiente") {
      Swal.fire("No permitido", "Solo se pueden derivar pedidos pendientes", "error");
      return;
    }

    const opcionesDestino = (sucursales || []).filter(
      (s) => String(s.id) !== String(sucursalActiva?.id)
    );

    if (!opcionesDestino.length) {
      Swal.fire("Sin destino", "No hay otra sucursal disponible", "warning");
      return;
    }

    const inputOptions = opcionesDestino.reduce((acc, s) => {
      acc[s.id] = s.nombre;
      return acc;
    }, {});

    const res = await Swal.fire({
      title: `Derivar pedido #${pedido.id}`,
      input: "select",
      inputOptions,
      inputPlaceholder: "Selecciona sucursal destino",
      showCancelButton: true,
      confirmButtonText: "Derivar",
      cancelButtonText: "Cancelar",
      inputValidator: (value) => (!value ? "Debes seleccionar una sucursal" : null),
    });

    if (!res.isConfirmed) return;

    try {
      await updatePedido(pedido.id, { sucursal_id: res.value });
      await Swal.fire({
        title: "Pedido derivado",
        icon: "success",
        timer: 900,
        showConfirmButton: false,
      });
      load();
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "No se pudo derivar el pedido", "error");
    }
  }

  const pedidosFiltrados = pedidos.filter((p) => p.estado === vista);
  const count = (estado) => pedidos.filter((p) => p.estado === estado).length;

  return (
    <>
      {/* ================= TOP ================= */}
      <div className="delivery-top">
        {/* Tabs izquierda */}
        <div className="delivery-tabs">
          <button
            className={vista === "pendiente" ? "tab active" : "tab"}
            onClick={() => setVista("pendiente")}
          >
            Pendientes ({count("pendiente")})
          </button>

          <button
            className={vista === "confirmado" ? "tab active" : "tab"}
            onClick={() => setVista("confirmado")}
          >
            Confirmados ({count("confirmado")})
          </button>

          <button
            className={vista === "enviado" ? "tab active" : "tab"}
            onClick={() => setVista("enviado")}
          >
            Enviados ({count("enviado")})
          </button>
        </div>

        {/* Acción primaria derecha */}
        <div className="delivery-actions-top">
          <span className="text-muted small me-2">
            Repartidores: <strong>{repartidoresDisponibles}</strong>
          </span>
          <button
            className="delivery-new-btn"
            onClick={() => setPedidoCreando(true)}
          >
            <i className="fa-solid fa-plus"></i> Nuevo pedido
          </button>
        </div>
      </div>

      {/* ================= PANEL ================= */}
      <div className="delivery-panel">
        <div className="delivery-list">
          {pedidosFiltrados.map((p) => (
            <PedidoCard
              key={p.id}
              pedido={p}
              cambiarEstado={cambiarEstado}
              onEditar={() => setPedidoEditando(p)}
              onCerrar={() => setPedidoPago(p)}
              onDerivar={() => derivarPedido(p)}
            />
          ))}

          {pedidosFiltrados.length === 0 && (
            <div className="delivery-empty">No hay pedidos en esta vista.</div>
          )}
        </div>
      </div>

      {/* ================= MODAL CREAR ================= */}
      {pedidoCreando && (
        <CrearDeliveryPedidoModal
          onClose={() => setPedidoCreando(false)}
          onCreated={async () => {
            setPedidoCreando(false);
            setVista("confirmado");
            await load(); // ✔ vuelve a traer pedido con items reales
          }}
        />
      )}

      {/* ================= MODAL EDITAR ================= */}
      {pedidoEditando && (
        <PedidoEditorModal
          pedido={pedidoEditando}
          onClose={() => setPedidoEditando(null)}
          onSaved={() => {
            setPedidoEditando(null);
            load();
          }}
        />
      )}

      {/* ================= MODAL PAGO / CIERRE ================= */}
      {pedidoPago && (
        <PagoPedidoModal
          pedido={pedidoPago}
          onClose={() => setPedidoPago(null)}
          onConfirm={async ({ metodo_pago, propina }) => {
            const cerrando = pedidoPago;
            setPedidoPago(null);

            try {
              await updatePedidoEstado(cerrando.id, "enviado", {
                metodo_pago,
                propina,
              });

              await registrarVentaCajaSiAplica({
                sucursalId: sucursalActiva?.id,
                pedidoId: cerrando.id,
                totalPedido: cerrando.total,
              });

              await Swal.fire({
                title: "Pedido cerrado",
                icon: "success",
                timer: 900,
                showConfirmButton: false,
              });

              load();
            } catch (e) {
              console.error(e);
              Swal.fire("Error", "No se pudo cerrar el pedido", "error");
            }
          }}
        />
      )}
    </>
  );
}

/* ================= CARD ================= */

function PedidoCard({ pedido, cambiarEstado, onEditar, onCerrar, onDerivar }) {
  return (
    <div className="delivery-card">
      {/* HEADER */}
      <div className="delivery-header">
        <div>
          <div className="delivery-title">
            <i className="fa-solid fa-receipt"></i>
            Pedido #{pedido.id}
          </div>

          <div className="delivery-meta">
            <i className="fa-solid fa-user"></i>
            {pedido.cliente_nombre || "Cliente"}
            <span> · </span>
            <i className="fa-solid fa-truck-fast"></i>
            Delivery
          </div>
        </div>

        <span className={`estado-badge ${pedido.estado}`}>{pedido.estado}</span>
      </div>

      {/* MAPA */}
      {pedido.cliente_lat && pedido.cliente_lon && (
        <div className="delivery-location">
          <div className="delivery-location-title">
            <i className="fa-solid fa-location-dot"></i>
            Ubicación del cliente
          </div>

          <div className="delivery-map">
            <iframe
              title={`mapa-${pedido.id}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={getOpenStreetMapEmbedSrc(pedido.cliente_lat, pedido.cliente_lon)}
            />
          </div>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm mt-2"
            onClick={() => abrirGoogleMaps(pedido.cliente_lat, pedido.cliente_lon)}
          >
            <i className="fa-solid fa-route"></i> Cómo llegar
          </button>
        </div>
      )}

      {/* ITEMS */}
      <div className="delivery-items">
        {pedido.pedido_items?.map((item) => (
          <div key={item.id} className="delivery-item">
            <div className="delivery-item-main">
              <span>
                {item.cantidad}x {item.nombre}
              </span>
            </div>

            {item.comentario && (
              <div className="delivery-item-comment">
                <i className="fa-solid fa-comment"></i>
                {item.comentario}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div className="delivery-footer">
        <div className="delivery-total">Total: ${pedido.total || 0}</div>

        <div className="delivery-actions">
          {pedido.estado === "pendiente" && (
            <button className="btn btn-outline-secondary btn-sm" onClick={onDerivar}>
              Derivar
            </button>
          )}

          <button
            className="btn btn-warning btn-sm"
            onClick={onEditar}
            disabled={pedido.estado === "enviado"}
          >
            <i className="fa-solid fa-pen"></i> Editar
          </button>

          {pedido.estado === "pendiente" && (
            <>
              <button
                className="btn btn-success btn-sm"
                onClick={() => cambiarEstado(pedido, "confirmado")}
              >
                <i className="fa-solid fa-check"></i> Aceptar
              </button>

              <button
                className="btn btn-danger btn-sm"
                onClick={() => cambiarEstado(pedido, "cancelado")}
              >
                <i className="fa-solid fa-xmark"></i> Rechazar
              </button>
            </>
          )}

          {pedido.estado === "confirmado" && (
            <button className="btn btn-primary btn-sm" onClick={onCerrar}>
              <i className="fa-solid fa-motorcycle"></i> Enviar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
