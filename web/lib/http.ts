// L'app tourne derrière Caddy : la requête reçue par Next.js vient du
// réseau interne (`jiska-app:80`), pas du domaine public. Pour construire
// une URL absolue à destination du client (invitations Clerk, redirects
// vers un domaine tiers), on lit les en-têtes X-Forwarded-* posés par
// Caddy plutôt que l'hôte interne.
export function origineRequete(request: Request): string {
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const hote =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    "";
  return `${proto}://${hote}`;
}
