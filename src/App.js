import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import AuthGuard from "./components/AuthGuard";
import { useSucursal } from "./context/SucursalContext";

import Dashboard from "./pages/Dashboard";

// PEDIDOS (layout + subvistas)
import Pedidos from "./pages/Pedidos/Pedidos";
import Mostrador from "./pages/Pedidos/Mostrador";
import Delivery from "./pages/Pedidos/Delivery";

import Productos from "./pages/Productos/Productos";
import Inventario from "./pages/Inventario/Inventario";
import Mesas from "./pages/Mesas/Mesas";
import Sucursales from "./pages/Sucursales";
import Usuarios from "./pages/Usuarios";
import Reportes from "./pages/Reportes/Reportes";
import Cocina from "./pages/Cocina";
import Caja from "./pages/Caja";
import CajaHistorial from "./pages/CajaHistorial";
import CajaPermisoRoute from "./components/CajaPermisoRoute";
import Login from "./pages/Login";

import "./styles/globals.css";

function getFirstAllowedPath(permisos = {}, rol) {
  const orderedViews = [
    { path: "/", allowed: permisos.resumen === true },
    { path: "/pedidos", allowed: permisos.pedidos === true },
    { path: "/productos", allowed: permisos.productos === true },
    { path: "/inventario", allowed: permisos.inventario === true },
    { path: "/mesas", allowed: permisos.mesas === true },
    { path: "/cocina", allowed: permisos.cocina === true },
    {
      path: "/caja",
      allowed:
        rol === "admin" ||
        (permisos?.caja &&
          typeof permisos.caja === "object" &&
          permisos.caja.ver === true),
    },
    { path: "/sucursales", allowed: true },
    { path: "/usuarios", allowed: permisos.usuarios === true },
    { path: "/reportes", allowed: permisos.reportes === true },
  ];

  const first = orderedViews.find((view) => view.allowed);
  return first?.path || "/login";
}

function DashboardHome() {
  const { permisos = {}, rol, loading } = useSucursal();

  if (loading) return <p className="px-4 pt-4">Cargando datos...</p>;
  if (rol === "admin") return <Dashboard />;
  if (permisos.resumen === true) return <Dashboard />;

  return <Navigate to={getFirstAllowedPath(permisos, rol)} replace />;
}

export default function App() {
  return (
    <BrowserRouter basename={process.env.PUBLIC_URL}>
      <Routes>

        {/* LOGIN - acceso público */}
        <Route path="/login" element={<Login />} />

        {/* PANEL - rutas protegidas */}
        <Route
          element={
            <AuthGuard>
              <Layout />
            </AuthGuard>
          }
        >
          <Route path="/" element={<DashboardHome />} />

          {/* ===== PEDIDOS ===== */}
          <Route path="/pedidos" element={<Pedidos />}>
            <Route index element={<Mostrador />} /> {/* default */}
            <Route path="mostrador" element={<Mostrador />} />
            <Route path="delivery" element={<Delivery />} />
          </Route>

          <Route path="/productos" element={<Productos />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/mesas" element={<Mesas />} />
          <Route
            path="/caja"
            element={
              <CajaPermisoRoute accion="ver">
                <Caja />
              </CajaPermisoRoute>
            }
          />
          <Route
            path="/caja/historial"
            element={
              <CajaPermisoRoute accion="historial">
                <CajaHistorial />
              </CajaPermisoRoute>
            }
          />
          <Route path="/cocina" element={<Cocina />} />
          <Route path="/sucursales" element={<Sucursales />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/reportes" element={<Reportes />} />
        </Route>

        {/* fallback */}
        <Route path="*" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}
