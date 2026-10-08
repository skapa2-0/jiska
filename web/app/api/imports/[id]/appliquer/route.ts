import { NextResponse } from "next/server";
import { canManageSujets, estAdmin, getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import type { Proposition, PropositionDeploiement } from "@/lib/extraction";
import { genererResume } from "@/lib/resume-projet";
import type { Criticite, Etat, TypeSujet } from "@/lib/sujets";
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

type DeploiementRetenu = Pick<
  PropositionDeploiement,
  "ref" | "projectId" | "deployable"
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

  // Le lexique pointe vers un sujet ou un produit. Une correction vers
  // « transverse » ne désigne ni l'un ni l'autre : il n'y a rien à
  // apprendre, et cible_id n'accepte pas NULL.
  const cible = retenue.sujetId
    ? (["sujet", retenue.sujetId] as const)
    : retenue.projectId !== null
      ? (["projet", retenue.projectId] as const)
      : null;

  if (cibleChangee && origine.titre.trim() && cible) {
    const [type, id] = cible;
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
    deploiements: PropositionDeploiement[];
    statut: string;
    transcript: string;
    date_reunion: string;
  }>(
    `SELECT project_id, propositions, deploiements, statut, transcript,
            date_reunion::text AS date_reunion
       FROM reunion_imports WHERE id = $1`,
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
    if (!estAdmin(me)) {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }
  } else if (!(await canManageSujets(me, imp.project_id))) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  let body: { retenues?: Retenue[]; deploiementsRetenus?: DeploiementRetenu[] };
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
  let deploiements = 0;
  const erreurs: { ref: string; message: string }[] = [];
  // Produits touchés avec succès par au moins une proposition retenue :
  // sert à ne régénérer le résumé IA que de ceux qu'évoque la réunion.
  // Les sujets transverses (projectId null) sont exclus volontairement.
  const produitsTouches = new Set<string>();

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
      if (r.projectId) produitsTouches.add(r.projectId);
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
      if (r.projectId) produitsTouches.add(r.projectId);
    }

    await apprendre(me.id, origine, r);
  }

  // Déployabilité : le client ne peut que confirmer une annonce relevée à
  // l'analyse. La valeur écrite vient de l'import stocké, pas du corps de la
  // requête, qui ne sert qu'à désigner les annonces retenues.
  const annonces = new Map((imp.deploiements ?? []).map((d) => [d.ref, d]));
  const retenusDeploiement = Array.isArray(body.deploiementsRetenus)
    ? body.deploiementsRetenus
    : [];
  const traites = new Set<string>();

  for (const r of retenusDeploiement) {
    const annonce = annonces.get(r.ref);
    if (!annonce) {
      erreurs.push({ ref: r.ref, message: "Annonce inconnue." });
      continue;
    }
    if (traites.has(annonce.projectId)) continue;
    if (imp.project_id !== null && annonce.projectId !== imp.project_id) {
      erreurs.push({ ref: r.ref, message: "Hors de la portée de l'import." });
      continue;
    }
    if (!(await canManageSujets(me, annonce.projectId))) {
      erreurs.push({ ref: r.ref, message: "Droits insuffisants sur ce produit." });
      continue;
    }
    await query("UPDATE projects SET deployable = $1 WHERE id = $2", [
      annonce.deployable,
      annonce.projectId,
    ]);
    traites.add(annonce.projectId);
    deploiements += 1;
  }

  // Résumés IA : un appel modèle par produit touché. En parallèle pour que
  // la latence totale ne soit pas la somme. Un échec par produit est
  // silencieux (resume_ia reste à sa valeur précédente), on ne veut pas
  // qu'une coupure du modèle rejette l'application d'un import.
  await Promise.all(
    [...produitsTouches].map(async (projectId) => {
      const [produit] = await query<{ name: string; description: string }>(
        "SELECT name, description FROM projects WHERE id = $1",
        [projectId],
      );
      if (!produit) return;
      const sujets = await query<{
        title: string;
        type: TypeSujet;
        etat: Etat;
        criticite: Criticite;
        action: string;
      }>(
        `SELECT title, type, etat, criticite, action
           FROM sujets WHERE project_id = $1
          ORDER BY (etat = 'termine'), id`,
        [projectId],
      );
      const resume = await genererResume(
        { nom: produit.name, description: produit.description, sujets },
        imp.date_reunion,
        imp.transcript,
      );
      if (resume) {
        await query(
          `UPDATE projects
              SET resume_ia = $1,
                  resume_ia_date = $2,
                  resume_ia_import_id = $3
            WHERE id = $4`,
          [resume, imp.date_reunion, id, projectId],
        );
      }
    }),
  );

  await query(
    "UPDATE reunion_imports SET statut = 'applique', applied_at = now() WHERE id = $1",
    [id],
  );

  return NextResponse.json({ ok: true, majs, creations, deploiements, erreurs });
}
