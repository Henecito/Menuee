import { useState } from "react";
import { supabase } from "../supabaseClient";

const UNSPLASH_IMAGE =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 1) Autenticar
    const { data: auth, error: loginError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (loginError) {
      setLoading(false);
      return setError("Correo o contraseña incorrectos");
    }

    const user = auth.user;
    if (!user) {
      setLoading(false);
      return setError("Error inesperado. Intenta nuevamente.");
    }

    // 2) Validar que exista un profile asociado al usuario
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, nombre, local_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      await supabase.auth.signOut();
      setLoading(false);
      return setError(
        "Tu usuario no tiene acceso asignado. Contacta al administrador."
      );
    }

    // 3) Todo OK → Entrar al panel
    window.location.href = "/";
  }

  return (
    <div className="container-fluid vh-100">
      <div className="row h-100">

        {/* Imagen lateral (desktop) */}
        <div
          className="col-lg-6 d-none d-lg-flex align-items-center justify-content-center text-white"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(${UNSPLASH_IMAGE})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="text-center px-5">
            <h2 className="fw-bold mb-3">Panel Administrativo</h2>
            <p className="text-white-50">
              Controla pedidos, productos y sucursales desde un solo lugar
            </p>
          </div>
        </div>

        {/* Formulario */}
        <div className="col-12 col-lg-6 d-flex align-items-center justify-content-center bg-white">
          <div className="w-100" style={{ maxWidth: 420 }}>

            <div className="card border-0 shadow-lg rounded-4">
              <div className="card-body p-4 p-md-5">

                <div className="mb-4 text-center">
                  <h4 className="fw-semibold text-dark">Acceso administrativo</h4>
                  <p className="text-muted small mb-0">
                    Solo usuarios autorizados
                  </p>
                </div>

                {error && (
                  <div className="alert alert-dark text-center py-2 small rounded-3">
                    {error}
                  </div>
                )}

                <form onSubmit={handleLogin}>
                  <div className="mb-3">
                    <label className="form-label small text-muted">Correo</label>
                    <input
                      type="email"
                      className="form-control form-control-lg rounded-3"
                      placeholder="admin@restaurante.cl"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="form-label small text-muted">Contraseña</label>
                    <input
                      type="password"
                      className="form-control form-control-lg rounded-3"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="d-grid">
                    <button
                      type="submit"
                      className="btn btn-dark btn-lg rounded-3"
                      disabled={loading}
                    >
                      {loading ? "Ingresando..." : "Ingresar"}
                    </button>
                  </div>
                </form>

                <div className="text-center mt-4">
                  <span className="text-muted small">¿Problemas para ingresar?</span>
                  <br />
                  <span className="text-muted small">
                    Contacta al administrador del sistema
                  </span>
                </div>

              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
