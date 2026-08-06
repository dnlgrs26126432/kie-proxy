import { put } from "@vercel/blob";
import { sql, cors } from "./_db.js";
import { getUserFromRequest } from "./_auth.js";

// POST  /api/overlays       -> salva una registrazione overlay (voce/effetto)
//                              fatta sopra un track gia' generato. L'audio
//                              arriva in base64 nel body (nessun blob storage
//                              client-side qui, a differenza di Supabase:
//                              passa sempre da questa funzione, che lo carica
//                              su Vercel Blob server-side).
// PATCH /api/overlays?id=... -> aggiorna un overlay esistente: o il mix
//                              semplice (mixedAudioBase64, altro upload Blob)
//                              o l'esito di una rigenerazione via kie.ai
//                              (regeneration_status/regenerated_audio_url,
//                              gia' un URL — nessun upload in quel caso).
const EXT_BY_CONTENT_TYPE = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/mpeg": "mp3",
};

async function loadOwnedTrack(sqlTag, trackId, userId) {
  const rows = await sqlTag`
    select t.id as track_id, t.project_id
    from tracks t
    join projects p on p.id = t.project_id
    where t.id = ${trackId} and p.user_id = ${userId}
  `;
  return rows[0] || null;
}

async function loadOwnedOverlay(sqlTag, overlayId, userId) {
  const rows = await sqlTag`
    select o.*
    from overlays o
    join projects p on p.id = o.project_id
    where o.id = ${overlayId} and p.user_id = ${userId}
  `;
  return rows[0] || null;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Devi accedere" });

    if (req.method === "POST") {
      const b = req.body || {};
      if (!b.trackId || !b.audioBase64) {
        return res.status(400).json({ error: "trackId e audioBase64 sono obbligatori" });
      }

      const owned = await loadOwnedTrack(sql, b.trackId, user.id);
      if (!owned) return res.status(404).json({ error: "Track non trovato" });

      const ext = EXT_BY_CONTENT_TYPE[b.contentType] || "webm";
      const buffer = Buffer.from(b.audioBase64, "base64");
      const filename = `overlays/${owned.project_id}/${owned.track_id}-${Date.now()}.${ext}`;
      const blob = await put(filename, buffer, {
        access: "public",
        contentType: b.contentType || "audio/webm",
      });

      const rows = await sql`
        insert into overlays (track_id, project_id, overlay_type, raw_audio_url)
        values (${owned.track_id}, ${owned.project_id}, ${b.overlayType || "voice"}, ${blob.url})
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

      if (b.mixedAudioBase64) {
        const ext = EXT_BY_CONTENT_TYPE[b.contentType] || "wav";
        const buffer = Buffer.from(b.mixedAudioBase64, "base64");
        const filename = `overlays/${overlay.project_id}/${overlay.track_id}-${Date.now()}-mixed.${ext}`;
        const blob = await put(filename, buffer, {
          access: "public",
          contentType: b.contentType || "audio/wav",
        });
        const rows = await sql`
          update overlays set mixed_audio_url = ${blob.url} where id = ${id} returning *
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

    res.setHeader("Allow", "POST, PATCH, OPTIONS");
    return res.status(405).json({ error: "Metodo non consentito" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
