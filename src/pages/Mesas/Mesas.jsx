import { useEffect, useState, useCallback } from "react";
import { useSucursal } from "../../context/SucursalContext";
import {
  getZonasBySucursal,
  addZona,
  deleteZona,
} from "../../services/zonasService";
import {
  getMesasByZona,
  addMesa,
  deleteMesa,
  updateMesaEstado,
} from "../../services/mesasService";
import {
  getPedidosByMesa,
  updatePedidoEstado,
} from "../../services/pedidosService";
import "../../styles/mesas.css";
import Swal from "sweetalert2";
import CrearPedidoModal from "../Pedidos/CrearPedidoMModal";
import PagoPedidoModal from "../Pedidos/PagoPedidoModal";
import { registrarVentaCajaSiAplica } from "../../utils/registrarVentaCajaSiAplica";

export default function Mesas() {
  const { sucursalActiva } = useSucursal();

  const [zonas, setZonas] = useState([]);
  const [zonaActiva, setZonaActiva] = useState(null);
  const [mesas, setMesas] = useState([]);
  const [editando, setEditando] = useState(false);
  const [numeroMesa, setNumeroMesa] = useState("");
  const [nuevaZona, setNuevaZona] = useState("");
  const [mesaPedido, setMesaPedido] = useState(null);
  const [cierreMesaData, setCierreMesaData] = useState(null);

  /* =========================
     RESET CUANDO CAMBIA SUCURSAL
  ========================= */
  useEffect(() => {
    setZonas([]);
    setZonaActiva(null);
    setMesas([]);
  }, [sucursalActiva?.id]);

  /* =========================
     LOAD ZONAS
  ========================= */
  const loadZonas = useCallback(async () => {
    if (!sucursalActiva) return;

    const data = await getZonasBySucursal(sucursalActiva.id);
    setZonas(data);

    // selecciona primera zona automáticamente
    if (data.length) {
      setZonaActiva((prev) => {
        const existe = data.find((z) => z.id === prev?.id);
        return existe || data[0];
      });
    }
  }, [sucursalActiva]);

  /* =========================
     LOAD MESAS (SEGURA)
  ========================= */
  const loadMesas = useCallback(async () => {
    if (!sucursalActiva || !zonaActiva) return;

    const data = await getMesasByZona(sucursalActiva.id, zonaActiva.id);
    const enriched = await Promise.all(
      (data || []).map(async (m) => {
        const pedidos = await getPedidosByMesa(sucursalActiva.id, m.id);
        const pedidosActivos = (pedidos || []).filter(
          (p) => p.estado !== "cancelado" && p.estado !== "entregado"
        );
        const totalActivos = pedidosActivos.reduce(
          (acc, p) => acc + Number(p.total || 0),
          0
        );
        const ocupadaPorEstado =
          m.estado === "ocupada" || m.estado === "abierta" || m.estado === "cuenta";
        const estadoVisual =
          ocupadaPorEstado || pedidosActivos.length > 0 ? "ocupada" : "libre";

        return {
          ...m,
          estadoVisual,
          pedidosActivosCount: pedidosActivos.length,
          totalActivos,
          pedidosActivos,
        };
      })
    );

    setMesas(enriched);
  }, [sucursalActiva, zonaActiva]);

  /* =========================
     EFFECTS
  ========================= */
  useEffect(() => {
    loadZonas();
  }, [loadZonas]);

  useEffect(() => {
    loadMesas();
  }, [loadMesas]);

  /* =========================
     CRUD ZONA
  ========================= */
  async function crearZona() {
    if (!nuevaZona.trim()) return;
    await addZona(sucursalActiva.id, nuevaZona.trim());
    setNuevaZona("");
    loadZonas();
  }

  async function eliminarZona(id) {
    const res = await Swal.fire({
      title: "Eliminar zona",
      text: "Se eliminarán sus mesas",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!res.isConfirmed) return;

    await deleteZona(id);

    if (zonaActiva?.id === id) {
      setZonaActiva(null);
      setMesas([]);
    }

    loadZonas();
  }

  /* =========================
     CRUD MESA
  ========================= */
  async function crearMesa() {
    if (!numeroMesa || !zonaActiva) return;
    await addMesa(sucursalActiva.id, zonaActiva.id, Number(numeroMesa));
    setNumeroMesa("");
    loadMesas();
  }

  async function eliminarMesa(id) {
    const res = await Swal.fire({
      title: "Eliminar mesa",
      text: "Esta acción no se puede deshacer",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!res.isConfirmed) return;

    await deleteMesa(id, sucursalActiva.id);
    loadMesas();
  }

  async function getResumenMesa(idMesa) {
    const pedidos = await getPedidosByMesa(sucursalActiva.id, idMesa);
    const pedidosActivos = (pedidos || []).filter(
      (p) => p.estado !== "cancelado" && p.estado !== "entregado"
    );
    const totalMesa = pedidosActivos.reduce(
      (acc, p) => acc + Number(p.total || 0),
      0
    );
    return { pedidosActivos, totalMesa };
  }

  async function abrirMesaYAgregar(mesa) {
    const abierta = mesa.estadoVisual === "ocupada";

    if (!abierta) {
      const res = await Swal.fire({
        title: `Abrir mesa ${mesa.numero}`,
        text: "¿Quieres abrir esta mesa para agregar pedidos?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Abrir mesa",
        cancelButtonText: "Cancelar",
      });

      if (!res.isConfirmed) return;

      await updateMesaEstado(mesa.id, sucursalActiva.id, "abierta");
      await loadMesas();
    }

    const resumen = await getResumenMesa(mesa.id);
    setMesaPedido({ ...mesa, ...resumen });
  }

  async function clickMesa(mesa) {
    const abierta = mesa.estadoVisual === "ocupada";

    if (!abierta) {
      await abrirMesaYAgregar(mesa);
      return;
    }

    const resumen = await getResumenMesa(mesa.id);
    setMesaPedido({ ...mesa, ...resumen });
  }

  /* =========================
     UI
  ========================= */
  return (
    <div className="mesas-wrapper">
      <div className="mesas-top">
        <div>
          <h2>Mesas</h2>
          <span>Distribución del local</span>
        </div>

        <button
          className={`mesas-edit ${editando ? "active" : ""}`}
          onClick={() => setEditando(!editando)}
        >
          <i className="fa-solid fa-pen"></i>
          {editando ? "Cerrar edición" : "Editar"}
        </button>
      </div>

      <div className="mesas-panel">
        {/* ZONAS */}
        <div className="zonas-bar">
          {zonas.map((z) => (
            <div key={z.id} className="zona-wrap">
              <button
                className={`zona-pill ${
                  zonaActiva?.id === z.id ? "active" : ""
                }`}
                onClick={() => setZonaActiva(z)}
              >
                {z.nombre}
              </button>

              {editando && (
                <button className="zona-x" onClick={() => eliminarZona(z.id)}>
                  ×
                </button>
              )}
            </div>
          ))}

          {editando && (
            <div className="zona-new">
              <input
                className="zona-input"
                placeholder="Nueva zona..."
                value={nuevaZona}
                onChange={(e) => setNuevaZona(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") crearZona();
                }}
              />

              <button className="zona-add-btn" onClick={crearZona}>
                Agregar
              </button>
            </div>
          )}
        </div>

        {/* MESAS */}
        {zonaActiva && (
          <>
            <div className="mesas-grid">
              {mesas.map((m) => (
                <div
                  key={m.id}
                  className={`mesa ${m.estadoVisual || "libre"} ${!editando ? "mesa-clickable" : ""}`}
                  onClick={() => {
                    if (!editando) clickMesa(m);
                  }}
                >
                  <div className="mesa-num">Mesa {m.numero}</div>
                  <div className="mesa-status">{m.estadoVisual || "libre"}</div>

                  {editando && (
                    <button
                      className="mesa-del"
                      onClick={() => eliminarMesa(m.id)}
                    >
                      🗑
                    </button>
                  )}
                </div>
              ))}
            </div>

            {editando && (
              <div className="mesa-add">
                <input
                  type="number"
                  placeholder="Número mesa"
                  value={numeroMesa}
                  onChange={(e) => setNumeroMesa(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") crearMesa();
                  }}
                />
                <button onClick={crearMesa}>Agregar</button>
              </div>
            )}
          </>
        )}
      </div>

      {mesaPedido && (
        <CrearPedidoModal
          onClose={() => setMesaPedido(null)}
          onCreated={async () => {
            await updateMesaEstado(mesaPedido.id, sucursalActiva.id, "abierta");
            const resumen = await getResumenMesa(mesaPedido.id);
            setMesaPedido((prev) => (prev ? { ...prev, ...resumen } : prev));
            loadMesas();
          }}
          pedidoOverrides={{
            mesa_id: mesaPedido.id,
            modo_entrega: "mesa",
            estado: "confirmado",
            cliente_nombre: `Mesa ${mesaPedido.numero}`,
          }}
          titulo={`Agregar pedido - Mesa ${mesaPedido.numero}`}
          clientePlaceholder="Cliente mesa (opcional)"
          mesaFlow={{
            mesaNumero: mesaPedido.numero,
            totalMesa: mesaPedido.totalMesa || 0,
            pedidosActivos: mesaPedido.pedidosActivos || [],
            onAbrirCierreModal: async () => {
              const resumen = await getResumenMesa(mesaPedido.id);
              if (resumen.pedidosActivos.length === 0) {
                Swal.fire(
                  "Sin pedidos",
                  "No puedes cerrar una mesa sin pedidos",
                  "warning"
                );
                return;
              }

              setCierreMesaData({
                mesa: mesaPedido,
                pedidosActivos: resumen.pedidosActivos,
                totalMesa: resumen.totalMesa,
              });
            },
          }}
        />
      )}

      {cierreMesaData && (
        <PagoPedidoModal
          pedido={{
            id: `M${cierreMesaData.mesa.numero}`,
            total: cierreMesaData.totalMesa,
          }}
          onClose={() => setCierreMesaData(null)}
          onConfirm={async ({ metodo_pago, propina }) => {
            const propinaNum = Number(propina || 0);
            if (Number.isNaN(propinaNum) || propinaNum < 0) {
              Swal.fire(
                "Propina inválida",
                "La propina debe ser numérica y no negativa",
                "warning"
              );
              return;
            }

            const propinaPorPedido = propinaNum / cierreMesaData.pedidosActivos.length;

            for (let i = 0; i < cierreMesaData.pedidosActivos.length; i += 1) {
              const p = cierreMesaData.pedidosActivos[i];
              const propinaAsignada =
                i === cierreMesaData.pedidosActivos.length - 1
                  ? propinaNum -
                    propinaPorPedido * (cierreMesaData.pedidosActivos.length - 1)
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

            await updateMesaEstado(cierreMesaData.mesa.id, sucursalActiva.id, "cerrada");
            await Swal.fire({
              title: "Mesa cerrada",
              icon: "success",
              timer: 900,
              showConfirmButton: false,
            });
            setCierreMesaData(null);
            setMesaPedido(null);
            loadMesas();
          }}
        />
      )}
    </div>
  );
}
