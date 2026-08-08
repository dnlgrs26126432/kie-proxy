import { del } from "@vercel/blob";
import { sql, cors } from "./_db.js";
import { getUserFromRequest } from "./_auth.js";
import { loadOwnedTrack, loadOwnedOverlay } from "./_overlays.js";

// GET    /api/overlays?trackId=... -> tutti i layer (registrazioni/upload)
//                               salvati per quel track, in ordine di
//                               creazione. Il mix multi-traccia finale vive
//                               su tracks.overlay_mix_url (PATCH /api/tracks),
//                               non qui: un mix combina PIU' layer insieme,
//                               non e' piu' un 1:1 con un singolo overlay.
// POST   /api/overlays        -> aggiunge un nuovo layer (voce/effetto/
//                               strumento) sopra un track gia' generato.
//                               L'audio e' gia' su Vercel Blob (upload
//                               diretto client-to-blob via
//                               api/overlay-upload-token.js) — qui arriva
//                               solo l'URL risultante, salvato cosi' com'e'.
// DELETE /api/overlays?id=... -> rimuove un layer (es. una take scartata
//                               prima del mix finale).
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

      const layers = await sql`
        select * from overlays where track_id = ${trackId} order by created_at asc
      `;
      return res.status(200).json({ layers });
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

    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "id mancante" });

      const overlay = await loadOwnedOverlay(sql, id, user.id);
      if (!overlay) return res.status(404).json({ error: "Layer non trovato" });

      try {
        await del(overlay.raw_audio_url);
      } catch {
        /* file gia' rimosso, ignora */
      }
      await sql`delete from overlays where id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE, OPTIONS");
    return res.status(405).json({ error: "Metodo non consentito" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
