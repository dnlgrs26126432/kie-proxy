import { sql, cors } from "./_db.js";
import { getUserFromRequest, PLAN_LIMITS, checkMonthlyLimit } from "./_auth.js";

// POST /api/regenerate-overlay -> avvia su kie.ai la rifinitura AI di un
// overlay gia' mixato (o, in modalita' extend/add_vocals, della sola
// registrazione grezza). Nessun callback: come /api/generate, il client fa
// polling su /api/status?taskId=... gia' esistente, poi salva l'esito con
// PATCH /api/overlays?id=...
//
// prompt/style/model vengono letti da tracks.generation_params — lo
// snapshot esatto del payload usato per generare quella take (salvato da
// api/tracks.js al momento della generazione), non ricostruiti al volo dal
// progetto: quest'ultimo puo' essere cambiato nel frattempo, ma la take
// gia' generata deve restare coerente con cio' che l'ha davvero prodotta.
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
      select o.*, p.title as project_title, t.generation_params
      from overlays o
      join projects p on p.id = o.project_id
      join tracks t on t.id = o.track_id
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

    // Niente fallback: se manca, la take e' stata generata prima che
    // salvassimo generation_params e non c'e' un prompt storico affidabile
    // da riusare (ricostruirlo da projects.lyrics rompeva silenziosamente
    // quando il progetto era cambiato o strumentale — vedi il bug su
    // "Cuore in Fiamme").
    if (!overlay.generation_params || !overlay.generation_params.prompt) {
      return res.status(400).json({
        error: "Questa take è stata generata prima che salvassimo i parametri completi — genera una nuova take per usare l'overlay recorder.",
      });
    }
    const { prompt, style, model } = overlay.generation_params;

    const payload = {
      uploadUrl: sourceUrl,
      model,
      style,
      title: overlay.project_title,
      prompt,
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

    // DEBUG temporaneo: interroga subito lo stato del task appena creato
    // (stessa chiamata di /api/status) per vedere lo stato iniziale senza
    // dover cercare il taskId nel Network tab del browser.
    try {
      const statusRes = await fetch(`https://api.kie.ai/api/v1/generate/record-info?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const statusText = await statusRes.text();
      console.log(`[regenerate-overlay] taskId=${taskId} stato iniziale:`, statusText);
    } catch (statusErr) {
      console.log(`[regenerate-overlay] taskId=${taskId} — errore nel controllo di stato immediato:`, statusErr.message);
    }

    return res.status(200).json({ taskId });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
