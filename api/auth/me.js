import { cors } from "../_db.js";
import { getUserFromRequest } from "../_auth.js";

// GET /api/auth/me -> utente corrente (o null se non autenticato).
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const user = await getUserFromRequest(req);
    return res.status(200).json({ user });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
