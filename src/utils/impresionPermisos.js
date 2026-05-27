/**
 * Permisos de impresión (objeto anidado en `permisos.impresion`).
 * precuentas → pre-cuenta cliente | comandas → comandas cocina/barra automáticas
 */

export function defaultImpresionPermisos() {
  return {
    precuentas: false,
    comandas: false,
  };
}

export function mergeImpresionPermisos(permisos) {
  const imp = permisos?.impresion;
  if (imp && typeof imp === "object") {
    return {
      ...defaultImpresionPermisos(),
      precuentas: imp.precuentas === true,
      comandas: imp.comandas === true,
    };
  }
  return defaultImpresionPermisos();
}

/** Valores por defecto al resetear permisos según rol */
export function getImpresionPermisosByRol(rol) {
  if (rol === "admin" || rol === "admin_local") {
    return { precuentas: true, comandas: false };
  }
  if (rol === "cocina") {
    return { precuentas: false, comandas: true };
  }
  return { precuentas: false, comandas: false };
}

function resolverImpresion(permisos, rol) {
  if (permisos?.impresion && typeof permisos.impresion === "object") {
    return mergeImpresionPermisos(permisos);
  }
  return getImpresionPermisosByRol(rol);
}

export function puedeImprimirPrecuentas(permisos, rol) {
  return resolverImpresion(permisos, rol).precuentas === true;
}

export function puedeImprimirComandas(permisos, rol) {
  return resolverImpresion(permisos, rol).comandas === true;
}

/** Fusiona `impresion` sobre permisos existentes (login / guardado perfil). */
export function normalizarPermisosConImpresion(rol, permisosDb = {}) {
  return {
    ...permisosDb,
    impresion: {
      ...getImpresionPermisosByRol(rol),
      ...mergeImpresionPermisos(permisosDb),
    },
  };
}
