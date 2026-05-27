import { useState, useEffect } from "react";
import "./userformmodal.css";
import { createUser, updateUser } from "../services/userService";
import { useSucursal } from "../context/SucursalContext"; // 🔥 agregado
import {
  getImpresionPermisosByRol,
  mergeImpresionPermisos,
} from "../utils/impresionPermisos";

const MODULOS_PERMISOS = [
  "mesas",
  "cocina",
  "pedidos",
  "reportes",
  "productos",
  "inventario",
  "usuarios",
];

const DEFAULT_PERMISOS = {
  mesas: true,
  cocina: true,
  pedidos: true,
  reportes: true,
  productos: true,
  inventario: true,
  usuarios: true,
};

const CAJA_ACCIONES = ["ver", "abrir", "cerrar", "movimientos", "historial"];

function defaultCajaPermisos() {
  return {
    ver: false,
    abrir: false,
    cerrar: false,
    movimientos: false,
    historial: false,
  };
}

function mergeCajaPermisos(permisosParciales) {
  const c = permisosParciales?.caja;
  if (c && typeof c === "object") {
    return { ...defaultCajaPermisos(), ...c };
  }
  return defaultCajaPermisos();
}

function getPermisosByRol(rol) {
  const impresion = getImpresionPermisosByRol(rol);

  if (rol === "admin" || rol === "admin_local") {
    return { ...DEFAULT_PERMISOS, impresion };
  }
  if (rol === "cocina") {
    return {
      mesas: false,
      cocina: true,
      pedidos: true,
      reportes: false,
      productos: false,
      inventario: false,
      usuarios: false,
      impresion,
    };
  }
  if (rol === "garzon") {
    return {
      mesas: true,
      cocina: false,
      pedidos: true,
      reportes: false,
      productos: false,
      inventario: false,
      usuarios: false,
      impresion,
    };
  }
  if (rol === "caja") {
    return {
      mesas: false,
      cocina: false,
      pedidos: false,
      reportes: false,
      productos: false,
      inventario: false,
      usuarios: false,
      impresion,
      caja: {
        ver: true,
        abrir: true,
        cerrar: true,
        movimientos: true,
        historial: true,
      },
    };
  }
  return {
    mesas: false,
    cocina: false,
    pedidos: false,
    reportes: false,
    productos: false,
    inventario: false,
    usuarios: false,
    impresion,
  };
}

