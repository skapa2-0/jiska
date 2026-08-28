import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { sqlAvatarUrl, sqlLogoUrl } from "@/lib/media";
import type { SujetRow } from "@/lib/sujets";
import BottomNav from "../bottom-nav";
import Navbar from "../navbar";
import Dashboard from "../dashboard";

// Page Actions : le tableau de pilotage hebdomadaire (PRD), une ligne
// par sujet. Dirigeants : tous les projets. Collaborateurs : les leurs.
export default async function ActionsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const dirigeant = user.role === "dirigeant";
  // Filtre de visibilité injecté dans chaque requête ($1 = user id).
  const vis = dirigeant
    ? "SELECT id FROM projects"
    : "SELECT project_id FROM project_members WHERE user_id = $1";
  const visParams = dirigeant ? [] : [user.id];

  const [indicRows, sujetRows, projectRows, memberRows] = await Promise.all([
    query<{
      projets: string;
      ouverts: string;
      avancement: string;
      bloques: string;
      retard: string;
      echeances: string;
      clotures: string;
      sem_engages: string;
      sem_avancement: string | null;
    }>(
      `WITH s AS (SELECT * FROM sujets WHERE project_id IN (${vis}))
       SELECT
         (SELECT count(*) FROM (${vis}) v)                            AS projets,
         (SELECT count(*) FROM s WHERE etat <> 'termine')             AS ouverts,
         COALESCE((SELECT round(avg(round(least(100, COALESCE((SELECT sum(s2.poids * CASE s2.etat WHEN 'termine' THEN 1 WHEN 'en_validation' THEN 0.5 ELSE 0 END) FROM sujets s2
                WHERE s2.project_id = p.id AND s2.type = 'technique'), 0)) * 0.6 + least(100, COALESCE((SELECT sum(s2.poids * CASE s2.etat WHEN 'termine' THEN 1 WHEN 'en_validation' THEN 0.5 ELSE 0 END) FROM sujets s2
                WHERE s2.project_id = p.id AND s2.type = 'business'), 0)) * 0.4)))
              FROM projects p WHERE p.id IN (${vis})
               AND EXISTS (SELECT 1 FROM sujets sx WHERE sx.project_id = p.id)), 0) AS avancement,
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
         (SELECT count(*) FROM s WHERE action <> '')                  AS sem_engages,
         -- Avancement des actions engagées, tous produits visibles
         -- confondus (voir lib/semaine.ts pour l'échelle).
         (SELECT round(avg(CASE etat
                             WHEN 'termine' THEN 100
                             WHEN 'en_validation' THEN 66
                             WHEN 'en_cours' THEN 33
                             ELSE 0 END))
            FROM s WHERE action <> '')                                AS sem_avancement`,
      visParams,
    ),
    query<SujetRow & { is_proj_resp: boolean }>(
      `SELECT s.id, s.project_id, p.name AS project_name,
              ${sqlLogoUrl("p")} AS project_logo, s.title, s.action,
              s.due_date::text AS due_date, s.type, s.poids,
              s.porteur_id, s.updated_at::date::text AS updated_at,
              s.criticite, s.etat, s.commentaire,
              EXISTS (SELECT 1 FROM project_members m
                       WHERE m.project_id = s.project_id
                         AND m.user_id = $${visParams.length + 1}
                         AND m.is_responsable) AS is_proj_resp
         FROM sujets s
         JOIN projects p ON p.id = s.project_id
        WHERE s.project_id IN (${vis})
        ORDER BY s.due_date NULLS LAST, s.id`,
      [...visParams, user.id],
    ),
    query<{
      id: string;
      name: string;
      logo: string | null;
      avancement: string | null;
      poids_tech: string;
      poids_business: string;
      is_resp: boolean;
      responsable_id: string | null;
    }>(
      `SELECT p.id, p.name, ${sqlLogoUrl("p")} AS logo,
              round(least(100, COALESCE((SELECT sum(s2.poids * CASE s2.etat WHEN 'termine' THEN 1 WHEN 'en_validation' THEN 0.5 ELSE 0 END) FROM sujets s2
                WHERE s2.project_id = p.id AND s2.type = 'technique'), 0)) * 0.6 + least(100, COALESCE((SELECT sum(s2.poids * CASE s2.etat WHEN 'termine' THEN 1 WHEN 'en_validation' THEN 0.5 ELSE 0 END) FROM sujets s2
                WHERE s2.project_id = p.id AND s2.type = 'business'), 0)) * 0.4) AS avancement,
              COALESCE((SELECT sum(s2.poids) FROM sujets s2
                WHERE s2.project_id = p.id AND s2.type = 'technique'), 0) AS poids_tech,
              COALESCE((SELECT sum(s2.poids) FROM sujets s2
                WHERE s2.project_id = p.id AND s2.type = 'business'), 0)  AS poids_business,
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
    avancement: Number(p.avancement ?? 0),
    poidsTech: Number(p.poids_tech),
    poidsBusiness: Number(p.poids_business),
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
    poids: Number(s.poids),
    can_manage: dirigeant || s.is_proj_resp,
    can_edit: dirigeant || s.is_proj_resp || s.porteur_id === user.id,
  }));

  const canCreateSujet = projects.some((p) => p.canManage);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white">
      <Navbar user={user} canCreateSujet={canCreateSujet} onglet="actions" />
      <Dashboard
        meId={user.id}
        sujets={sujets}
        projects={projects}
        indicateurs={{
          projets: Number(ind.projets),
          ouverts,
          avancement: Number(ind.avancement),
          bloques: Number(ind.bloques),
          echeances: Number(ind.echeances),
          retard: Number(ind.retard),
          clotures: Number(ind.clotures),
          semEngages: Number(ind.sem_engages),
          semAvancement: Number(ind.sem_avancement ?? 0),
        }}
      />
      <BottomNav onglet="actions" canCreate={canCreateSujet} />
    </div>
  );
}
