import { sql, cors } from "../_db.js";
import { hashPassword, signToken, setAuthCookie } from "../_auth.js";

// POST /api/auth/signup -> crea un account (piano Free di default) e apre la sessione.
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const { name, email, password } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: "Inserisci il tuo nome" });
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "Email non valida" });
    if (!password || password.length < 6) return res.status(400).json({ error: "La password deve avere almeno 6 caratteri" });

    const cleanEmail = email.toLowerCase().trim();
    const existing = await sql`select id from users where email = ${cleanEmail}`;
    if (existing.length > 0) return res.status(409).json({ error: "Esiste gia' un account con questa email" });

    const hash = await hashPassword(password);
    const rows = await sql`
      insert into users (name, email, password_hash)
      values (${name.trim()}, ${cleanEmail}, ${hash})
      returning id, name, email, plan, generation_count, generation_reset_at, created_at
    `;
    const user = rows[0];
    setAuthCookie(res, signToken({ uid: user.id }));
    return res.status(200).json({ user });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
