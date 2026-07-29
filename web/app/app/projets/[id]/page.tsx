import { redirect } from "next/navigation";
import { getSessionUser, isResponsable } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  avancementGlobal,
  CRITICITES,
  ETATS,
  JALONS_BUSINESS,
  JALONS_TECH,
} from "@/lib/sujets";
import type { Criticite, Etat } from "@/lib/sujets";
import Avatar, { displayName } from "../../avatar";
import Navbar from "../../navbar";
import ProjetLogo from "../../projet-logo";
import Roue, { tonAvancement } from "../../roue";

const CHAMPS: Record<string, string> = {
  title: "le sujet",
  action: "l'action de la semaine",
  commentaire: "le commentaire",
  due_date: "l'échéance",
  jalon_tech: "le jalon technique",
  jalon_business: "le jalon business",
  criticite: "la criticité",
  etat: "l'état",
  responsable_id: "le responsable",
};

function valeurLisible(field: string, v: string | null): string {
  if (!v) return "-";
  if (field === "etat") return ETATS[v as Etat]?.label ?? v;
  if (field === "criticite") return CRITICITES[v as Criticite]?.label ?? v;
  if (field === "jalon_tech")
    return `${JALONS_TECH[Number(v) as 0] ?? v} (${v} %)`;
  if (field === "jalon_business")
    return `${JALONS_BUSINESS[Number(v) as 0] ?? v} (${v} %)`;
  if (field === "due_date") return v.split("-").reverse().join("/");
  return v.length > 60 ? `${v.slice(0, 60)}…` : v;
}

// Détail d'un projet : avancement, équipe, sujets actifs, historique.
export default async function ProjetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  if (!/^\d+$/.test(id)) redirect("/app/projets");

  const dirigeant = user.role === "dirigeant";
  if (!dirigeant) {
    const membre = await query(
      "SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2",
      [id, user.id],
    );
    if (membre.length === 0) redirect("/app/projets");
  }

  const [projets, equipe, sujets, historique, personnes] = await Promise.all([
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
      etat: Etat;
      criticite: Criticite;
      due_date: string | null;
      jalon_tech: number;
      jalon_business: number;
    }>(
      `SELECT id, title, etat, criticite, due_date::text AS due_date,
              jalon_tech, jalon_business
         FROM sujets WHERE project_id = $1
        ORDER BY (etat = 'termine'), due_date NULLS LAST, id`,
      [id],
    ),
    query<{
      field: string;
      old_value: string | null;
      new_value: string | null;
      quand: string;
      titre: string;
      auteur_id: string | null;
    }>(
      `SELECT h.field, h.old_value, h.new_value,
              to_char(h.changed_at, 'DD/MM à HH24:MI') AS quand,
              s.title AS titre, h.changed_by AS auteur_id
         FROM sujet_history h
         JOIN sujets s ON s.id = h.sujet_id
        WHERE s.project_id = $1
        ORDER BY h.changed_at DESC, h.id DESC
        LIMIT 25`,
      [id],
    ),
    query<{
      id: string;
      email: string;
      first_name: string;
      last_name: string;
    }>("SELECT id, email, first_name, last_name FROM users"),
  ]);

  const projet = projets[0];
  if (!projet) redirect("/app/projets");

  const nomDe = new Map(personnes.map((p) => [p.id, displayName(p)]));
  const actifs = sujets.filter((s) => s.etat !== "termine");
  const termines = sujets.length - actifs.length;
  const bloques = actifs.filter((s) => s.etat === "bloque").length;
  const avancement =
    sujets.length > 0
      ? Math.round(
          sujets.reduce(
            (acc, s) => acc + avancementGlobal(s.jalon_tech, s.jalon_business),
            0,
          ) / sujets.length,
        )
      : 0;
  const canCreateSujet = dirigeant || (await isResponsable(user.id));

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} canCreateSujet={canCreateSujet} onglet="projets" />
      <main className="w-full flex-1 px-6 py-8 lg:px-8">
        <a
          href="/app/projets"
          className="text-sm font-medium text-mute transition hover:text-ink"
        >
          ← Tous les projets
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
          <a
            href={`/app?projet=${projet.id}`}
            className="rounded-lg border border-hairline px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface"
          >
            Voir dans le tableau
          </a>
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
              global
            </span>
          </div>
          <Stat valeur={actifs.length} label="Sujets actifs" />
          <Stat
            valeur={bloques}
            label="Bloqués"
            ton={bloques > 0 ? "text-danger" : "text-success"}
          />
          <Stat valeur={termines} label="Terminés" ton="text-success" />
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_440px]">
          <div className="space-y-8">
            {/* Sujets du projet */}
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone">
                Sujets actifs
              </h2>
              {actifs.length === 0 ? (
                <p className="text-sm text-stone">
                  Aucun sujet actif sur ce projet.
                </p>
              ) : (
                <ul className="divide-y divide-hairline rounded-lg bg-white shadow-card">
                  {actifs.map((s) => {
                    const global = avancementGlobal(
                      s.jalon_tech,
                      s.jalon_business,
                    );
                    return (
                      <li
                        key={s.id}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <span
                          title={ETATS[s.etat].label}
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${ETATS[s.etat].dot}`}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                          {s.title}
                        </span>
                        <span
                          className={`hidden rounded-md px-2 py-0.5 text-xs font-semibold sm:inline ${CRITICITES[s.criticite].chip}`}
                        >
                          {CRITICITES[s.criticite].label}
                        </span>
                        <span className="w-20 whitespace-nowrap text-right text-xs text-mute">
                          {s.due_date
                            ? s.due_date.split("-").reverse().join("/")
                            : "-"}
                        </span>
                        <Roue
                          valeur={global}
                          ton={tonAvancement(global)}
                          taille="h-8 w-8"
                          texte="text-[8px]"
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

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
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone">
              Historique
            </h2>
            {historique.length === 0 ? (
              <p className="text-sm text-stone">
                Aucune modification enregistrée pour l&apos;instant.
              </p>
            ) : (
              <ul className="space-y-3 border-l-2 border-hairline pl-4">
                {historique.map((h, i) => (
                  <li key={i} className="relative text-xs">
                    <span
                      aria-hidden="true"
                      className="absolute -left-[21.5px] top-1 h-2 w-2 rounded-full bg-hairline"
                    />
                    <p className="text-stone">
                      {h.quand}
                      {h.auteur_id && nomDe.get(h.auteur_id)
                        ? ` · ${nomDe.get(h.auteur_id)}`
                        : ""}
                    </p>
                    <p className="mt-0.5 text-sm text-mute">
                      <span className="font-medium text-ink">{h.titre}</span> ·{" "}
                      {CHAMPS[h.field] ?? h.field} :{" "}
                      {h.field === "responsable_id" ? (
                        <>
                          {nomDe.get(h.old_value ?? "") ?? "-"} →{" "}
                          <span className="font-medium text-ink">
                            {nomDe.get(h.new_value ?? "") ?? "-"}
                          </span>
                        </>
                      ) : (
                        <>
                          {valeurLisible(h.field, h.old_value)} →{" "}
                          <span className="font-medium text-ink">
                            {valeurLisible(h.field, h.new_value)}
                          </span>
                        </>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
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
