import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useSucursal } from "../context/SucursalContext";
import { useEffect, useState } from "react";

export default function NavbarAdmin() {
  const navigate = useNavigate();
  const { sucursales, sucursalActiva, setSucursalActiva, loading, rol } =
    useSucursal();
  const isAdmin = rol === "admin";

  const [profileName, setProfileName] = useState("");

  async function logout() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("nombre")
        .eq("id", user.id)
        .single();

      setProfileName(data?.nombre || "");
    }

    loadProfile();
  }, []);

  return (
    <>
      {/* NAVBAR PRINCIPAL */}
      <nav className="navbar navbar-dark bg-black px-3 shadow">
        <div className="container-fluid d-flex align-items-center">

          {/* BOTÓN HAMBURGUESA (mobile - abre sidebar) */}
          <button
            className="btn btn-dark d-md-none me-2"
            data-bs-toggle="offcanvas"
            data-bs-target="#mobileSidebar"
          >
            <i className="fa-solid fa-bars"></i>
          </button>

          {/* Branding */}
          <span className="navbar-brand fw-semibold">
            Panel Administrativo
          </span>

          {/* Selector sucursal (desktop) */}
          <div className="mx-auto d-none d-md-flex align-items-center gap-2">
            <i className="fa-solid fa-store text-white-50"></i>

            {!loading && sucursalActiva && isAdmin && (
              <select
                className="form-select form-select-sm bg-dark text-white border-secondary rounded-3"
                value={sucursalActiva.id}
                onChange={(e) => {
                  if (!isAdmin) {
                    window.alert("No tienes permisos");
                    return;
                  }
                  const selected = sucursales.find(
                    (s) => s.id === Number(e.target.value)
                  );
                  setSucursalActiva(selected);
                }}
                style={{ minWidth: 220 }}
              >
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Perfil usuario */}
          <div className="dropdown">
            <button
              className="btn text-white border-0 dropdown-toggle d-flex align-items-center"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <i className="fa-solid fa-user-circle fs-5 fs-md-4"></i>
            </button>

            <ul className="dropdown-menu dropdown-menu-end shadow">
              <li>
                <span className="dropdown-item-text fw-semibold">
                  {profileName}
                </span>
              </li>

              <li><hr className="dropdown-divider" /></li>

              <li>
                <button
                  className="dropdown-item text-danger d-flex align-items-center gap-2"
                  onClick={logout}
                >
                  <i className="fa-solid fa-right-from-bracket"></i>
                  Cerrar sesión
                </button>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Selector sucursal (mobile debajo) */}
      <div className="d-md-none bg-black px-3 py-2 border-top border-secondary">
        {!loading && sucursalActiva && isAdmin && (
          <div className="d-flex align-items-center gap-2">
            <i className="fa-solid fa-store text-white-50"></i>

            <select
              className="form-select form-select-sm bg-dark text-white border-secondary rounded-3"
              value={sucursalActiva.id}
              onChange={(e) => {
                if (!isAdmin) {
                  window.alert("No tienes permisos");
                  return;
                }
                const selected = sucursales.find(
                  (s) => s.id === Number(e.target.value)
                );
                setSucursalActiva(selected);
              }}
            >
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </>
  );
}
