import { useState } from "react";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import { addProductosBatch } from "../../services/productosService";
import "../../styles/productos.css";

const IMAGEN_DEFAULT = "https://tusitio.com/productos/papas_fritas.png";

export default function ImportProductosModal({
  onClose,
  sucursalId,
  productosExistentes,
  onFinish,
}) {
  const [excelFile, setExcelFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  /* ================= HELPERS ================= */

  function normalizarTexto(txt = "") {
    return txt
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function getCampo(fila, campoBuscado) {
    const key = Object.keys(fila).find(
      (k) => normalizarTexto(k) === normalizarTexto(campoBuscado),
    );
    return key ? fila[key] : "";
  }

  function parseEstado(valor) {
    const v = normalizarTexto(valor);

    if (["si", "sí", "true", "1", "activo", "yes"].includes(v)) return true;
    if (["no", "false", "0", "inactivo", "nope"].includes(v)) return false;

    return true; // por defecto activo
  }

  function existeEnDB(nombre, categoria) {
    return productosExistentes.some((p) => {
      return (
        normalizarTexto(p.nombre) === normalizarTexto(nombre) &&
        normalizarTexto(p.categoria) === normalizarTexto(categoria)
      );
    });
  }

  /* ================= LEER EXCEL ================= */

  async function leerExcel(file) {
    setLoading(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const procesadas = json.map((fila, index) => {
        const nombre = getCampo(fila, "nombre");
        const precio = getCampo(fila, "precio");
        const categoria = getCampo(fila, "categoria");
        const descripcion = getCampo(fila, "descripcion");
        const estadoExcel = getCampo(fila, "estado");

        const activo = parseEstado(estadoExcel);

        let estado = "nuevo";
        let error = "";

        if (!nombre || !precio || !categoria) {
          estado = "error";
          error = "Faltan campos obligatorios";
        } else if (isNaN(Number(precio))) {
          estado = "error";
          error = "Precio inválido";
        } else if (existeEnDB(nombre, categoria)) {
          estado = "existente";
        }

        return {
          index: index + 2,
          nombre: nombre.toString(),
          descripcion: descripcion?.toString() || "",
          precio: Number(precio),
          categoria: categoria.toString(),
          activo,
          estado,
          error,
        };
      });

      setRows(procesadas);
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "No se pudo leer el archivo", "error");
    } finally {
      setLoading(false);
    }
  }

  /* ================= IMPORTAR MASIVO ================= */

  async function importarProductos() {
    const nuevos = rows.filter((r) => r.estado === "nuevo");

    if (nuevos.length === 0) {
      Swal.fire(
        "Nada para importar",
        "No hay productos nuevos válidos",
        "info",
      );
      return;
    }

    try {
      setLoading(true);

      const payload = nuevos.map((p) => ({
        nombre: p.nombre,
        descripcion: p.descripcion || null,
        precio: p.precio,
        categoria: p.categoria,
        sucursal_id: sucursalId,
        activo: p.activo,
        imagen_url: IMAGEN_DEFAULT,
      }));

      await addProductosBatch(payload);

      await Swal.fire(
        "Importación completa",
        `${payload.length} productos importados`,
        "success",
      );

      onFinish();
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "Falló la importación masiva", "error");
    } finally {
      setLoading(false);
    }
  }

  /* ================= UI ================= */

  return (
    <div className="import-modal-backdrop">
      <div
        className="import-modal"
        style={{ maxWidth: 900, position: "relative" }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 10,
            right: 12,
            background: "transparent",
            border: "none",
            fontSize: 18,
            cursor: "pointer",
            color: "#94a3b8",
          }}
          title="Cerrar"
        >
          ✕
        </button>

        <h3>Importar productos</h3>
        <p>Sube un archivo Excel (.xls o .xlsx)</p>

        {!rows.length && (
          <>
            <label className="import-dropzone">
              <input
                type="file"
                accept=".xls,.xlsx"
                hidden
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  setExcelFile(file);
                  leerExcel(file);
                }}
              />
              {excelFile
                ? excelFile.name
                : "Arrastra tu Excel aquí o haz click"}
            </label>

            {loading && <p style={{ opacity: 0.6 }}>Leyendo archivo...</p>}
          </>
        )}

        {rows.length > 0 && (
          <>
            <div style={{ maxHeight: 340, overflow: "auto", marginTop: 14 }}>
              <table className="productos-table">
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>Nombre</th>
                    <th>Categoría</th>
                    <th>Precio</th>
                    <th>Activo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={i}
                      style={{
                        opacity: r.estado === "existente" ? 0.4 : 1,
                        background:
                          r.estado === "error"
                            ? "rgba(239,68,68,0.08)"
                            : r.estado === "existente"
                              ? "rgba(234,179,8,0.05)"
                              : "transparent",
                      }}
                    >
                      <td>{r.index}</td>
                      <td>{r.nombre}</td>
                      <td>{r.categoria}</td>
                      <td>${r.precio}</td>
                      <td>{r.activo ? "Sí" : "No"}</td>
                      <td>
                        {r.estado === "nuevo" && "🟢 Nuevo"}
                        {r.estado === "existente" && "🟡 Ya existe"}
                        {r.estado === "error" && `🔴 ${r.error}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="import-actions">
              <button onClick={onClose}>Cancelar</button>

              <button disabled={loading} onClick={importarProductos}>
                {loading ? "Importando..." : "Importar productos"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
