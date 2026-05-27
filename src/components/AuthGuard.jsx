import { supabase } from "../supabaseClient";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

export default function AuthGuard({ children }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    async function verify() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setAllowed(false);
        setLoading(false);
        return;
      }

      // Verificar que exista un profile (vinculado a local)
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (profile) {
        setAllowed(true);
      } else {
        setAllowed(false);
      }

      setLoading(false);
    }

    verify();
  }, []);

  if (loading) return <p>Cargando...</p>;

  // NO autenticado o sin profile asignado
  if (!allowed) return <Navigate to="/login" replace />;

  return children;
}
