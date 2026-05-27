import {
  DIAS_SEMANA,
  normalizarHorariosDesdeDb,
  esHorarioPorDiaValido,
} from "./sucursalHorarios";

/** getDay(): 0 domingo … 6 sábado → clave porDia */
const DIA_KEY_POR_GETDAY = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
];

function minutosDesdeHHMM(str) {
  if (typeof str !== "string") return null;
  const s = str.trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) return null;
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

export function claveTurnoDesdeBloque(b) {
  const nom = String(b?.nombre ?? "").trim();
  if (nom) return nom.toLowerCase().replace(/\s+/g, "_");
  const ini = String(b?.inicio ?? "").trim();
  const fin = String(b?.fin ?? "").trim();
  return `bloque_${ini}_${fin}`;
}

export function etiquetaTurnoDesdeBloque(b) {
  const nom = String(b?.nombre ?? "").trim();
  if (nom) return nom;
  const ini = String(b?.inicio ?? "").trim();
  const fin = String(b?.fin ?? "").trim();
  if (ini && fin) return `${ini} – ${fin}`;
  return "Turno";
}

/**
 * Para métricas y filtros por turno: prioriza el cierre del pedido (`cerrado_en`) si existe;
 * si no, el alta (`creado_en`), para no romper datos históricos.
 */
export function instanteReferenciaParaTurnoPedido(pedido) {
  const c = pedido?.cerrado_en;
  if (c != null && String(c).trim() !== "") return c;
  return pedido?.creado_en;
}

/**
 * Horarios v2 con al menos un bloque en algún día; si no, null (sin turnos en reportes).
 */
export function horariosUsablesParaTurnos(raw) {
  const h = normalizarHorariosDesdeDb(raw);
  if (!esHorarioPorDiaValido(h)) return null;
  const tiene = DIAS_SEMANA.some(({ key }) => (h.porDia[key] || []).length > 0);
  return tiene ? h : null;
}

/**
 * Opciones para selector: [{ value, label }] sin duplicar claves.
 */
export function listarOpcionesTurnoDesdeHorarios(horariosRaw) {
  const h = horariosUsablesParaTurnos(horariosRaw);
  const out = [{ value: "", label: "Todos los turnos" }];
  if (!h) return out;

  const visto = new Set();
  DIAS_SEMANA.forEach(({ key }) => {
    (h.porDia[key] || []).forEach((b) => {
      const k = claveTurnoDesdeBloque(b);
      if (visto.has(k)) return;
      visto.add(k);
      out.push({ value: k, label: etiquetaTurnoDesdeBloque(b) });
    });
  });
  return out;
}

/**
 * Asigna turno a una fecha/hora (zona local del navegador) según bloques del día.
 * @returns {{ key: string, label: string } | null} null si no hay horarios usables
 */
export function turnoDesdeFechaYHorarios(isoString, horariosRaw) {
  const h = horariosUsablesParaTurnos(horariosRaw);
  if (!h) return null;

  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return null;

  const diaKey = DIA_KEY_POR_GETDAY[d.getDay()];
  const t = d.getHours() * 60 + d.getMinutes();
  const bloques = h.porDia[diaKey] || [];

  for (let i = 0; i < bloques.length; i += 1) {
    const b = bloques[i];
    const ini = minutosDesdeHHMM(b.inicio);
    const fin = minutosDesdeHHMM(b.fin);
    if (ini == null || fin == null) continue;
    if (t >= ini && t < fin) {
      return {
        key: claveTurnoDesdeBloque(b),
        label: etiquetaTurnoDesdeBloque(b),
      };
    }
  }

  return { key: "__fuera__", label: "Fuera de horario" };
}

/** @param {string} isoReferencia — típicamente `instanteReferenciaParaTurnoPedido(pedido)` */
export function pedidoCoincideConTurno(isoReferencia, filtroClave, horariosRaw) {
  if (!filtroClave || filtroClave === "todos" || filtroClave === "") return true;
  const asignado = turnoDesdeFechaYHorarios(isoReferencia, horariosRaw);
  if (!asignado) return true;
  return asignado.key === filtroClave;
}

/** Agrega métricas por turno a partir de filas de pedidos ya filtradas por fecha/sucursal. */
export function agregarPedidoAPorTurno(acum, pedido, horariosRaw) {
  if (!horariosUsablesParaTurnos(horariosRaw)) return;

  const t = turnoDesdeFechaYHorarios(instanteReferenciaParaTurnoPedido(pedido), horariosRaw);
  const key = t ? t.key : "__sin__";
  const label = t ? t.label : "—";

  if (!acum[key]) {
    acum[key] = {
      key,
      label,
      pedidos: 0,
      ingresos: 0,
      propinas: 0,
      pagosCantidad: {
        efectivo: 0,
        tarjeta: 0,
        debito: 0,
        credito: 0,
        transferencia: 0,
        otro: 0,
      },
      pagosMonto: {
        efectivo: 0,
        tarjeta: 0,
        debito: 0,
        credito: 0,
        transferencia: 0,
        otro: 0,
      },
    };
  }

  const row = acum[key];
  row.pedidos += 1;

  const estado = (pedido.estado || "").toLowerCase();
  if (estado === "entregado" || estado === "enviado") {
    row.ingresos += Number(pedido.total || 0);
    row.propinas += Number(pedido.propina || 0);

    const metodo = (pedido.metodo_pago || "").toLowerCase().trim();
    const monto = Number(pedido.total || 0);
    switch (metodo) {
      case "efectivo":
        row.pagosCantidad.efectivo++;
        row.pagosMonto.efectivo += monto;
        break;
      case "debito":
      case "tarjeta_debito":
        row.pagosCantidad.tarjeta++;
        row.pagosCantidad.debito++;
        row.pagosMonto.tarjeta += monto;
        row.pagosMonto.debito += monto;
        break;
      case "credito":
      case "tarjeta_credito":
        row.pagosCantidad.tarjeta++;
        row.pagosCantidad.credito++;
        row.pagosMonto.tarjeta += monto;
        row.pagosMonto.credito += monto;
        break;
      case "tarjeta":
        row.pagosCantidad.tarjeta++;
        row.pagosMonto.tarjeta += monto;
        break;
      case "transferencia":
      case "transfer":
        row.pagosCantidad.transferencia++;
        row.pagosMonto.transferencia += monto;
        break;
      default:
        row.pagosCantidad.otro++;
        row.pagosMonto.otro += monto;
        break;
    }
  }
}

export function porTurnoDesdeAcum(acum) {
  return Object.values(acum).sort((a, b) => a.label.localeCompare(b.label, "es"));
}
