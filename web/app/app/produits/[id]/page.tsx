import { redirect } from "next/navigation";
import { getSessionUser, isResponsable } from "@/lib/auth";
import { chargerImportsEnAttente } from "@/lib/imports";
import { query } from "@/lib/db";
import {
  avancementGlobal,
  CRITICITES,
  ETATS,
  JALONS_BUSINESS,
  JALONS_TECH,
  creditSujet,
} from "@/lib/sujets";
import type { Criticite, Etat, SujetRow } from "@/lib/sujets";
import Avatar, { displayName } from "../../avatar";
import BottomNav from "../../bottom-nav";
import Navbar from "../../navbar";
import ProjetLogo from "../../projet-logo";
import Roue, { tonAvancement } from "../../roue";
import HistoriqueProjet from "./historique-projet";
import type { EntreeHistorique } from "./historique-projet";
import SujetsProjet from "./sujets-projet";

const CHAMPS: Record<string, string> = {
  title: "le sujet",
  action: "l'action de la semaine",
  commentaire: "le commentaire",
  due_date: "l'échéance",
  jalon_tech: "le jalon technique",
  jalon_business: "le jalon business",
  type: "le type",
  poids: "le poids",
  criticite: "la criticité",
  etat: "l'état",
  responsable_id: "le responsable",
  porteur_id: "le porteur",
};

function valeurLisible(field: string, v: string | null): string {
  if (!v) return "-";
  if (field === "etat") return ETATS[v as Etat]?.label ?? v;
  if (field === "criticite") return CRITICITES[v as Criticite]?.label ?? v;
  if (field === "jalon_tech")
    return `${JALONS_TECH[Number(v) as 0] ?? v} (${v} %)`;
  if (field === "jalon_business")
    return `${JALONS_BUSINESS[Number(v) as 0] ?? v} (${v} %)`;
  if (field === "type") return v === "technique" ? "Technique" : "Business";
  if (field === "poids") return `${v} %`;
  if (field === "due_date") return v.split("-").reverse().join("/");
  return v.length > 60 ? `${v.slice(0, 60)}…` : v;
}

