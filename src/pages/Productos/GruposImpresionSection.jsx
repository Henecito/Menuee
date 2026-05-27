import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  getGruposImpresion,
  createGrupoImpresion,
  updateGrupoImpresion,
  deleteGrupoImpresion,
  getAsignacionesCategorias,
  upsertAsignacionCategoria,
  deleteAsignacionCategoria,
  getCategoriasProductos,
} from "../../services/gruposImpresionService";

export default function GruposImpresionSection({ sucursalId, reloadKey = 0 }) {
  const [abierto, setAbierto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [grupos, setGrupos] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [editNombre, setEditNombre] = useState("");

  const mapaAsignaciones = useMemo(() => {
    const m = {};
    for (const a of asignaciones) {
      m[a.categoria] = a.grupo_impresion_id;
    }
    return m;
  }, [asignaciones]);

  const load = useCallback(async () => {
    if (!sucursalId) return;

    try {
      setLoading(true);
      const [g, a, c] = await Promise.all([
        getGruposImpresion(sucursalId),
        getAsignacionesCategorias(sucursalId),
        getCategoriasProductos(sucursalId),
      ]);
      setGrupos(g);
      setAsignaciones(a);
      setCategorias(c);
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "No se pudieron cargar los grupos de impresión", "error");
    } finally {
      setLoading(false);
    }
  }, [sucursalId]);

  useEffect(() => {
    if (abierto) load();
  }, [abierto, load, reloadKey]);

  async function handleCrearGrupo(e) {
    e.preventDefault();
    const nombre = nuevoNombre.trim();
    if (!nombre) return;

    try {
      await createGrupoImpresion(sucursalId, nombre);
      setNuevoNombre("");
      await load();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "No se pudo crear el grupo", "error");
    }
  }

  function iniciarEdicion(grupo) {
    setEditandoId(grupo.id);
    setEditNombre(grupo.nombre);
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setEditNombre("");
  }

  async function guardarEdicion(id) {
    const nombre = editNombre.trim();
    if (!nombre) return;

    try {
      await updateGrupoImpresion(id, { nombre });
      cancelarEdicion();
      await load();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "No se pudo actualizar el grupo", "error");
    }
  }

  async function toggleActivo(grupo) {
    try {
      await updateGrupoImpresion(grupo.id, { activo: !grupo.activo });
      await load();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "No se pudo cambiar el estado del grupo", "error");
    }
  }

  async function handleEliminarGrupo(grupo) {
    const res = await Swal.fire({
      title: "¿Eliminar grupo?",
      text: `"${grupo.nombre}" se eliminará. Las asignaciones de categoría vinculadas también se quitarán.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!res.isConfirmed) return;

    try {
      await deleteGrupoImpresion(grupo.id);
      await load();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "No se pudo eliminar el grupo", "error");
    }
  }

  async function handleAsignacionChange(categoria, valor) {
    try {
      if (!valor) {
        await deleteAsignacionCategoria(sucursalId, categoria);
      } else {
        await upsertAsignacionCategoria(sucursalId, categoria, Number(valor));
      }
      await load();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "No se pudo guardar la asignación", "error");
    }
  }

  const gruposActivos = grupos.filter((g) => g.activo);

  return (
    <section className="grupos-impresion-section">
      <button
        type="button"
        className="grupos-impresion-toggle"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
      >
        <span>
          <i className="fa-solid fa-print" aria-hidden="true" /> Grupos de impresión
        </span>
        <i className={`fa-solid fa-chevron-${abierto ? "up" : "down"}`} aria-hidden="true" />
      </button>

      {abierto && (
        <div className="grupos-impresion-body">
          <p className="grupos-impresion-hint">
            Estaciones para comandas futuras (barra, cocina, etc.). La asignación es por categoría de
            producto: todos los productos de una categoría comparten el mismo grupo.
          </p>

          {loading && (
            <p className="grupos-impresion-muted">Cargando...</p>
          )}

          {!loading && (
            <>
              <div className="grupos-impresion-block">
                <h3>Grupos</h3>
                <form className="grupos-impresion-form-inline" onSubmit={handleCrearGrupo}>
                  <input
                    className="productos-input"
                    placeholder="Nuevo grupo (ej. Barra, Cocina)"
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                  />
                  <button type="submit" className="productos-btn grupos-impresion-btn-sm">
                    Agregar
                  </button>
                </form>

                {grupos.length === 0 ? (
                  <p className="grupos-impresion-muted">No hay grupos creados.</p>
                ) : (
                  <ul className="grupos-impresion-lista">
                    {grupos.map((g) => (
                      <li key={g.id} className={g.activo ? "" : "inactivo"}>
                        {editandoId === g.id ? (
                          <div className="grupos-impresion-edit-row">
                            <input
                              className="productos-input"
                              value={editNombre}
                              onChange={(e) => setEditNombre(e.target.value)}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="productos-btn grupos-impresion-btn-sm"
                              onClick={() => guardarEdicion(g.id)}
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-dark"
                              onClick={cancelarEdicion}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="grupos-impresion-nombre">{g.nombre}</span>
                            <div className="grupos-impresion-acciones">
                              <label className="grupos-impresion-switch" title={g.activo ? "Activo" : "Inactivo"}>
                                <input
                                  type="checkbox"
                                  checked={!!g.activo}
                                  onChange={() => toggleActivo(g)}
                                />
                                <span>{g.activo ? "Activo" : "Inactivo"}</span>
                              </label>
                              <button
                                type="button"
                                className="btn-action btn-edit"
                                onClick={() => iniciarEdicion(g)}
                                title="Editar nombre"
                              >
                                <i className="fa-solid fa-pen" />
                              </button>
                              <button
                                type="button"
                                className="btn-action btn-delete"
                                onClick={() => handleEliminarGrupo(g)}
                                title="Eliminar"
                              >
                                <i className="fa-solid fa-trash" />
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="grupos-impresion-block">
                <h3>Asignación por categoría</h3>
                {categorias.length === 0 ? (
                  <p className="grupos-impresion-muted">
                    No hay categorías en los productos de esta sucursal. Creá productos con categoría
                    para asignarlas aquí.
                  </p>
                ) : gruposActivos.length === 0 ? (
                  <p className="grupos-impresion-muted">
                    Creá al menos un grupo activo para asignar categorías.
                  </p>
                ) : (
                  <div className="grupos-impresion-categorias-box">
                    <table className="grupos-impresion-categorias-table">
                      <thead>
                        <tr>
                          <th>Categoría (productos)</th>
                          <th>Grupo de impresión</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categorias.map((cat) => {
                          const asignado = mapaAsignaciones[cat];
                          const grupoAsignado = grupos.find((g) => g.id === asignado);

                          return (
                            <tr key={cat}>
                              <td>{cat}</td>
                              <td>
                                <select
                                  className="productos-input grupos-impresion-select"
                                  value={asignado ? String(asignado) : ""}
                                  onChange={(e) => handleAsignacionChange(cat, e.target.value)}
                                >
                                  <option value="">Sin asignar</option>
                                  {gruposActivos.map((g) => (
                                    <option key={g.id} value={g.id}>
                                      {g.nombre}
                                    </option>
                                  ))}
                                  {grupoAsignado && !grupoAsignado.activo && (
                                    <option value={grupoAsignado.id}>
                                      {grupoAsignado.nombre} (inactivo)
                                    </option>
                                  )}
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
