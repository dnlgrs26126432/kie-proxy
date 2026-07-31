import { cors } from "../_db.js";
import { clearAuthCookie } from "../_auth.js";

// POST /api/auth/logout -> chiude la sessione.
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  clearAuthCookie(res);
  return res.status(200).json({ ok: true });
}
