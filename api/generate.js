export default async function handler(req, res) {
res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
if (req.method === "OPTIONS") return res.status(200).end();
try {
const apiKey = process.env.KIE_API_KEY;
if (!apiKey) {
res.status(500).json({ code: 500, msg: "KIE_API_KEY non configurata sul server" });
return;
}
const r = await fetch("https://api.kie.ai/api/v1/generate", {
method: "POST",
headers: {"Content-Type":"application/json", "Authorization": `Bearer ${apiKey}`},
body: JSON.stringify(req.body)
});
const text = await r.text();
let d;
try { d = JSON.parse(text); } catch { d = { code: r.status, msg: text || "Risposta non valida da kie.ai" }; }
res.status(r.status).json(d);
} catch (e) {
res.status(500).json({ code: 500, msg: e.message });
}
}
