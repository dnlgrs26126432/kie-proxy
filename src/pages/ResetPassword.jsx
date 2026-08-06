import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const V = "#6C3BFF", M = "#00D4AA", BG = "#07070E", SF = "#0E0E1C", CD = "#161628", BR = "#252540", TX = "#F0F0FF", MU = "#5A5A80";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

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

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("La password deve avere almeno 6 caratteri");
    if (password !== confirm) return setError("Le due password non coincidono");
    setLoading(true);
    try {
      const r = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      await refresh();
      setDone(true);
      setTimeout(() => navigate("/dashboard"), 1200);
    } catch (err) {
      setError(err.message || "Errore, riprova.");
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter,sans-serif", color: TX, padding: 16 }}>
      <div style={{ background: CD, border: `1px solid ${BR}`, borderRadius: 14, padding: 28, width: "100%", maxWidth: 380 }}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Imposta una nuova password</div>
        {!token && (
          <div style={{ color: "#FF5757", fontSize: 13, marginTop: 12 }}>
            Link non valido. <Link to="/" style={{ color: V }}>Torna alla home</Link> e richiedi un nuovo link dal login.
          </div>
        )}
        {token && !done && (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
            <input style={inp} type="password" placeholder="Nuova password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            <input style={inp} type="password" placeholder="Conferma password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
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
              {loading ? "..." : "Salva nuova password"}
            </button>
          </form>
        )}
        {done && <div style={{ color: M, fontSize: 14, marginTop: 16 }}>✓ Password aggiornata. Ti sto reindirizzando...</div>}
      </div>
    </div>
  );
}
