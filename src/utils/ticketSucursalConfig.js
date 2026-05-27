/**
 * Configuración visual del ticket por sucursal (sin lógica de productos/totales).
 */

export const ORDEN_ENCABEZADO_DEFAULT = [
  "nombre",
  "subtitulo",
  "direccion",
  "telefono",
  "instagram",
  "mensaje_superior",
];

export const TICKET_BLOQUES_ENCABEZADO = [
  { key: "nombre", label: "Nombre comercial" },
  { key: "subtitulo", label: "Razón social" },
  { key: "direccion", label: "Dirección" },
  { key: "telefono", label: "Teléfono" },
  { key: "instagram", label: "Instagram / redes" },
  { key: "mensaje_superior", label: "Mensaje superior" },
];

const MENSAJE_FINAL_DEFAULT = "Gracias por su visita";
export const MARCA_PIE_TICKET = "Menuee\nSoftware Gastronómico";

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function texto(val) {
  const t = String(val ?? "").trim();
  return t || null;
}

function parseOrden(raw) {
  let arr = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      arr = null;
    }
  }
  if (!Array.isArray(arr)) return [...ORDEN_ENCABEZADO_DEFAULT];
  const validos = arr.filter((k) => ORDEN_ENCABEZADO_DEFAULT.includes(k));
  const faltantes = ORDEN_ENCABEZADO_DEFAULT.filter((k) => !validos.includes(k));
  return [...validos, ...faltantes];
}

function formatInstagram(val) {
  const t = texto(val);
  if (!t) return null;
  if (t.startsWith("@")) return t;
  return `@${t.replace(/^@+/, "")}`;
}

/**
 * @param {Object|null} sucursal
 * @param {{ nombreFallback?: string }} [opts]
 */
export function normalizarConfigTicket(sucursal, opts = {}) {
  const s = sucursal && typeof sucursal === "object" ? sucursal : {};
  const nombreFallback = texto(opts.nombreFallback) || "RESTAURANTE";

  return {
    nombre: texto(s.nombre_ticket) || nombreFallback,
    subtitulo: texto(s.subtitulo_ticket),
    direccion: texto(s.direccion_ticket) || texto(s.direccion),
    telefono: texto(s.telefono_ticket) || texto(s.telefono),
    instagram: formatInstagram(s.instagram_ticket),
    mensajeSuperior: texto(s.mensaje_superior_ticket),
    mensajeFinal:
      texto(s.mensaje_final_ticket) ||
      texto(s.mensaje_ticket) ||
      MENSAJE_FINAL_DEFAULT,
    infoAdicional: texto(s.info_adicional_ticket),
    ordenEncabezado: parseOrden(s.ticket_encabezado_orden),
    ver: {
      nombre: s.ticket_ver_nombre !== false,
      subtitulo: s.ticket_ver_subtitulo !== false,
      direccion: s.ticket_ver_direccion !== false,
      telefono: s.ticket_ver_telefono !== false,
      instagram: s.ticket_ver_instagram !== false,
      mensaje_superior: s.ticket_ver_mensaje_superior !== false,
      mensaje_final: s.ticket_ver_mensaje_final !== false,
      info_adicional: s.ticket_ver_info_adicional !== false,
    },
  };
}

function lineaEncabezado(key, cfg) {
  switch (key) {
    case "nombre":
      return cfg.nombre
        ? `<div class="header-title">${escapeHtml(cfg.nombre.toUpperCase())}</div>`
        : null;
    case "subtitulo":
      return cfg.subtitulo
        ? `<div class="header-line">${escapeHtml(cfg.subtitulo)}</div>`
        : null;
    case "direccion":
      return cfg.direccion
        ? `<div class="header-line">${escapeHtml(cfg.direccion)}</div>`
        : null;
    case "telefono":
      return cfg.telefono
        ? `<div class="header-line">${escapeHtml(cfg.telefono)}</div>`
        : null;
    case "instagram":
      return cfg.instagram
        ? `<div class="header-line">${escapeHtml(cfg.instagram)}</div>`
        : null;
    case "mensaje_superior":
      return cfg.mensajeSuperior
        ? `<div class="header-line header-msg">${escapeHtml(cfg.mensajeSuperior)}</div>`
        : null;
    default:
      return null;
  }
}

export function renderEncabezadoTicketHtml(cfg) {
  const lineas = cfg.ordenEncabezado
    .map((key) => lineaEncabezado(key, cfg))
    .filter(Boolean);

  if (!lineas.length) {
    return `<div class="center header-block">
      <hr class="rule-solid" />
      <div class="header-title">${escapeHtml((cfg.nombre || "RESTAURANTE").toUpperCase())}</div>
      <hr class="rule-solid" />
    </div>`;
  }

  return `<div class="center header-block">
    <hr class="rule-solid" />
    ${lineas.join("\n    ")}
    <hr class="rule-solid" />
  </div>`;
}

export function renderPieTicketHtml(cfg) {
  const partes = [];

  if (cfg.mensajeFinal) {
    const lineas = cfg.mensajeFinal.split(/\r?\n/).filter(Boolean);
    partes.push(
      `<div class="thanks">${lineas.map((l) => escapeHtml(l)).join("<br/>")}</div>`
    );
  }

  if (cfg.infoAdicional) {
    const lineas = cfg.infoAdicional.split(/\r?\n/).filter(Boolean);
    partes.push(
      `<div class="info-extra">${lineas.map((l) => escapeHtml(l)).join("<br/>")}</div>`
    );
  }

  const marca = MARCA_PIE_TICKET.split("\n");
  partes.push(
    `<div class="brand-footer">
      <div class="brand-name">${escapeHtml(marca[0])}</div>
      <div class="brand-sub">${escapeHtml(marca[1] || "")}</div>
    </div>`
  );

  return partes.join("\n  ");
}

