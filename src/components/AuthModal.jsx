import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

const V = "#6C3BFF", M = "#00D4AA", SF = "#0E0E1C", CD = "#161628", BR = "#252540", TX = "#F0F0FF", MU = "#5A5A80";

export default function AuthModal({ mode: initialMode = "register", onClose, onSuccess }) {
  const { signup, login } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "register") {
        if (!name.trim()) throw new Error("Inserisci il tuo nome");
        await signup(name, email, password);
      } else {
        await login(email, password);
      }
      onSuccess?.();
    } catch (err) {
      setError(err.message || "Errore, riprova.");
    }
    setLoading(false);
  }

  const inp = {
    background: SF,
    border: `1px solid ${BR}`,
    borderRadius: 8,
    color: TX,
    fontFamily: "Inter,sans-serif",
    fontSize: 14,
    padding: "11px 14px",
    outline: "none",
    width: "100%",
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "#000000CC", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}
      onClick={onClose}
    >
      <div style={{ background: CD, border: `1px solid ${BR}`, borderRadius: 14, padding: 28, width: "100%", maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button
            onClick={() => setMode("register")}
            style={{
              flex: 1,
              padding: "9px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
              fontFamily: "Inter,sans-serif",
              background: mode === "register" ? `linear-gradient(135deg,${V},#9B6BFF)` : "transparent",
              color: mode === "register" ? "#fff" : MU,
            }}
          >
            Registrati
          </button>
          <button
            onClick={() => setMode("login")}
            style={{
              flex: 1,
              padding: "9px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
              fontFamily: "Inter,sans-serif",
              background: mode === "login" ? `linear-gradient(135deg,${V},#9B6BFF)` : "transparent",
              color: mode === "login" ? "#fff" : MU,
            }}
          >
            Accedi
          </button>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "register" && (
            <input style={inp} placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          )}
          <input style={inp} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input style={inp} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          {error && <div style={{ color: "#FF5757", fontSize: 12 }}>{error}</div>}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 14,
              fontFamily: "Inter,sans-serif",
              background: `linear-gradient(135deg,${M},#00B8A0)`,
              color: "#001A16",
            }}
          >
            {loading ? "..." : mode === "register" ? "Crea account gratis" : "Accedi"}
          </button>
        </form>
        <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: MU }}>
          {mode === "register" ? "Piano Free incluso, nessuna carta richiesta." : "Non hai un account? Registrati sopra."}
        </div>
      </div>
    </div>
  );
}
