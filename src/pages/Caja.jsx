import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import { Link } from "react-router-dom";
import { useSucursal } from "../context/SucursalContext";
import { accesoModuloCaja } from "../utils/cajaPermisos";
import {
  getCajaActiva,
  getMovimientosPorCaja,
  abrirCaja,
  registrarMovimiento,
  cerrarCaja,
} from "../services/cajaService";

export default function Caja() {
  const { sucursalActiva, loading: ctxLoading, profile, permisos, rol } = useSucursal();
  const puedeAbrir = accesoModuloCaja(permisos, rol, "abrir");
  const puedeCerrar = accesoModuloCaja(permisos, rol, "cerrar");
  const puedeMovimientos = accesoModuloCaja(permisos, rol, "movimientos");
  const puedeHistorial = accesoModuloCaja(permisos, rol, "historial");
  const [caja, setCaja] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apertura, setApertura] = useState("");

  const refrescar = useCallback(async () => {
    if (!sucursalActiva?.id) {
      setCaja(null);
      setMovimientos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const activa = await getCajaActiva(sucursalActiva.id);
      setCaja(activa);

      if (activa?.id) {
        const lista = await getMovimientosPorCaja(activa.id);
        setMovimientos(lista);
      } else {
        setMovimientos([]);
      }
    } catch (e) {
      console.error("Error:", e);
      Swal.fire(
        "Error",
        e?.message || "No se pudo consultar el estado de la caja.",
        "error"
      );
      setCaja(null);
      setMovimientos([]);
    } finally {
      setLoading(false);
    }
  }, [sucursalActiva]);

  useEffect(() => {
    if (!ctxLoading) refrescar();
  }, [ctxLoading, refrescar]);

  async function handleAbrir(e) {
    e.preventDefault();
    if (!puedeAbrir) return;
    const m = Number(apertura);
    if (!sucursalActiva?.id || !profile?.local_id || !profile?.id) {
      Swal.fire("Faltan datos", "Sesión o sucursal incompleta.", "warning");
      return;
    }
    if (Number.isNaN(m) || m < 0) {
      Swal.fire("Monto inválido", "Ingresa un monto de apertura válido.", "warning");
      return;
    }

    try {
      await abrirCaja({
        local_id: profile.local_id,
        sucursal_id: sucursalActiva.id,
        usuario_id: profile.id,
        monto_apertura: m,
      });
      setApertura("");
      await Swal.fire({
        title: "Caja abierta",
        icon: "success",
        timer: 900,
        showConfirmButton: false,
      });
      refrescar();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", err?.message || "No se pudo abrir la caja.", "error");
    }
  }

  async function promptMonto(titulo, confirmLabel) {
    const { value } = await Swal.fire({
      title: titulo,
      input: "text",
      inputPlaceholder: "0",
      showCancelButton: true,
      confirmButtonText: confirmLabel,
      cancelButtonText: "Cancelar",
      inputValidator: (v) => {
        const n = Number(String(v).replace(",", "."));
        if (v === "" || Number.isNaN(n) || n <= 0) {
          return "Ingresa un monto mayor a 0";
        }
        return null;
      },
    });
    if (value === undefined) return null;
    return Number(String(value).replace(",", "."));
  }

  async function handleIngreso() {
    if (!caja?.id) return;
    const monto = await promptMonto("Registrar ingreso", "Registrar");
    if (monto == null) return;
    try {
      await registrarMovimiento({
        caja_id: caja.id,
        tipo: "ingreso",
        monto,
        descripcion: "Ingreso manual",
      });
      Swal.fire({ title: "Ingreso registrado", icon: "success", timer: 800, showConfirmButton: false });
      refrescar();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", err?.message || "No se pudo registrar.", "error");
    }
  }

  async function handleRetiro() {
    if (!caja?.id) return;
    const monto = await promptMonto("Registrar retiro", "Registrar");
    if (monto == null) return;
    try {
      await registrarMovimiento({
        caja_id: caja.id,
        tipo: "retiro",
        monto,
        descripcion: "Retiro manual",
      });
      Swal.fire({ title: "Retiro registrado", icon: "success", timer: 800, showConfirmButton: false });
      refrescar();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", err?.message || "No se pudo registrar.", "error");
    }
  }

  async function handleCerrar() {
    if (!caja?.id) return;
    const monto = await promptMonto("Monto contado al cierre", "Cerrar caja");
    if (monto == null) return;
    try {
      await cerrarCaja({ caja_id: caja.id, monto_cierre: monto });
      Swal.fire({ title: "Caja cerrada", icon: "success", timer: 900, showConfirmButton: false });
      refrescar();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", err?.message || "No se pudo cerrar la caja.", "error");
    }
  }

  if (ctxLoading || loading) {
    return <p className="px-4 pt-4 text-secondary">Cargando caja…</p>;
  }

  if (!sucursalActiva) {
    return (
      <div className="px-4 pt-4">
        <p className="text-warning">Selecciona una sucursal para usar caja.</p>
      </div>
    );
  }

  const fechaApertura = caja?.abierta_en || caja?.created_at || caja?.apertura_en;

  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
        <h1 className="h4 mb-0">
          <i className="fa-solid fa-cash-register me-2" />
          Caja / arqueo
        </h1>
        {puedeHistorial && (
          <Link to="/caja/historial" className="btn btn-outline-secondary btn-sm">
            <i className="fa-solid fa-clock-rotate-left me-1" />
            Historial de arqueo
          </Link>
        )}
      </div>

      {!caja && (
        <div className="card shadow-sm" style={{ maxWidth: "420px" }}>
          <div className="card-body">
            <h2 className="h6 card-title">No hay caja abierta</h2>
            <p className="text-secondary small mb-3">
              Sucursal: <strong>{sucursalActiva.nombre}</strong>
            </p>
            {puedeAbrir ? (
              <>
                <p className="small text-muted mb-3">
                  Podés abrir una nueva caja con el monto inicial de apertura.
                </p>
                <form onSubmit={handleAbrir}>
                  <label className="form-label">Monto apertura</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="form-control mb-3"
                    value={apertura}
                    onChange={(e) => setApertura(e.target.value)}
                    placeholder="0"
                  />
                  <button type="submit" className="btn btn-success">
                    Abrir caja
                  </button>
                </form>
              </>
            ) : (
              <p className="small text-muted mb-0">
                No tenés permiso para abrir caja. Pedí acceso a un administrador.
              </p>
            )}
          </div>
        </div>
      )}

      {caja && (
        <div className="row g-4">
          <div className="col-lg-5">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <h2 className="h6 card-title">Caja abierta</h2>
                <ul className="list-unstyled small mb-4">
                  <li>
                    <span className="text-secondary">Apertura: </span>
                    <strong>
                      ${Number(caja.monto_apertura || 0).toLocaleString("es-CL")}
                    </strong>
                  </li>
                  <li>
                    <span className="text-secondary">Desde: </span>
                    {fechaApertura
                      ? new Date(fechaApertura).toLocaleString("es-CL")
                      : "—"}
                  </li>
                </ul>
                <div className="d-flex flex-wrap gap-2">
                  {puedeMovimientos && (
                    <button type="button" className="btn btn-outline-primary btn-sm" onClick={handleIngreso}>
                      Registrar ingreso
                    </button>
                  )}
                  {puedeMovimientos && (
                    <button type="button" className="btn btn-outline-warning btn-sm" onClick={handleRetiro}>
                      Registrar retiro
                    </button>
                  )}
                  {puedeCerrar && (
                    <button type="button" className="btn btn-danger btn-sm" onClick={handleCerrar}>
                      Cerrar caja
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-7">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <h2 className="h6 card-title mb-3">Movimientos</h2>
                {movimientos.length === 0 ? (
                  <p className="text-secondary small mb-0">Sin movimientos aún.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm table-striped align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Tipo</th>
                          <th className="text-end">Monto</th>
                          <th>Descripción</th>
                          <th>Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movimientos.map((m) => (
                          <tr key={m.id}>
                            <td>
                              <span className="badge bg-secondary text-uppercase">{m.tipo}</span>
                            </td>
                            <td className="text-end">${Number(m.monto || 0).toLocaleString("es-CL")}</td>
                            <td className="small">{m.descripcion || "—"}</td>
                            <td className="small text-nowrap">
                              {(m.created_at || m.creado_en)
                                ? new Date(m.created_at || m.creado_en).toLocaleString("es-CL")
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
