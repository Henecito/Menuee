import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { extendSucursalRow } from "../utils/sucursalTicketDb";
import {
  getImpresionPermisosByRol,
  normalizarPermisosConImpresion,
} from "../utils/impresionPermisos";

const SucursalContext = createContext();
export const useSucursal = () => useContext(SucursalContext);

export function SucursalProvider({ children }) {
  const [sucursales, setSucursales] = useState([]);
  const [sucursalActiva, setSucursalActiva] = useState(null);
  const [rol, setRol] = useState(null);
  const [permisos, setPermisos] = useState({});
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  const resetSessionState = useCallback(() => {
    setSucursales([]);
    setSucursalActiva(null);
    setRol(null);
    setPermisos({});
    setProfile(null);
    setLoading(false);
  }, []);

  const loadUserData = useCallback(async (user) => {
    setLoading(true);

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("local_id, rol, permisos, sucursal_id")
      .eq("id", user.id)
      .single();

    if (!profileRow) {
      setProfile(null);
      setRol(null);
      setPermisos({});
      setSucursales([]);
      setSucursalActiva(null);
      setLoading(false);
      return;
    }

    setProfile({
      id: user.id,
      local_id: profileRow.local_id,
      rol: profileRow.rol,
      sucursal_id: profileRow.sucursal_id,
    });

    setRol(profileRow.rol || null);

    const permisosAdmin = {
      resumen: true,
      mesas: true,
      cocina: true,
      pedidos: true,
      reportes: true,
      productos: true,
      inventario: true,
      usuarios: true,
      impresion: getImpresionPermisosByRol("admin"),
    };

    const permisosNormalizados =
      profileRow.rol === "admin"
        ? normalizarPermisosConImpresion("admin", {
            ...permisosAdmin,
            ...(profileRow.permisos || {}),
          })
        : normalizarPermisosConImpresion(
            profileRow.rol,
            profileRow.permisos || {}
          );
    setPermisos(permisosNormalizados);

    let lista = [];
    const resLista = await supabase
      .from("sucursales")
      .select("*")
      .eq("local_id", profileRow.local_id)
      .order("nombre", { ascending: true });

    if (resLista.error) {
      console.warn(
        "[SucursalContext] select * falló, reintento id+nombre:",
        resLista.error.message
      );
      const resMin = await supabase
        .from("sucursales")
        .select("id, nombre")
        .eq("local_id", profileRow.local_id)
        .order("nombre", { ascending: true });
      if (resMin.error) {
        console.error("[SucursalContext] No se pudieron cargar sucursales:", resMin.error);
      } else {
        lista = resMin.data || [];
      }
    } else {
      lista = resLista.data || [];
    }

    const listaExtendida = lista.map(extendSucursalRow);
    setSucursales(listaExtendida);

    const guardada = localStorage.getItem("sucursal_activa");
    if (guardada && profileRow.rol === "admin") {
      const s = JSON.parse(guardada);
      const valida = listaExtendida.find((x) => x.id === s.id);

      if (valida) {
        setSucursalActiva(extendSucursalRow({ ...valida, ...s }));
        setLoading(false);
        return;
      }
    }

    if (profileRow.rol === "admin") {
      setSucursalActiva(listaExtendida[0] || null);
    } else {
      const sucursalPerfil =
        listaExtendida.find((x) => x.id === profileRow.sucursal_id) || null;
      setSucursalActiva(sucursalPerfil || listaExtendida[0] || null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;

      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        if (session?.user) {
          await loadUserData(session.user);
        } else {
          resetSessionState();
        }
        setAuthReady(true);
        return;
      }

      if (event === "SIGNED_OUT") {
        resetSessionState();
        setAuthReady(true);
      }
    });

    supabase.auth.getSession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadUserData, resetSessionState]);

  useEffect(() => {
    if (sucursalActiva?.id) {
      const enLista = sucursales.find((s) => s.id === sucursalActiva.id);
      const paraGuardar = extendSucursalRow(
        enLista ? { ...enLista, ...sucursalActiva } : sucursalActiva
      );
      localStorage.setItem("sucursal_activa", JSON.stringify(paraGuardar));
    }
  }, [sucursalActiva, sucursales]);

  return (
    <SucursalContext.Provider
      value={{
        sucursales,
        sucursalActiva,
        setSucursalActiva,
        loading,
        authReady,
        rol,
        permisos,
        profile,
      }}
    >
      {children}
    </SucursalContext.Provider>
  );
}