// Détail d'un projet : avancement, sujets, équipe, historique.
export default async function ProjetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  if (!/^\d+$/.test(id)) redirect("/app");

  const dirigeant = user.role === "dirigeant";
  if (!dirigeant) {
    const membre = await query(
      "SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2",
      [id, user.id],
    );
    if (membre.length === 0) redirect("/app");
  }

  const [projets, equipe, sujetRows, histRows, personnes, creations] =
    await Promise.all([
    query<{
      id: string;
      name: string;
      description: string;
      logo: string | null;
      created_at: string;
    }>(
      "SELECT id, name, description, logo, created_at::date::text AS created_at FROM projects WHERE id = $1",
      [id],
    ),
    query<{
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      avatar: string | null;
      is_responsable: boolean;
    }>(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.avatar, m.is_responsable
         FROM project_members m JOIN users u ON u.id = m.user_id
        WHERE m.project_id = $1
        ORDER BY m.is_responsable DESC, u.email`,
      [id],
    ),
    query<{
      id: string;
      title: string;
      action: string;
      commentaire: string;
      etat: Etat;
      criticite: Criticite;
      type: "technique" | "business";
      poids: number;
      porteur_id: string | null;
      updated_at: string;
      due_date: string | null;
    }>(
      `SELECT id, title, action, commentaire, etat, criticite, type, poids,
              porteur_id, updated_at::date::text AS updated_at,
              due_date::text AS due_date
         FROM sujets WHERE project_id = $1
        ORDER BY (etat = 'termine'), due_date NULLS LAST, id`,
      [id],
    ),
    query<{
      sujet_id: string;
      field: string;
      old_value: string | null;
      new_value: string | null;
      quand: string;
      titre: string;
      auteur_id: string | null;
    }>(
      `SELECT h.sujet_id, h.field, h.old_value, h.new_value,
              to_char(h.changed_at, 'DD/MM à HH24:MI') AS quand,
              s.title AS titre, h.changed_by AS auteur_id
         FROM sujet_history h
         JOIN sujets s ON s.id = h.sujet_id
        WHERE s.project_id = $1
        ORDER BY h.changed_at DESC, h.id DESC
        LIMIT 200`,
      [id],
    ),
    query<{
      id: string;
      email: string;
      first_name: string;
      last_name: string;
    }>("SELECT id, email, first_name, last_name FROM users"),
    // Qui a émis chaque sujet : la trace de création de l'historique.
    query<{ sujet_id: string; changed_by: string | null }>(
      `SELECT h.sujet_id, h.changed_by
         FROM sujet_history h
         JOIN sujets s ON s.id = h.sujet_id
        WHERE s.project_id = $1 AND h.field = 'creation'`,
      [id],
    ),
  ]);

  const projet = projets[0];
  if (!projet) redirect("/app");

  const nomDe = new Map(personnes.map((p) => [p.id, displayName(p)]));
  const canManage = dirigeant || equipe.some((m) => m.id === user.id && m.is_responsable);

  const acquis = (t: "technique" | "business") =>
    Math.min(
      100,
      Math.round(
        sujetRows
          .filter((s) => s.type === t)
          .reduce((acc, s) => acc + creditSujet(s.etat, Number(s.poids)), 0),
      ),
    );
  const attribue = (t: "technique" | "business") =>
    sujetRows
      .filter((s) => s.type === t)
      .reduce((acc, s) => acc + Number(s.poids), 0);
  const tech = acquis("technique");
  const business = acquis("business");
  const avancement = avancementGlobal(tech, business);

  const projetOption = {
    id: projet.id,
    name: projet.name,
    logo: projet.logo,
    responsableId: equipe.find((m) => m.is_responsable)?.id ?? null,
    avancement,
    poidsTech: attribue("technique"),
    poidsBusiness: attribue("business"),
    canManage,
    members: equipe.map((m) => ({
      id: m.id,
      email: m.email,
      first_name: m.first_name,
      last_name: m.last_name,
      avatar: m.avatar,
    })),
  };

  const sujets: SujetRow[] = sujetRows.map((s) => ({
    id: s.id,
    project_id: projet.id,
    project_name: projet.name,
    project_logo: projet.logo,
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

  const entrees: EntreeHistorique[] = histRows.map((h) => ({
    quand: h.quand,
    auteur: (h.auteur_id && nomDe.get(h.auteur_id)) || "",
    sujetId: h.sujet_id,
    titre: h.titre,
    champ: CHAMPS[h.field] ?? h.field,
    ancien:
      ["responsable_id", "porteur_id"].includes(h.field)
        ? (nomDe.get(h.old_value ?? "") ?? "-")
        : valeurLisible(h.field, h.old_value),
    nouveau:
      ["responsable_id", "porteur_id"].includes(h.field)
        ? (nomDe.get(h.new_value ?? "") ?? "-")
        : valeurLisible(h.field, h.new_value),
    creation: h.field === "creation",
  }));

  // Nom de l'émetteur par sujet (vide si la trace n'existe pas).
  const emetteurs: Record<string, string> = {};
  for (const c of creations) {
    const nom = c.changed_by ? nomDe.get(c.changed_by) : undefined;
    if (nom) emetteurs[c.sujet_id] = nom;
  }

  const actifs = sujets.filter((s) => s.etat !== "termine");
  const termines = sujets.length - actifs.length;
  const bloques = actifs.filter((s) => s.etat === "bloque").length;
  const canCreateSujet = dirigeant || (await isResponsable(user.id));
  const importsEnAttente = canManage ? await chargerImportsEnAttente(id) : [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} canCreateSujet={canCreateSujet} onglet="produits" />
      <main className="w-full flex-1 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <a
          href="/app"
          className="text-sm font-medium text-mute transition hover:text-ink"
        >
          ← Tous les produits
        </a>

        {/* En-tête du projet */}
        <div className="mt-4 flex flex-wrap items-start gap-5">
          <ProjetLogo
            name={projet.name}
            logo={projet.logo}
            taille="h-14 w-14 text-3xl"
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-medium tracking-[-0.02em] text-ink">
              {projet.name}
            </h1>
            <p className="mt-1 text-sm text-mute">
              {projet.description || "Aucune description."}
            </p>
            <p className="mt-1 text-xs text-stone">
              Créé le {projet.created_at.split("-").reverse().join("/")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage && (
              <a
                href={`/app/produits/${projet.id}/import`}
                className="flex items-center gap-1.5 rounded-lg border border-hairline px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface"
              >
                Importer une réunion
                {importsEnAttente.length > 0 && (
                  <span className="rounded-md bg-warn-soft px-1.5 py-0.5 text-xs font-semibold text-warn">
                    {importsEnAttente.length}
                  </span>
                )}
              </a>
            )}
            {dirigeant && (
              <a
                href={`/app/produits/${projet.id}/modifier`}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:opacity-85"
              >
                Modifier
              </a>
            )}
            <a
              href={`/app/actions?projet=${projet.id}`}
              className="rounded-lg border border-hairline px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface"
            >
              Voir les sujets
            </a>
          </div>
        </div>

        {/* Indicateurs du projet */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-card">
            <Roue
              valeur={avancement}
              ton={tonAvancement(avancement)}
              taille="h-12 w-12"
            />
            <span className="text-xs font-medium text-mute">
              Avancement
              <br />
              moyen
            </span>
          </div>
          <Stat valeur={actifs.length} label="Sujets actifs" />
          {/* Couleur seulement quand la valeur porte un signal : un
              zéro reste neutre. */}
          <Stat
            valeur={bloques}
            label="Bloqués"
            ton={bloques > 0 ? "text-danger" : undefined}
          />
          <Stat
            valeur={termines}
            label="Terminés"
            ton={termines > 0 ? "text-success" : undefined}
          />
        </div>

        {/* Avancement par axe : somme des poids des sujets terminés. */}
        <div className="mt-3 rounded-lg bg-white p-4 shadow-card">
          <div className="grid gap-5 sm:grid-cols-2">
            <BarreAxe
              nom="Technique · 60 %"
              valeur={tech}
              attribue={attribue("technique")}
            />
            <BarreAxe
              nom="Business · 40 %"
              valeur={business}
              attribue={attribue("business")}
            />
          </div>
          <p className="mt-3 text-xs text-stone">
            Un sujet terminé rapporte tout son poids, un sujet en validation
            la moitié. Objectif : 100 % attribués par axe.
          </p>
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_440px]">
          <div className="space-y-8">
            <SujetsProjet
              sujets={sujets}
              projet={projetOption}
              emetteurs={emetteurs}
              today={today}
            />

            {/* Équipe */}
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone">
                Équipe
              </h2>
              <ul className="flex flex-wrap gap-3">
                {equipe.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-2.5 rounded-lg bg-white py-2 pl-2.5 pr-4 shadow-card"
                  >
                    <Avatar
                      personne={m}
                      taille="h-8 w-8 text-sm"
                      dore={m.is_responsable}
                    />
                    <span className="text-sm">
                      <span className="block font-medium leading-tight text-ink">
                        {displayName(m)}
                      </span>
                      {m.is_responsable && (
                        <span className="block text-xs leading-tight text-brand">
                          Responsable
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Historique (PRD : conservé, hors tableau principal) */}
          <HistoriqueProjet entrees={entrees} />
        </div>
      </main>
      <BottomNav onglet="produits" canCreate={canCreateSujet} />
    </div>
  );
}

function BarreAxe({
  nom,
  valeur,
  attribue,
}: {
  nom: string;
  valeur: number;
  attribue: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-ink">{nom}</p>
        <p className="text-xs text-mute">
          <span className="font-semibold text-ink">{valeur} %</span> acquis ·{" "}
          <span className={attribue < 100 ? "font-semibold text-warn" : ""}>
            {attribue} % attribués
          </span>
        </p>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface">
        <div
          className={`h-full rounded-full ${valeur >= 75 ? "bg-success" : "bg-warn"}`}
          style={{ width: `${valeur}%` }}
        />
      </div>
    </div>
  );
}

function Stat({
  valeur,
  label,
  ton,
}: {
  valeur: number;
  label: string;
  ton?: string;
}) {
  return (
    <div className="rounded-lg bg-white px-4 py-3 shadow-card">
      <p className={`font-display text-2xl font-semibold ${ton ?? "text-ink"}`}>
        {valeur}
      </p>
      <p className="text-xs font-medium text-mute">{label}</p>
    </div>
  );
}
