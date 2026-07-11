const { get } = require("@vercel/blob");

const VALID_PATH = /^(global|day-[a-zA-Z0-9_-]{1,32})\/\d+-[^/]{1,200}$/;

module.exports = async function handler(req, res) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: "BLOB_READ_WRITE_TOKEN manquant sur le projet Vercel" });
  }
  try {
    const pathname = req.query.pathname;
    if (!pathname || !VALID_PATH.test(pathname)) {
      return res.status(400).json({ error: "pathname invalide" });
    }

    const result = await get(pathname, { access: "private" });
    if (!result || result.statusCode !== 200) {
      return res.status(404).json({ error: "Fichier introuvable" });
    }

    res.setHeader("Content-Type", result.blob.contentType || "application/octet-stream");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=0");

    const reader = result.stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
};
