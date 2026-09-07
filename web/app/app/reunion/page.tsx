import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { sqlAvatarUrl, sqlLogoUrl } from "@/lib/media";
import { lireSemaine, sqlSemaine, sqlSemaineTransverse } from "@/lib/semaine";
import type { SemaineRow } from "@/lib/semaine";
import { NOM_TRANSVERSE, NOM_TRANSVERSES } from "@/lib/sujets";
import type { SujetRow } from "@/lib/sujets";
import type { ProjectOption } from "../dashboard";
import Revue from "./revue";
import type { EtapeRevue } from "./revue";

// Mode réunion : les produits défilent un par un, dans l'ordre du
// risque, avec leurs actions de la semaine éditables en fiche.
export default async function ReunionPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const dirigeant = user.role === "dirigeant";
  const vis = dirigeant
    ? "SELECT id FROM projects"
    : "SELECT project_id FROM project_members WHERE user_id = $1";
  const visParams = dirigeant ? [] : [user.id];

  const [projetRows, membres, sujetRows, semaineTransverseRows] =
    await Promise.all([
    query<{
      id: string;
      name: string;
      logo: string | null;
      tech: string;
      business: string;
      attrib_tech: string;
      attrib_business: string;
      responsable_id: string | null;
      is_resp: boolean;
    } & SemaineRow>(
      `SELECT p.id, p.name, ${sqlLogoUrl("p")} AS logo,
              ${sqlSemaine("p")},
              least(100, COALESCE((SELECT round(sum(s.poids * CASE s.etat WHEN 'termine' THEN 1 WHEN 'en_validation' THEN 0.5 ELSE 0 END)) FROM sujets s
                WHERE s.project_id = p.id AND s.type = 'technique'), 0)) AS tech,
              least(100, COALESCE((SELECT round(sum(s.poids * CASE s.etat WHEN 'termine' THEN 1 WHEN 'en_validation' THEN 0.5 ELSE 0 END)) FROM sujets s
                WHERE s.project_id = p.id AND s.type = 'business'), 0))  AS business,
              COALESCE((SELECT sum(s.poids) FROM sujets s
                WHERE s.project_id = p.id AND s.type = 'technique'), 0) AS attrib_tech,
              COALESCE((SELECT sum(s.poids) FROM sujets s
                WHERE s.project_id = p.id AND s.type = 'business'), 0)  AS attrib_business,
              (SELECT m.user_id FROM project_members m
                WHERE m.project_id = p.id AND m.is_responsable LIMIT 1) AS responsable_id,
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
      `SELECT m.project_id, u.id, u.email, u.first_name, u.last_name,
              ${sqlAvatarUrl("u")} AS avatar
         FROM project_members m
         JOIN users u ON u.id = m.user_id
        WHERE m.project_id IN (${vis})
        ORDER BY u.email`,
      visParams,
    ),
    query<{
      id: string;
      project_id: string | null;
      title: string;
      action: string;
      due_date: string | null;
      type: "technique" | "business";
      poids: string;
      porteur_id: string | null;
      updated_at: string;
      criticite: SujetRow["criticite"];
      etat: SujetRow["etat"];
      commentaire: string;
    }>(
      `SELECT s.id, s.project_id, s.title, s.action,
              s.due_date::text AS due_date, s.type, s.poids,
              s.porteur_id, s.updated_at::date::text AS updated_at,
              s.criticite, s.etat, s.commentaire
         FROM sujets s
        WHERE s.project_id IS NULL OR s.project_id IN (${vis})
        ORDER BY (s.etat = 'termine'),
                 s.due_date NULLS LAST, s.id`,
      visParams,
    ),
    // Les sujets transverses ne relèvent d'aucun produit : leur semaine
    // se mesure sur le même périmètre gelé, portée transverse.
    query<SemaineRow>(`SELECT ${sqlSemaineTransverse()}`),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  const etapes: EtapeRevue[] = projetRows.map((p) => {
    const equipe = membres
      .filter((m) => m.project_id === p.id)
      .map((m) => ({
        id: m.id,
        email: m.email,
        first_name: m.first_name,
        last_name: m.last_name,
        avatar: m.avatar,
      }));
    const canManage = dirigeant || p.is_resp;
    const projet: ProjectOption = {
      id: p.id,
      name: p.name,
      logo: p.logo,
      responsableId: p.responsable_id,
      avancement: Math.round(Number(p.tech) * 0.6 + Number(p.business) * 0.4),
      poidsTech: Number(p.attrib_tech),
      poidsBusiness: Number(p.attrib_business),
      canManage,
      members: equipe,
    };
    const tous = sujetRows
      .filter((s) => s.project_id === p.id)
      .map<SujetRow>((s) => ({
        id: s.id,
        project_id: s.project_id,
        project_name: p.name,
        project_logo: p.logo,
        title: s.title,
        action: s.action,
        due_date: s.due_date,
        type: s.type,
        poids: Number(s.poids),
        porteur_id: s.porteur_id,
        updated_at: s.updated_at,
        criticite: s.criticite,
        etat: s.etat,
        commentaire: s.commentaire,
        can_edit: canManage || s.porteur_id === user.id,
        can_manage: canManage,
      }));
    const sujets = tous.filter((s) => s.etat !== "termine");
    // Ordre réunion : retards en tête, puis échéance croissante.
    sujets.sort((a, b) => {
      const ra = !!a.due_date && a.due_date < today;
      const rb = !!b.due_date && b.due_date < today;
      if (ra !== rb) return ra ? -1 : 1;
      if (a.due_date !== b.due_date) {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }
      return 0;
    });
    return {
      projet,
      tech: Number(p.tech),
      business: Number(p.business),
      semaine: lireSemaine(p),
      sujets,
      termines: tous.length - sujets.length,
      bloques: sujets.filter((s) => s.etat === "bloque").length,
      retards: sujets.filter((s) => !!s.due_date && s.due_date < today)
        .length,
    };
  });

  // L'ordre de revue suit le risque : bloqués, retards, puis nom.
  etapes.sort(
    (a, b) =>
      b.bloques - a.bloques ||
      b.retards - a.retards ||
      a.projet.name.localeCompare(b.projet.name, "fr"),
  );

  // Les sujets transverses ferment la revue : on passe les produits, puis
  // ce qui traverse l'entreprise. Étape ajoutée après le tri, sa place ne
  // dépend pas du risque.
  const transverseTous = sujetRows
    .filter((s) => s.project_id === null)
    .map<SujetRow>((s) => ({
      id: s.id,
      project_id: null,
      project_name: NOM_TRANSVERSE,
      project_logo: null,
      title: s.title,
      action: s.action,
      due_date: s.due_date,
      type: s.type,
      poids: Number(s.poids),
      porteur_id: s.porteur_id,
      updated_at: s.updated_at,
      criticite: s.criticite,
      etat: s.etat,
      commentaire: s.commentaire,
      can_edit: dirigeant || s.porteur_id === user.id,
      can_manage: dirigeant,
    }));

  if (transverseTous.length > 0) {
    const actifs = transverseTous.filter((s) => s.etat !== "termine");
    actifs.sort((a, b) => {
      const ra = !!a.due_date && a.due_date < today;
      const rb = !!b.due_date && b.due_date < today;
      if (ra !== rb) return ra ? -1 : 1;
      if (a.due_date !== b.due_date) {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }
      return 0;
    });
    // Pas de produit, donc pas d'équipe : le vivier de porteurs est
    // l'ensemble des membres visibles.
    const tousMembres = [
      ...new Map(
        membres.map((m) => [
          m.id,
          {
            id: m.id,
            email: m.email,
            first_name: m.first_name,
            last_name: m.last_name,
            avatar: m.avatar,
          },
        ]),
      ).values(),
    ];
    etapes.push({
      transverse: true,
      projet: {
        // Identifiant vide : aucun produit ne peut le porter.
        id: "",
        name: NOM_TRANSVERSES,
        logo: null,
        responsableId: null,
        avancement: 0,
        poidsTech: 0,
        poidsBusiness: 0,
        canManage: dirigeant,
        members: tousMembres,
      },
      tech: 0,
      business: 0,
      semaine: lireSemaine(semaineTransverseRows[0]),
      sujets: actifs,
      termines: transverseTous.length - actifs.length,
      bloques: actifs.filter((s) => s.etat === "bloque").length,
      retards: actifs.filter((s) => !!s.due_date && s.due_date < today).length,
    });
  }

  if (etapes.length === 0) redirect("/app");

  return <Revue etapes={etapes} today={today} peutCloturer={dirigeant} />;
}
