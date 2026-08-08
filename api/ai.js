import { sql, cors } from "./_db.js";
import { getUserFromRequest, PLAN_LIMITS, checkMonthlyLimit } from "./_auth.js";

// POST /api/ai -> proxy verso Anthropic per testi/idee/breakdown/titolo.
// Richiede login (prima era un endpoint completamente aperto: chiunque avesse
// l'URL poteva consumare la ANTHROPIC_API_KEY del server) e applica il tetto
// mensile di chiamate testo del piano dell'utente.
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

    const limit = PLAN_LIMITS[user.plan]?.aiTextCallsPerMonth ?? PLAN_LIMITS.free.aiTextCallsPerMonth;
    const { ok } = await checkMonthlyLimit(user, "ai_text_count", limit);
    if (!ok) {
      return res.status(403).json({
        error: `Hai raggiunto il limite di ${limit} generazioni di testo/mese del piano ${user.plan}. Passa a un piano superiore per continuare.`,
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "ANTHROPIC_API_KEY non configurata sul server" });
    }

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });
    const text = await r.text();
    let d;
    try {
      d = JSON.parse(text);
    } catch {
      d = { error: text || "Risposta non valida da Anthropic" };
    }
    // DEBUG temporaneo: risposta grezza e completa di Anthropic, per capire
    // perche' il client a volte estrae un testo vuoto ("Nessuna risposta").
    console.log(`[ai] httpStatus=${r.status} raw:`, text);

    if (r.ok) {
      await sql`update users set ai_text_count = coalesce(ai_text_count, 0) + 1 where id = ${user.id}`;
    }

    return res.status(r.status).json(d);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
