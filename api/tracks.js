import { put, del } from "@vercel/blob";
import { sql, cors } from "./_db.js";
import { getUserFromRequest, PLAN_LIMITS, checkMonthlyLimit } from "./_auth.js";

function isOwnBlobUrl(url) {
  if (typeof url !== "string") return false;
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

// POST   /api/tracks       -> scarica l'audio da kie.ai, lo ricarica su Vercel Blob
//                             (permanente anche se l'URL di kie.ai scade), salva il
//                             record collegato al progetto e applica il limite di
//                             generazioni mensili del piano dell'utente.
// PATCH  /api/tracks?id=... -> aggiorna overlay_mix_url (mix multi-traccia
//                             dell'Overlay Recorder, gia' su Vercel Blob:
//                             qui arriva solo l'URL risultante).
// DELETE /api/tracks?id=... -> elimina un brano salvato (solo se del progetto dell'utente)
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Devi accedere" });

    if (req.method === "POST") {
      const b = req.body || {};
      if (!b.project_id || !b.source_url) {
        return res.status(400).json({ error: "project_id e source_url sono obbligatori" });
      }

      const ownerRows = await sql`select id from projects where id = ${b.project_id} and user_id = ${user.id}`;
      if (ownerRows.length === 0) return res.status(404).json({ error: "Progetto non trovato" });

      const limit = PLAN_LIMITS[user.plan]?.generationsPerMonth ?? PLAN_LIMITS.free.generationsPerMonth;
      const { ok } = await checkMonthlyLimit(user, "generation_count", limit);
      if (!ok) {
        return res.status(403).json({
          error: `Hai raggiunto il limite di ${limit} generazioni/mese del piano ${user.plan}. Passa a un piano superiore per continuare.`,
        });
      }

      const audioRes = await fetch(b.source_url);
      if (!audioRes.ok) return res.status(502).json({ error: "Impossibile scaricare l'audio da kie.ai" });
      const buffer = await audioRes.arrayBuffer();

      const filename = `tracks/${b.project_id}/${Date.now()}-take${b.take_index ?? 0}.mp3`;
      const blob = await put(filename, Buffer.from(buffer), {
        access: "public",
        contentType: "audio/mpeg",
      });

      const rows = await sql`
        insert into tracks (project_id, title, audio_url, source_url, take_index, duration_seconds, kie_task_id, kie_audio_id, generation_params)
        values (${b.project_id}, ${b.title || "Track"}, ${blob.url}, ${b.source_url}, ${b.take_index ?? 0}, ${b.duration_seconds || null}, ${b.kie_task_id || null}, ${b.kie_audio_id || null}, ${b.generation_params ? JSON.stringify(b.generation_params) : null})
        returning *
      `;
      await sql`update users set generation_count = coalesce(generation_count, 0) + 1 where id = ${user.id}`;
      return res.status(200).json({ track: rows[0] });
    }

    if (req.method === "PATCH") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "id mancante" });

      const b = req.body || {};
      if (!b.overlay_mix_url || !isOwnBlobUrl(b.overlay_mix_url)) {
        return res.status(400).json({ error: "overlay_mix_url non valido" });
      }

      const rows = await sql`
        update tracks set overlay_mix_url = ${b.overlay_mix_url}
        where id = ${id} and project_id in (select id from projects where user_id = ${user.id})
        returning *
      `;
      if (rows.length === 0) return res.status(404).json({ error: "Brano non trovato" });
      return res.status(200).json({ track: rows[0] });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "id mancante" });
      const rows = await sql`
        select t.* from tracks t
        join projects p on p.id = t.project_id
        where t.id = ${id} and p.user_id = ${user.id}
      `;
      if (rows.length === 0) return res.status(404).json({ error: "Brano non trovato" });
      try {
        await del(rows[0].audio_url);
      } catch {
        /* file gia' rimosso, ignora */
      }
      await sql`delete from tracks where id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "POST, PATCH, DELETE, OPTIONS");
    return res.status(405).json({ error: "Metodo non consentito" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
