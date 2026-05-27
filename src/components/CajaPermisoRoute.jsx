import { Navigate } from "react-router-dom";
import { useSucursal } from "../context/SucursalContext";
import { accesoModuloCaja } from "../utils/cajaPermisos";

/**
 * Protege rutas de caja: admin o `permisos.caja[accion] === true`.
 */
export default function CajaPermisoRoute({ accion, children }) {
  const { permisos, rol, loading, authReady } = useSucursal();

  if (!authReady || loading) {
    return <p className="px-4 pt-4 text-secondary">Cargando…</p>;
  }

  if (accesoModuloCaja(permisos, rol, accion)) {
    return children;
  }

  return <Navigate to="/" replace />;
}
