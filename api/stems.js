import { sql, cors } from "./_db.js";
import { getUserFromRequest } from "./_auth.js";

// POST /api/stems            -> avvia la separazione voce/strumenti su kie.ai
//                                per un brano gia' generato (serve kie_task_id +
//                                kie_audio_id salvati sul brano — vedi wav.js
//                                per lo stesso limite sui brani piu' vecchi).
//                                body: { trackId, type: "separate_vocal" | "split_stem" }
//                                "separate_vocal" -> 2 stem (voce/strumentale)
//                                "split_stem"      -> fino a 12 stem per strumento
// GET  /api/stems?taskId=... -> controlla lo stato della separazione e
//                                ritorna gli URL degli stem quando pronti
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
      const { trackId, type } = req.body || {};
      if (!trackId || !["separate_vocal", "split_stem"].includes(type)) {
        return res.status(400).json({ error: "trackId e type (separate_vocal|split_stem) sono obbligatori" });
      }

      const rows = await sql`
        select t.kie_task_id, t.kie_audio_id
        from tracks t
        join projects p on p.id = t.project_id
        where t.id = ${trackId} and p.user_id = ${user.id}
      `;
      const track = rows[0];
      if (!track) return res.status(404).json({ error: "Brano non trovato" });
      if (!track.kie_task_id || !track.kie_audio_id) {
        return res.status(400).json({
          error: "Brano generato prima di questa funzione: rigeneralo per poter esportare gli stem",
        });
      }

      const r = await fetch("https://api.kie.ai/api/v1/vocal-removal/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          taskId: track.kie_task_id,
          audioId: track.kie_audio_id,
          type,
          callBackUrl: "https://example.com/callback",
        }),
      });
      const text = await r.text();
      // DEBUG temporaneo: split_stem torna "Nessun taskId ricevuto" lato
      // client nonostante nessun errore esplicito — guardiamo la risposta
      // grezza per capire se kie.ai la struttura diversamente da separate_vocal.
      console.log(`[stems] POST type=${type} httpStatus=${r.status} raw:`, text);
      let d;
      try { d = JSON.parse(text); } catch { d = { code: r.status, msg: text || "Risposta non valida da kie.ai" }; }
      return res.status(r.status).json(d);
    }

    if (req.method === "GET") {
      const { taskId } = req.query;
      if (!taskId) return res.status(400).json({ error: "taskId mancante" });
      const r = await fetch(`https://api.kie.ai/api/v1/vocal-removal/record-info?taskId=${taskId}`, {
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
