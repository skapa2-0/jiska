import { NextResponse } from "next/server";

// Stub d'authentification : à brancher sur PostgreSQL (table users,
// hachage argon2/bcrypt, session par cookie httpOnly).
export async function POST(request: Request) {
  let body: { email?: string; password?: string; remember?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  if (!body.email || !body.password) {
    return NextResponse.json(
      { error: "E-mail et mot de passe requis." },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { error: "L'authentification n'est pas encore branchée (PostgreSQL à venir)." },
    { status: 501 },
  );
}
