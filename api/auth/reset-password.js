import { sql, cors } from "../_db.js";
import { hashPassword, hashResetToken, signToken, setAuthCookie } from "../_auth.js";

// POST /api/auth/reset-password -> verifica il token ricevuto via email,
// imposta la nuova password e apre subito la sessione. Token monouso.
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const { token, password } = req.body || {};
    if (!token) return res.status(400).json({ error: "Token mancante" });
    if (!password || password.length < 6) return res.status(400).json({ error: "La password deve avere almeno 6 caratteri" });

    const tokenHash = hashResetToken(token);
    const rows = await sql`
      select id, reset_token_expires from users
      where reset_token_hash = ${tokenHash}
    `;
    const user = rows[0];
    if (!user || !user.reset_token_expires || new Date(user.reset_token_expires) < new Date()) {
      return res.status(400).json({ error: "Link non valido o scaduto. Richiedine uno nuovo." });
    }

    const hash = await hashPassword(password);
    await sql`
      update users set password_hash = ${hash}, reset_token_hash = null, reset_token_expires = null,
        failed_login_count = 0, locked_until = null
      where id = ${user.id}
    `;

    const userRows = await sql`select id, name, email, plan, generation_count, ai_text_count, generation_reset_at, created_at from users where id = ${user.id}`;
    setAuthCookie(res, signToken({ uid: user.id }));
    return res.status(200).json({ user: userRows[0] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
