export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  const { taskId } = req.query;
  const apiKey = req.headers["authorization"];
  const r = await fetch(`https://api.kie.ai/api/v1/generate/${taskId}`, {
    headers: {"Authorization": apiKey}
  });
  const d = await r.json();
  res.status(r.status).json(d);
}
