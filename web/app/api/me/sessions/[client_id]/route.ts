import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { revoquerSession } from "@/lib/oauth";

// Révocation d'une session OAuth : coupe tous les access et refresh
// tokens actifs émis à ce client pour la personne connectée. Le client
// peut redemander un consentement par la suite, Jiska n'empêchera pas
// l'autorisation ; on révoque l'accès actuel, pas l'enregistrement du
// client.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ client_id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { client_id } = await params;
  if (!client_id) {
    return NextResponse.json({ error: "Identifiant manquant." }, { status: 400 });
  }

  await revoquerSession(me.id, client_id);
  return NextResponse.json({ ok: true });
}
