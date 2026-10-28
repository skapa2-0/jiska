import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { creerToken, listerTokens } from "@/lib/api-tokens";

const LABEL_MAX = 80;

// Liste des jetons d'API de la personne connectée. On ne renvoie jamais
// le secret, seulement de quoi reconnaître chaque jeton (préfixe + libellé)
// et savoir s'il est encore actif.
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const tokens = await listerTokens(me.id);
  return NextResponse.json({ tokens });
}

// Création d'un jeton. Le secret est renvoyé en clair UNE SEULE FOIS,
// ici : la page le montre, l'utilisateur le copie, puis on ne peut plus
// le relire (on n'en garde que le hash). S'il perd le secret, il doit
// révoquer et en recréer un.
export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  let body: { label?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const label =
    typeof body.label === "string" ? body.label.trim().slice(0, LABEL_MAX) : "";
  if (!label) {
    return NextResponse.json(
      { error: "Donnez un nom à ce jeton pour le reconnaître plus tard." },
      { status: 400 },
    );
  }

  const { row, secret } = await creerToken(me.id, label);
  return NextResponse.json({ token: row, secret }, { status: 201 });
}
