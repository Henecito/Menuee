import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export function useSessionContext() {
  const [user, setUser] = useState(null);
  const [local, setLocal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      setUser(user);

      /**
       * AJUSTA ESTA QUERY SI TU RELACIÓN ES DISTINTA
       * Ejemplo: tabla "usuarios" con local_id
       */
      const { data: usuarioDB, error } = await supabase
        .from("usuarios")
        .select("local_id, locales(nombre)")
        .eq("auth_user_id", user.id)
        .single();

      if (!error && usuarioDB) {
        setLocal(usuarioDB.locales);
      }

      setLoading(false);
    }

    load();
  }, []);

  return { user, local, loading };
}
