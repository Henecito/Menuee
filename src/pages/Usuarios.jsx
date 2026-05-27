import { useEffect, useState, useCallback } from "react";
import UserFormModal from "../components/UserFormModal";
import { supabase } from "../supabaseClient";
import { useSucursal } from "../context/SucursalContext";
import { tienePermisoCaja } from "../utils/cajaPermisos";
import "../styles/usuarios.css";

const MODULOS_PERMISOS = [
  "mesas",
  "cocina",
  "pedidos",
  "reportes",
  "productos",
  "inventario",
  "usuarios",
];

const CAJA_ACCION_LABEL = {
  ver: "caja · ver",
  abrir: "caja · abrir",
  cerrar: "caja · cerrar",
  movimientos: "caja · mov.",
  historial: "caja · hist.",
};

const DEFAULT_PERMISOS = {
  mesas: true,
  cocina: true,
  pedidos: true,
  reportes: true,
  productos: true,
  inventario: true,
  usuarios: true,
};

export default function Usuarios() {
  const { sucursalActiva, permisos } = useSucursal();

  const [showForm, setShowForm] = useState(false);
  const puedeGestionarUsuarios = (permisos || DEFAULT_PERMISOS).usuarios === true;

  function getPermisosNormalizados(user) {
    return {
      ...DEFAULT_PERMISOS,
      ...(user?.permisos || {}),
    };
  }

  function renderPermisosBadges(user) {
    const p = getPermisosNormalizados(user);
    const activos = MODULOS_PERMISOS.filter((k) => p[k] === true);
    const cajaActivos = Object.keys(CAJA_ACCION_LABEL).filter((k) =>
      tienePermisoCaja(p, k)
    );

    if (!activos.length && !cajaActivos.length) {
      return <span className="badge text-bg-secondary">Sin permisos</span>;
    }

    return (
      <div className="d-flex flex-wrap gap-1">
        {activos.map((permiso) => (
          <span key={permiso} className="badge text-bg-light border text-dark">
            {permiso}
          </span>
        ))}
        {cajaActivos.map((k) => (
          <span key={`caja-${k}`} className="badge text-bg-light border text-dark">
            {CAJA_ACCION_LABEL[k]}
          </span>
        ))}
      </div>
    );
  }

  const [editUser, setEditUser] = useState(null);
  const [users, setUsers] = useState([]);

  const roleLabels = {
    admin: "Administrador",
    admin_local: "Admin Local",
    cocina: "Cocina",
    garzon: "Garzón",
    caja: "Caja",
  };

  const loadUsers = useCallback(async () => {
    if (!sucursalActiva) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("sucursal_id", sucursalActiva.id); // 🔥 CLAVE

    if (error) {
      console.error(error);
      return;
    }

    setUsers(data || []);
  }, [sucursalActiva]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function openCreate() {
    setEditUser(null);
    setShowForm(true);
  }

  function openEdit(user) {
    setEditUser(user);
    setShowForm(true);
  }

  async function deleteUser(id) {
    if (!window.confirm("¿Eliminar usuario?")) return;

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Error al eliminar");
      return;
    }

    loadUsers();
  }

  return (
    <div className="container-fluid usuarios-wrapper">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 py-4">
        <div>
          <h3 className="fw-bold mb-1">Usuarios</h3>
          <p className="text-muted small mb-0">
            Sucursal: {sucursalActiva?.nombre || "---"}
          </p>
        </div>

        {puedeGestionarUsuarios && (
          <button className="btn btn-dark rounded-3" onClick={openCreate}>
            + Nuevo usuario
          </button>
        )}
      </div>

      {/* DESKTOP */}
      <div className="card border-0 shadow-sm rounded-4 d-none d-md-block">
        <div className="card-body p-4">
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Permisos</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.nombre}</td>
                    <td>{user.email}</td>

                    <td>
                      <span className="badge bg-dark">
                        {roleLabels[user.rol] || user.rol}
                      </span>
                    </td>
                    <td>{renderPermisosBadges(user)}</td>

                    <td className="text-end">
                      <button
                        className="btn btn-outline-dark btn-sm rounded-3 me-2"
                        onClick={() => openEdit(user)}
                      >
                        Editar
                      </button>

                      <button
                        className="btn btn-outline-danger btn-sm rounded-3"
                        onClick={() => deleteUser(user.id)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MOBILE */}
      <div className="d-md-none">
        {users.map((u) => (
          <div
            key={u.id}
            className="user-card-mobile shadow-sm p-3 mb-3 rounded-4"
          >
            <div className="d-flex justify-content-between">
              <strong>{u.nombre}</strong>
              <span className="badge bg-dark">
                {roleLabels[u.rol] || u.rol}
              </span>
            </div>

            <small className="text-muted d-block mb-3">
              {u.email}
            </small>

            <div className="mb-2">{renderPermisosBadges(u)}</div>

            <div className="d-flex justify-content-end gap-2">
              <button
                className="btn btn-outline-dark btn-sm rounded-3"
                onClick={() => openEdit(u)}
              >
                <i className="fa-solid fa-pen"></i>
              </button>

              <button
                className="btn btn-outline-danger btn-sm rounded-3"
                onClick={() => deleteUser(u.id)}
              >
                <i className="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {showForm && (
        <UserFormModal
          onClose={() => {
            setShowForm(false);
            loadUsers(); // 🔥 refresca después de crear/editar
          }}
          user={editUser}
        />
      )}
    </div>
  );
}