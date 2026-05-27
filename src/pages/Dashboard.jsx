import { useEffect, useState } from "react";
import { useSucursal } from "../context/SucursalContext";
import { getKpisHoy } from "../services/kpiService";
import "../styles/dashboard.css";

export default function Dashboard() {
  const { sucursalActiva, loading } = useSucursal();
  const [kpis, setKpis] = useState(null);
  const [rango, setRango] = useState("hoy");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  useEffect(() => {
    if (!sucursalActiva) return;

    async function load() {
      try {
        const data = await getKpisHoy(sucursalActiva.id, {
          rango,
          fechaDesde,
          fechaHasta,
        });
        setKpis(data);
      } catch (e) {
        console.error("Error cargando KPIs:", e);
      }
    }

    load();
  }, [sucursalActiva, rango, fechaDesde, fechaHasta]);

  if (loading) return <p className="px-4 pt-4">Cargando datos...</p>;
  if (!sucursalActiva)
    return <p className="px-4 pt-4">No hay sucursales disponibles.</p>;

  return (
    <div className="dashboard-wrapper">
      <div className="container-fluid px-4">
        {/* Header */}
        <header className="py-4">
          <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
            <div>
              <h2 className="fw-bold mb-1">Resumen</h2>
              <span className="text-muted small">
                Sucursal activa: <strong>{sucursalActiva.nombre}</strong>
              </span>
            </div>

            <div className="d-flex gap-2 align-items-center">
              <select
                className="form-select w-auto"
                value={rango}
                onChange={(e) => setRango(e.target.value)}
              >
                <option value="hoy">Hoy</option>
                <option value="ayer">Ayer</option>
                <option value="ultimos_7_dias">Ultimos 7 dias</option>
                <option value="ultimos_30_dias">Ultimos 30 dias</option>
                <option value="personalizado">Rango personalizado</option>
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
            </div>
          </div>
        </header>

        {/* KPIs */}
        <section className="row g-3 mb-4">
          <KpiCard
            title="Pedidos"
            value={kpis ? kpis.pedidosHoy : "--"}
            icon="fa-receipt"
          />

          <KpiCard
            title="Ingresos"
            value={
              kpis ? `$ ${kpis.ingresosHoy.toLocaleString("es-CL")}` : "$ --"
            }
            icon="fa-cash-register"
          />

          <KpiCard
            title="Propinas"
            value={
              kpis ? `$ ${kpis.propinasHoy.toLocaleString("es-CL")}` : "$ --"
            }
            icon="fa-hand-holding-dollar"
          />

          <KpiCard
            title="Mesas ocupadas"
            value={
              kpis ? `${kpis.mesasOcupadas} / ${kpis.totalMesas}` : "0 / 0"
            }
            icon="fa-chair"
          />
        </section>

        {/* Contenido inferior */}
        <section className="row g-3">
          <div className="col-lg-8">
            <Panel title="Ventas por día (próximo)">
              <div className="placeholder">Gráfico Chart.js aquí</div>
            </Panel>
          </div>

          <div className="col-lg-4">
            <Panel title="Top 5 productos">
              <div className="placeholder small">
                Próximamente: productos más vendidos
              </div>
            </Panel>
          </div>
        </section>
      </div>
    </div>
  );
}

/* COMPONENTES BASE */

function KpiCard({ title, value, icon }) {
  return (
    <div className="col-sm-6 col-lg-3">
      <div className="card shadow-sm border-0 rounded-4 kpi-card">
        <div className="card-body d-flex align-items-center gap-3">
          <div
            style={{
              width: "54px",
              height: "54px",
              backgroundColor: "#000",
              borderRadius: "14px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <i
              className={`fa-solid ${icon}`}
              style={{ color: "#fff", fontSize: "1.6rem" }}
            ></i>
          </div>

          <div>
            <p className="text-muted mb-1 small">{title}</p>
            <h5 className="fw-semibold mb-0">{value}</h5>
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="card shadow-sm border-0 rounded-4">
      <div className="card-body p-4">
        <h6 className="fw-semibold mb-3">{title}</h6>
        {children}
      </div>
    </div>
  );
}
