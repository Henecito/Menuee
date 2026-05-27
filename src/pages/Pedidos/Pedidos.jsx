import { NavLink, Outlet } from "react-router-dom";
import "../../styles/pedidos.css";

export default function Pedidos() {
  return (
    <div className="pedidos-page">
      <div className="pedidos-header">
        <h2>Pedidos</h2>

        <div className="pedidos-tabs">
          <NavLink
            to="mostrador"
            className={({ isActive }) =>
              isActive ? "pedido-tab active" : "pedido-tab"
            }
          >
            Mostrador
          </NavLink>

          <NavLink
            to="delivery"
            className={({ isActive }) =>
              isActive ? "pedido-tab active" : "pedido-tab"
            }
          >
            Delivery
          </NavLink>
        </div>
      </div>

      <Outlet />
    </div>
  );
}
