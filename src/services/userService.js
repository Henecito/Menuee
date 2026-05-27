import { supabase } from "../supabaseClient";

/**
 * 🔐 Obtener token del usuario actual
 */
async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token;
}

/**
 * ➕ CREAR USUARIO (via Edge Function)
 */
export async function createUser({
  email,
  password,
  nombre,
  rol,
  sucursal_id,
}) {
  try {
    const token = await getAccessToken();

    if (!token) {
      throw new Error("No autenticado");
    }

    const res = await fetch(
      "https://fbekoygqajoednphjwga.functions.supabase.co/create-user",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          nombre,
          rol,
          sucursal_id, // 🔥 único campo nuevo
        }),
      }
    );

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || "Error al crear usuario");
    }

    return { success: true };
  } catch (error) {
    console.error("createUser error:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * ✏️ EDITAR USUARIO (solo profiles)
 */
export async function updateUser(id, data) {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({
        nombre: data.nombre,
        rol: data.rol,
        permisos: data.permisos,
      })
      .eq("id", id);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("updateUser error:", error.message);
    return { success: false, error: error.message };
  }
}