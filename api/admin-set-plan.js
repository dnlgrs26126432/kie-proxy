import { sql, cors } from "./_db.js";

// GET /api/admin-set-plan?email=...&plan=pro -> aggiorna manualmente il piano
// di un utente (Stripe non e' ancora collegato). Azzera anche i contatori
// mensili cosi' l'utente riparte subito con i nuovi limiti.
// Endpoint temporaneo, da rimuovere dopo l'uso.
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const email = (req.query.email || "").toLowerCase().trim();
    const plan = req.query.plan || "pro";
    if (!email || !["free", "pro", "studio"].includes(plan)) {
      return res.status(400).json({ error: "email o plan mancante/non valido" });
    }
    const rows = await sql`
      update users
      set plan = ${plan}, generation_count = 0, ai_text_count = 0
      where email = ${email}
      returning id, email, plan, generation_count, ai_text_count
    `;
    if (rows.length === 0) return res.status(404).json({ error: "Utente non trovato" });
    return res.status(200).json({ ok: true, user: rows[0] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
