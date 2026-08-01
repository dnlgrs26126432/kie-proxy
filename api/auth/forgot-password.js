import { sql, cors } from "../_db.js";
import { generateResetToken, hashResetToken, RESET_TOKEN_TTL_MIN } from "../_auth.js";

const SITE_URL = "https://kie-proxy-three.vercel.app";
const FROM_EMAIL = "Music Studio Pro <onboarding@resend.dev>";

// POST /api/auth/forgot-password -> se l'email esiste, invia un link di reset
// valido RESET_TOKEN_TTL_MIN minuti. Risponde sempre con lo stesso messaggio,
// email esista o no, per non rivelare quali indirizzi sono registrati.
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  const genericOk = {
    ok: true,
    message: "Se l'indirizzo e' registrato, riceverai a breve un'email con le istruzioni per reimpostare la password.",
  };

  try {
    const { email } = req.body || {};
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "Email non valida" });

    const cleanEmail = email.toLowerCase().trim();
    const rows = await sql`select id, name from users where email = ${cleanEmail}`;
    const user = rows[0];
    if (!user) return res.status(200).json(genericOk);

    const token = generateResetToken();
    const tokenHash = hashResetToken(token);
    const expires = new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60000);
    await sql`update users set reset_token_hash = ${tokenHash}, reset_token_expires = ${expires} where id = ${user.id}`;

    const resetUrl = `${SITE_URL}/reset-password?token=${token}`;
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      // Servizio email non ancora configurato: non blocchiamo la risposta
      // pubblica (evita di rivelare lo stato dell'account), ma segnaliamo
      // l'errore nei log del server.
      console.error("RESEND_API_KEY non configurata: impossibile inviare l'email di reset");
      return res.status(200).json(genericOk);
    }

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: cleanEmail,
        subject: "Reimposta la password - Music Studio Pro",
        html: `
          <p>Ciao ${user.name || ""},</p>
          <p>Hai richiesto di reimpostare la password del tuo account Music Studio Pro.</p>
          <p><a href="${resetUrl}">Clicca qui per scegliere una nuova password</a></p>
          <p>Il link scade tra ${RESET_TOKEN_TTL_MIN} minuti. Se non hai richiesto tu il reset, ignora questa email.</p>
        `,
      }),
    });

    return res.status(200).json(genericOk);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
