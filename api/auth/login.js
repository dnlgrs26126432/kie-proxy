import { sql, cors } from "../_db.js";
import { comparePassword, signToken, setAuthCookie } from "../_auth.js";

// POST /api/auth/login -> verifica le credenziali e apre la sessione.
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email e password sono obbligatorie" });

    const rows = await sql`select * from users where email = ${email.toLowerCase().trim()}`;
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Credenziali non valide" });

    const ok = await comparePassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Credenziali non valide" });

    setAuthCookie(res, signToken({ uid: user.id }));
    delete user.password_hash;
    return res.status(200).json({ user });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
