module.exports = async function handler(req, res) {
res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
if (req.method === "OPTIONS") return res.status(200).end();
const apiKey = req.headers["authorization"];
const r = await fetch("https://api.kie.ai/api/v1/generate", {
method: "POST",
headers: {"Content-Type":"application/json", "Authorization": apiKey},
body: JSON.stringify(req.body)
});
const d = await r.json();
res.status(r.status).json(d);
}
