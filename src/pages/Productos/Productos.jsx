import { useEffect, useState, useCallback } from "react";
import Swal from "sweetalert2";
import {
  getProductos,
  getTodosProductos,
  addProducto,
  updateProducto,
  deleteProducto,
} from "../../services/productosService";
import { useSucursal } from "../../context/SucursalContext";
import ImportProductosModal from "./ImportProductosModal";
import GruposImpresionSection from "./GruposImpresionSection";
import "../../styles/productos.css";

export default function Productos() {
  const { sucursalActiva, loading: loadingSucursal, rol } = useSucursal();

  const [productos, setProductos] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verInactivos, setVerInactivos] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [gruposImpresionReloadKey, setGruposImpresionReloadKey] = useState(0);

  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    precio: "",
    categoria: "",
    activo: true,
  });

  const load = useCallback(async () => {
    if (!sucursalActiva) return;

    try {
      const res = verInactivos
        ? await getTodosProductos(sucursalActiva.id)
        : await getProductos(sucursalActiva.id);

      setProductos(res);
      setGruposImpresionReloadKey((k) => k + 1);
    } catch (e) {
      console.error("Error cargando productos:", e);
    }
  }, [sucursalActiva, verInactivos]);

  useEffect(() => {
    load();
  }, [load]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function editarProducto(p) {
    setEditandoId(p.id);
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion || "",
      precio: p.precio,
      categoria: p.categoria,
      activo: p.activo,
    });
  }

  async function desactivarProducto(id) {
    const res = await Swal.fire({
      title: "¿Desactivar producto?",
      text: "Este producto dejará de estar disponible",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Sí, desactivar",
      cancelButtonText: "Cancelar",
    });

    if (!res.isConfirmed) return;

    try {
      await deleteProducto(id);
      await Swal.fire({
        title: "Producto desactivado",
        icon: "success",
        timer: 1200,
        showConfirmButton: false,
      });
      load();
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "No se pudo desactivar el producto", "error");
    }
  }

  async function reactivarProducto(id) {
    const res = await Swal.fire({
      title: "¿Reactivar producto?",
      text: "El producto volverá a estar disponible",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#22c55e",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Sí, reactivar",
      cancelButtonText: "Cancelar",
    });

    if (!res.isConfirmed) return;

    try {
      await updateProducto(id, { activo: true });

      await Swal.fire({
        title: "Producto reactivado",
        icon: "success",
        timer: 1200,
        showConfirmButton: false,
      });

      load();
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "No se pudo reactivar el producto", "error");
    }
  }

  async function guardar(e) {
    e.preventDefault();
    if (!form.nombre || !form.precio || !form.categoria) return;
    if (!sucursalActiva) return;

    try {
      setLoading(true);

      const payload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion || null,
        precio: Number(form.precio),
        categoria: form.categoria,
        activo: form.activo,
      };

      if (editandoId) {
        await updateProducto(editandoId, payload);
      } else {
        await addProducto({
          ...payload,
          sucursal_id: sucursalActiva.id,
        });
      }

      await Swal.fire({
        title: editandoId ? "Producto actualizado" : "Producto creado",
        icon: "success",
        timer: 1000,
        showConfirmButton: false,
      });

      setForm({
        nombre: "",
        descripcion: "",
        precio: "",
        categoria: "",
        activo: true,
      });

      setEditandoId(null);
      load();
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "No se pudo guardar el producto", "error");
    } finally {
      setLoading(false);
    }
  }

  const productosFiltrados = productos.filter((p) => {
    const t = busqueda.toLowerCase();
    return (
      p.nombre.toLowerCase().includes(t) ||
      p.categoria.toLowerCase().includes(t) ||
      String(p.precio).includes(t) ||
      String(p.id).includes(t)
    );
  });

  if (loadingSucursal || !sucursalActiva) {
    return (
      <div className="productos-page">
        <div className="productos-card">
          <p style={{ color: "white", opacity: 0.7 }}>Cargando sucursal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="productos-page">
      <div className="productos-card">
        <div className="productos-header">
          <div className="productos-header-toolbar">
            <div className="productos-header-main">
              <h2>Productos</h2>
              <p>Administra los productos de esta sucursal</p>

              <div className="productos-header-actions">
                <button
                  className="btn btn-sm btn-dark mt-2"
                  onClick={() => setVerInactivos(!verInactivos)}
                >
                  {verInactivos ? "Ver solo activos" : "Ver todos (incluye desactivados)"}
                </button>

                <button
                  className="btn btn-sm btn-success mt-2"
                  onClick={() => setShowImportModal(true)}
                >
                  📥 Importar Excel
                </button>
              </div>
            </div>

            <div className="productos-header-search">
              <label className="productos-header-search-label">
                Buscar producto
              </label>
              <input
                className="productos-input productos-search-input"
                placeholder="Nombre, categoría, precio o ID..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </div>
        </div>

        {rol === "admin" && (
          <GruposImpresionSection
            sucursalId={sucursalActiva.id}
            reloadKey={gruposImpresionReloadKey}
          />
        )}

        <form className="productos-form" onSubmit={guardar}>
          <input className="productos-input" name="nombre" placeholder="Nombre del producto" value={form.nombre} onChange={handleChange} />
          <input className="productos-input" type="number" name="precio" placeholder="Precio" value={form.precio} onChange={handleChange} />
          <input className="productos-input" name="categoria" placeholder="Categoría" value={form.categoria} onChange={handleChange} />
          <textarea className="productos-input textarea" name="descripcion" placeholder="Descripción (opcional)" value={form.descripcion} onChange={handleChange} />

          <button className="productos-btn" disabled={loading}>
            {loading ? "Guardando..." : editandoId ? "Guardar cambios" : "Agregar producto"}
          </button>
        </form>

        <div className="productos-table-box">
          <table className="productos-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.map((p) => (
                <tr key={p.id} style={{ opacity: p.activo ? 1 : 0.4 }}>
                  <td className="id">{p.id}</td>
                  <td>{p.nombre}</td>
                  <td className="cat">{p.categoria}</td>
                  <td className="precio">${p.precio}</td>
                  <td className="acciones">
                    <button className="btn-action btn-edit" onClick={() => editarProducto(p)}>
                      <i className="fa-solid fa-pen"></i>
                    </button>

                    {p.activo ? (
                      <button
                        className="btn-action btn-delete"
                        onClick={() => desactivarProducto(p.id)}
                        title="Desactivar"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    ) : (
                      <button
                        className="btn-action"
                        style={{ background: "#22c55e" }}
                        onClick={() => reactivarProducto(p.id)}
                        title="Reactivar"
                      >
                        <i className="fa-solid fa-rotate-left"></i>
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {productosFiltrados.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", opacity: 0.6 }}>
                    No hay productos que coincidan con la búsqueda
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showImportModal && (
        <ImportProductosModal
          sucursalId={sucursalActiva.id}
          productosExistentes={productos}
          onClose={() => setShowImportModal(false)}
          onFinish={() => {
            setShowImportModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}
