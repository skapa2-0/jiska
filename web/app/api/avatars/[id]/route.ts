import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { servirImage } from "@/lib/media";

// Photo de profil servie en binaire et cachable par le navigateur,
// plutôt qu'inlinée dans le HTML de chaque page (voir lib/media.ts).
// Réservée aux personnes connectées : les trombinoscopes ne sont pas
// publics.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return new Response(null, { status: 401 });

  const { id } = await params;
  if (!/^\d+$/.test(id)) return new Response(null, { status: 400 });

  const rows = await query<{ avatar: string | null }>(
    "SELECT avatar FROM users WHERE id = $1",
    [id],
  );
  return servirImage(request, rows[0]?.avatar ?? null);
}
