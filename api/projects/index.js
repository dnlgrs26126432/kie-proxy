import { sql, cors } from "../_db.js";

// GET  /api/projects        -> elenco progetti (piu' recenti prima) con conteggio brani
// POST /api/projects        -> crea un nuovo progetto e restituisce il record salvato
export default async function handler(req, res) {
cors(res);
if (req.method === "OPTIONS") return res.status(200).end();

try {
if (req.method === "GET") {
const rows = await sql`
select p.*,
(select count(*) from tracks t where t.project_id = p.id) as track_count
from projects p
order by p.updated_at desc
limit 100
`;
return res.status(200).json({ projects: rows });
}

if (req.method === "POST") {
const b = req.body || {};
const rows = await sql`
insert into projects (
title, genre, custom_genre, mood, bpm, key_signature, scale,
sections, lyrics, energy, darkness, reference_artist,
duration_seconds, instrumental, director_notes, concept
) values (
${b.title || "Untitled"}, ${b.genre || "Trap"}, ${b.customGenre || null}, ${b.mood || "Dark"},
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
