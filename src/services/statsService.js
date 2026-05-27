import { supabase } from "../supabaseClient";

export async function getKPIStats() {
  const { data: pedidos } = await supabase
    .rpc("get_dashboard_stats"); // usamos una función SQL

  return pedidos;
}
