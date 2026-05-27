/**
 * Envío silencioso de comandas al bridge local (ESC/POS → impresora térmica).
 */

import { trace, traceReturn, traceError } from "./comandaTrace";

const DEV_BRIDGE_FALLBACK = "http://127.0.0.1:17890";

export function getPrintBridgeUrl() {
  trace("getPrintBridgeUrl — inicio", {
    envRaw: process.env.REACT_APP_COMANDA_PRINT_URL,
    nodeEnv: process.env.NODE_ENV,
  });

  const fromEnv = process.env.REACT_APP_COMANDA_PRINT_URL;
  if (fromEnv && String(fromEnv).trim()) {
    const url = String(fromEnv).trim().replace(/\/$/, "");
    trace("getPrintBridgeUrl — OK desde REACT_APP_COMANDA_PRINT_URL", url);
    return url;
  }

  try {
    const stored = localStorage.getItem("comanda_print_url");
    if (stored && String(stored).trim()) {
      const url = String(stored).trim().replace(/\/$/, "");
      trace("getPrintBridgeUrl — OK desde localStorage", url);
      return url;
    }
  } catch (e) {
    traceError("getPrintBridgeUrl — localStorage", e);
  }

  if (process.env.NODE_ENV === "development") {
    trace(
      "getPrintBridgeUrl — usando fallback desarrollo (revisá .env + reinicio npm start)",
      DEV_BRIDGE_FALLBACK
    );
    return DEV_BRIDGE_FALLBACK;
  }

  traceReturn(
    "getPrintBridgeUrl",
    "sin URL (ni env, ni localStorage, ni fallback prod)"
  );
  return null;
}

/**
 * @param {{ grupo: string, ticket: object }} payload
 */
export async function enviarComandaSilenciosa(payload) {
  trace("enviarComandaSilenciosa — inicio", {
    grupo: payload?.grupo,
    lineas: payload?.ticket?.lineas?.length,
  });

  const baseUrl = getPrintBridgeUrl();
  if (!baseUrl) {
    const err = new Error(
      "[comandas] Sin URL del bridge. REACT_APP_COMANDA_PRINT_URL en .env + reiniciar npm start"
    );
    traceError("enviarComandaSilenciosa", err);
    throw err;
  }

  const url = `${baseUrl}/print`;
  trace("enviando POST a bridge", { url, payload });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text().catch(() => "");

    if (!res.ok) {
      const err = new Error(
        `[comandas] Bridge respondió ${res.status}: ${text || "(sin cuerpo)"}`
      );
      traceError("enviarComandaSilenciosa — response no OK", err);
      throw err;
    }

    trace("response OK", { status: res.status, body: text || "(vacío)" });
    return true;
  } catch (err) {
    traceError("enviarComandaSilenciosa — fetch", err);
    throw err;
  }
}

export function isComandaPrintConfigured() {
  return Boolean(getPrintBridgeUrl());
}

/** Ping al bridge (health) — solo diagnóstico */
export async function pingComandaBridge() {
  const baseUrl = getPrintBridgeUrl();
  if (!baseUrl) {
    traceReturn("pingComandaBridge", "sin URL");
    return null;
  }
  const url = `${baseUrl}/health`;
  trace("ping bridge", url);
  try {
    const res = await fetch(url);
    const text = await res.text();
    trace("ping bridge resultado", { status: res.status, text });
    return { ok: res.ok, status: res.status, text };
  } catch (err) {
    traceError("pingComandaBridge", err);
    throw err;
  }
}
