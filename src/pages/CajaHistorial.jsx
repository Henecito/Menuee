import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { useSucursal } from "../context/SucursalContext";
import { accesoModuloCaja } from "../utils/cajaPermisos";
import { getHistorialCajas } from "../services/cajaHistorialService";

function fmtFecha(val) {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL");
}

function fmtMoney(n) {
  return `$${Number(n || 0).toLocaleString("es-CL")}`;
}

function fechaAperturaRow(c) {
  return c.fecha_apertura || c.abierta_en || c.created_at || c.apertura_en;
}

export default function CajaHistorial() {
  const { sucursalActiva, loading: ctxLoading, permisos, rol } = useSucursal();
  const volverACaja = accesoModuloCaja(permisos, rol, "ver");
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!sucursalActiva?.id) {
      setFilas([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await getHistorialCajas(sucursalActiva.id);
      setFilas(data || []);
    } catch (e) {
      console.error(e);
      Swal.fire(
        "Error",
        e?.message || "No se pudo cargar el historial de cajas.",
        "error"
      );
      setFilas([]);
    } finally {
      setLoading(false);
    }
  }, [sucursalActiva?.id]);

  useEffect(() => {
    if (!ctxLoading) load();
  }, [ctxLoading, load]);

  if (ctxLoading || loading) {
    return <p className="px-4 pt-4 text-secondary">Cargando historial…</p>;
  }

  if (!sucursalActiva) {
    return (
      <div className="px-4 pt-4">
        <p className="text-warning">Selecciona una sucursal para ver el historial.</p>
      </div>
    );
  }

  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
        <h1 className="h4 mb-0">
          <i className="fa-solid fa-clock-rotate-left me-2" />
          Historial de arqueo
        </h1>
        <Link
          to={volverACaja ? "/caja" : "/"}
          className="btn btn-outline-light btn-sm"
        >
          <i className={`fa-solid ${volverACaja ? "fa-cash-register" : "fa-house"} me-1`} />
          {volverACaja ? "Volver a caja" : "Inicio"}
        </Link>
      </div>

      <p className="text-secondary small mb-4">
        Sucursal: <strong>{sucursalActiva.nombre}</strong>
        <span className="text-muted"> · últimas {filas.length ? filas.length : "0"} cajas cerradas</span>
      </p>

      {filas.length === 0 ? (
        <div className="alert alert-secondary mb-0" role="status">
          No hay historial de cajas cerradas para esta sucursal.
        </div>
      ) : (
        <div className="row g-3">
          {filas.map((caja) => {
            const montoApertura = Number(caja.monto_apertura || 0);
            const totalVentas = Number(caja.total_ventas || 0);
            const totalIngresos = Number(caja.total_ingresos || 0);
            const totalRetiros = Number(caja.total_retiros || 0);
            const montoCierre = Number(caja.monto_cierre ?? 0);

            const totalEsperado =
              montoApertura + totalIngresos + totalVentas - totalRetiros;
            const diferencia = montoCierre - totalEsperado;
            const cuadrado = Math.abs(diferencia) < 0.01;

            let diffClass = "text-secondary";
            if (diferencia > 0.01) diffClass = "text-success fw-semibold";
            else if (diferencia < -0.01) diffClass = "text-danger fw-semibold";

            return (
              <div key={caja.id} className="col-12">
                <div className="card shadow-sm border-secondary">
                  <div className="card-body">
                    <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
                      <span className="text-muted small">
                        Caja #{String(caja.id ?? "").slice(0, 8)}
                      </span>
                    </div>
                    <div className="row g-3 small">
                      <div className="col-md-6 col-lg-3">
                        <div className="text-muted">Apertura</div>
                        <div>{fmtFecha(fechaAperturaRow(caja))}</div>
                      </div>
                      <div className="col-md-6 col-lg-3">
                        <div className="text-muted">Cierre</div>
                        <div>{fmtFecha(caja.cerrada_en)}</div>
                      </div>
                      <div className="col-md-4 col-lg-2">
                        <div className="text-muted">Monto apertura</div>
                        <div>{fmtMoney(montoApertura)}</div>
                      </div>
                      <div className="col-md-4 col-lg-2">
                        <div className="text-muted">Ventas</div>
                        <div>{fmtMoney(totalVentas)}</div>
                      </div>
                      <div className="col-md-4 col-lg-2">
                        <div className="text-muted">Ingresos</div>
                        <div>{fmtMoney(totalIngresos)}</div>
                      </div>
                      <div className="col-md-4 col-lg-2">
                        <div className="text-muted">Retiros</div>
                        <div>{fmtMoney(totalRetiros)}</div>
                      </div>
                      <div className="col-md-4 col-lg-2">
                        <div className="text-muted">Total esperado</div>
                        <div className="fw-semibold">{fmtMoney(totalEsperado)}</div>
                      </div>
                      <div className="col-md-4 col-lg-2">
                        <div className="text-muted">Monto cierre</div>
                        <div>{fmtMoney(montoCierre)}</div>
                      </div>
                      <div className="col-md-4 col-lg-2">
                        <div className="text-muted">Diferencia</div>
                        <div className={diffClass}>
                          {diferencia > 0.01 ? "+" : ""}
                          {fmtMoney(diferencia)}
                          <span className="d-block text-muted fw-normal" style={{ fontSize: "0.75rem" }}>
                            {diferencia > 0.01 && "Sobrante"}
                            {diferencia < -0.01 && "Faltante"}
                            {cuadrado && "Cuadrado"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
