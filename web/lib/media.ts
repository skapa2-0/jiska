import { createHash } from "node:crypto";

// Photos de profil et logos de produit : stockés en data URL base64 dans
// la base, mais jamais inlinés dans le HTML. Une page en affichait
// jusqu'à onze copies de la même image, soit 300 Ko de base64 par page,
// retéléchargés à chaque navigation puisque le HTML d'une page connectée
// n'est pas cachable. Les requêtes ne renvoient donc plus qu'une URL, que
// le navigateur télécharge une fois puis garde.

const TYPES = /^image\/(jpeg|png|webp)$/;

// L'empreinte courte portée par `?v=` change dès que l'image change :
// c'est ce qui autorise un cache « immutable » sans jamais servir une
// photo périmée. Même calcul côté SQL (md5) et côté route (ci-dessous).
function sqlUrl(base: string, id: string, colonne: string): string {
  return `CASE WHEN ${colonne} IS NULL THEN NULL
               ELSE '${base}' || ${id} || '?v=' || left(md5(${colonne}), 8)
          END`;
}

// `alias` : préfixe de table de la requête appelante (« u », « p »…),
// vide quand la requête ne qualifie pas ses colonnes.
function prefixe(alias: string): string {
  return alias ? `${alias}.` : "";
}

export function sqlAvatarUrl(alias = ""): string {
  const p = prefixe(alias);
  return sqlUrl("/api/avatars/", `${p}id`, `${p}avatar`);
}

export function sqlLogoUrl(alias = ""): string {
  const p = prefixe(alias);
  return sqlUrl("/api/logos/", `${p}id`, `${p}logo`);
}

// Sert une data URL de la base en vraie réponse image, cachable.
export function servirImage(request: Request, dataUrl: string | null): Response {
  if (!dataUrl) return new Response(null, { status: 404 });

  const pointVirgule = dataUrl.indexOf(";");
  const virgule = dataUrl.indexOf(",");
  const type = dataUrl.slice("data:".length, pointVirgule);
  if (pointVirgule < 0 || virgule < 0 || !TYPES.test(type)) {
    return new Response(null, { status: 415 });
  }

  const etag = `"${createHash("md5").update(dataUrl).digest("hex").slice(0, 8)}"`;
  // Une URL sans `v`, ou avec un `v` dépassé (page rendue avant le
  // changement de photo), reste correcte mais doit être revalidée :
  // l'ETag rend cette revalidation quasi gratuite (304 sans corps).
  const version = new URL(request.url).searchParams.get("v");
  const cache =
    version && `"${version}"` === etag
      ? "private, max-age=31536000, immutable"
      : "private, no-cache";

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: { etag, "cache-control": cache },
    });
  }

  const octets = Uint8Array.from(Buffer.from(dataUrl.slice(virgule + 1), "base64"));
  return new Response(octets, {
    headers: {
      "content-type": type,
      "content-length": String(octets.length),
      "cache-control": cache,
      etag,
    },
  });
}
