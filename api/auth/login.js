import { sql, cors } from "../_db.js";
import { comparePassword, signToken, setAuthCookie } from "../_auth.js";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// POST /api/auth/login -> verifica le credenziali e apre la sessione.
// Blocca l'account per LOCKOUT_MINUTES dopo MAX_ATTEMPTS tentativi falliti
// consecutivi, per limitare i tentativi di forza bruta.
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

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minsLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(429).json({
        error: `Troppi tentativi falliti. Riprova tra ${minsLeft} minut${minsLeft === 1 ? "o" : "i"}.`,
      });
    }

    const ok = await comparePassword(password, user.password_hash);
    if (!ok) {
      const attempts = (user.failed_login_count || 0) + 1;
      if (attempts >= MAX_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60000);
        await sql`
          update users set failed_login_count = 0, locked_until = ${lockedUntil}
          where id = ${user.id}
        `;
        return res.status(429).json({
          error: `Troppi tentativi falliti. Account bloccato per ${LOCKOUT_MINUTES} minuti.`,
        });
      }
      await sql`update users set failed_login_count = ${attempts} where id = ${user.id}`;
      return res.status(401).json({ error: "Credenziali non valide" });
    }

    if (user.failed_login_count || user.locked_until) {
      await sql`update users set failed_login_count = 0, locked_until = null where id = ${user.id}`;
    }

    setAuthCookie(res, signToken({ uid: user.id }));
    delete user.password_hash;
    return res.status(200).json({ user });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
