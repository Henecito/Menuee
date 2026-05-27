/**
 * Pre-cuenta de mesa: impresión vía diálogo del navegador (ticket 80mm).
 * Sin persistencia ni cambio de estado.
 */

import {
  normalizarConfigTicket,
  renderEncabezadoTicketHtml,
  renderPieTicketHtml,
} from "./ticketSucursalConfig";

/** ESC/POS: avance de líneas + corte total (GS V 0) */
const ESC_POS_FEED_Y_CORTE = "\x1b\x64\x05\x1d\x56\x00";

function fmtMoney(n) {
  return `$${Number(n || 0).toLocaleString("es-CL")}`;
}

function aggregateLineas(pedidosActivos) {
  const map = new Map();
  for (const pedido of pedidosActivos || []) {
    for (const it of pedido.pedido_items || []) {
      const key =
        it.producto_id != null && it.producto_id !== ""
          ? `id:${it.producto_id}`
          : `n:${String(it.nombre || "").trim().toLowerCase()}`;
      const cant = Number(it.cantidad) || 0;
      const precio = Number(it.precio) || 0;
      const sub = cant * precio;
      const cur = map.get(key);
      if (!cur) {
        map.set(key, {
          nombre: it.nombre || "Producto",
          cantidad: cant,
          subtotal: sub,
        });
      } else {
        cur.cantidad += cant;
        cur.subtotal += sub;
      }
    }
  }
  return Array.from(map.values());
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function padLine(left, right, width = 42) {
  const l = String(left);
  const r = String(right);
  const space = width - l.length - r.length;
  if (space >= 1) return `${l}${" ".repeat(space)}${r}`;
  return `${l.slice(0, Math.max(0, width - r.length - 1))} ${r}`;
}

function buildTicketHtml(payload) {
  const {
    mesaNumero,
    fechaHora,
    lineas,
    subtotal,
    propinaSugerida,
    total,
    ticketCfg,
  } = payload;

  const encabezadoHtml = renderEncabezadoTicketHtml(ticketCfg);
  const pieHtml = renderPieTicketHtml(ticketCfg);

  const productosHtml = lineas
    .map((row) => {
      const text = padLine(
        `${row.cantidad}x ${row.nombre}`,
        fmtMoney(row.subtotal)
      );
      return `<div class="line">${escapeHtml(text)}</div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Pre-cuenta Mesa ${escapeHtml(mesaNumero)}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 2mm;
    }
    html, body {
      width: 80mm;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: "Courier New", Courier, monospace;
      font-size: 12px;
      line-height: 1.35;
      color: #000;
      background: #fff;
      padding: 4mm 3mm;
    }
    .center { text-align: center; }
    .header-block { margin-bottom: 8px; }
    .header-title {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.04em;
      margin: 4px 0;
    }
    .header-line {
      font-size: 11px;
      margin: 2px 0;
      white-space: pre-wrap;
    }
    .header-msg { font-style: italic; margin-top: 6px; }
    .rule {
      border: none;
      border-top: 1px dashed #000;
      margin: 8px 0;
    }
    .rule-solid { border-top: 1px solid #000; }
    .meta { margin: 6px 0 10px; }
    .line { white-space: pre; margin: 2px 0; }
    .totals .line { margin: 3px 0; }
    .total-final {
      font-weight: 700;
      margin-top: 6px;
    }
    .thanks, .info-extra {
      text-align: center;
      margin-top: 10px;
      font-size: 11px;
      white-space: pre-wrap;
    }
    .info-extra { font-size: 10px; color: #333; }
    .brand-footer {
      text-align: center;
      margin-top: 14px;
      padding-top: 8px;
      border-top: 1px dashed #000;
      font-size: 10px;
    }
    .brand-name { font-weight: 700; }
    .brand-sub { font-size: 9px; margin-top: 2px; }
    .paper-feed {
      display: block;
      height: 22mm;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
    .paper-feed .feed-line {
      line-height: 1.2em;
      height: 1.2em;
      visibility: hidden;
    }
    .escpos-cut {
      display: block;
      width: 0;
      height: 0;
      margin: 0;
      padding: 0;
      border: 0;
      font-size: 1px;
      line-height: 1px;
      overflow: hidden;
      white-space: pre;
      color: transparent;
    }
    @media screen {
      body { box-shadow: 0 0 0 1px #ddd; }
      .escpos-cut, .paper-feed { display: none; }
    }
    @media print {
      body { padding: 0; }
      .paper-feed, .escpos-cut { display: block; }
    }
  </style>
</head>
<body>
  ${encabezadoHtml}
  <div class="meta">
    <div><strong>Mesa ${escapeHtml(mesaNumero)}</strong></div>
    <div>Fecha: ${escapeHtml(fechaHora)}</div>
  </div>
  <hr class="rule" />
  ${productosHtml || '<div class="line">Sin productos</div>'}
  <hr class="rule" />
  <div class="totals">
    <div class="line">${escapeHtml(padLine("Subtotal", fmtMoney(subtotal)))}</div>
    <div class="line">${escapeHtml(padLine("Propina sugerida (10%)", fmtMoney(propinaSugerida)))}</div>
    <div class="line total-final">${escapeHtml(padLine("TOTAL", fmtMoney(total)))}</div>
  </div>
  <hr class="rule" />
  ${pieHtml}
  <div class="paper-feed" aria-hidden="true">
    <div class="feed-line">&nbsp;</div>
    <div class="feed-line">&nbsp;</div>
    <div class="feed-line">&nbsp;</div>
    <div class="feed-line">&nbsp;</div>
    <div class="feed-line">&nbsp;</div>
    <div class="feed-line">&nbsp;</div>
  </div>
  <pre class="escpos-cut" aria-hidden="true">${ESC_POS_FEED_Y_CORTE}</pre>
</body>
</html>`;
}

function esperarCierreDialogoImpresion(win) {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const onAfterPrint = () => setTimeout(done, 80);
    try {
      win.addEventListener("afterprint", onAfterPrint, { once: true });
    } catch (_) {
      /* ignore */
    }

    try {
      const mq = win.matchMedia("print");
      const onChange = (e) => {
        if (!e.matches) setTimeout(done, 80);
      };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);

      setTimeout(() => {
        if (!mq.matches) done();
      }, 600);
    } catch (_) {
      /* ignore */
    }

    setTimeout(done, 8000);
  });
}

