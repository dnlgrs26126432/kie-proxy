export default async function handler(req, res) {
res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
if (req.method === "OPTIONS") return res.status(200).end();
try {
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
res.status(500).json({ error: "ANTHROPIC_API_KEY non configurata sul server" });
return;
}
const r = await fetch("https://api.anthropic.com/v1/messages", {
method: "POST",
headers: {
"Content-Type": "application/json",
"x-api-key": apiKey,
"anthropic-version": "2023-06-01"
},
body: JSON.stringify(req.body)
});
const text = await r.text();
let d;
try { d = JSON.parse(text); } catch { d = { error: text || "Risposta non valida da Anthropic" }; }
res.status(r.status).json(d);
} catch (e) {
res.status(500).json({ error: e.message });
}
  }
