import { sql, cors } from "./_db.js";

// GET /api/cleanup-test-users -> rimuove gli account di test creati durante
// le verifiche in sviluppo (email che iniziano con "test-" su @example.com).
// Progetti e brani collegati vengono rimossi automaticamente (on delete cascade).
// Endpoint temporaneo, da rimuovere dopo l'uso.
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const rows = await sql`
      delete from users where email like 'test-%@example.com'
      returning email
    `;
    return res.status(200).json({ ok: true, removed: rows.map((r) => r.email) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
