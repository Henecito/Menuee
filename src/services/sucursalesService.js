import { supabase } from "../supabaseClient";
import {
  buildTicketRowFromPayload,
  extendSucursalRow,
} from "../utils/sucursalTicketDb";

export async function getSucursalesByLocal(localId) {
  let { data, error } = await supabase
    .from("sucursales")
    .select("*")
    .eq("local_id", localId)
    .order("nombre", { ascending: true });

  if (error) {
    console.warn("[sucursales] select * falló, reintento mínimo:", error.message);
    const fallback = await supabase
      .from("sucursales")
      .select("id, nombre, direccion, telefono, horario_atencion, horario_reparto, correo_electronico, logo_url, activo, latitud, longitud, horarios")
      .eq("local_id", localId)
      .order("nombre", { ascending: true });
    if (fallback.error) throw fallback.error;
    data = fallback.data;
  }

  return (data || []).map(extendSucursalRow);
}

export async function updateSucursal(id, payload) {
  const row = {
    nombre: payload.nombre,
    direccion: payload.direccion,
    horario_atencion: payload.horario_atencion,
    horario_reparto: payload.horario_reparto,
    telefono: payload.telefono,
    correo_electronico: payload.correo_electronico,
    logo_url: payload.logo_url,
    activo: payload.activo,
    latitud: payload.latitud,
    longitud: payload.longitud,
  };

  if (Object.prototype.hasOwnProperty.call(payload, "horarios")) {
    row.horarios = payload.horarios;
  }

  const { data, error } = await supabase
    .from("sucursales")
    .update(row)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  let merged = extendSucursalRow(data);

  const ticketRow = buildTicketRowFromPayload(payload);
  const { data: ticketData, error: ticketError } = await supabase
    .from("sucursales")
    .update(ticketRow)
    .eq("id", id)
    .select()
    .single();

  if (!ticketError && ticketData) {
    merged = extendSucursalRow({ ...merged, ...ticketData });
  } else if (ticketError) {
    console.warn(
      "[sucursales] Campos de ticket no guardados (¿falta migración?):",
      ticketError.message
    );
  }

  return merged;
}
