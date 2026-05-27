import {
  DIAS_SEMANA,
  newHorarioBloqueId,
  replicarBloquesEnTodosLosDias,
} from "../utils/sucursalHorarios";

const DEFAULT_INICIO = "09:00";
const DEFAULT_FIN = "18:00";
const TEMPLATE_KEY = "lunes";

const PRESETS_TURNO = [
  { label: "Mañana", valor: "mañana" },
  { label: "Tarde", valor: "tarde" },
  { label: "Noche", valor: "noche" },
];

function nuevoBloque() {
  return {
    id: newHorarioBloqueId(),
    inicio: DEFAULT_INICIO,
    fin: DEFAULT_FIN,
    nombre: "",
  };
}

export default function HorariosPorDiaEditor({ value, onChange, modoUnificado = false }) {
  function aplicarBloquesDia(diaKey, bloques) {
    if (modoUnificado) {
      onChange(replicarBloquesEnTodosLosDias(bloques));
    } else {
      onChange({ ...value, [diaKey]: bloques });
    }
  }

  function agregarBloque(diaKey) {
    const key = modoUnificado ? TEMPLATE_KEY : diaKey;
    const actuales = value[key] || [];
    aplicarBloquesDia(key, [...actuales, nuevoBloque()]);
  }

  function actualizarBloque(diaKey, bloqueId, campo, raw) {
    const key = modoUnificado ? TEMPLATE_KEY : diaKey;
    const actuales = value[key] || [];
    aplicarBloquesDia(
      key,
      actuales.map((b) => (b.id === bloqueId ? { ...b, [campo]: raw } : b))
    );
  }

  function eliminarBloque(diaKey, bloqueId) {
    const key = modoUnificado ? TEMPLATE_KEY : diaKey;
    const actuales = value[key] || [];
    aplicarBloquesDia(
      key,
      actuales.filter((b) => b.id !== bloqueId)
    );
  }

  function renderBloques(diaKey, label) {
    const bloques = value[diaKey] || [];
    return (
      <div
        key={diaKey}
        className="border rounded-3 p-3 mb-3 bg-white bg-opacity-50"
      >
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
          <span className="fw-semibold">{label}</span>
          <button
            type="button"
            className="btn btn-outline-dark btn-sm rounded-3"
            onClick={() => agregarBloque(diaKey)}
          >
            + Bloque / turno
          </button>
        </div>

        {bloques.length === 0 ? (
          <p className="text-muted small mb-0">Sin horarios este día.</p>
        ) : (
          <div className="d-flex flex-column gap-3">
            {bloques.map((b, idx) => (
              <div
                key={b.id}
                className="border-bottom pb-3 border-secondary border-opacity-25"
              >
                <div className="d-flex flex-wrap align-items-end gap-2 gap-md-3">
                  <div className="small text-muted d-none d-md-block" style={{ minWidth: "1.25rem" }}>
                    {idx + 1}.
                  </div>
                  <div className="flex-grow-1" style={{ minWidth: "140px", maxWidth: "220px" }}>
                    <label className="form-label small text-muted mb-0">Turno (opcional)</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="ej. mañana, tarde"
                      maxLength={60}
                      value={b.nombre || ""}
                      onChange={(e) =>
                        actualizarBloque(diaKey, b.id, "nombre", e.target.value)
                      }
                    />
                    <div className="d-flex flex-wrap gap-1 mt-1">
                      {PRESETS_TURNO.map((p) => (
                        <button
                          key={p.valor}
                          type="button"
                          className="btn btn-link btn-sm p-0 text-decoration-none"
                          style={{ fontSize: "0.75rem" }}
                          onClick={() =>
                            actualizarBloque(diaKey, b.id, "nombre", p.valor)
                          }
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="form-label small text-muted mb-0">Inicio</label>
                    <input
                      type="time"
                      className="form-control form-control-sm"
                      step={60}
                      value={b.inicio || ""}
                      onChange={(e) =>
                        actualizarBloque(diaKey, b.id, "inicio", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="form-label small text-muted mb-0">Fin</label>
                    <input
                      type="time"
                      className="form-control form-control-sm"
                      step={60}
                      value={b.fin || ""}
                      onChange={(e) =>
                        actualizarBloque(diaKey, b.id, "fin", e.target.value)
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm rounded-3 ms-md-auto"
                    onClick={() => eliminarBloque(diaKey, b.id)}
                    title="Eliminar bloque"
                  >
                    <i className="fa-solid fa-trash" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (modoUnificado) {
    return (
      <div className="horarios-por-dia-editor">
        {renderBloques(TEMPLATE_KEY, "Todos los días")}
      </div>
    );
  }

  return (
    <div className="horarios-por-dia-editor">
      {DIAS_SEMANA.map(({ key, label }) => renderBloques(key, label))}
    </div>
  );
}
