import { sql, cors } from "../_db.js";
import { getUserFromRequest } from "../_auth.js";

// GET    /api/projects/:id -> progetto (solo se dell'utente) + brani collegati
// PATCH  /api/projects/:id -> aggiorna il progetto (solo se dell'utente)
// DELETE /api/projects/:id -> elimina progetto e brani collegati (solo se dell'utente)
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "id mancante" });

  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Devi accedere" });

    if (req.method === "GET") {
      const projectRows = await sql`select * from projects where id = ${id} and user_id = ${user.id}`;
      if (projectRows.length === 0) return res.status(404).json({ error: "Progetto non trovato" });
      const tracks = await sql`select * from tracks where project_id = ${id} order by created_at desc`;
      return res.status(200).json({ project: projectRows[0], tracks });
    }

    if (req.method === "PATCH") {
      const b = req.body || {};
      const rows = await sql`
        update projects set
          title = ${b.title || "Untitled"},
          genre = ${b.genre || "Trap"},
          custom_genre = ${b.customGenre || null},
          mood = ${b.mood || "Dark"},
          bpm = ${b.bpm || 120},
          key_signature = ${b.key || "C"},
          scale = ${b.scale || "Minore"},
          sections = ${JSON.stringify(b.sections || [])},
          lyrics = ${JSON.stringify(b.lyrics || {})},
          energy = ${b.energy ?? 80},
          darkness = ${b.darkness ?? 70},
          reference_artist = ${b.refArtist || null},
          duration_seconds = ${b.duration || 120},
          instrumental = ${!!b.instrumental},
          director_notes = ${b.directorNotes || null},
          concept = ${b.concept || null},
          updated_at = now()
        where id = ${id} and user_id = ${user.id}
        returning *
      `;
      if (rows.length === 0) return res.status(404).json({ error: "Progetto non trovato" });
      return res.status(200).json({ project: rows[0] });
    }

    if (req.method === "DELETE") {
      await sql`delete from projects where id = ${id} and user_id = ${user.id}`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, PATCH, DELETE, OPTIONS");
    return res.status(405).json({ error: "Metodo non consentito" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
