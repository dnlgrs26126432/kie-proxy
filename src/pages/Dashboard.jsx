import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const V = "#6C3BFF", M = "#00D4AA", BG = "#07070E", SF = "#0E0E1C", CD = "#161628", BR = "#252540", TX = "#F0F0FF", MU = "#5A5A80";

const PLAN_LABEL = { free: "Free", pro: "Pro", studio: "Studio" };

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/projects");
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setProjects(d.projects || []);
    } catch (e) {
      setError(e.message || "Errore nel caricamento dei progetti");
    }
    setLoading(false);
  }

  async function removeProject(e, id) {
    e.stopPropagation();
    if (!confirm("Eliminare questo progetto e tutti i brani generati?")) return;
    setProjects((p) => p.filter((x) => x.id !== id));
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TX, fontFamily: "Inter,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
        *{box-sizing:border-box}
      `}</style>

      <header style={{ borderBottom: `1px solid ${BR}`, padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: `linear-gradient(135deg,${V},#9B6BFF)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>◈</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Music Studio <span style={{ color: V }}>Pro</span></div>
            <div style={{ fontSize: 9, color: MU, letterSpacing: "2px" }}>PROMO MUSIC ITALIA</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: MU }}>
              <span>{user.name}</span>
              <span style={{ background: `${V}22`, color: V, border: `1px solid ${V}44`, borderRadius: 6, padding: "3px 9px", fontWeight: 700, fontSize: 10 }}>{PLAN_LABEL[user.plan] || user.plan}</span>
            </div>
          )}
          <button onClick={() => navigate("/studio")} style={{ background: `linear-gradient(135deg,${M},#00B8A0)`, color: "#001A16", border: "none", borderRadius: 8, padding: "11px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>
            ◈ Nuovo progetto
          </button>
          <button onClick={logout} style={{ background: "none", border: `1px solid ${BR}`, color: MU, cursor: "pointer", fontSize: 12, borderRadius: 8, padding: "10px 14px" }}>Esci</button>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>I tuoi progetti</h1>
        <p style={{ color: MU, fontSize: 13, marginBottom: 32 }}>Ogni sessione salvata resta qui: riapri, continua a scrivere, genera nuove take.</p>

        {loading ? (
          <div style={{ color: MU, fontSize: 13, padding: "60px 0", textAlign: "center" }}>Caricamento...</div>
        ) : error ? (
          <div style={{ background: CD, border: `1px solid #FF575744`, borderRadius: 10, padding: 20, color: "#FF5757", fontSize: 13 }}>
            {error}
          </div>
        ) : projects.length === 0 ? (
          <div style={{ border: `1px dashed ${BR}`, borderRadius: 12, padding: "60px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>◈</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Nessun progetto ancora</div>
            <div style={{ fontSize: 13, color: MU, marginBottom: 20 }}>Crea il primo progetto per iniziare a scrivere e generare</div>
            <button onClick={() => navigate("/studio")} style={{ background: `linear-gradient(135deg,${V},#9B6BFF)`, color: "#fff", border: "none", borderRadius: 8, padding: "11px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Crea progetto
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
            {projects.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(`/studio/${p.id}`)}
                style={{ background: CD, border: `1px solid ${BR}`, borderRadius: 12, padding: 16, cursor: "pointer", transition: "border-color 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = V)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = BR)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: V, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {p.genre}{p.custom_genre ? ` / ${p.custom_genre}` : ""}
                  </span>
                  <button onClick={(e) => removeProject(e, p.id)} style={{ background: "none", border: "none", color: MU, cursor: "pointer", fontSize: 13 }} aria-label="Elimina">✕</button>
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{p.title || "Untitled"}</div>
                <div style={{ display: "flex", gap: 8, fontSize: 11, color: MU, marginBottom: 10 }}>
                  <span>{p.mood}</span>·<span style={{ color: M, fontFamily: "'JetBrains Mono',monospace" }}>{p.bpm} BPM</span>·<span>{p.key_signature} {p.scale}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: MU }}>
                  <span>{p.track_count > 0 ? `${p.track_count} brani generati` : "nessun brano ancora"}</span>
                  <span>{new Date(p.updated_at).toLocaleDateString("it-IT")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
