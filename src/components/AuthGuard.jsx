import { Navigate } from "react-router-dom";
import { useSucursal } from "../context/SucursalContext";

export default function AuthGuard({ children }) {
  const { authReady, loading, profile } = useSucursal();

  if (!authReady || loading) {
    return <p>Cargando...</p>;
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