export function imprimirHtmlEnIframe(html) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute(
      "style",
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;"
    );
    iframe.setAttribute("title", "Impresión pre-cuenta");

    let done = false;
    const cleanup = () => {
      try {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      } catch (_) {
        /* ignore */
      }
    };
    const finishOk = () => {
      if (done) return;
      done = true;
      cleanup();
      resolve();
    };
    const finishErr = (err) => {
      if (done) return;
      done = true;
      cleanup();
      reject(err);
    };

    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = iframe.contentDocument || win?.document;
    if (!win || !doc) {
      finishErr(new Error("El navegador no permite imprimir en este contexto."));
      return;
    }

    try {
      doc.open();
      doc.write(html);
      doc.close();
    } catch (e) {
      finishErr(new Error("No se pudo preparar el ticket para imprimir."));
      return;
    }

    const lanzarImpresion = () => {
      try {
        win.focus();
        win.print();
        esperarCierreDialogoImpresion(win).then(finishOk);
      } catch (e) {
        finishErr(
          new Error(
            e?.message || "No se pudo abrir el diálogo de impresión."
          )
        );
      }
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(lanzarImpresion);
    });
  });
}

/**
 * @param {Object} opts
 * @param {string} [opts.restaurante] - fallback si no hay nombre_ticket
 * @param {string|number} opts.mesaNumero
 * @param {Array} opts.pedidosActivos
 * @param {number} [opts.totalMesa]
 * @param {Object} [opts.configTicket] - datos de sucursal (ticket)
 * @returns {Promise<void>}
 */
export async function imprimirPreCuentaMesa({
  restaurante = "RESTAURANTE",
  mesaNumero,
  pedidosActivos = [],
  totalMesa,
  configTicket,
}) {
  const lineas = aggregateLineas(pedidosActivos);
  const subtotalFromItems = lineas.reduce(
    (acc, r) => acc + Number(r.subtotal || 0),
    0
  );
  const subtotal =
    Number(totalMesa) > 0 ? Number(totalMesa) : subtotalFromItems;

  if (!lineas.length && subtotal <= 0) {
    throw new Error("No hay productos en la mesa para imprimir la cuenta.");
  }

  if (mesaNumero == null || mesaNumero === "") {
    throw new Error("No se pudo identificar el número de mesa.");
  }

  const propinaSugerida = Math.round(subtotal * 0.1);
  const ticketCfg = normalizarConfigTicket(configTicket, {
    nombreFallback: restaurante,
  });

  const payload = {
    mesaNumero,
    fechaHora: new Date().toLocaleString("es-CL", {
      dateStyle: "short",
      timeStyle: "short",
    }),
    lineas,
    subtotal,
    propinaSugerida,
    total: subtotal + propinaSugerida,
    ticketCfg,
  };

  const html = buildTicketHtml(payload);
  await imprimirHtmlEnIframe(html);
}
