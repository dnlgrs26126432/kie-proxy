import { cors } from "./_db.js";
import { getUserFromRequest } from "./_auth.js";

// POST /api/wav                 -> avvia la conversione di un brano in WAV su kie.ai
//                                   (serve kie_task_id + kie_audio_id salvati sul brano)
// GET  /api/wav?taskId=...      -> controlla lo stato della conversione e ritorna l'URL
//                                   del file WAV quando pronto
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Devi accedere" });

    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "KIE_API_KEY non configurata sul server" });
    }

    if (req.method === "POST") {
      const { taskId, audioId } = req.body || {};
      if (!taskId || !audioId) {
        return res.status(400).json({ error: "taskId e audioId sono obbligatori (brano generato prima di questa modifica: rigeneralo per poterlo convertire in WAV)" });
      }
      const r = await fetch("https://api.kie.ai/api/v1/wav/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ taskId, audioId, callBackUrl: "https://example.com/callback" }),
      });
      const text = await r.text();
      let d;
      try { d = JSON.parse(text); } catch { d = { code: r.status, msg: text || "Risposta non valida da kie.ai" }; }
      return res.status(r.status).json(d);
    }

    if (req.method === "GET") {
      const { taskId } = req.query;
      if (!taskId) return res.status(400).json({ error: "taskId mancante" });
      const r = await fetch(`https://api.kie.ai/api/v1/wav/record-info?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const text = await r.text();
      let d;
      try { d = JSON.parse(text); } catch { d = { code: r.status, msg: text || "Risposta non valida da kie.ai" }; }
      return res.status(r.status).json(d);
    }

    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(405).json({ error: "Metodo non consentito" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
