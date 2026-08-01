import { cors } from "./_db.js";

// GET /api/debug-resend?to=indirizzo@email.com -> invia un'email di prova
// tramite Resend e restituisce la risposta grezza dell'API, per capire
// perche' le email non arrivano. Endpoint temporaneo di debug, da rimuovere
// una volta risolto.
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return res.status(200).json({ error: "RESEND_API_KEY non impostata" });

    const to = req.query.to || "danilogirasole361@gmail.com";

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: "Music Studio Pro <onboarding@resend.dev>",
        to,
        subject: "Test debug Resend",
        html: "<p>Email di prova per verificare l'invio.</p>",
      }),
    });
    const text = await r.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    return res.status(200).json({ resendStatus: r.status, resendOk: r.ok, resendBody: body, sentTo: to });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
