import { redirect } from "next/navigation";
import { estAdmin, getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { sqlAvatarUrl, sqlLogoUrl } from "@/lib/media";
import { lireSemaine, sqlSemainePortefeuille } from "@/lib/semaine";
import type { SemaineRow } from "@/lib/semaine";
import { NOM_TRANSVERSE } from "@/lib/sujets";
import type { SujetRow } from "@/lib/sujets";
import BottomNav from "../bottom-nav";
import Navbar from "../navbar";
import Dashboard from "../dashboard";

// Page Actions : le tableau de pilotage hebdomadaire (PRD), une ligne
// par sujet. Dirigeants : tous les projets. Collaborateurs : les leurs.
export default async function ActionsPage({
  searchParams,
}: {
  // ?sujet=<id> ouvre directement la fiche : c'est le lien des lignes de
  // la section « Sujets transverses » de l'accueil. « nouveau » est traité
  // côté client, il n'ouvre pas une fiche mais la modale de création.
  searchParams: Promise<{ sujet?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { sujet: sujetOuvertId } = await searchParams;

  const dirigeant = estAdmin(user);
  // Filtre de visibilité injecté dans chaque requête ($1 = user id).
  const vis = dirigeant
    ? "SELECT id FROM projects"
    : "SELECT project_id FROM project_members WHERE user_id = $1";
  const visParams = dirigeant ? [] : [user.id];

  const [indicRows, sujetRows, projectRows, memberRows] = await Promise.all([
    query<{
      projets: string;
      ouverts: string;
      bloques: string;
      retard: string;
      echeances: string;
      clotures: string;
    } & SemaineRow>(
      `WITH s AS (SELECT * FROM sujets
                   WHERE project_id IS NULL OR project_id IN (${vis}))
       SELECT
         (SELECT count(*) FROM (${vis}) v)                            AS projets,
         (SELECT count(*) FROM s WHERE etat <> 'termine')             AS ouverts,
         (SELECT count(*) FROM s WHERE etat = 'bloque')               AS bloques,
         (SELECT count(*) FROM s WHERE etat <> 'termine'
            AND due_date < current_date)                              AS retard,
         (SELECT count(*) FROM s WHERE etat <> 'termine'
            AND due_date >= date_trunc('week', current_date)::date
            AND due_date <  date_trunc('week', current_date)::date + 7) AS echeances,
         (SELECT count(DISTINCT h.sujet_id) FROM sujet_history h
            JOIN sujets su ON su.id = h.sujet_id
           WHERE su.project_id IN (${vis}) AND h.field = 'etat'
             AND h.new_value = 'termine'
             AND h.changed_at > now() - interval '7 days')            AS clotures,
         -- Engagements de la semaine, tous produits visibles confondus,
         -- transverses compris (voir lib/semaine.ts).
         ${sqlSemainePortefeuille(vis)}`,
      visParams,
    ),
    query<SujetRow & { is_proj_resp: boolean }>(
      `SELECT s.id, s.project_id,
              COALESCE(p.name, '${NOM_TRANSVERSE}') AS project_name,
              ${sqlLogoUrl("p")} AS project_logo, s.title, s.action,
              s.due_date::text AS due_date, s.type,
              s.porteur_id, s.updated_at::date::text AS updated_at,
              s.criticite, s.etat, s.commentaire,
              EXISTS (SELECT 1 FROM project_members m
                       WHERE m.project_id = s.project_id
                         AND m.user_id = $${visParams.length + 1}
                         AND m.is_responsable) AS is_proj_resp
         FROM sujets s
         LEFT JOIN projects p ON p.id = s.project_id
        WHERE s.project_id IS NULL OR s.project_id IN (${vis})
        ORDER BY s.due_date NULLS LAST, s.id`,
      [...visParams, user.id],
    ),
    query<{
      id: string;
      name: string;
      logo: string | null;
      is_resp: boolean;
      responsable_id: string | null;
    }>(
      `SELECT p.id, p.name, ${sqlLogoUrl("p")} AS logo,
              EXISTS (SELECT 1 FROM project_members m
                       WHERE m.project_id = p.id
                         AND m.user_id = $${visParams.length + 1}
                         AND m.is_responsable) AS is_resp,
              (SELECT m.user_id FROM project_members m
                WHERE m.project_id = p.id AND m.is_responsable LIMIT 1) AS responsable_id
         FROM projects p
        WHERE p.id IN (${vis})
        ORDER BY p.name`,
      [...visParams, user.id],
    ),
    query<{
      project_id: string;
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      avatar: string | null;
    }>(
      `SELECT m.project_id, u.id, u.email, u.first_name, u.last_name,
              ${sqlAvatarUrl("u")} AS avatar
         FROM project_members m
         JOIN users u ON u.id = m.user_id
        WHERE m.project_id IN (${vis})
        ORDER BY u.email`,
      visParams,
    ),
  ]);

  const ind = indicRows[0];
  const ouverts = Number(ind.ouverts);

  const projects = projectRows.map((p) => ({
    id: p.id,
    name: p.name,
    logo: p.logo,
    responsableId: p.responsable_id,
    canManage: dirigeant || p.is_resp,
    members: memberRows
      .filter((m) => m.project_id === p.id)
      .map((m) => ({
        id: m.id,
        email: m.email,
        first_name: m.first_name,
        last_name: m.last_name,
        avatar: m.avatar,
      })),
  }));

  const sujets = sujetRows.map((s) => ({
    ...s,
    can_manage: dirigeant || s.is_proj_resp,
    can_edit: dirigeant || s.is_proj_resp || s.porteur_id === user.id,
  }));

  const canCreateSujet = dirigeant || projects.some((p) => p.canManage);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white">
      <Navbar user={user} canCreateSujet={canCreateSujet} onglet="actions" />
      <Dashboard
        meId={user.id}
        dirigeant={dirigeant}
        sujetOuvertId={sujetOuvertId}
        sujets={sujets}
        projects={projects}
        indicateurs={{
          projets: Number(ind.projets),
          ouverts,
          bloques: Number(ind.bloques),
          echeances: Number(ind.echeances),
          retard: Number(ind.retard),
          clotures: Number(ind.clotures),
          semaine: lireSemaine(ind),
        }}
      />
      <BottomNav onglet="actions" canCreate={canCreateSujet} />
    </div>
  );
}
