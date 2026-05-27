import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 🔥 CORS HEADERS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getPermisosByRol(rol: string) {
  const allTrue = {
    mesas: true,
    cocina: true,
    pedidos: true,
    reportes: true,
    productos: true,
    inventario: true,
    usuarios: true,
  };

  if (rol === "admin") {
    return allTrue;
  }

  if (rol === "cocina") {
    return {
      mesas: false,
      cocina: true,
      pedidos: true,
      reportes: false,
      productos: false,
      inventario: false,
      usuarios: false,
    };
  }

  if (rol === "garzon") {
    return {
      mesas: true,
      cocina: false,
      pedidos: true,
      reportes: false,
      productos: false,
      inventario: false,
      usuarios: false,
    };
  }

  return {
    mesas: false,
    cocina: false,
    pedidos: false,
    reportes: false,
    productos: false,
    inventario: false,
    usuarios: false,
  };
}

serve(async (req) => {
  // 🔥 preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: corsHeaders }
      );
    }

    // 🔐 token
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // cliente user
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: corsHeaders }
      );
    }

    // 🔥 traer rol + local del usuario logueado
    const { data: profile, error: profileError } =
      await supabaseUser
        .from("profiles")
        .select("rol, local_id")
        .eq("id", user.id)
        .single();

    if (profileError || !profile || profile.rol !== "admin") {
      return new Response(
        JSON.stringify({ error: "No tienes permisos" }),
        { status: 403, headers: corsHeaders }
      );
    }

    const body = await req.json();

    let { email, password, nombre, rol, sucursal_id } = body;

    email = email?.trim().toLowerCase();

    if (!email || !email.includes("@")) {
      throw new Error("Email inválido");
    }

    if (!password || password.length < 4) {
      throw new Error("Password mínimo 4 caracteres");
    }

    if (!nombre) {
      throw new Error("Nombre requerido");
    }

    if (!sucursal_id) {
      throw new Error("Sucursal requerida");
    }

    const permisos = getPermisosByRol(rol);

    const localId = profile.local_id; // 🔥 clave real

    // cliente admin
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // crear usuario auth
    const { data: userData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError) throw authError;

    const userId = userData.user.id;

    // insertar profile
    const { error: insertError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        nombre,
        rol,
        sucursal_id,
        local_id: localId, // 🔥 SIEMPRE del usuario logueado
        permisos,
      });

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { status: 400, headers: corsHeaders }
    );
  }
});