import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import AuthModal from "../components/AuthModal.jsx";

const V = "#6C3BFF", M = "#00D4AA", BG = "#07070E", SF = "#0E0E1C", CD = "#161628", BR = "#252540", TX = "#F0F0FF", MU = "#5A5A80";

const FEATURES = [
  {
    icon: "◈",
    title: "Musica vera, non solo testi",
    text: "Genera brani audio completi (voce, strumentale, ogni genere) con motore Suno V4: non un demo o una bozza, un file pronto all'ascolto.",
  },
  {
    icon: "✍",
    title: "Ghostwriter AI in italiano",
    text: "Testi, hook, concept e breakdown di produzione scritti da un'AI addestrata sul linguaggio e i riferimenti della scena italiana, non traduzioni.",
  },
  {
    icon: "▤",
    title: "Nessuna take persa",
    text: "Ogni generazione salva tutte le versioni prodotte, non solo la prima: confronta le take e scegli quella giusta, archiviata per sempre.",
  },
  {
    icon: "☁",
    title: "Progetti nel cloud",
    text: "Ogni sessione si salva automaticamente. Riprendi da dove hai lasciato da qualsiasi computer, senza perdere testi, accordi o audio generato.",
  },
  {
    icon: "▦",
    title: "Export pronto per lo studio",
    text: "Scheda tecnica in PDF per il producer e progressione di accordi in MIDI, generati in un click, senza software esterni.",
  },
  {
    icon: "◎",
    title: "Controllo creativo totale",
    text: "Durata, energia, atmosfera, riferimento artistico e note di regia: ogni generazione riflette esattamente la direzione che vuoi dare al brano.",
  },
];

const STEPS = [
  { n: "01", title: "Descrivi il brano", text: "Genere, mood, BPM, tonalità, concept e riferimento artistico: bastano pochi campi." },
  { n: "02", title: "L'AI scrive e produce", text: "Testi, titolo e breakdown di produzione in italiano, poi la generazione audio vera e propria." },
  { n: "03", title: "Esporta e consegna", text: "Scarica l'MP3, la scheda tecnica in PDF e gli accordi in MIDI, pronti per lo studio." },
];

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "0",
    cadence: "per sempre",
    tagline: "Per provare la piattaforma senza impegno.",
    cta: "Inizia gratis",
    features: [
      "2 progetti salvati",
      "5 generazioni audio al mese",
      "Testi e concept AI illimitati",
      "Galleria multi-take",
      "Export scheda tecnica PDF",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "19",
    cadence: "/ mese",
    tagline: "Per chi produce con costanza.",
    cta: "Passa a Pro",
    highlighted: true,
    features: [
      "Progetti illimitati",
      "50 generazioni audio al mese",
      "Titolo AI e note di regia illimitati",
      "Riferimento artistico avanzato",
      "Export scheda tecnica PDF + MIDI",
      "Storico completo dei progetti",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    price: "49",
    cadence: "/ mese",
    tagline: "Per team e produzioni professionali.",
    cta: "Passa a Studio",
    features: [
      "Tutto il piano Pro",
      "Generazioni audio illimitate",
      "Priorità in coda di generazione",
      "Rimozione branding (white-label)",
      "Supporto prioritario",
      "Accesso anticipato alle nuove funzioni",
    ],
  },
];

