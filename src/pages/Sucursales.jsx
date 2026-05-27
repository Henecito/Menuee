import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { useSucursal } from "../context/SucursalContext";
import { getSucursalesByLocal, updateSucursal } from "../services/sucursalesService";
import {
  horariosPorDiaDesdeDb,
  validarHorariosPorDia,
  serializarHorariosPorDia,
  getHorarioAtencionPreferido,
  horariosTieneFormatoPorDia,
  leerMismoHorarioTodosLosDias,
  obtenerPlantillaDesdeEstado,
  replicarBloquesEnTodosLosDias,
} from "../utils/sucursalHorarios";
import HorariosPorDiaEditor from "../components/HorariosPorDiaEditor";
import TicketPreviewEditor from "../components/TicketPreviewEditor";
import { ORDEN_ENCABEZADO_DEFAULT } from "../utils/ticketSucursalConfig";

const emptyForm = {
  nombre: "",
  direccion: "",
  horario_atencion: "",
  horario_reparto: "",
  telefono: "",
  correo_electronico: "",
  logo_url: "",
  activo: true,
  latitud: "",
  longitud: "",
  nombre_ticket: "",
  subtitulo_ticket: "",
  direccion_ticket: "",
  telefono_ticket: "",
  instagram_ticket: "",
  mensaje_superior_ticket: "",
  mensaje_final_ticket: "",
  info_adicional_ticket: "",
  ticket_encabezado_orden: [...ORDEN_ENCABEZADO_DEFAULT],
  ticket_ver_nombre: true,
  ticket_ver_subtitulo: true,
  ticket_ver_direccion: true,
  ticket_ver_telefono: true,
  ticket_ver_instagram: true,
  ticket_ver_mensaje_superior: true,
  ticket_ver_mensaje_final: true,
  ticket_ver_info_adicional: true,
};

function abrirGoogleMaps(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return;
  window.open(
    `https://www.google.com/maps?q=${latitude},${longitude}`,
    "_blank",
    "noopener,noreferrer"
  );
}

const MAP_DEFAULT_CENTER = [-34.6037, -58.3816];
const MAP_DEFAULT_ZOOM = 5;
const MAP_WITH_MARKER_ZOOM = 16;

function ensureLeafletCss() {
  if (document.querySelector("link[data-gastro-leaflet-css]")) return;
  const link = document.createElement("link");
  link.setAttribute("data-gastro-leaflet-css", "1");
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
}

function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.L) {
      resolve(window.L);
      return;
    }
    const existing = document.querySelector("script[data-gastro-leaflet-js]");
    if (existing) {
      const id = setInterval(() => {
        if (window.L) {
          clearInterval(id);
          resolve(window.L);
        }
      }, 40);
      setTimeout(() => {
        clearInterval(id);
        if (!window.L) reject(new Error("Leaflet no cargó"));
      }, 15000);
      return;
    }
    const script = document.createElement("script");
    script.setAttribute("data-gastro-leaflet-js", "1");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("No se pudo cargar Leaflet"));
    document.body.appendChild(script);
  });
}

