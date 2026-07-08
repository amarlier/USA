const { Redis } = require("@upstash/redis");

const redis = Redis.fromEnv();

function noteKey(scope, dayId) {
  return scope === "day" ? `note:day:${dayId}` : "note:global";
}
function filesKey(scope, dayId) {
  return scope === "day" ? `files:day:${dayId}` : "files:global";
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      const scope = req.query.scope === "day" ? "day" : "global";
      const dayId = req.query.dayId || "";
      const [text, files] = await Promise.all([
        redis.get(noteKey(scope, dayId)),
        redis.get(filesKey(scope, dayId)),
      ]);
      return res.status(200).json({ text: text || "", files: files || [] });
    }

    if (req.method === "POST") {
      const { scope, dayId, text } = req.body || {};
      const s = scope === "day" ? "day" : "global";
      await redis.set(noteKey(s, dayId || ""), text || "");
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
};
