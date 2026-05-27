/**
 * Campos opcionales de ticket en `sucursales`.
 * Update aparte para no romper el guardado si faltan columnas en Supabase.
 */

export const TICKET_COLUMN_KEYS = [
  "mensaje_ticket",
  "nombre_ticket",
  "subtitulo_ticket",
  "direccion_ticket",
  "telefono_ticket",
  "instagram_ticket",
  "mensaje_superior_ticket",
  "mensaje_final_ticket",
  "info_adicional_ticket",
  "ticket_encabezado_orden",
  "ticket_ver_nombre",
  "ticket_ver_subtitulo",
  "ticket_ver_direccion",
  "ticket_ver_telefono",
  "ticket_ver_instagram",
  "ticket_ver_mensaje_superior",
  "ticket_ver_mensaje_final",
  "ticket_ver_info_adicional",
];

export function buildTicketRowFromPayload(payload = {}) {
  const finalMsg =
    payload.mensaje_final_ticket ?? payload.mensaje_ticket ?? null;

  return {
    mensaje_ticket: finalMsg,
    nombre_ticket: payload.nombre_ticket ?? null,
    subtitulo_ticket: payload.subtitulo_ticket ?? null,
    direccion_ticket: payload.direccion_ticket ?? null,
    telefono_ticket: payload.telefono_ticket ?? null,
    instagram_ticket: payload.instagram_ticket ?? null,
    mensaje_superior_ticket: payload.mensaje_superior_ticket ?? null,
    mensaje_final_ticket: payload.mensaje_final_ticket ?? null,
    info_adicional_ticket: payload.info_adicional_ticket ?? null,
    ticket_encabezado_orden: payload.ticket_encabezado_orden ?? null,
    ticket_ver_nombre: payload.ticket_ver_nombre,
    ticket_ver_subtitulo: payload.ticket_ver_subtitulo,
    ticket_ver_direccion: payload.ticket_ver_direccion,
    ticket_ver_telefono: payload.ticket_ver_telefono,
    ticket_ver_instagram: payload.ticket_ver_instagram,
    ticket_ver_mensaje_superior: payload.ticket_ver_mensaje_superior,
    ticket_ver_mensaje_final: payload.ticket_ver_mensaje_final,
    ticket_ver_info_adicional: payload.ticket_ver_info_adicional,
  };
}

/** Extiende fila de sucursal con defaults seguros (sin reemplazar el objeto). */
export function extendSucursalRow(row) {
  if (!row || typeof row !== "object") return row;
  return {
    ...row,
    direccion: row.direccion ?? null,
    telefono: row.telefono ?? null,
    mensaje_ticket: row.mensaje_ticket ?? null,
    nombre_ticket: row.nombre_ticket ?? null,
    subtitulo_ticket: row.subtitulo_ticket ?? null,
    direccion_ticket: row.direccion_ticket ?? null,
    telefono_ticket: row.telefono_ticket ?? null,
    instagram_ticket: row.instagram_ticket ?? null,
    mensaje_superior_ticket: row.mensaje_superior_ticket ?? null,
    mensaje_final_ticket:
      row.mensaje_final_ticket ?? row.mensaje_ticket ?? null,
    info_adicional_ticket: row.info_adicional_ticket ?? null,
    ticket_encabezado_orden: row.ticket_encabezado_orden ?? null,
  };
}
