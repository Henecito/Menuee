import { useEffect, useState, useCallback } from "react";
import Swal from "sweetalert2";
import { useSucursal } from "../../context/SucursalContext";
import {
  getPedidosBySucursal,
  updatePedidoEstado,
  updatePedido,
} from "../../services/pedidosService";
import PedidoEditorModal from "./PedidoEditorModal";
import CrearPedidoModal from "./CrearPedidoMModal";
import { abrirWhatsAppConfirmacion } from "../../utils/whatsapp";
import "../../styles/mostrador.css";
import PagoPedidoModal from "./PagoPedidoModal";
import { registrarVentaCajaSiAplica } from "../../utils/registrarVentaCajaSiAplica";

export default function Mostrador() {
  const { sucursalActiva, sucursales } = useSucursal();

  const [pedidos, setPedidos] = useState([]);
  const [pedidoEditando, setPedidoEditando] = useState(null);
  const [pedidoPago, setPedidoPago] = useState(null);
  const [pedidoCreando, setPedidoCreando] = useState(false); // ← NUEVO
  const [vista, setVista] = useState("pendiente");

  const load = useCallback(async () => {
    if (!sucursalActiva) return;

    try {
      const data = await getPedidosBySucursal(sucursalActiva.id, "retiro");
      setPedidos(data || []);
    } catch (e) {
      console.error("Error cargando pedidos:", e);
    }
  }, [sucursalActiva]);

  useEffect(() => {
    load();
  }, [load]);

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
        abrirWhatsAppConfirmacion(p);
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

      <div className="mostrador-top">
        {/* IZQUIERDA → Tabs */}
        <div className="mostrador-tabs">
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
            className={vista === "entregado" ? "tab active" : "tab"}
            onClick={() => setVista("entregado")}
          >
            Entregados ({count("entregado")})
          </button>
        </div>

        {/* DERECHA → Acción primaria */}
        <div className="mostrador-actions-top">
          <button
            className="mostrador-new-btn"
            onClick={() => setPedidoCreando(true)}
          >
            <i className="fa-solid fa-plus"></i> Nuevo pedido
          </button>
        </div>
      </div>

      {/* ================= LISTA ================= */}

      <div className="mostrador-panel">
        <div className="mostrador-list">
          {pedidosFiltrados.map((p) => (
            <PedidoCard
              key={p.id}
              pedido={p}
              cambiarEstado={cambiarEstado}
              onEditar={() => setPedidoEditando(p)}
              onEntregar={() => setPedidoPago(p)}
              onDerivar={() => derivarPedido(p)}
            />
          ))}

          {pedidosFiltrados.length === 0 && (
            <div className="mostrador-empty">No hay pedidos en esta vista.</div>
          )}
        </div>
      </div>

      {/* ================= EDITAR ================= */}

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

      {/* ================= PAGO ================= */}

      {pedidoPago && (
        <PagoPedidoModal
          pedido={pedidoPago}
          onClose={() => setPedidoPago(null)}
          onConfirm={async ({ metodo_pago, propina }) => {
            const cerrando = pedidoPago;
            setPedidoPago(null);

            try {
              await updatePedidoEstado(cerrando.id, "entregado", {
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

      {/* ================= CREAR PEDIDO (NUEVO) ================= */}

      {pedidoCreando && (
        <CrearPedidoModal
          onClose={() => setPedidoCreando(false)}
          onCreated={(pedido) => {
            setPedidoCreando(false); // ← cierra modal
            setVista("confirmado"); // ← opcional: cambia a tab confirmados
            load(); // ← refresca lista
          }}
        />
      )}
    </>
  );
}

/* ================= CARD ================= */

function PedidoCard({ pedido, cambiarEstado, onEditar, onEntregar, onDerivar }) {
  return (
    <div className="mostrador-card">
      <div className="mostrador-header">
        <div>
          <div className="mostrador-title">
            <i className="fa-solid fa-receipt"></i>
            Pedido #{pedido.id}
          </div>

          <div className="mostrador-meta">
            <i className="fa-solid fa-store"></i>
            Retiro en local
            {pedido.cliente_nombre && (
              <>
                <span> · </span>
                <i className="fa-solid fa-user"></i>
                {pedido.cliente_nombre}
              </>
            )}
          </div>
        </div>

        <span className={`estado-badge ${pedido.estado}`}>{pedido.estado}</span>
      </div>

      <div className="mostrador-items">
        {pedido.pedido_items?.map((item) => (
          <div key={item.id} className="mostrador-item">
            <div className="mostrador-item-main">
              <span>
                {item.cantidad}x {item.nombre}
              </span>
            </div>

            {item.comentario && (
              <div className="mostrador-item-comment">
                <i className="fa-solid fa-comment"></i>
                {item.comentario}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mostrador-footer">
        <div className="mostrador-total">Total: ${pedido.total || 0}</div>

        <div className="mostrador-actions">
          {pedido.estado === "pendiente" && (
            <button className="btn btn-outline-secondary btn-sm" onClick={onDerivar}>
              Derivar
            </button>
          )}

          <button
            className="btn btn-warning btn-sm"
            onClick={onEditar}
            disabled={pedido.estado === "entregado"}
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
            <button className="btn btn-primary btn-sm" onClick={onEntregar}>
              <i className="fa-solid fa-box"></i> Entregado
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
