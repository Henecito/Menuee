import { NavLink } from "react-router-dom";
import { useSucursal } from "../context/SucursalContext";
import { accesoModuloCaja } from "../utils/cajaPermisos";

export default function Sidebar({ mobile = false }) {
  const { permisos = {}, rol } = useSucursal();

  const baseClass = mobile
    ? "list-group list-group-flush"
    : "list-group list-group-flush vh-100 pt-3";

  return (
    <div className={baseClass}>
      {permisos.resumen === true && (
        <NavItem to="/" icon="fa-chart-line" label="Resumen" />
      )}
      {permisos.pedidos === true && (
        <NavItem to="/pedidos" icon="fa-receipt" label="Pedidos" />
      )}
      {accesoModuloCaja(permisos, rol, "ver") && (
        <NavItem to="/caja" icon="fa-money-bill-wave" label="Caja" />
      )}
      {accesoModuloCaja("historial") && (
        <NavItem to="/caja/historial" icon="fa-clock-rotate-left" label="Arqueo histórico" />
      )}
      {permisos.productos === true && (
        <NavItem to="/productos" icon="fa-box-open" label="Productos" />
      )}
      {permisos.inventario === true && (
        <NavItem to="/inventario" icon="fa-boxes-stacked" label="Inventario" />
      )}
      {permisos.mesas === true && (
        <NavItem to="/mesas" icon="fa-table" label="Mesas" />
      )}
      {permisos.cocina === true && (
        <NavItem to="/cocina" icon="fa-utensils" label="Cocina" />
      )}

      <hr className="border-secondary my-3" />

      <NavItem to="/sucursales" icon="fa-store" label="Sucursales" />
      {permisos.usuarios === true && (
        <NavItem to="/usuarios" icon="fa-users" label="Usuarios" />
      )}
      {permisos.reportes === true && (
        <NavItem to="/reportes" icon="fa-file-lines" label="Reportes" />
      )}
    </div>
  );
}

function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `list-group-item list-group-item-action bg-black text-white border-0 d-flex align-items-center gap-3 ${
          isActive ? "fw-semibold" : "text-white-50"
        }`
      }
    >
      <i className={`fa-solid ${icon}`}></i>
      <span>{label}</span>
    </NavLink>
  );
}
