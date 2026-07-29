import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import type { SujetRow } from "@/lib/sujets";
import Navbar from "./navbar";
import Dashboard from "./dashboard";

// Le dashboard de pilotage hebdomadaire (PRD) : une seule page.
// Dirigeants : tous les projets. Collaborateurs : leurs projets.
export default async function AppPage() {
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
      echeances: string;
      membres: string;
      clotures: string;
    }>(
      `WITH s AS (SELECT * FROM sujets WHERE project_id IN (${vis}))
       SELECT
         (SELECT count(*) FROM (${vis}) v)                            AS projets,
         (SELECT count(*) FROM s WHERE etat <> 'termine')             AS ouverts,
         COALESCE((SELECT round(avg(pavg)) FROM (
            SELECT avg(jalon_tech * 0.6 + jalon_business * 0.4) AS pavg
              FROM s GROUP BY project_id) t), 0)                      AS avancement,
         (SELECT count(*) FROM s WHERE etat = 'bloque')               AS bloques,
         (SELECT count(*) FROM s WHERE etat <> 'termine'
            AND due_date >= date_trunc('week', current_date)::date
            AND due_date <  date_trunc('week', current_date)::date + 7) AS echeances,
         (SELECT count(DISTINCT user_id) FROM project_members
           WHERE project_id IN (${vis}))                              AS membres,
         (SELECT count(DISTINCT h.sujet_id) FROM sujet_history h
            JOIN sujets su ON su.id = h.sujet_id
           WHERE su.project_id IN (${vis}) AND h.field = 'etat'
             AND h.new_value = 'termine'
             AND h.changed_at > now() - interval '7 days')            AS clotures`,
      visParams,
    ),
    query<SujetRow & { is_proj_resp: boolean }>(
      `SELECT s.id, s.project_id, p.name AS project_name,
              p.logo AS project_logo, s.title,
              s.responsable_id, u.email AS responsable_email, s.action,
              s.due_date::text AS due_date, s.jalon_tech, s.jalon_business,
              s.criticite, s.etat, s.commentaire,
              EXISTS (SELECT 1 FROM project_members m
                       WHERE m.project_id = s.project_id
                         AND m.user_id = $${visParams.length + 1}
                         AND m.is_responsable) AS is_proj_resp
         FROM sujets s
         JOIN projects p ON p.id = s.project_id
         LEFT JOIN users u ON u.id = s.responsable_id
        WHERE s.project_id IN (${vis})
        ORDER BY s.due_date NULLS LAST, s.id`,
      [...visParams, user.id],
    ),
    query<{
      id: string;
      name: string;
      logo: string | null;
      is_resp: boolean;
    }>(
      `SELECT p.id, p.name, p.logo,
              EXISTS (SELECT 1 FROM project_members m
                       WHERE m.project_id = p.id
                         AND m.user_id = $${visParams.length + 1}
                         AND m.is_responsable) AS is_resp
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
      `SELECT m.project_id, u.id, u.email, u.first_name, u.last_name, u.avatar
         FROM project_members m
         JOIN users u ON u.id = m.user_id
        WHERE m.project_id IN (${vis})
        ORDER BY u.email`,
      visParams,
    ),
  ]);

  const ind = indicRows[0];
  const membres = Number(ind.membres);
  const ouverts = Number(ind.ouverts);

  const projects = projectRows.map((p) => ({
    id: p.id,
    name: p.name,
    logo: p.logo,
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
    jalon_tech: Number(s.jalon_tech),
    jalon_business: Number(s.jalon_business),
    can_manage: dirigeant || s.is_proj_resp,
    can_edit: dirigeant || s.is_proj_resp || s.responsable_id === user.id,
  }));

  const canCreateSujet = projects.some((p) => p.canManage);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white">
      <Navbar user={user} canCreateSujet={canCreateSujet} onglet="sujets" />
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
          charge: membres > 0 ? Math.round((ouverts / membres) * 10) / 10 : 0,
          clotures: Number(ind.clotures),
        }}
      />
    </div>
  );
}
