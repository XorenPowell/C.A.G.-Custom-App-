// Tiny static server for the design mockup. Deliberately separate from the
// Next app: it serves design/mockup only and touches nothing in src/.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not .pathname: the project folder has a space in it, which
// .pathname hands back as %20 and readFile cannot resolve.
const ROOT = fileURLToPath(new URL("./mockup/", import.meta.url));
const PORT = Number(process.argv[2] || 4321);
const TYPES = { ".html":"text/html", ".css":"text/css", ".js":"text/javascript",
                ".json":"application/json", ".svg":"image/svg+xml" };

createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  const rel = normalize(url === "/" ? "index.html" : url.replace(/^\/+/, ""));
  if (rel.includes("..")) { res.writeHead(403).end("no"); return; }
  try {
    const body = await readFile(join(ROOT, rel));
    res.writeHead(200, {
      "content-type": TYPES[extname(rel)] || "application/octet-stream",
      "cache-control": "no-store",
    }).end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("not found");
  }
}).listen(PORT, () => {
  console.log(`\n  C.A.G. design mockup  ->  http://localhost:${PORT}\n`);
});
