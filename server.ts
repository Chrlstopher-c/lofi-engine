/**
 * Serveur statique de LoFi Engine (site statique construit par Vite).
 * Traite explicitement les requêtes Range : le navigateur demande les
 * pistes mp3 par tranches pendant la lecture.
 */
import { file, type BunFile } from "bun";
import { resolve, normalize, join } from "node:path";
import { repondre as repondreProgression } from "./progression.ts";

const ROOT = resolve(process.env.LOFI_ROOT ?? "./dist");
const PORT = Number(process.env.LOFI_PORT ?? 4707);
const HOST = process.env.LOFI_HOST ?? "127.0.0.1";

function resolveSafePath(pathname: string): string | null {
  const decoded = decodeURIComponent(pathname);
  const candidate = resolve(join(ROOT, normalize(decoded)));
  // Empêche toute remontée hors de ROOT (path traversal)
  if (candidate !== ROOT && !candidate.startsWith(ROOT + "/")) return null;
  return candidate.endsWith("/") ? join(candidate, "index.html") : candidate;
}

/** Renvoie [start, end] inclusifs, ou null si l'en-tête est absent/illisible. */
function parseRange(header: string | null, size: number): [number, number] | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;
  // Forme suffixe « bytes=-500 » : les 500 derniers octets
  const start = rawStart ? Number(rawStart) : Math.max(0, size - Number(rawEnd));
  const end = rawStart ? (rawEnd ? Math.min(Number(rawEnd), size - 1) : size - 1) : size - 1;
  if (start > end || start >= size) return null;
  return [start, end];
}

function serve(target: BunFile, req: Request): Response {
  const size = target.size;
  const range = parseRange(req.headers.get("range"), size);
  if (!range) {
    return new Response(target, { headers: { "accept-ranges": "bytes" } });
  }
  const [start, end] = range;
  return new Response(target.slice(start, end + 1), {
    status: 206,
    headers: {
      "accept-ranges": "bytes",
      "content-range": `bytes ${start}-${end}/${size}`,
      "content-length": String(end - start + 1),
    },
  });
}

Bun.serve({
  port: PORT,
  hostname: HOST,
  idleTimeout: 255,
  async fetch(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);
    // Seule route dynamique du site : le relais d'accords vers le diffuseur.
    if (pathname === "/progression") return repondreProgression(req, req.method);
    const path = resolveSafePath(pathname);
    if (!path) return new Response("Forbidden", { status: 403 });

    let target = file(path);
    if (!(await target.exists())) {
      const fallback = file(join(path, "index.html"));
      if (!(await fallback.exists())) return new Response("Not Found", { status: 404 });
      target = fallback;
    }
    return serve(target, req);
  },
  error(err: Error): Response {
    console.error(`[lofi] ${err.message}`);
    return new Response("Internal Server Error", { status: 500 });
  },
});

console.log(`[lofi] écoute sur ${HOST}:${PORT}, racine ${ROOT}`);
