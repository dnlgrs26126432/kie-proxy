import { sql, cors } from "./_db.js";
import { getUserFromRequest, PLAN_LIMITS, checkMonthlyLimit } from "./_auth.js";

// POST /api/regenerate-overlay -> avvia su kie.ai la rifinitura AI di un
// overlay gia' mixato (o, in modalita' extend/add_vocals, della sola
// registrazione grezza). Nessun callback: come /api/generate, il client fa
// polling su /api/status?taskId=... gia' esistente, poi salva l'esito con
// PATCH /api/overlays?id=...
//
// A differenza di consolle-1 (dove ogni audio_version salva i propri
// generation_params), qui non esiste uno snapshot per take: lo stile per la
// rigenerazione viene preso direttamente dal progetto (genre/mood/bpm/...).
const ENDPOINT_BY_MODE = {
  extend: "/api/v1/generate/upload-extend",
  cover: "/api/v1/generate/upload-cover",
  add_vocals: "/api/v1/generate/add-vocals", // verifica il path esatto contro la doc kie.ai per il piano attivo
};

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

    const { overlayId, mode } = req.body || {};
    if (!overlayId || !ENDPOINT_BY_MODE[mode]) {
      return res.status(400).json({ error: "overlayId e mode (extend|cover|add_vocals) sono obbligatori" });
    }

    const limit = PLAN_LIMITS[user.plan]?.generationsPerMonth ?? PLAN_LIMITS.free.generationsPerMonth;
    const { ok } = await checkMonthlyLimit(user, "generation_count", limit);
    if (!ok) {
      return res.status(403).json({
        error: `Hai raggiunto il limite di ${limit} generazioni/mese del piano ${user.plan}. Passa a un piano superiore per continuare.`,
      });
    }

    const rows = await sql`
      select o.*, p.genre, p.custom_genre, p.mood, p.bpm, p.key_signature, p.scale, p.title as project_title
      from overlays o
      join projects p on p.id = o.project_id
      where o.id = ${overlayId} and p.user_id = ${user.id}
    `;
    const overlay = rows[0];
    if (!overlay) return res.status(404).json({ error: "Overlay non trovato" });

    if (mode === "cover" && !overlay.mixed_audio_url) {
      return res.status(400).json({
        error: "Nessun mix disponibile per questo overlay: fai prima il mix semplice prima di rifinire con AI.",
      });
    }
    const sourceUrl = mode === "cover" ? overlay.mixed_audio_url : overlay.raw_audio_url;

    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "KIE_API_KEY non configurata sul server" });

    const genreText = [overlay.genre, overlay.custom_genre].filter(Boolean).join(", ");
    const style = `${genreText}, ${overlay.mood}, ${overlay.bpm} BPM, ${overlay.key_signature} ${overlay.scale}`.slice(0, 200);

    const payload = {
      uploadUrl: sourceUrl,
      model: "V4",
      style,
      title: overlay.project_title,
      // Obbligatorio per kie.ai (422 "Please enter callBackUrl" altrimenti),
      // ma mai realmente raggiunto: come nel resto di kie-proxy, non
      // esistono callback implementati, tutto e' polling su /api/status.
      callBackUrl: "https://example.com/callback",
      ...(mode === "extend" ? { continueAt: 0, instrumental: false } : {}),
      ...(mode === "cover" ? { customMode: true, instrumental: false } : {}),
    };

    const kieRes = await fetch(`https://api.kie.ai${ENDPOINT_BY_MODE[mode]}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });

    if (!kieRes.ok) {
      const errBody = await kieRes.text();
      return res.status(502).json({ error: "kie.ai ha rifiutato la richiesta", details: errBody });
    }

    const kieData = await kieRes.json();
    const taskId = kieData?.data?.taskId || kieData?.taskId;
    if (!taskId) return res.status(502).json({ error: "kie.ai non ha restituito un taskId valido" });

    await sql`
      update overlays set
        regeneration_mode = ${mode},
        regeneration_status = 'pending',
        regeneration_task_id = ${taskId},
        regeneration_params = ${JSON.stringify(payload)}
      where id = ${overlayId}
    `;

    return res.status(200).json({ taskId });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
