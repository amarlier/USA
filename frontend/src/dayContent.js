// Parses the human-readable per-day text files (public/days/day-XX.md) into the
// block structure used by RenderBlocks: { type: "h1"|"h2"|"h3"|"p"|"img"|"doc", ... }
export function parseDayMarkdown(text) {
  if (!text) return [];
  const chunks = text.split(/\n\s*\n/).map(c => c.trim()).filter(Boolean);
  const blocks = [];
  for (const chunk of chunks) {
    if (chunk.startsWith("### ")) {
      blocks.push({ type: "h3", text: chunk.slice(4).trim() });
    } else if (chunk.startsWith("## ")) {
      blocks.push({ type: "h2", text: chunk.slice(3).trim() });
    } else if (chunk.startsWith("# ")) {
      blocks.push({ type: "h1", text: chunk.slice(2).trim() });
    } else if (/^!\[\]\(([^)]+)\)$/.test(chunk)) {
      const m = chunk.match(/^!\[\]\(([^)]+)\)$/);
      blocks.push({ type: "img", src: m[1] });
    } else if (/^\[DOC\]\(([^)]+)\)\s*(.*)$/s.test(chunk)) {
      const m = chunk.match(/^\[DOC\]\(([^)]+)\)\s*(.*)$/s);
      blocks.push({ type: "doc", url: m[1], title: m[2].trim() });
    } else {
      blocks.push({ type: "p", text: chunk });
    }
  }
  return blocks;
}

const cache = {};

export async function fetchDayBlocks(dayId) {
  if (cache[dayId]) return cache[dayId];
  const num = String(dayId).padStart(2, "0");
  const res = await fetch(`${process.env.PUBLIC_URL || ""}/days/day-${num}.md`);
  if (!res.ok) return [];
  const text = await res.text();
  const blocks = parseDayMarkdown(text);
  cache[dayId] = blocks;
  return blocks;
}
