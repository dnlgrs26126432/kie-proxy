import { cors } from "./_db.js";
import { getUserFromRequest, PLAN_LIMITS, checkMonthlyLimit } from "./_auth.js";

// POST /api/generate -> avvia una generazione audio su kie.ai usando la
// chiave API del server (mai esposta al client). Richiede login e applica
// il limite mensile di generazioni del piano dell'utente PRIMA di avviare
// la generazione (il salvataggio effettivo dei brani resta in /api/tracks).
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Devi accedere" });

    const limit = PLAN_LIMITS[user.plan]?.generationsPerMonth ?? PLAN_LIMITS.free.generationsPerMonth;
    const { ok } = await checkMonthlyLimit(user, "generation_count", limit);
    if (!ok) {
      return res.status(403).json({
        error: `Hai raggiunto il limite di ${limit} generazioni/mese del piano ${user.plan}. Passa a un piano superiore per continuare.`,
      });
    }

    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "KIE_API_KEY non configurata sul server" });
    }

    const r = await fetch("https://api.kie.ai/api/v1/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(req.body),
    });
    const text = await r.text();
    let d;
    try {
      d = JSON.parse(text);
    } catch {
      d = { code: r.status, msg: text || "Risposta non valida da kie.ai" };
    }
    return res.status(r.status).json(d);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
