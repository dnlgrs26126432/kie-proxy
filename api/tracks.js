import { put, del } from "@vercel/blob";
import { sql, cors } from "./_db.js";

// POST   /api/tracks   -> scarica l'audio da kie.ai e lo ricarica su Vercel Blob
//                         (cosi' resta permanente anche se l'URL di kie.ai scade),
//                         poi salva il record collegato al progetto. Supporta piu'
//                         take per la stessa generazione (galleria multi-take).
// DELETE /api/tracks?id=... -> elimina un brano salvato (DB + file su Blob)
export default async function handler(req, res) {
cors(res);
if (req.method === "OPTIONS") return res.status(200).end();

try {
if (req.method === "POST") {
const b = req.body || {};
if (!b.project_id || !b.source_url) {
return res.status(400).json({ error: "project_id e source_url sono obbligatori" });
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
insert into tracks (project_id, title, audio_url, source_url, take_index, duration_seconds)
values (${b.project_id}, ${b.title || "Track"}, ${blob.url}, ${b.source_url}, ${b.take_index ?? 0}, ${b.duration_seconds || null})
returning *
`;
return res.status(200).json({ track: rows[0] });
}

if (req.method === "DELETE") {
const { id } = req.query;
if (!id) return res.status(400).json({ error: "id mancante" });
const rows = await sql`select * from tracks where id = ${id}`;
if (rows.length > 0) {
try { await del(rows[0].audio_url); } catch { /* file gia' rimosso, ignora */ }
}
await sql`delete from tracks where id = ${id}`;
return res.status(200).json({ ok: true });
}

res.setHeader("Allow", "POST, DELETE, OPTIONS");
return res.status(405).json({ error: "Metodo non consentito" });
} catch (e) {
return res.status(500).json({ error: e.message });
}
}
