const { put, del } = require("@vercel/blob");
const { Redis } = require("@upstash/redis");

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

function filesKey(scope, dayId) {
  return scope === "day" ? `files:day:${dayId}` : "files:global";
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: "BLOB_READ_WRITE_TOKEN manquant sur le projet Vercel" });
  }
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return res.status(500).json({ error: "KV_REST_API_URL / KV_REST_API_TOKEN manquants sur le projet Vercel" });
  }

  try {
    if (req.method === "POST") {
      const { scope, dayId, filename, contentType, dataBase64 } = req.body || {};
      if (!filename || !dataBase64) {
        return res.status(400).json({ error: "filename et dataBase64 requis" });
      }
      const s = scope === "day" ? "day" : "global";
      const buffer = Buffer.from(dataBase64, "base64");
      if (buffer.length > 4 * 1024 * 1024) {
        return res.status(413).json({ error: "Fichier trop volumineux (max 4 Mo)" });
      }
      const pathKey = `${s === "day" ? `day-${dayId}` : "global"}/${Date.now()}-${filename}`;
      const blob = await put(pathKey, buffer, {
        access: "private",
        contentType: contentType || "application/octet-stream",
      });

      const key = filesKey(s, dayId || "");
      const files = (await redis.get(key)) || [];
      const entry = { name: filename, pathname: blob.pathname, uploadedAt: Date.now() };
      const updated = [...files, entry];
      await redis.set(key, updated);
      return res.status(200).json({ ok: true, file: entry, files: updated });
    }

    if (req.method === "DELETE") {
      const { scope, dayId, pathname } = req.body || {};
      const s = scope === "day" ? "day" : "global";
      if (pathname) {
        try { await del(pathname, { access: "private" }); } catch (e) { console.warn("blob del failed", e); }
      }
      const key = filesKey(s, dayId || "");
      const files = (await redis.get(key)) || [];
      const updated = files.filter(f => f.pathname !== pathname);
      await redis.set(key, updated);
      return res.status(200).json({ ok: true, files: updated });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
};
