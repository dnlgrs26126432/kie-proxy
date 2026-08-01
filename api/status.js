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
    let d;
    try {
      d = JSON.parse(text);
    } catch {
      d = { code: r.status, msg: text || "Risposta non valida da kie.ai" };
    }
    // DEBUG TEMPORANEO: logga la risposta completa quando la generazione
    // termina, per capire perche' le tracce escono piu' corte del previsto.
    // Da rimuovere dopo la diagnosi.
    if (d?.data?.status === "SUCCESS" || d?.status === "SUCCESS") {
      console.log("KIE_DEBUG_FULL_RESPONSE", JSON.stringify(d));
    }
    return res.status(r.status).json(d);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
