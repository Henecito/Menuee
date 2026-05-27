/**
 * Permisos de caja (objeto anidado opcional en `permisos.caja`).
 * Si `caja` no existe → sin permisos (no lanza).
 */

export function tienePermisoCaja(permisos, accion) {
  if (!permisos?.caja || typeof permisos.caja !== "object") return false;
  return permisos.caja[accion] === true;
}

/** Admin global o permiso explícito de caja */
export function accesoModuloCaja(permisos, rol, accion) {
  if (rol === "admin") return true;
  return tienePermisoCaja(permisos, accion);
}
