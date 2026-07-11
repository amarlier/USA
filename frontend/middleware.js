import { next } from "@vercel/functions";

export const config = {
  matcher: "/((?!_next).*)",
};

function unauthorized() {
  return new Response("Authentification requise", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="USA Ouest 2026", charset="UTF-8"' },
  });
}

export default function middleware(request) {
  const user = process.env.SITE_AUTH_USER;
  const pass = process.env.SITE_AUTH_PASSWORD;

  // If credentials aren't configured, fail closed (deny) rather than silently open.
  if (!user || !pass) {
    return new Response("Configuration d'authentification manquante", { status: 500 });
  }

  const auth = request.headers.get("authorization");
  if (!auth || !auth.startsWith("Basic ")) {
    return unauthorized();
  }

  let decoded = "";
  try {
    decoded = atob(auth.slice(6));
  } catch {
    return unauthorized();
  }

  const sep = decoded.indexOf(":");
  const u = sep === -1 ? decoded : decoded.slice(0, sep);
  const p = sep === -1 ? "" : decoded.slice(sep + 1);

  if (u !== user || p !== pass) {
    return unauthorized();
  }

  return next();
}