export default function Landing() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modal, setModal] = useState(null); // null | "login" | "register"

  useEffect(() => {
    if (searchParams.get("login")) {
      setModal("login");
      searchParams.delete("login");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openAuth(mode) {
    setModal(mode);
  }
  function onAuthSuccess() {
    setModal(null);
    navigate("/dashboard");
  }

  const btnPrimary = {
    padding: "13px 26px",
    borderRadius: 9,
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
    fontFamily: "Inter,sans-serif",
    background: `linear-gradient(135deg,${M},#00B8A0)`,
    color: "#001A16",
  };
  const btnGhost = {
    padding: "13px 26px",
    borderRadius: 9,
    border: `1px solid ${BR}`,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
    fontFamily: "Inter,sans-serif",
    background: "transparent",
    color: TX,
  };

  return (
    <div style={{ background: BG, color: TX, fontFamily: "Inter,sans-serif", minHeight: "100vh", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
        *{box-sizing:border-box}
        .msp-glow{position:absolute;border-radius:50%;filter:blur(90px);pointer-events:none;}
        .msp-card:hover{transform:translateY(-3px);transition:transform 0.2s;}
        a{color:inherit}
      `}</style>

      {/* HEADER */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "#07070Ecc", backdropFilter: "blur(10px)", borderBottom: `1px solid ${BR}`, padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: `linear-gradient(135deg,${V},#9B6BFF)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>◈</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Music Studio <span style={{ color: V }}>Pro</span></div>
            <div style={{ fontSize: 8, color: MU, letterSpacing: "2px" }}>PROMO MUSIC ITALIA</div>
          </div>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 26, fontSize: 13 }}>
          <a href="#caratteristiche" style={{ color: MU, textDecoration: "none" }}>Caratteristiche</a>
          <a href="#prezzi" style={{ color: MU, textDecoration: "none" }}>Prezzi</a>
          {user ? (
            <>
              <span style={{ color: MU }}>Ciao, {user.name.split(" ")[0]}</span>
              <button onClick={() => navigate("/dashboard")} style={{ ...btnPrimary, padding: "9px 18px" }}>Vai alla Dashboard</button>
              <button onClick={logout} style={{ background: "none", border: "none", color: MU, cursor: "pointer", fontSize: 13 }}>Esci</button>
            </>
          ) : (
            <>
              <button onClick={() => openAuth("login")} style={{ background: "none", border: "none", color: TX, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Accedi</button>
              <button onClick={() => openAuth("register")} style={{ ...btnPrimary, padding: "9px 18px" }}>Registrati</button>
            </>
          )}
        </nav>
      </header>

      {/* HERO */}
      <section style={{ position: "relative", padding: "100px 32px 90px", textAlign: "center", overflow: "hidden" }}>
        <div className="msp-glow" style={{ width: 500, height: 500, background: V, opacity: 0.22, top: -180, left: "18%" }} />
        <div className="msp-glow" style={{ width: 420, height: 420, background: M, opacity: 0.16, top: -100, right: "15%" }} />
        <div style={{ position: "relative", maxWidth: 780, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 20, border: `1px solid ${BR}`, background: SF, fontSize: 12, color: M, marginBottom: 26 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: M, display: "inline-block" }} />
            La prima console AI per la musica italiana
          </div>
          <h1 style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.1, margin: "0 0 22px" }}>
            Dall'idea al brano finito,<br /><span style={{ background: `linear-gradient(135deg,${V},${M})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>senza uno studio.</span>
          </h1>
          <p style={{ fontSize: 17, color: MU, lineHeight: 1.6, maxWidth: 560, margin: "0 auto 36px" }}>
            Scrivi il concept, scegli genere e mood, e Music Studio Pro genera testi, produzione e audio completo in italiano. Pensato per producer, cantanti e etichette che vogliono muoversi più veloci della concorrenza.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => openAuth("register")} style={btnPrimary}>◈ Inizia gratis, nessuna carta</button>
            <a href="#prezzi" style={{ textDecoration: "none" }}><button style={btnGhost}>Vedi i prezzi</button></a>
          </div>
        </div>

        {/* Mockup illustrativo */}
        <div style={{ position: "relative", maxWidth: 760, margin: "64px auto 0", background: CD, border: `1px solid ${BR}`, borderRadius: 16, padding: 22, boxShadow: `0 30px 80px -20px ${V}33` }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF5F57" }} />
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FEBC2E" }} />
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28C840" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
            {["Trap", "Dark", "145 BPM", "F# Minore"].map((t) => (
              <div key={t} style={{ background: SF, border: `1px solid ${BR}`, borderRadius: 8, padding: "10px 8px", textAlign: "center", fontSize: 12, color: M, fontFamily: "'JetBrains Mono',monospace" }}>{t}</div>
            ))}
          </div>
          <div style={{ background: SF, border: `1px solid ${BR}`, borderRadius: 10, padding: 16, textAlign: "left" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: MU, letterSpacing: "1px", marginBottom: 8 }}>AI GHOSTWRITER</div>
            <div style={{ fontSize: 13, color: TX, lineHeight: 1.7, fontFamily: "'JetBrains Mono',monospace" }}>
              [Hook]<br />Sopra la città le luci non dormono mai...
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="caratteristiche" style={{ padding: "90px 32px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 54 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: V, letterSpacing: "2px", marginBottom: 10 }}>PERCHÉ È DIVERSO</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, margin: 0 }}>Non un altro generatore di testi</h2>
          <p style={{ color: MU, fontSize: 15, marginTop: 12 }}>Le caratteristiche che rendono Music Studio Pro unico nel suo genere.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          {FEATURES.map((f) => (
            <div key={f.title} className="msp-card" style={{ background: CD, border: `1px solid ${BR}`, borderRadius: 14, padding: 26 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: `${V}1a`, border: `1px solid ${V}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, color: V, marginBottom: 16 }}>{f.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: MU, lineHeight: 1.65 }}>{f.text}</div>
            </div>
          ))}
        </div>
      </section>

      {/* COME FUNZIONA */}
      <section style={{ padding: "40px 32px 100px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 50 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: M, letterSpacing: "2px", marginBottom: 10 }}>COME FUNZIONA</div>
          <h2 style={{ fontSize: 30, fontWeight: 800, margin: 0 }}>Tre passaggi, un brano pronto</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {STEPS.map((s) => (
            <div key={s.n} style={{ position: "relative", padding: "0 4px" }}>
              <div style={{ fontSize: 40, fontWeight: 800, color: BR, fontFamily: "'JetBrains Mono',monospace", marginBottom: 10 }}>{s.n}</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: MU, lineHeight: 1.6 }}>{s.text}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="prezzi" style={{ padding: "40px 32px 110px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 54 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: V, letterSpacing: "2px", marginBottom: 10 }}>PREZZI</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, margin: 0 }}>Un piano per ogni fase del progetto</h2>
          <p style={{ color: MU, fontSize: 15, marginTop: 12 }}>Parti gratis. Passa a un piano superiore quando ti serve più volume.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, alignItems: "stretch" }}>
          {PLANS.map((p) => (
            <div
              key={p.id}
              style={{
                position: "relative",
                background: p.highlighted ? `linear-gradient(180deg, ${V}14, ${CD})` : CD,
                border: p.highlighted ? `1.5px solid ${V}` : `1px solid ${BR}`,
                borderRadius: 16,
                padding: 30,
                display: "flex",
                flexDirection: "column",
                boxShadow: p.highlighted ? `0 20px 60px -20px ${V}55` : "none",
              }}
            >
              {p.highlighted && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: `linear-gradient(135deg,${V},#9B6BFF)`, color: "#fff", fontSize: 10, fontWeight: 800, padding: "4px 14px", borderRadius: 20, letterSpacing: "1px" }}>
                  CONSIGLIATO
                </div>
              )}
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 13, color: MU, marginBottom: 20, minHeight: 34 }}>{p.tagline}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 24 }}>
                <span style={{ fontSize: 38, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace" }}>€{p.price}</span>
                <span style={{ fontSize: 13, color: MU }}>{p.cadence}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28, flex: 1 }}>
                {p.features.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13, color: TX }}>
                    <span style={{ color: M, flexShrink: 0, marginTop: 1 }}>✓</span>
                    {f}
                  </div>
                ))}
              </div>
              <button
                onClick={() => (user ? navigate("/dashboard") : openAuth("register"))}
                style={p.highlighted ? btnPrimary : { ...btnGhost, borderColor: p.id === "studio" ? BR : BR }}
              >
                {user ? "Vai alla Dashboard" : p.cta}
              </button>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", color: MU, fontSize: 12, marginTop: 28 }}>
          I piani Pro e Studio si attivano su richiesta dopo la registrazione: contattaci per passare al piano superiore.
        </p>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: `1px solid ${BR}`, padding: "28px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: MU, flexWrap: "wrap", gap: 12 }}>
        <span>© {new Date().getFullYear()} Music Studio Pro · Promo Music Italia</span>
        <div style={{ display: "flex", gap: 18 }}>
          <a href="#caratteristiche" style={{ textDecoration: "none", color: MU }}>Caratteristiche</a>
          <a href="#prezzi" style={{ textDecoration: "none", color: MU }}>Prezzi</a>
        </div>
      </footer>

      {modal && <AuthModal mode={modal} onClose={() => setModal(null)} onSuccess={onAuthSuccess} />}
    </div>
  );
}
