import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { useSucursal } from "../../context/SucursalContext";
import {
  getInventario,
  crearItemInventario,
  actualizarItemInventario,
  eliminarItemInventario,
} from "../../services/inventarioService";
import "../../styles/inventario.css";

const UNIDADES = [
  "unidad",
  "paquete",
  "caja",
  "bolsa",
  "saco",
  "botella",
  "lata",
  "otro",
];

const initialForm = {
  nombre: "",
  cantidad: "",
  unidad_control: "paquete",
};

export default function Inventario() {
  const { sucursalActiva } = useSucursal();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [setupPendiente, setSetupPendiente] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [editId, setEditId] = useState(null);

  const tituloForm = useMemo(
    () => (editId ? "Editar insumo" : "Nuevo insumo"),
    [editId]
  );

  const load = useCallback(async () => {
    if (!sucursalActiva?.id) return;

    setLoading(true);
    try {
      const res = await getInventario(sucursalActiva.id);
      setItems(res.data || []);
      setSetupPendiente(Boolean(res.setupPendiente));
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "No se pudo cargar inventario", "error");
    } finally {
      setLoading(false);
    }
  }, [sucursalActiva?.id]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setForm(initialForm);
    setEditId(null);
  }

  function onEditar(item) {
    setEditId(item.id);
    setForm({
      nombre: item.nombre || "",
      cantidad: item.cantidad ?? "",
      unidad_control: item.unidad_control || "paquete",
    });
  }

  async function onGuardar(e) {
    e.preventDefault();

    const nombre = (form.nombre || "").trim();
    const cantidad = Number(form.cantidad);
    const unidad = form.unidad_control;

    if (!nombre) {
      Swal.fire("Dato requerido", "El nombre es obligatorio", "warning");
      return;
    }

    if (!Number.isFinite(cantidad) || cantidad < 0) {
      Swal.fire("Dato inválido", "La cantidad debe ser 0 o mayor", "warning");
      return;
    }

    try {
      if (!sucursalActiva?.id) {
        Swal.fire("Sucursal requerida", "Selecciona una sucursal activa", "warning");
        return;
      }

      if (editId) {
        await actualizarItemInventario(editId, {
          nombre,
          cantidad,
          unidad_control: unidad,
          sucursal_id: sucursalActiva.id,
        });
      } else {
        await crearItemInventario({
          nombre,
          cantidad,
          unidad_control: unidad,
          sucursal_id: sucursalActiva.id,
        });
      }

      await load();
      resetForm();
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "No se pudo guardar el insumo", "error");
    }
  }

  async function onEliminar(id) {
    const res = await Swal.fire({
      title: "Eliminar insumo",
      text: "Esta acción no se puede deshacer",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!res.isConfirmed) return;

    try {
      if (!sucursalActiva?.id) {
        Swal.fire("Sucursal requerida", "Selecciona una sucursal activa", "warning");
        return;
      }

      await eliminarItemInventario(id, sucursalActiva.id);
      await load();
      if (editId === id) resetForm();
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "No se pudo eliminar el insumo", "error");
    }
  }

  return (
    <div className="inventario-page">
      <div className="inventario-top">
        <h2>Inventario</h2>
        <p>Control simple por cantidad y tipo de unidad (paquete, caja, etc.).</p>
        <p className="mb-0">
          Sucursal: <strong>{sucursalActiva?.nombre || "---"}</strong>
        </p>
      </div>

      {setupPendiente && (
        <div className="inventario-setup-warning">
          La tabla `inventario` aun no existe en Supabase. Ya dejamos el modulo
          listo; cuando creen la tabla, este apartado comenzara a operar.
        </div>
      )}

      <div className="inventario-grid">
        <form className="inventario-form card border-0 shadow-sm" onSubmit={onGuardar}>
          <div className="card-body">
            <h5 className="mb-3">{tituloForm}</h5>

            <div className="mb-3">
              <label className="form-label">Insumo</label>
              <input
                type="text"
                className="form-control"
                value={form.nombre}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, nombre: e.target.value }))
                }
                placeholder="Ej: Soya, arroz, servilletas"
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Cantidad</label>
              <input
                type="number"
                min="0"
                step="1"
                className="form-control"
                value={form.cantidad}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, cantidad: e.target.value }))
                }
                placeholder="Ej: 12"
              />
            </div>

            <div className="mb-4">
              <label className="form-label">Unidad de control</label>
              <select
                className="form-select"
                value={form.unidad_control}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, unidad_control: e.target.value }))
                }
              >
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div className="d-flex gap-2 justify-content-end">
              {editId && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={resetForm}
                >
                  Cancelar edición
                </button>
              )}
              <button type="submit" className="btn btn-dark">
                {editId ? "Guardar cambios" : "Agregar insumo"}
              </button>
            </div>
          </div>
        </form>

        <div className="inventario-list card border-0 shadow-sm">
          <div className="card-body">
            <h5 className="mb-3">Stock actual</h5>

            {loading && <p className="text-muted mb-0">Cargando...</p>}

            {!loading && items.length === 0 && (
              <p className="text-muted mb-0">No hay insumos registrados.</p>
            )}

            {!loading &&
              items.map((item) => (
                <div key={item.id} className="inventario-item">
                  <div>
                    <strong>{item.nombre}</strong>
                    <div className="inventario-meta">
                      {Number(item.cantidad || 0)} {item.unidad_control || "unidad"}
                      {Number(item.cantidad || 0) !== 1 ? "s" : ""}
                    </div>
                  </div>

                  <div className="inventario-actions">
                    <button
                      className="btn btn-sm btn-outline-dark"
                      onClick={() => onEditar(item)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => onEliminar(item.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

