import NavbarAdmin from "./NavbarAdmin";
import Sidebar from "./Sidebar";
import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <>
      <NavbarAdmin />

      <div className="d-flex flex-column flex-md-row">

        {/* Sidebar desktop: ancho fijo (no se encoge con el contenido); mobile sigue en offcanvas */}
        <div
          className="d-none d-md-block bg-black flex-shrink-0"
          style={{ width: 240, minWidth: 240, maxWidth: 240 }}
        >
          <Sidebar />
        </div>

        {/* Content */}
        <div className="flex-grow-1 bg-light min-vh-100 p-2 p-md-4">
          <Outlet />
        </div>

      </div>

      {/* Sidebar mobile */}
      <div
        className="offcanvas offcanvas-start bg-black text-white"
        tabIndex="-1"
        id="mobileSidebar"
      >
        <div className="offcanvas-header">
          <h5 className="offcanvas-title">Menú</h5>
          <button
            type="button"
            className="btn-close btn-close-white"
            data-bs-dismiss="offcanvas"
          ></button>
        </div>

        <div className="offcanvas-body p-0">
          <Sidebar mobile />
        </div>
      </div>
    </>
  );
}
