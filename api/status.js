import { cors } from "./_db.js";
import { getUserFromRequest } from "./_auth.js";

// GET /api/status?taskId=... -> controlla lo stato di una generazione su
// kie.ai usando la chiave API del server. Richiede login (nessuna key
// kie.ai lato client).
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Devi accedere" });

    const { taskId } = req.query;
    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "KIE_API_KEY non configurata sul server" });
    }

    const r = await fetch(`https://api.kie.ai/api/v1/generate/record-info?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const text = await r.text();
    // DEBUG temporaneo: risposta grezza e completa di kie.ai per capire se
    // "data: null" significa task non trovato o ancora in elaborazione.
    console.log(`[status] taskId=${taskId} httpStatus=${r.status} raw:`, text);
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
