/**
 * Horarios estructurados (campo JSON `horarios` en sucursales).
 * - version 2: `porDia` — bloques por día (editor en UI)
 * - version 1 (legacy): atencion/reparto turnos — no se edita desde el formulario nuevo
 * Texto legacy: `horario_atencion` / `horario_reparto` (sin tocar)
 */

export const HORARIOS_VERSION_POR_DIA = 2;

export const DIAS_SEMANA = [
  { key: "lunes", label: "Lunes" },
  { key: "martes", label: "Martes" },
  { key: "miercoles", label: "Miércoles" },
  { key: "jueves", label: "Jueves" },
  { key: "viernes", label: "Viernes" },
  { key: "sabado", label: "Sábado" },
  { key: "domingo", label: "Domingo" },
];

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function newHorarioBloqueId() {
  return `b_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Estado vacío para el editor (un bloque por día con horas por defecto, sin guardar hasta que el usuario guarde). */
export function estadoHorariosPorDiaVacio() {
  const out = {};
  DIAS_SEMANA.forEach(({ key }) => {
    out[key] = [];
  });
  return out;
}

/**
 * Normaliza valor desde DB: null/undefined → null; objeto → tal cual;
 * string JSON → parse si es válido y es objeto.
 */
export function normalizarHorariosDesdeDb(raw) {
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw);
      if (v && typeof v === "object" && !Array.isArray(v)) return v;
    } catch {
      return null;
    }
  }
  return null;
}

export function esHorarioPorDiaValido(obj) {
  if (!obj || typeof obj !== "object") return false;
  if (obj.version !== HORARIOS_VERSION_POR_DIA) return false;
  if (!obj.porDia || typeof obj.porDia !== "object" || Array.isArray(obj.porDia)) return false;
  return DIAS_SEMANA.every(({ key }) => {
    const arr = obj.porDia[key];
    return Array.isArray(arr);
  });
}

/** True si el valor en DB es el formato por día (v2) editable. */
export function horariosTieneFormatoPorDia(raw) {
  return esHorarioPorDiaValido(normalizarHorariosDesdeDb(raw));
}

/**
 * Si `horarios` es JSON v2 con porDia válido → estado para el editor.
 * Si no hay datos o formato distinto → vacío (no se infiere desde texto).
 */
const NOMBRE_TURNO_MAX = 60;

export function horariosPorDiaDesdeDb(raw) {
  const h = normalizarHorariosDesdeDb(raw);
  if (!esHorarioPorDiaValido(h)) {
    return estadoHorariosPorDiaVacio();
  }

  const out = estadoHorariosPorDiaVacio();
  DIAS_SEMANA.forEach(({ key }) => {
    const arr = h.porDia[key] || [];
    out[key] = arr.map((bloque) => ({
      id: newHorarioBloqueId(),
      inicio: String(bloque?.inicio ?? "").slice(0, 5),
      fin: String(bloque?.fin ?? "").slice(0, 5),
      nombre: String(bloque?.nombre ?? "").slice(0, NOMBRE_TURNO_MAX),
    }));
  });
  return out;
}

/** Lee flag opcional del JSON guardado (solo afecta UI / guardado). */
export function leerMismoHorarioTodosLosDias(raw) {
  const h = normalizarHorariosDesdeDb(raw);
  return h?.mismoHorarioTodosLosDias === true;
}

/** Primer día (en orden L–D) que tenga bloques; si ninguno, array vacío. */
export function obtenerPlantillaDesdeEstado(estadoPorDia) {
  for (const { key } of DIAS_SEMANA) {
    const arr = estadoPorDia[key];
    if (Array.isArray(arr) && arr.length > 0) return arr;
  }
  return [];
}

/** Copia los mismos horarios/turnos a los 7 días (ids nuevos por fila y por día). */
export function replicarBloquesEnTodosLosDias(bloquesPlantilla) {
  const plantilla = Array.isArray(bloquesPlantilla) ? bloquesPlantilla : [];
  const next = estadoHorariosPorDiaVacio();
  DIAS_SEMANA.forEach(({ key }) => {
    next[key] = plantilla.map((b) => ({
      id: newHorarioBloqueId(),
      inicio: (b.inicio || "").trim(),
      fin: (b.fin || "").trim(),
      nombre: String(b.nombre ?? "").slice(0, NOMBRE_TURNO_MAX),
    }));
  });
  return next;
}

export function tiempoValido(s) {
  return typeof s === "string" && TIME_RE.test(s.trim());
}

function minutosDesdeMedianoche(s) {
  const [h, m] = s.trim().split(":").map(Number);
  return h * 60 + m;
}

function validarSolapesMismoDia(bloques, labelDia) {
  if (bloques.length < 2) return { ok: true };
  const ordenados = [...bloques].sort(
    (a, b) => minutosDesdeMedianoche(a.inicio) - minutosDesdeMedianoche(b.inicio)
  );
  for (let i = 1; i < ordenados.length; i += 1) {
    const prev = ordenados[i - 1];
    const cur = ordenados[i];
    if (minutosDesdeMedianoche(cur.inicio) < minutosDesdeMedianoche(prev.fin)) {
      return {
        ok: false,
        error: `En ${labelDia}: los bloques no pueden solaparse (revisá ${prev.inicio}–${prev.fin} y ${cur.inicio}–${cur.fin}).`,
      };
    }
  }
  return { ok: true };
}

/**
 * Valida bloques antes de guardar: formato HH:MM, inicio < fin, sin campos a medias,
 * nombre de turno opcional con tope, sin solapes dentro del mismo día.
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validarHorariosPorDia(estadoPorDia) {
  for (const { key, label } of DIAS_SEMANA) {
    const bloques = estadoPorDia[key] || [];
    const validados = [];

    for (let i = 0; i < bloques.length; i += 1) {
      const b = bloques[i];
      const ini = (b?.inicio ?? "").trim();
      const fin = (b?.fin ?? "").trim();
      const nom = String(b?.nombre ?? "").trim();

      if (!ini && !fin) {
        return {
          ok: false,
          error: `Hay un bloque vacío en ${label}. Eliminá la fila o completá inicio y fin.`,
        };
      }
      if (!ini || !fin) {
        return {
          ok: false,
          error: `En ${label}, bloque ${i + 1}: completá hora de inicio y fin.`,
        };
      }
      if (!tiempoValido(ini) || !tiempoValido(fin)) {
        return {
          ok: false,
          error: `En ${label}, bloque ${i + 1}: usá formato de hora HH:MM (ej. 09:00).`,
        };
      }
      if (minutosDesdeMedianoche(ini) >= minutosDesdeMedianoche(fin)) {
        return {
          ok: false,
          error: `En ${label}, bloque ${i + 1}: la hora de inicio debe ser menor que la de fin.`,
        };
      }
      if (nom.length > NOMBRE_TURNO_MAX) {
        return {
          ok: false,
          error: `En ${label}, bloque ${i + 1}: el nombre del turno no puede superar ${NOMBRE_TURNO_MAX} caracteres.`,
        };
      }
      validados.push({ inicio: ini, fin });
    }

    const sol = validarSolapesMismoDia(validados, label);
    if (!sol.ok) return sol;
  }
  return { ok: true };
}

/**
 * Serializa estado del editor → objeto para guardar en columna JSON.
 * @param {boolean} [opts.mismoHorarioTodosLosDias] — si true, se guarda flag opcional (misma semántica en `porDia`).
 */
export function serializarHorariosPorDia(estadoPorDia, opts = {}) {
  const { mismoHorarioTodosLosDias = false } = opts;
  const porDia = {};
  DIAS_SEMANA.forEach(({ key }) => {
    porDia[key] = (estadoPorDia[key] || []).map((b) => {
      const row = {
        inicio: (b.inicio || "").trim(),
        fin: (b.fin || "").trim(),
      };
      const nom = String(b.nombre ?? "").trim();
      if (nom) row.nombre = nom.slice(0, NOMBRE_TURNO_MAX);
      return row;
    });
  });
  const out = {
    version: HORARIOS_VERSION_POR_DIA,
    porDia,
  };
  if (mismoHorarioTodosLosDias) {
    out.mismoHorarioTodosLosDias = true;
  }
  return out;
}

/** Plantilla legacy v1 (compatibilidad; no usada en el editor por día). */
export function plantillaHorariosVacia() {
  return {
    version: 1,
    atencion: { turnos: [] },
    reparto: { turnos: [] },
  };
}

export function parseHorariosJsonString(str) {
  const t = (str || "").trim();
  if (!t) return { ok: true, value: null };
  try {
    const v = JSON.parse(t);
    if (v === null || typeof v !== "object" || Array.isArray(v)) {
      return { ok: false, error: "El JSON debe ser un objeto (no un array ni un valor suelto)." };
    }
    return { ok: true, value: v };
  } catch (e) {
    return { ok: false, error: e?.message || "JSON inválido" };
  }
}

function contarBloquesPorDia(h) {
  if (!esHorarioPorDiaValido(h)) return 0;
  return DIAS_SEMANA.reduce((acc, { key }) => acc + (h.porDia[key]?.length || 0), 0);
}

export function horariosEstructuradosTienenDatos(horariosNormalizado) {
  const h = normalizarHorariosDesdeDb(horariosNormalizado);
  if (!h) return false;
  if (esHorarioPorDiaValido(h)) return contarBloquesPorDia(h) > 0;
  const ta = h.atencion?.turnos;
  const tr = h.reparto?.turnos;
  const na = Array.isArray(ta) ? ta.length : 0;
  const nr = Array.isArray(tr) ? tr.length : 0;
  return na > 0 || nr > 0 || Object.keys(h).some((k) => k !== "version");
}

/**
 * Resumen para mostrar fuera del editor: JSON v2 con bloques, v1, o texto legacy.
 */
export function getHorarioAtencionPreferido(sucursal) {
  const json = normalizarHorariosDesdeDb(sucursal?.horarios);
  if (json && esHorarioPorDiaValido(json)) {
    const n = contarBloquesPorDia(json);
    return {
      fuente: "json",
      texto:
        n > 0
          ? `Horario estructurado por día (${n} bloque(s))`
          : "Horario estructurado por día (sin bloques)",
    };
  }
  if (json && horariosEstructuradosTienenDatos(json)) {
    const n = Array.isArray(json.atencion?.turnos) ? json.atencion.turnos.length : 0;
    return {
      fuente: "json",
      texto:
        n > 0
          ? `Horario estructurado (${n} turno(s) en atención)`
          : "Horario estructurado definido",
    };
  }
  const legacy = (sucursal?.horario_atencion || "").trim();
  return {
    fuente: "texto",
    texto: legacy || "",
  };
}
