import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

// Clôture de la réunion hebdomadaire : pose la date de départ de la
// semaine et gèle son périmètre (les sujets portant une action à cet
// instant, avec leur état). Rien n'est effacé : les actions qu'on vient
// de décider en séance sont justement l'engagement de la semaine qui
// commence.
export async function POST() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  if (me.role !== "dirigeant") {
    return NextResponse.json(
      { error: "Seuls les dirigeants peuvent clôturer la réunion." },
      { status: 403 },
    );
  }

  // Reclôturer le même jour corrige la précédente plutôt que d'empiler
  // une deuxième réunion : on se trompe, on recommence.
  const rows = await query<{ id: string; tenue_le: string }>(
    `INSERT INTO reunions (tenue_le, cloturee_par) VALUES (current_date, $1)
     ON CONFLICT (tenue_le) DO UPDATE SET cloturee_par = EXCLUDED.cloturee_par
     RETURNING id, tenue_le::text AS tenue_le`,
    [me.id],
  );
  const reunion = rows[0];

  await query("DELETE FROM reunion_engagements WHERE reunion_id = $1", [
    reunion.id,
  ]);
  const engagements = await query<{ sujet_id: string }>(
    `INSERT INTO reunion_engagements (reunion_id, sujet_id, project_id, action, etat)
     SELECT $1, s.id, s.project_id, s.action, s.etat
       FROM sujets s WHERE s.action <> ''
     RETURNING sujet_id`,
    [reunion.id],
  );

  return NextResponse.json({
    ok: true,
    id: reunion.id,
    tenueLe: reunion.tenue_le,
    engagements: engagements.length,
  });
}
