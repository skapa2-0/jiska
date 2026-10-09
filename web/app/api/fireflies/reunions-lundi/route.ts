import { NextResponse } from "next/server";
import { estAdmin, getSessionUser } from "@/lib/auth";
import { listerLundis } from "@/lib/fireflies";

// Liste les réunions Fireflies qui ont eu lieu un lundi autour de 11h :
// ce sont les candidates à l'import de la réunion hebdo (portée
// portefeuille). Réservé aux admins, comme l'import global.
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  if (!estAdmin(me)) {
    return NextResponse.json({ error: "Réservé aux dirigeants." }, { status: 403 });
  }
  try {
    const reunions = await listerLundis(10);
    return NextResponse.json({ reunions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Échec Fireflies." },
      { status: 502 },
    );
  }
}
