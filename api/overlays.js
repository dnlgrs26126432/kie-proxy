import { sql, cors } from "./_db.js";
import { getUserFromRequest } from "./_auth.js";
import { loadOwnedTrack, loadOwnedOverlay } from "./_overlays.js";

// GET   /api/overlays?trackId=... -> ultimo overlay salvato per quel track
//                               (se esiste). Serve al client per ricostruire
//                               lo stato al mount/refresh invece di ripartire
//                               sempre da "idle" ignorando quanto gia' salvato
//                               (registrazione/mix/rigenerazione in corso).
// POST  /api/overlays        -> registra un overlay (voce/effetto) sopra un
//                               track gia' generato. L'audio e' gia' stato
//                               caricato su Vercel Blob dal client (upload
//                               diretto client-to-blob via
//                               api/overlay-upload-token.js, non passa piu'
//                               dal body di questa funzione) — qui arriva
//                               solo l'URL risultante, salvato cosi' com'e'.
// PATCH /api/overlays?id=... -> aggiorna un overlay esistente: o il mix
//                               semplice (mixedAudioUrl, stesso discorso:
//                               gia' su Blob, solo l'URL) o l'esito di una
//                               rigenerazione via kie.ai (gia' un URL suo).
function isOwnBlobUrl(url) {
  if (typeof url !== "string") return false;
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Devi accedere" });

    if (req.method === "GET") {
      const { trackId } = req.query;
      if (!trackId) return res.status(400).json({ error: "trackId mancante" });

      const owned = await loadOwnedTrack(sql, trackId, user.id);
      if (!owned) return res.status(404).json({ error: "Track non trovato" });

      const rows = await sql`
        select * from overlays where track_id = ${trackId} order by created_at desc limit 1
      `;
      return res.status(200).json({ overlay: rows[0] || null });
    }

    if (req.method === "POST") {
      const b = req.body || {};
      if (!b.trackId || !b.audioUrl) {
        return res.status(400).json({ error: "trackId e audioUrl sono obbligatori" });
      }
      if (!isOwnBlobUrl(b.audioUrl)) {
        return res.status(400).json({ error: "audioUrl non valido" });
      }

      const owned = await loadOwnedTrack(sql, b.trackId, user.id);
      if (!owned) return res.status(404).json({ error: "Track non trovato" });

      const rows = await sql`
        insert into overlays (track_id, project_id, overlay_type, raw_audio_url)
        values (${owned.track_id}, ${owned.project_id}, ${b.overlayType || "voice"}, ${b.audioUrl})
        returning *
      `;
      return res.status(200).json({ overlay: rows[0] });
    }

    if (req.method === "PATCH") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "id mancante" });

      const overlay = await loadOwnedOverlay(sql, id, user.id);
      if (!overlay) return res.status(404).json({ error: "Overlay non trovato" });

      const b = req.body || {};

      if (b.mixedAudioUrl) {
        if (!isOwnBlobUrl(b.mixedAudioUrl)) {
          return res.status(400).json({ error: "mixedAudioUrl non valido" });
        }
        const rows = await sql`
          update overlays set mixed_audio_url = ${b.mixedAudioUrl} where id = ${id} returning *
        `;
        return res.status(200).json({ overlay: rows[0] });
      }

      // Esito di una rigenerazione: kie.ai restituisce gia' un URL, nessun upload qui.
      // Conta come una generazione verso il limite mensile del piano, come una
      // take normale (il controllo pre-avvio e' in api/regenerate-overlay.js,
      // l'incremento avviene qui solo al completamento riuscito).
      if (b.regeneration_status === "completed") {
        await sql`update users set generation_count = coalesce(generation_count, 0) + 1 where id = ${user.id}`;
      }

      const rows = await sql`
        update overlays set
          regeneration_status = coalesce(${b.regeneration_status || null}, regeneration_status),
          regenerated_audio_url = coalesce(${b.regenerated_audio_url || null}, regenerated_audio_url),
          regeneration_task_id = coalesce(${b.regeneration_task_id || null}, regeneration_task_id),
          regeneration_mode = coalesce(${b.regeneration_mode || null}, regeneration_mode),
          regeneration_error = coalesce(${b.regeneration_error || null}, regeneration_error)
        where id = ${id}
        returning *
      `;
      return res.status(200).json({ overlay: rows[0] });
    }

    res.setHeader("Allow", "GET, POST, PATCH, OPTIONS");
    return res.status(405).json({ error: "Metodo non consentito" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
