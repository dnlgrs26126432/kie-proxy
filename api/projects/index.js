import { sql, cors } from "../_db.js";
import { getUserFromRequest, PLAN_LIMITS } from "../_auth.js";

// GET  /api/projects -> progetti dell'utente autenticato (piu' recenti prima)
// POST /api/projects -> crea un progetto per l'utente autenticato (rispetta i limiti del piano)
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Devi accedere per vedere i tuoi progetti" });

    if (req.method === "GET") {
      const rows = await sql`
        select p.*, (select count(*) from tracks t where t.project_id = p.id) as track_count
        from projects p
        where p.user_id = ${user.id}
        order by p.updated_at desc
        limit 100
      `;
      return res.status(200).json({ projects: rows, user });
    }

    if (req.method === "POST") {
      const limit = PLAN_LIMITS[user.plan]?.projects ?? PLAN_LIMITS.free.projects;
      if (Number.isFinite(limit)) {
        const countRows = await sql`select count(*) from projects where user_id = ${user.id}`;
        if (Number(countRows[0].count) >= limit) {
          return res.status(403).json({
            error: `Il piano ${user.plan} permette al massimo ${limit} progetti salvati. Passa a un piano superiore per crearne altri.`,
          });
        }
      }

      const b = req.body || {};
      const rows = await sql`
        insert into projects (
          user_id, title, genre, custom_genre, mood, bpm, key_signature, scale,
          sections, lyrics, energy, darkness, reference_artist,
          duration_seconds, instrumental, director_notes, concept
        ) values (
          ${user.id}, ${b.title || "Untitled"}, ${b.genre || "Trap"}, ${b.customGenre || null}, ${b.mood || "Dark"},
          ${b.bpm || 120}, ${b.key || "C"}, ${b.scale || "Minore"},
          ${JSON.stringify(b.sections || [])}, ${JSON.stringify(b.lyrics || {})},
          ${b.energy ?? 80}, ${b.darkness ?? 70}, ${b.refArtist || null},
          ${b.duration || 120}, ${!!b.instrumental}, ${b.directorNotes || null}, ${b.concept || null}
        )
        returning *
      `;
      return res.status(200).json({ project: rows[0] });
    }

    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(405).json({ error: "Metodo non consentito" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