export default function UserFormModal({ onClose, user }) {
  const { sucursalActiva } = useSucursal(); // 🔥 agregado

  const isEdit = Boolean(user);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState("cocina");
  const [password, setPassword] = useState("");
  const [permisos, setPermisos] = useState(DEFAULT_PERMISOS);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (user) {
      const userRol = user.rol || "cocina";
      setNombre(user.nombre || "");
      setEmail(user.email || "");
      setRol(userRol);
      const base = {
        ...getPermisosByRol(userRol),
        ...(user.permisos || {}),
      };
      setPermisos({
        ...base,
        caja: mergeCajaPermisos(base),
        impresion: mergeImpresionPermisos(base),
      });
    } else {
      setNombre("");
      setEmail("");
      setRol("cocina");
      setPassword("");
      const baseNuevo = getPermisosByRol("cocina");
      setPermisos({
        ...baseNuevo,
        caja: mergeCajaPermisos(baseNuevo),
        impresion: mergeImpresionPermisos(baseNuevo),
      });
    }
  }, [user]);

  function validate() {
    if (!(nombre || "").trim()) return "El nombre es obligatorio";

    if (!isEdit && password.length < 4)
      return "La contraseña debe tener al menos 4 caracteres";

    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (loading) return;

    setErrorMsg("");

    const validationError = validate();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setLoading(true);

    const cleanEmail = (email || "").trim().toLowerCase();

    let res;

    if (isEdit) {
      res = await updateUser(user.id, {
        nombre,
        rol,
        permisos,
      });
    } else {
      res = await createUser({
        nombre,
        email: cleanEmail,
        password,
        rol,
        sucursal_id: sucursalActiva?.id, // 🔥 único cambio real
      });
    }

    setLoading(false);

    if (res.success) {
      setNombre("");
      setEmail("");
      setPassword("");
      setRol("cocina");

      onClose();
    } else {
      setErrorMsg(res.error || "Error inesperado");
    }
  }

  return (
    <div className="modal-backdrop-custom" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-card-header">
          <h5 className="fw-bold">
            {isEdit ? "Editar usuario" : "Nuevo usuario"}
          </h5>
        </div>

        <form className="modal-card-form" onSubmit={handleSubmit}>
          <div className="modal-card-body">
          {errorMsg && (
            <div className="alert alert-danger py-2">
              {errorMsg}
            </div>
          )}

          <div className="mb-3">
            <label className="form-label">Nombre</label>
            <input
              type="text"
              className="form-control rounded-3"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Correo</label>
            <input
              type="email"
              className="form-control rounded-3"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isEdit}
            />
          </div>

          {!isEdit && (
            <div className="mb-3">
              <label className="form-label">Contraseña</label>
              <input
                type="password"
                className="form-control rounded-3"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}

          <div className="mb-4">
            <label className="form-label">Rol</label>
            <select
              className="form-select rounded-3"
              value={rol}
              onChange={(e) => setRol(e.target.value)}
            >
              <option value="admin">Admin</option>
              <option value="admin_local">Administrador Local</option>
              <option value="cocina">Cocina</option>
              <option value="garzon">Garzón</option>
              <option value="caja">Caja</option>
            </select>
          </div>

          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <label className="form-label mb-0">Permisos</label>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-3"
                onClick={() => setPermisos(getPermisosByRol(rol))}
              >
                Resetear permisos según rol
              </button>
            </div>

            <div className="d-flex flex-wrap gap-2">
              {MODULOS_PERMISOS.map((key) => (
                <label
                  key={key}
                  className="border rounded-3 px-2 py-1 d-flex align-items-center gap-2 bg-light"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(permisos[key])}
                    onChange={(e) =>
                      setPermisos((prev) => ({
                        ...prev,
                        [key]: e.target.checked,
                      }))
                    }
                  />
                  <span className="text-capitalize small">{key}</span>
                </label>
              ))}
            </div>

            <div className="mt-3 pt-3 border-top">
              <label className="form-label small text-muted mb-2">Impresión</label>
              <div className="d-flex flex-wrap gap-2">
                <label className="border rounded-3 px-2 py-1 d-flex align-items-center gap-2 bg-light">
                  <input
                    type="checkbox"
                    checked={Boolean(mergeImpresionPermisos(permisos).precuentas)}
                    onChange={(e) =>
                      setPermisos((prev) => ({
                        ...prev,
                        impresion: {
                          ...mergeImpresionPermisos(prev),
                          precuentas: e.target.checked,
                        },
                      }))
                    }
                  />
                  <span className="small">Pre-cuentas cliente</span>
                </label>
                <label className="border rounded-3 px-2 py-1 d-flex align-items-center gap-2 bg-light">
                  <input
                    type="checkbox"
                    checked={Boolean(mergeImpresionPermisos(permisos).comandas)}
                    onChange={(e) =>
                      setPermisos((prev) => ({
                        ...prev,
                        impresion: {
                          ...mergeImpresionPermisos(prev),
                          comandas: e.target.checked,
                        },
                      }))
                    }
                  />
                  <span className="small">Comandas cocina/barra</span>
                </label>
              </div>
            </div>

            <div className="mt-3 pt-3 border-top">
              <label className="form-label small text-muted mb-2">Caja (arqueo)</label>
              <div className="d-flex flex-wrap gap-2">
                {CAJA_ACCIONES.map((accion) => (
                  <label
                    key={accion}
                    className="border rounded-3 px-2 py-1 d-flex align-items-center gap-2 bg-light"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(mergeCajaPermisos(permisos)[accion])}
                      onChange={(e) =>
                        setPermisos((prev) => ({
                          ...prev,
                          caja: {
                            ...mergeCajaPermisos(prev),
                            [accion]: e.target.checked,
                          },
                        }))
                      }
                    />
                    <span className="small">
                      {accion === "ver" && "Ver caja"}
                      {accion === "abrir" && "Abrir caja"}
                      {accion === "cerrar" && "Cerrar caja"}
                      {accion === "movimientos" && "Movimientos"}
                      {accion === "historial" && "Historial"}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          </div>

          <div className="modal-card-footer">
            <button
              type="button"
              className="btn btn-outline-dark rounded-3"
              onClick={onClose}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="btn btn-dark rounded-3"
              disabled={loading}
            >
              {loading
                ? "Guardando..."
                : isEdit
                ? "Guardar"
                : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}