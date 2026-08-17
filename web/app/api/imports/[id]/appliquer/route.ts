import { NextResponse } from "next/server";
import { canManageSujets, getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import type { Proposition } from "@/lib/extraction";
import {
  appliquerPatch,
  chargerSujet,
  creerSujet,
  estEchec,
  peutEditer,
} from "@/lib/sujets-write";

type Retenue = Pick<
  Proposition,
  "ref" | "projectId" | "sujetId" | "titre" | "champs"
>;

// Les corrections de l'utilisateur alimentent le lexique : c'est ce qui
// évite de recorriger la même confusion à chaque réunion.
async function apprendre(
  auteur: string,
  origine: Proposition,
  retenue: Retenue,
): Promise<void> {
  const cibleChangee =
    origine.projectId !== retenue.projectId ||
    origine.sujetId !== retenue.sujetId;

  if (cibleChangee && origine.titre.trim()) {
    const [type, id] = retenue.sujetId
      ? (["sujet", retenue.sujetId] as const)
      : (["projet", retenue.projectId] as const);
    await query(
      `INSERT INTO lexique (terme, cible_type, cible_id, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (lower(terme), cible_type)
       DO UPDATE SET cible_id = EXCLUDED.cible_id, created_by = EXCLUDED.created_by`,
      [origine.titre.trim(), type, id, auteur],
    );
  }

  const porteurChange =
    (origine.champs.porteurId ?? null) !== (retenue.champs.porteurId ?? null);
  if (porteurChange && origine.porteurNom && retenue.champs.porteurId) {
    await query(
      `INSERT INTO locuteurs (nom, user_id) VALUES ($1, $2)
       ON CONFLICT (lower(nom)) DO UPDATE SET user_id = EXCLUDED.user_id`,
      [origine.porteurNom.trim(), retenue.champs.porteurId],
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  const imports = await query<{
    project_id: string | null;
    propositions: Proposition[];
    statut: string;
  }>(
    "SELECT project_id, propositions, statut FROM reunion_imports WHERE id = $1",
    [id],
  );
  const imp = imports[0];
  if (!imp) {
    return NextResponse.json({ error: "Import introuvable." }, { status: 404 });
  }
  if (imp.statut === "applique") {
    return NextResponse.json(
      { error: "Cet import a déjà été appliqué." },
      { status: 409 },
    );
  }

  if (imp.project_id === null) {
    if (me.role !== "dirigeant") {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }
  } else if (!(await canManageSujets(me, imp.project_id))) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  let body: { retenues?: Retenue[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const retenues = Array.isArray(body.retenues) ? body.retenues : [];
  const origines = new Map(imp.propositions.map((p) => [p.ref, p]));

  const source = `reunion:${id}`;
  let majs = 0;
  let creations = 0;
  const erreurs: { ref: string; message: string }[] = [];

  for (const r of retenues) {
    const origine = origines.get(r.ref);
    if (!origine) {
      erreurs.push({ ref: r.ref, message: "Proposition inconnue." });
      continue;
    }
    // La portée de l'import est une frontière d'écriture, pas un filtre
    // d'affichage : un import scopé ne peut rien écrire ailleurs.
    if (imp.project_id !== null && r.projectId !== imp.project_id) {
      erreurs.push({ ref: r.ref, message: "Hors de la portée de l'import." });
      continue;
    }

    if (r.sujetId) {
      const sujet = await chargerSujet(r.sujetId);
      if (!sujet || sujet.project_id !== r.projectId) {
        erreurs.push({ ref: r.ref, message: "Sujet introuvable." });
        continue;
      }
      if (!(await peutEditer(me, sujet))) {
        erreurs.push({ ref: r.ref, message: "Droits insuffisants sur ce sujet." });
        continue;
      }
      const res = await appliquerPatch(me, sujet, { ...r.champs }, source);
      if (estEchec(res)) {
        erreurs.push({ ref: r.ref, message: res.error });
        continue;
      }
      majs += 1;
    } else {
      const res = await creerSujet(
        me,
        r.projectId,
        { ...r.champs, title: r.titre },
        source,
      );
      if (estEchec(res)) {
        erreurs.push({ ref: r.ref, message: res.error });
        continue;
      }
      creations += 1;
    }

    await apprendre(me.id, origine, r);
  }

  await query(
    "UPDATE reunion_imports SET statut = 'applique', applied_at = now() WHERE id = $1",
    [id],
  );

  return NextResponse.json({ ok: true, majs, creations, erreurs });
}