function fixLeafletDefaultIcons(L) {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

export default function Sucursales() {
  const { profile, loading: contextLoading } = useSucursal();
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localId, setLocalId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [horariosPorDia, setHorariosPorDia] = useState(() => horariosPorDiaDesdeDb(null));
  /** Si la sucursal tenía JSON no-v2 y el editor sigue sin bloques, no enviar `horarios` al guardar (no pisar legacy). */
  const [preservarHorariosLegacy, setPreservarHorariosLegacy] = useState(false);
  const [mismoHorarioTodosLosDias, setMismoHorarioTodosLosDias] = useState(false);

  const [geoBusqueda, setGeoBusqueda] = useState("");
  const [geoResultados, setGeoResultados] = useState([]);
  const [geoCargando, setGeoCargando] = useState(false);

  const formRef = useRef(emptyForm);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const reverseDebounceRef = useRef(null);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const syncDireccionDesdeCoords = useCallback((lat, lng) => {
    if (reverseDebounceRef.current) clearTimeout(reverseDebounceRef.current);
    reverseDebounceRef.current = setTimeout(async () => {
      reverseDebounceRef.current = null;
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
          lat
        )}&lon=${encodeURIComponent(lng)}`;
        const res = await fetch(url, { headers: { "Accept-Language": "es,en" } });
        if (!res.ok) return;
        const data = await res.json();
        const name = data.display_name;
        if (!name) return;
        setForm((prev) => ({ ...prev, direccion: name }));
      } catch (e) {
        console.error(e);
      }
    }, 700);
  }, []);

  const selectedSucursal = useMemo(
    () => sucursales.find((s) => s.id === editId) || null,
    [sucursales, editId]
  );

  const load = useCallback(async () => {
    if (!localId) return;

    setLoading(true);
    try {
      const data = await getSucursalesByLocal(localId);
      setSucursales(data);
      if (!editId && data.length > 0) {
        handleSelectSucursal(data[0]);
      }
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "No se pudieron cargar las sucursales", "error");
    } finally {
      setLoading(false);
    }
  }, [localId, editId]);

  useEffect(() => {
    if (contextLoading) return;

    if (profile?.local_id) {
      setLocalId(profile.local_id);
      return;
    }

    setLoading(false);
  }, [contextLoading, profile?.local_id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const q = geoBusqueda.trim();
    if (!q) {
      setGeoResultados([]);
      return undefined;
    }
    const handle = setTimeout(async () => {
      setGeoCargando(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          q
        )}&limit=6&addressdetails=1`;
        const res = await fetch(url, { headers: { "Accept-Language": "es,en" } });
        if (!res.ok) throw new Error("nominatim");
        const data = await res.json();
        setGeoResultados(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setGeoResultados([]);
      } finally {
        setGeoCargando(false);
      }
    }, 650);
    return () => clearTimeout(handle);
  }, [geoBusqueda]);

  useEffect(() => {
    if (!editId || !mapContainerRef.current) return undefined;

    let cancelled = false;
    let mapInstance = null;

    ensureLeafletCss();
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapContainerRef.current) return;
        fixLeafletDefaultIcons(L);

        const f = formRef.current;
        const latStr = f.latitud;
        const lngStr = f.longitud;
        const latNum = latStr === "" ? NaN : Number(latStr);
        const lngNum = lngStr === "" ? NaN : Number(lngStr);
        const hasCoords = !Number.isNaN(latNum) && !Number.isNaN(lngNum);

        mapInstance = L.map(mapContainerRef.current, { scrollWheelZoom: true }).setView(
          hasCoords ? [latNum, lngNum] : MAP_DEFAULT_CENTER,
          hasCoords ? MAP_WITH_MARKER_ZOOM : MAP_DEFAULT_ZOOM
        );

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(mapInstance);

        let marker = null;
        if (hasCoords) {
          marker = L.marker([latNum, lngNum], { draggable: true }).addTo(mapInstance);
          marker.on("dragend", () => {
            const p = marker.getLatLng();
            setForm((prev) => ({
              ...prev,
              latitud: String(p.lat),
              longitud: String(p.lng),
            }));
            syncDireccionDesdeCoords(p.lat, p.lng);
          });
        }

        mapInstanceRef.current = mapInstance;
        markerRef.current = marker;

        mapInstance.on("click", (e) => {
          const { lat, lng } = e.latlng;
          if (!markerRef.current) {
            const m = L.marker([lat, lng], { draggable: true }).addTo(mapInstance);
            m.on("dragend", () => {
              const p = m.getLatLng();
              setForm((prev) => ({
                ...prev,
                latitud: String(p.lat),
                longitud: String(p.lng),
              }));
              syncDireccionDesdeCoords(p.lat, p.lng);
            });
            markerRef.current = m;
          } else {
            markerRef.current.setLatLng([lat, lng]);
          }
          setForm((prev) => ({
            ...prev,
            latitud: String(lat),
            longitud: String(lng),
          }));
          syncDireccionDesdeCoords(lat, lng);
        });

        setTimeout(() => {
          if (!cancelled && mapInstance) mapInstance.invalidateSize();
        }, 250);
      })
      .catch((e) => {
        console.error(e);
      });

    return () => {
      cancelled = true;
      if (reverseDebounceRef.current) {
        clearTimeout(reverseDebounceRef.current);
        reverseDebounceRef.current = null;
      }
      mapInstanceRef.current = null;
      markerRef.current = null;
      if (mapInstance) {
        mapInstance.remove();
      }
    };
  }, [editId, syncDireccionDesdeCoords]);

  function aplicarCoordenadasDesdeNominatim(item) {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return;

    if (reverseDebounceRef.current) {
      clearTimeout(reverseDebounceRef.current);
      reverseDebounceRef.current = null;
    }

    const texto =
      typeof item.display_name === "string" && item.display_name.trim()
        ? item.display_name.trim()
        : "";

    setForm((prev) => ({
      ...prev,
      direccion: texto || prev.direccion,
      latitud: String(lat),
      longitud: String(lon),
    }));
    setGeoBusqueda("");
    setGeoResultados([]);

    const map = mapInstanceRef.current;
    const mk = markerRef.current;
    if (map && typeof window !== "undefined" && window.L) {
      const L = window.L;
      if (!mk) {
        const m = L.marker([lat, lon], { draggable: true }).addTo(map);
        m.on("dragend", () => {
          const p = m.getLatLng();
          setForm((prev) => ({
            ...prev,
            latitud: String(p.lat),
            longitud: String(p.lng),
          }));
          syncDireccionDesdeCoords(p.lat, p.lng);
        });
        markerRef.current = m;
      } else {
        mk.setLatLng([lat, lon]);
      }
      map.setView([lat, lon], MAP_WITH_MARKER_ZOOM);
    }
  }

  function handleSelectSucursal(sucursal) {
    if (!sucursal) return;

    setEditId(sucursal.id);
    const raw = sucursal.horarios;
    const esV2 = horariosTieneFormatoPorDia(raw);
    setPreservarHorariosLegacy(Boolean(raw) && !esV2);
    setMismoHorarioTodosLosDias(leerMismoHorarioTodosLosDias(raw));
    setHorariosPorDia(horariosPorDiaDesdeDb(raw));
    setForm({
      nombre: sucursal.nombre || "",
      direccion: sucursal.direccion || "",
      horario_atencion: sucursal.horario_atencion || "",
      horario_reparto: sucursal.horario_reparto || "",
      telefono: sucursal.telefono || "",
      correo_electronico: sucursal.correo_electronico || "",
      logo_url: sucursal.logo_url || "",
      activo: sucursal.activo ?? true,
      latitud: sucursal.latitud ?? "",
      longitud: sucursal.longitud ?? "",
      nombre_ticket: sucursal.nombre_ticket || "",
      subtitulo_ticket: sucursal.subtitulo_ticket || "",
      direccion_ticket: sucursal.direccion_ticket || "",
      telefono_ticket: sucursal.telefono_ticket || "",
      instagram_ticket: sucursal.instagram_ticket || "",
      mensaje_superior_ticket: sucursal.mensaje_superior_ticket || "",
      mensaje_final_ticket:
        sucursal.mensaje_final_ticket || sucursal.mensaje_ticket || "",
      info_adicional_ticket: sucursal.info_adicional_ticket || "",
      ticket_encabezado_orden: Array.isArray(sucursal.ticket_encabezado_orden)
        ? sucursal.ticket_encabezado_orden
        : [...ORDEN_ENCABEZADO_DEFAULT],
      ticket_ver_nombre: sucursal.ticket_ver_nombre !== false,
      ticket_ver_subtitulo: sucursal.ticket_ver_subtitulo !== false,
      ticket_ver_direccion: sucursal.ticket_ver_direccion !== false,
      ticket_ver_telefono: sucursal.ticket_ver_telefono !== false,
      ticket_ver_instagram: sucursal.ticket_ver_instagram !== false,
      ticket_ver_mensaje_superior: sucursal.ticket_ver_mensaje_superior !== false,
      ticket_ver_mensaje_final: sucursal.ticket_ver_mensaje_final !== false,
      ticket_ver_info_adicional: sucursal.ticket_ver_info_adicional !== false,
    });
    setGeoBusqueda("");
    setGeoResultados([]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!editId || saving) return;

    const payload = {
      nombre: (form.nombre || "").trim(),
      direccion: (form.direccion || "").trim() || null,
      horario_atencion: (form.horario_atencion || "").trim() || null,
      horario_reparto: (form.horario_reparto || "").trim() || null,
      telefono: (form.telefono || "").trim() || null,
      correo_electronico: (form.correo_electronico || "").trim() || null,
      logo_url: (form.logo_url || "").trim() || null,
      activo: Boolean(form.activo),
      latitud:
        form.latitud === "" || form.latitud === null ? null : Number(form.latitud),
      longitud:
        form.longitud === "" || form.longitud === null ? null : Number(form.longitud),
      nombre_ticket: (form.nombre_ticket || "").trim() || null,
      subtitulo_ticket: (form.subtitulo_ticket || "").trim() || null,
      direccion_ticket: (form.direccion_ticket || "").trim() || null,
      telefono_ticket: (form.telefono_ticket || "").trim() || null,
      instagram_ticket: (form.instagram_ticket || "").trim() || null,
      mensaje_superior_ticket: (form.mensaje_superior_ticket || "").trim() || null,
      mensaje_final_ticket: (form.mensaje_final_ticket || "").trim() || null,
      info_adicional_ticket: (form.info_adicional_ticket || "").trim() || null,
      ticket_encabezado_orden: form.ticket_encabezado_orden,
      ticket_ver_nombre: Boolean(form.ticket_ver_nombre),
      ticket_ver_subtitulo: Boolean(form.ticket_ver_subtitulo),
      ticket_ver_direccion: Boolean(form.ticket_ver_direccion),
      ticket_ver_telefono: Boolean(form.ticket_ver_telefono),
      ticket_ver_instagram: Boolean(form.ticket_ver_instagram),
      ticket_ver_mensaje_superior: Boolean(form.ticket_ver_mensaje_superior),
      ticket_ver_mensaje_final: Boolean(form.ticket_ver_mensaje_final),
      ticket_ver_info_adicional: Boolean(form.ticket_ver_info_adicional),
    };

    if (!payload.nombre) {
      Swal.fire("Dato requerido", "El nombre es obligatorio", "warning");
      return;
    }

    if (payload.latitud !== null && Number.isNaN(payload.latitud)) {
      Swal.fire("Dato inválido", "Latitud debe ser numérica", "warning");
      return;
    }

    if (payload.longitud !== null && Number.isNaN(payload.longitud)) {
      Swal.fire("Dato inválido", "Longitud debe ser numérica", "warning");
      return;
    }

    const validacionHorarios = validarHorariosPorDia(horariosPorDia);
    if (!validacionHorarios.ok) {
      Swal.fire("Horarios estructurados", validacionHorarios.error, "warning");
      return;
    }

    const tieneBloquesPorDia = Object.values(horariosPorDia).some(
      (arr) => Array.isArray(arr) && arr.length > 0
    );
    if (!(preservarHorariosLegacy && !tieneBloquesPorDia)) {
      payload.horarios = serializarHorariosPorDia(horariosPorDia, {
        mismoHorarioTodosLosDias,
      });
    }

    setSaving(true);
    try {
      const guardado = await updateSucursal(editId, payload);
      setHorariosPorDia(horariosPorDiaDesdeDb(guardado?.horarios));
      setMismoHorarioTodosLosDias(leerMismoHorarioTodosLosDias(guardado?.horarios));
      setPreservarHorariosLegacy(
        Boolean(guardado?.horarios) && !horariosTieneFormatoPorDia(guardado.horarios)
      );
      await Swal.fire({
        title: "Sucursal actualizada",
        icon: "success",
        timer: 900,
        showConfirmButton: false,
      });
      await load();
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "No se pudo guardar la sucursal", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container-fluid mt-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 className="mb-1">Sucursales</h3>
          <p className="text-muted small mb-0">Editar datos operativos por sucursal.</p>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-4">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body">
              <h6 className="fw-bold mb-3">Seleccionar sucursal</h6>

              {loading && <p className="text-muted mb-0">Cargando...</p>}

              {!loading && sucursales.length === 0 && (
                <p className="text-muted mb-0">No hay sucursales disponibles.</p>
              )}

              {!loading && sucursales.length > 0 && (
                <div className="d-grid gap-2">
                  {sucursales.map((s) => (
                    <button
                      key={s.id}
                      className={`btn rounded-3 text-start ${
                        editId === s.id ? "btn-dark" : "btn-outline-dark"
                      }`}
                      onClick={() => handleSelectSucursal(s)}
                    >
                      {s.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-8">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body">
              <h6 className="fw-bold mb-3">
                {selectedSucursal ? `Editar: ${selectedSucursal.nombre}` : "Editar sucursal"}
              </h6>

              {!selectedSucursal ? (
                <p className="text-muted mb-0">Selecciona una sucursal para editar.</p>
              ) : (
                <form onSubmit={handleSubmit}>
                  <h6 className="text-uppercase text-muted small mb-2">Informacion general</h6>
                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label">Nombre</label>
                      <input
                        className="form-control"
                        value={form.nombre}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, nombre: e.target.value }))
                        }
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Telefono</label>
                      <input
                        className="form-control"
                        value={form.telefono}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, telefono: e.target.value }))
                        }
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Correo electronico</label>
                      <input
                        className="form-control"
                        value={form.correo_electronico}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            correo_electronico: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Logo URL</label>
                      <input
                        className="form-control"
                        value={form.logo_url}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, logo_url: e.target.value }))
                        }
                      />
                    </div>
                    <div className="col-12">
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="sucursal-activa-switch"
                          checked={Boolean(form.activo)}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, activo: e.target.checked }))
                          }
                        />
                        <label className="form-check-label" htmlFor="sucursal-activa-switch">
                          Sucursal activa
                        </label>
                      </div>
                    </div>
                  </div>

                  <h6 className="text-uppercase text-muted small mb-2 mt-2">
                    Ticket de impresión (pre-cuenta)
                  </h6>
                  <div className="mb-3">
                    <TicketPreviewEditor
                      form={form}
                      fallbackNombre={form.nombre || selectedSucursal?.nombre}
                      fallbackDireccion={form.direccion}
                      fallbackTelefono={form.telefono}
                      onFieldChange={(field, value) =>
                        setForm((prev) => ({ ...prev, [field]: value }))
                      }
                    />
                  </div>

                  <h6 className="text-uppercase text-muted small mb-2">Horarios</h6>
                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label">Horario atencion</label>
                      <input
                        className="form-control"
                        value={form.horario_atencion}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            horario_atencion: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Horario reparto</label>
                      <input
                        className="form-control"
                        value={form.horario_reparto}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            horario_reparto: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="border rounded-3 p-3 mb-4 bg-light bg-opacity-25">
                    <h6 className="text-uppercase text-muted small mb-2">
                      Horarios por día
                    </h6>
                    <p className="small text-muted mb-2">
                    </p>
                    <div className="form-check form-switch mb-3">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        id="horario-mismo-todos"
                        checked={mismoHorarioTodosLosDias}
                        onChange={(e) => {
                          const on = e.target.checked;
                          if (on) {
                            const plantilla = obtenerPlantillaDesdeEstado(horariosPorDia);
                            setHorariosPorDia(replicarBloquesEnTodosLosDias(plantilla));
                            setMismoHorarioTodosLosDias(true);
                          } else {
                            setMismoHorarioTodosLosDias(false);
                          }
                        }}
                      />
                      <label className="form-check-label" htmlFor="horario-mismo-todos">
                        Usar mismo horario todos los días
                      </label>
                    </div>
                    {mismoHorarioTodosLosDias && (
                      <p className="small text-info mb-3">
                        Estás editando un solo conjunto de bloques; al guardar se aplicará a lunes a
                        domingo. Desactivá el interruptor para personalizar días por separado.
                      </p>
                    )}
                    {preservarHorariosLegacy && (
                      <div className="alert alert-warning py-2 small mb-3" role="status">
                        Esta sucursal tiene horarios guardados en un formato anterior. El editor muestra
                        días vacíos hasta que agregues bloques; al guardar con bloques nuevos se reemplaza
                        por el formato actual. Si no agregás bloques, no se altera el JSON existente.
                      </div>
                    )}
                    {selectedSucursal && (
                      <p className="small mb-3">
                        <span className="text-muted">Resumen atención (app): </span>
                        <strong>{getHorarioAtencionPreferido(selectedSucursal).texto || "—"}</strong>
                        {horariosTieneFormatoPorDia(selectedSucursal.horarios) ? (
                          <span className="badge bg-secondary ms-2">
                            {mismoHorarioTodosLosDias ? "Unificado" : "Por día"}
                          </span>
                        ) : null}
                      </p>
                    )}
                    <HorariosPorDiaEditor
                      value={horariosPorDia}
                      onChange={setHorariosPorDia}
                      modoUnificado={mismoHorarioTodosLosDias}
                    />
                  </div>

                  <h6 className="text-uppercase text-muted small mb-2">
                    Dirección y ubicación
                  </h6>
                  <p className="small text-muted mb-2">
                  </p>
                  <div className="row g-3 mb-4">
                    <div className="col-12 position-relative">
                      <label className="form-label">Buscar dirección</label>
                      <input
                        type="search"
                        className="form-control"
                        autoComplete="off"
                        placeholder="Calle, ciudad, barrio..."
                        value={geoBusqueda}
                        onChange={(e) => setGeoBusqueda(e.target.value)}
                      />
                      {geoCargando && (
                        <div className="small text-muted mt-1">Buscando...</div>
                      )}
                      {geoResultados.length > 0 && (
                        <ul
                          className="list-group position-absolute w-100 shadow-sm mt-1"
                          style={{ zIndex: 20, maxHeight: 220, overflowY: "auto" }}
                        >
                          {geoResultados.map((item) => (
                            <li key={`${item.osm_type}-${item.osm_id}-${item.place_id}`}>
                              <button
                                type="button"
                                className="list-group-item list-group-item-action py-2 text-start small"
                                onClick={() => aplicarCoordenadasDesdeNominatim(item)}
                              >
                                {item.display_name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="col-12">
                      <label className="form-label">Mapa (OpenStreetMap)</label>
                      <div
                        ref={mapContainerRef}
                        className="rounded-3 border bg-light"
                        style={{ height: 280, width: "100%" }}
                      />
                    </div>
                    {form.direccion ? (
                      <div className="col-12">
                        <div className="rounded-3 border bg-light px-3 py-2 small">
                          <span className="text-muted">Dirección en base de datos: </span>
                          <span className="fw-medium">{form.direccion}</span>
                        </div>
                      </div>
                    ) : null}
                    <div className="col-12 d-flex flex-wrap align-items-center gap-2">
                      <span className="small text-muted">
                        Coordenadas:{" "}
                        <strong>
                          {form.latitud !== "" && form.longitud !== ""
                            ? `${Number(form.latitud).toFixed(6)}, ${Number(form.longitud).toFixed(6)}`
                            : "—"}
                        </strong>
                      </span>
                      {form.latitud !== "" && form.longitud !== "" && (
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => abrirGoogleMaps(form.latitud, form.longitud)}
                        >
                          <i className="fa-solid fa-map-location-dot me-1"></i>
                          Ver en Google Maps
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="d-flex justify-content-end">
                    <button className="btn btn-dark" type="submit" disabled={saving}>
                      {saving ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
