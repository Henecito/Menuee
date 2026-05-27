import { useEffect, useState } from "react";
import { useSucursal } from "../../context/SucursalContext";
import { getKpisHoy } from "../../services/kpiService";
import ModalPagosTarjeta from "./ModalPagosTarjeta";
import "../../styles/reportes.css";

export default function Reportes() {
  const { sucursalActiva } = useSucursal();

  const [rango, setRango] = useState("hoy");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [filtroTurno, setFiltroTurno] = useState("");
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [openTarjetaModal, setOpenTarjetaModal] = useState(false);

  /* =========================
     LOAD KPIS DESDE SERVICE
  ========================= */
  useEffect(() => {
    if (!sucursalActiva) return;

    async function load() {
      try {
        setLoadError(null);
        setLoading(true);
        const data = await getKpisHoy(
          sucursalActiva.id,
          {
            rango,
            fechaDesde,
            fechaHasta,
          },
          { filtroTurno }
        );
        setKpis(data);
      } catch (e) {
        console.error("Error cargando reportes:", e);
        setKpis(null);
        setLoadError(
          e?.message || e?.error_description || "No se pudieron cargar los reportes."
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [sucursalActiva, rango, fechaDesde, fechaHasta, filtroTurno]);

  if (!sucursalActiva)
    return <p className="mt-4 px-3">No hay sucursal activa</p>;

  if (loading)
    return <p className="mt-4 px-3">Cargando reportes...</p>;

  if (loadError)
    return (
      <div className="mt-4 px-3">
        <div className="alert alert-danger" role="alert">
          <strong>Error al cargar reportes.</strong> {loadError}
        </div>
        <p className="text-muted small mb-0">
          Revisá la consola del navegador y que tu usuario tenga permisos sobre pedidos y sucursales.
          Si acabás de agregar la columna <code>cerrado_en</code>, ejecutá la migración en Supabase o
          recargá el esquema.
        </p>
      </div>
    );

  if (!kpis)
    return <p className="mt-4 px-3">Cargando reportes...</p>;

  const ticketPromedio =
    kpis.pedidosHoy > 0 ? Math.round(kpis.ingresosHoy / kpis.pedidosHoy) : 0;

  return (
    <div className="reportes-wrapper container-fluid px-4 mt-3">
      {/* ================= HEADER ================= */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold mb-1">Reportes</h3>
          <span className="text-muted small">
            Análisis completo del negocio
          </span>
        </div>

        {/* FILTRO DE FECHAS (FRONT PREPARADO) */}
        <div className="d-flex flex-wrap gap-2 align-items-center justify-content-end">
          <select
            className="form-select w-auto"
            value={rango}
            onChange={(e) => setRango(e.target.value)}
          >
            <option value="hoy">Hoy</option>
            <option value="ayer">Ayer</option>
            <option value="ultimos_7_dias">Ultimos 7 dias</option>
            <option value="ultimos_30_dias">Ultimos 30 dias</option>
            <option value="personalizado">Personalizado</option>
          </select>

          {rango === "personalizado" && (
            <>
              <input
                type="date"
                className="form-control"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
              <input
                type="date"
                className="form-control"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </>
          )}

          <select
            className="form-select w-auto"
            style={{ minWidth: "11rem" }}
            value={filtroTurno}
            onChange={(e) => setFiltroTurno(e.target.value)}
            disabled={!kpis?.turnosDisponibles}
            title={
              kpis?.turnosDisponibles
                ? "Filtrar métricas por turno según horarios de la sucursal"
                : "Definí horarios estructurados en Sucursales para usar turnos"
            }
          >
            {(kpis?.turnosOpciones || [{ value: "", label: "Todos los turnos" }]).map((opt) => (
              <option key={opt.value || "todos"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {kpis?.turnosDisponibles && (
        <p className="small text-muted mb-3">
          Los turnos se calculan con la hora de creación del pedido y los bloques configurados en la
          sucursal (zona horaria de este equipo).
        </p>
      )}

      {/* ================= KPIs ================= */}
      <section className="row g-3 mb-4">
        <Kpi
          title="Ventas totales"
          value={`$ ${kpis.ingresosHoy.toLocaleString("es-CL")}`}
        />

        <Kpi title="Pedidos" value={kpis.pedidosHoy} />

        <Kpi
          title="Ticket promedio"
          value={`$ ${ticketPromedio.toLocaleString("es-CL")}`}
        />

        <Kpi
          title="Propinas"
          value={`$ ${kpis.propinasHoy.toLocaleString("es-CL")}`}
        />

        <Kpi
          title="Pagos en efectivo"
          value={`$ ${kpis.pagosMonto?.efectivo.toLocaleString("es-CL")}`}
        />

        <Kpi
          title="Pagos con tarjeta"
          value={`$ ${kpis.pagosMonto?.tarjeta.toLocaleString("es-CL")}`}
          onClick={() => setOpenTarjetaModal(true)}
        />
      </section>

      {/* MODAL TARJETA */}
      {openTarjetaModal && (
        <ModalPagosTarjeta
          kpis={kpis}
          onClose={() => setOpenTarjetaModal(false)}
        />
      )}

      {/* ================= RESUMEN ================= */}
      <section className="row g-3 mb-4">
        <div className="col-12">
          <Panel title="Resumen del período">
            <ul className="small text-muted mb-0">
              <li>
                Ventas totales:{" "}
                <strong>${kpis.ingresosHoy.toLocaleString("es-CL")}</strong>
              </li>
              <li>
                Propinas acumuladas:{" "}
                <strong>${kpis.propinasHoy.toLocaleString("es-CL")}</strong>
              </li>
              <li>
                Pedidos realizados: <strong>{kpis.pedidosHoy}</strong>
              </li>
              <li>
                Ticket promedio:{" "}
                <strong>${ticketPromedio.toLocaleString("es-CL")}</strong>
              </li>
            </ul>
          </Panel>
        </div>
      </section>

      {/* ================= POR TURNO ================= */}
      {kpis?.turnosDisponibles && Array.isArray(kpis.porTurno) && kpis.porTurno.length > 0 && (
        <section className="row g-3 mb-4">
          <div className="col-12">
            <Panel title="Métricas por turno (mismo período)">
              <div className="table-responsive">
                <table className="table table-sm table-striped align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Turno</th>
                      <th className="text-end">Pedidos</th>
                      <th className="text-end">Ventas</th>
                      <th className="text-end">Propinas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpis.porTurno.map((t) => (
                      <tr key={t.key}>
                        <td>{t.label}</td>
                        <td className="text-end">{t.pedidos}</td>
                        <td className="text-end">
                          ${Number(t.ingresos || 0).toLocaleString("es-CL")}
                        </td>
                        <td className="text-end">
                          ${Number(t.propinas || 0).toLocaleString("es-CL")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="small text-muted mb-0 mt-2">
                Ventas y propinas solo incluyen pedidos entregados o enviados; &quot;Pedidos&quot; cuenta
                todos los no cancelados en cada turno. El turno se asigna por la hora de cierre del
                pedido cuando existe; si no, por la hora de creación (pedidos anteriores al cierre
                registrado).
              </p>
            </Panel>
          </div>
        </section>
      )}

      {/* ================= MÉTODOS DE PAGO ================= */}
      <section className="row g-3">
        <div className="col-lg-4">
          <Panel title="Métodos de pago">
            <ul className="small text-muted mb-0">
              <li>
                Efectivo:{" "}
                <strong>
                  ${kpis.pagosMonto?.efectivo.toLocaleString("es-CL")} (
                  {kpis.pagosCantidad?.efectivo})
                </strong>
              </li>
              <li>
                Tarjeta:{" "}
                <strong>
                  ${kpis.pagosMonto?.tarjeta.toLocaleString("es-CL")} (
                  {kpis.pagosCantidad?.tarjeta})
                </strong>
              </li>
              <li>
                Transferencia:{" "}
                <strong>
                  ${kpis.pagosMonto?.transferencia.toLocaleString("es-CL")} (
                  {kpis.pagosCantidad?.transferencia})
                </strong>
              </li>
              <li>
                Otros:{" "}
                <strong>
                  ${kpis.pagosMonto?.otro.toLocaleString("es-CL")} (
                  {kpis.pagosCantidad?.otro})
                </strong>
              </li>
            </ul>
          </Panel>
        </div>

        <div className="col-lg-8">
          <Panel title="Ventas por período">
            <div className="chart-placeholder">Próximo: gráfico de ventas</div>
          </Panel>
        </div>
      </section>
    </div>
  );
}

/* =========================
   COMPONENTES BASE
========================= */

function Kpi({ title, value, onClick }) {
  return (
    <div className="col-sm-6 col-lg-4 col-xl-2">
      <div
        className={`card shadow-sm border-0 rounded-4 kpi-card ${
          onClick ? "kpi-clickable" : ""
        }`}
        onClick={onClick}
      >
        <div className="card-body">
          <p className="text-muted small mb-1">{title}</p>
          <h5 className="fw-semibold mb-0">{value}</h5>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="card shadow-sm border-0 rounded-4 h-100">
      <div className="card-body">
        <h6 className="fw-semibold mb-3">{title}</h6>
        {children}
      </div>
    </div>
  );
}
