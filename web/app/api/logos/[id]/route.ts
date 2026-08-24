import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { servirImage } from "@/lib/media";

// Logo de produit servi en binaire et cachable par le navigateur,
// plutôt qu'inliné dans le HTML de chaque page (voir lib/media.ts).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return new Response(null, { status: 401 });

  const { id } = await params;
  if (!/^\d+$/.test(id)) return new Response(null, { status: 400 });

  const rows = await query<{ logo: string | null }>(
    "SELECT logo FROM projects WHERE id = $1",
    [id],
  );
  return servirImage(request, rows[0]?.logo ?? null);
}
