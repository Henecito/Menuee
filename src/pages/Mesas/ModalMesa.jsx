import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { useSucursal } from "../../context/SucursalContext";
import { getPedidosByMesa, updatePedidoEstado } from "../../services/pedidosService";
import { updateMesaEstado } from "../../services/mesasService";
import CrearPedidoModal from "../Pedidos/CrearPedidoMModal";
import PagoPedidoModal from "../Pedidos/PagoPedidoModal";
import { registrarVentaCajaSiAplica } from "../../utils/registrarVentaCajaSiAplica";
import "../../styles/modalMesa.css";

export default function ModalMesa({ mesa, onClose }) {
  const { sucursalActiva } = useSucursal();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creandoPedido, setCreandoPedido] = useState(false);
  const [cerrandoMesa, setCerrandoMesa] = useState(false);

  const loadPedidosMesa = useCallback(async () => {
    if (!sucursalActiva?.id || !mesa?.id) return;
    setLoading(true);
    try {
      const data = await getPedidosByMesa(sucursalActiva.id, mesa.id);
      setPedidos(data || []);
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "No se pudieron cargar los pedidos de la mesa", "error");
    } finally {
      setLoading(false);
    }
  }, [sucursalActiva?.id, mesa?.id]);

  useEffect(() => {
    loadPedidosMesa();
  }, [loadPedidosMesa]);

  const mesaAbierta = useMemo(
    () =>
      mesa?.estado === "abierta" ||
      mesa?.estado === "ocupada" ||
      mesa?.estado === "cuenta",
    [mesa?.estado]
  );

  const pedidosActivos = useMemo(
    () => pedidos.filter((p) => p.estado !== "cancelado" && p.estado !== "entregado"),
    [pedidos]
  );

  const totalMesa = useMemo(
    () => pedidosActivos.reduce((acc, p) => acc + Number(p.total || 0), 0),
    [pedidosActivos]
  );

  async function confirmarCierre({ metodo_pago, propina }) {
    if (!mesa) return;
    if (pedidosActivos.length === 0) {
      Swal.fire("Sin pedidos", "No puedes cerrar una mesa sin pedidos", "warning");
      return;
    }

    if (Number.isNaN(Number(propina)) || Number(propina) < 0) {
      Swal.fire("Propina inválida", "La propina debe ser numérica y no negativa", "warning");
      return;
    }

    try {
      const propinaTotal = Number(propina || 0);
      const propinaPorPedido = propinaTotal / pedidosActivos.length;

      for (let i = 0; i < pedidosActivos.length; i += 1) {
        const p = pedidosActivos[i];
        const propinaAsignada =
          i === pedidosActivos.length - 1
            ? propinaTotal - propinaPorPedido * (pedidosActivos.length - 1)
            : propinaPorPedido;

        await updatePedidoEstado(p.id, "entregado", {
          metodo_pago,
          propina: Number(propinaAsignada.toFixed(2)),
        });

        await registrarVentaCajaSiAplica({
          sucursalId: sucursalActiva?.id,
          pedidoId: p.id,
          totalPedido: p.total,
        });
      }

      await updateMesaEstado(mesa.id, sucursalActiva.id, "cerrada");

      await Swal.fire({
        title: "Mesa cerrada",
        icon: "success",
        timer: 1000,
        showConfirmButton: false,
      });

      setCerrandoMesa(false);
      await loadPedidosMesa();
      onClose();
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "No se pudo cerrar la mesa", "error");
    }
  }

  async function abrirMesaYAgregar() {
    if (!mesa) return;
    if (!mesaAbierta) {
      const res = await Swal.fire({
        title: `Abrir mesa ${mesa.numero}`,
        text: "¿Quieres abrir esta mesa para agregar pedidos?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Abrir mesa",
        cancelButtonText: "Cancelar",
      });

      if (!res.isConfirmed) return;

      try {
        await updateMesaEstado(mesa.id, sucursalActiva.id, "abierta");
      } catch (e) {
        console.error(e);
        Swal.fire("Error", "No se pudo abrir la mesa", "error");
        return;
      }
    }

    setCreandoPedido(true);
  }

  if (!mesa) return null;

  return (
    <>
      <div className="mm-backdrop" onClick={onClose}>
        <div className="mm-card" onClick={(e) => e.stopPropagation()}>
        <div className="mm-header">
          <h3>Mesa {mesa.numero}</h3>
          <button className="mm-close" onClick={onClose}>✕</button>
        </div>

        <div className="mm-body">
          <div className="mm-row">
            <span>Estado:</span>
            <strong className={`estado ${mesa.estado}`}>
              {mesa.estado}
            </strong>
          </div>

          <div className="mm-row">
            <span>ID:</span>
            <strong>{mesa.id}</strong>
          </div>

          <div className="mm-row">
            <span>Pedidos:</span>
            <strong>{pedidosActivos.length}</strong>
          </div>

          <div className="mm-row">
            <span>Total mesa:</span>
            <strong>${totalMesa.toLocaleString("es-CL")}</strong>
          </div>
          {loading && <p className="mm-empty">Cargando...</p>}
        </div>

        <div className="mm-footer">
          <button className="mm-btn mm-secondary" onClick={abrirMesaYAgregar}>
            Agregar pedido
          </button>
          <button className="mm-btn" onClick={() => setCerrandoMesa(true)}>
            Cerrar mesa
          </button>
          <button className="mm-btn" onClick={onClose}>Cerrar</button>
        </div>
      </div>
      </div>

      {creandoPedido && (
        <CrearPedidoModal
          onClose={() => setCreandoPedido(false)}
          onCreated={async () => {
            await updateMesaEstado(mesa.id, sucursalActiva.id, "abierta");
            setCreandoPedido(false);
            loadPedidosMesa();
          }}
          pedidoOverrides={{
            mesa_id: mesa.id,
            modo_entrega: "mesa",
            estado: "confirmado",
            cliente_nombre: `Mesa ${mesa.numero}`,
          }}
          mesaFlow={{ mesaNumero: mesa.numero }}
          titulo={`Agregar pedido - Mesa ${mesa.numero}`}
          clientePlaceholder="Cliente mesa (opcional)"
        />
      )}

      {cerrandoMesa && (
        <PagoPedidoModal
          pedido={{ id: `M${mesa.numero}`, total: totalMesa }}
          onClose={() => setCerrandoMesa(false)}
          onConfirm={confirmarCierre}
        />
      )}
    </>
  );
}
