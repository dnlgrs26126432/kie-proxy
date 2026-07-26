export default async function handler(req, res) {
res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
if (req.method === "OPTIONS") return res.status(200).end();
try {
const { taskId } = req.query;
const apiKey = req.headers["authorization"];
const r = await fetch(`https://api.kie.ai/api/v1/generate/${taskId}`, {
headers: { "Authorization": apiKey }
});
const text = await r.text();
let d;
try { d = JSON.parse(text); } catch { d = { code: r.status, msg: text || "Risposta non valida da kie.ai" }; }
res.status(r.status).json(d);
} catch (e) {
res.status(500).json({ code: 500, msg: e.message });
}
}
