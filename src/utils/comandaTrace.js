/**
 * Trazabilidad comandas — logs siempre visibles (console.log / console.error).
 * Quitar o desactivar COMANDA_TRACE_ENABLED cuando ya no haga falta debug.
 */

export const COMANDA_TRACE_ENABLED = true;

export function trace(step, detail) {
  if (!COMANDA_TRACE_ENABLED) return;
  if (detail !== undefined) {
    console.log(`[comandas] ${step}`, detail);
  } else {
    console.log(`[comandas] ${step}`);
  }
}

export function traceWarn(step, detail) {
  if (!COMANDA_TRACE_ENABLED) return;
  if (detail !== undefined) {
    console.warn(`[comandas] ${step}`, detail);
  } else {
    console.warn(`[comandas] ${step}`);
  }
}

/** Antes de un return que corta el flujo de impresión */
export function traceReturn(step, reason, detail) {
  if (detail !== undefined) {
    console.error(`[comandas] RETURN (${step}): ${reason}`, detail);
  } else {
    console.error(`[comandas] RETURN (${step}): ${reason}`);
  }
}

export function traceError(step, err) {
  const msg = err?.message ?? String(err);
  console.error(`[comandas] ERROR (${step}):`, msg, err);
}
