"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CRITICITES, ETATS } from "@/lib/sujets";
import type { SujetRow } from "@/lib/sujets";
import Avatar, { displayName } from "./avatar";
import type { Personne } from "./avatar";
import FicheSujet, { IconeCommentaire } from "./fiche-sujet";
import ProjetLogo from "./projet-logo";
import Select from "./select";
import SujetModal from "./sujet-modal";

export type ProjectOption = {
  id: string;
  name: string;
  logo: string | null;
  responsableId: string | null;
  canManage: boolean;
  members: Personne[];
};

type Indicateurs = {
  projets: number;
  ouverts: number;
  avancement: number;
  bloques: number;
  echeances: number;
  charge: number;
  clotures: number;
};

const FILTRES = [
  { key: "tous", label: "Tous les sujets" },
  { key: "miens", label: "Mes sujets" },
  { key: "bloques", label: "Bloqués" },
  { key: "semaine", label: "Cette semaine" },
  { key: "retard", label: "En retard" },
] as const;
type FiltreKey = (typeof FILTRES)[number]["key"];

// Tri par clic sur les en-têtes de colonnes.
type TriCol =
  | "projet"
  | "etat"
  | "sujet"
  | "equipe"
  | "action"
  | "echeance"
  | "criticite"
  | "commentaire";
type Tri = { col: TriCol; sens: 1 | -1 };

const CRITICITE_ORDRE: Record<string, number> = {
  critique: 0,
  haute: 1,
  normale: 2,
  faible: 3,
};

const ETAT_ORDRE: Record<string, number> = {
  bloque: 0,
  en_cours: 1,
  en_validation: 2,
  a_faire: 3,
  termine: 4,
};

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Dashboard({
  meId,
  sujets,
  projects,
  indicateurs,
}: {
  meId: string;
  sujets: SujetRow[];
  projects: ProjectOption[];
  indicateurs: Indicateurs;
}) {
  const router = useRouter();
  const [filtre, setFiltre] = useState<FiltreKey>("tous");
  const [projetId, setProjetId] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [recherche, setRecherche] = useState("");
  const [modal, setModal] = useState<
    { mode: "create" } | { mode: "edit"; sujet: SujetRow } | null
  >(null);
  const [fiche, setFiche] = useState<SujetRow | null>(null);
  const [tri, setTri] = useState<Tri | null>(null);

  function basculerTri(col: TriCol) {
    setTri((t) =>
      t?.col === col
        ? t.sens === 1
          ? { col, sens: -1 }
          : null
        : { col, sens: 1 },
    );
  }

  // « Nouveau sujet » de la navbar arrive avec ?sujet=nouveau ;
  // la vue projet renvoie vers le tableau filtré avec ?projet=<id>.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("sujet") === "nouveau") setModal({ mode: "create" });
    const projet = params.get("projet");
    if (projet) setProjetId(projet);
    if (params.get("sujet") || projet) {
      window.history.replaceState(null, "", "/app");
    }
  }, []);

  // Bornes temporelles calculées une fois par rendu.
  const { today, weekStart, weekEnd } = useMemo(() => {
    const now = new Date();
    const day = (now.getDay() + 6) % 7; // lundi = 0
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      today: isoDate(now),
      weekStart: isoDate(start),
      weekEnd: isoDate(end),
    };
  }, []);

  // Responsables = les responsables de projet (le sujet n'en a pas).
  const responsables = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of projects) {
      const r = p.members.find((m) => m.id === p.responsableId);
      if (r) seen.set(r.id, displayName(r));
    }
    return [...seen.entries()].map(([id, nom]) => ({ id, nom }));
  }, [projects]);

  const projetDe = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  );
  const mesProjets = useMemo(
    () =>
      new Set(
        projects
          .filter((p) => p.members.some((m) => m.id === meId))
          .map((p) => p.id),
      ),
    [projects, meId],
  );

  const visibles = sujets.filter((s) => {
    if (filtre === "miens" && !mesProjets.has(s.project_id)) return false;
    if (filtre === "bloques" && s.etat !== "bloque") return false;
    if (
      filtre === "semaine" &&
      !(s.due_date && s.due_date >= weekStart && s.due_date <= weekEnd)
    )
      return false;
    if (
      filtre === "retard" &&
      !(s.due_date && s.due_date < today && s.etat !== "termine")
    )
      return false;
    if (projetId && s.project_id !== projetId) return false;
    if (
      responsableId &&
      projetDe.get(s.project_id)?.responsableId !== responsableId
    )
      return false;
    if (recherche) {
      const responsable = projetDe.get(s.project_id)?.members.find(
        (m) => m.id === projetDe.get(s.project_id)?.responsableId,
      );
      const hay =
        `${s.title} ${s.project_name} ${responsable ? displayName(responsable) : ""} ${s.action} ${s.commentaire}`.toLowerCase();
      if (!hay.includes(recherche.toLowerCase())) return false;
    }
    return true;
  });

  function nomResponsable(s: SujetRow): string {
    const p = projetDe.get(s.project_id);
    const r = p?.members.find((m) => m.id === p?.responsableId);
    return r ? displayName(r) : "";
  }

  // Tri actif appliqué après filtrage ; les valeurs vides vont en fin.
  let lignes = visibles;
  if (tri) {
    const cle = (s: SujetRow): string | number | null => {
      switch (tri.col) {
        case "projet":
          return s.project_name.toLowerCase();
        case "etat":
          return ETAT_ORDRE[s.etat];
        case "sujet":
          return s.title.toLowerCase();
        case "equipe":
          return nomResponsable(s).toLowerCase() || null;
        case "action":
          return s.action.toLowerCase() || null;
        case "echeance":
          return s.due_date;
        case "criticite":
          return CRITICITE_ORDRE[s.criticite];
        case "commentaire":
          return s.commentaire.toLowerCase() || null;
      }
    };
    lignes = [...visibles].sort((a, b) => {
      const va = cle(a);
      const vb = cle(b);
      if (va === null || va === "") return 1;
      if (vb === null || vb === "") return -1;
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "fr");
      if (cmp !== 0) return cmp * tri.sens;
      // Départage stable : nom de projet puis titre du sujet.
      return (
        a.project_name.localeCompare(b.project_name, "fr") ||
        a.title.localeCompare(b.title, "fr")
      );
    });
  }

  function closeModal(refresh: boolean) {
    setModal(null);
    if (refresh) router.refresh();
  }

  return (
    <main className="flex min-h-0 w-full flex-1 flex-col gap-3 px-4 py-3 lg:px-6">
      {/* Bandeau supérieur : vision immédiate de l'activité (PRD §4A). */}
      <section
        aria-label="Indicateurs"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7"
      >
        <Indicateur
          valeur={indicateurs.projets}
          label="Projets actifs"
          tint="bg-brand/10 text-brand"
          icone={<IconeDossier />}
        />
        <Indicateur
          valeur={indicateurs.ouverts}
          label="Sujets ouverts"
          tint="bg-purple-50 text-purple-600"
          icone={<IconeListe />}
        />
        <Indicateur
          valeur={`${indicateurs.avancement} %`}
          label="Avancement moyen"
          tint="bg-success-soft text-success"
          icone={<IconeTendance />}
          ton={
            indicateurs.avancement >= 75
              ? "text-success"
              : indicateurs.avancement >= 50
                ? "text-warn"
                : "text-ink"
          }
        />
        <Indicateur
          valeur={indicateurs.bloques}
          label="Sujets bloqués"
          tint="bg-danger-soft text-danger"
          icone={<IconeAlerte />}
          ton={indicateurs.bloques > 0 ? "text-danger" : "text-success"}
        />
        <Indicateur
          valeur={indicateurs.echeances}
          label="Échéances semaine"
          tint="bg-warn-soft text-warn"
          icone={<IconeCalendrier />}
        />
        <Indicateur
          valeur={indicateurs.charge}
          label="Sujets / collaborateur"
          tint="bg-info-soft text-info"
          icone={<IconeEquipe />}
        />
        <Indicateur
          valeur={indicateurs.clotures}
          label="Clôturés sur 7 jours"
          tint="bg-success-soft text-success"
          icone={<IconeCoche />}
          ton={indicateurs.clotures > 0 ? "text-success" : undefined}
        />
      </section>

      {/* Filtres volontairement limités (PRD §10) + recherche. */}
      <section
        aria-label="Filtres"
        className="flex flex-wrap items-center gap-2"
      >
        {FILTRES.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFiltre(f.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              filtre === f.key
                ? "bg-ink text-white"
                : "border border-hairline text-mute hover:bg-surface"
            }`}
          >
            {f.label}
          </button>
        ))}
        <Select
          ariaLabel="Filtrer par projet"
          placeholder="Par projet"
          value={projetId}
          onChange={setProjetId}
          options={projects.map((p) => ({ value: p.id, label: p.name }))}
        />
        <Select
          ariaLabel="Filtrer par responsable"
          placeholder="Par responsable"
          value={responsableId}
          onChange={setResponsableId}
          options={responsables.map((r) => ({ value: r.id, label: r.nom }))}
        />
        <input
          type="search"
          placeholder="Rechercher un sujet, projet, responsable…"
          aria-label="Rechercher"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="ml-auto w-full rounded-lg border border-hairline bg-white px-4 py-2 text-sm text-ink placeholder-stone outline-none transition focus:ring-2 focus:ring-brand sm:w-72"
        />
      </section>

      {/* Tableau principal : une ligne = un sujet (PRD §4B). Il occupe
          tout l'espace restant et scrolle en interne : la page, elle,
          tient dans le viewport. */}
      <section className="min-h-0 flex-1 overflow-auto rounded-lg bg-white shadow-card">
        <table className="w-full min-w-[1250px] table-fixed border-collapse text-left text-sm">
          {/* Largeurs figées (table-fixed) : Projet/Sujet/Action se
              partagent l'espace restant, le reste est en pixels. */}
          <colgroup>
            <col />
            <col style={{ width: 110 }} />
            <col />
            <col style={{ width: 130 }} />
            <col />
            <col style={{ width: 115 }} />
            <col style={{ width: 115 }} />
            <col style={{ width: 110 }} />
          </colgroup>
          <thead>
            <tr className="divide-x divide-hairline text-xs text-ink">
              <Th col="projet" tri={tri} onTri={basculerTri}>
                Projet
              </Th>
              <Th centre col="etat" tri={tri} onTri={basculerTri}>
                État
              </Th>
              <Th col="sujet" tri={tri} onTri={basculerTri}>
                Sujet
              </Th>
              <Th col="equipe" tri={tri} onTri={basculerTri}>
                Équipe
              </Th>
              <Th col="action" tri={tri} onTri={basculerTri}>
                Action de la semaine
              </Th>
              <Th centre col="echeance" tri={tri} onTri={basculerTri}>
                Échéance
              </Th>
              <Th centre col="criticite" tri={tri} onTri={basculerTri}>
                Criticité
              </Th>
              <Th centre col="commentaire" tri={tri} onTri={basculerTri}>
                Commentaire
              </Th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-stone">
                  {sujets.length === 0
                    ? "Aucun sujet pour l'instant. Créez le premier avec « Nouveau sujet »."
                    : "Aucun sujet ne correspond aux filtres."}
                </td>
              </tr>
            )}
            {lignes.map((s) => {
              const projet = projetDe.get(s.project_id);
              const respId = projet?.responsableId ?? null;
              // Responsable du projet en tête, cerclé de brand.
              const equipe = [...(projet?.members ?? [])].sort((a, b) =>
                a.id === respId ? -1 : b.id === respId ? 1 : 0,
              );
              const retard = s.due_date && s.due_date < today && s.etat !== "termine";
              return (
                <tr
                  key={s.id}
                  onClick={() => setFiche(s)}
                  className="h-[60px] divide-x divide-hairline border-b border-hairline last:border-b-0 cursor-pointer transition hover:bg-surface"
                >
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2.5">
                      <ProjetLogo
                        name={s.project_name}
                        logo={s.project_logo}
                        taille="h-8 w-8 text-base"
                      />
                      <span className="line-clamp-2 font-semibold text-ink">
                        {s.project_name}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center align-middle">
                    <Chip classe={ETATS[s.etat].chip}>
                      {ETATS[s.etat].label}
                    </Chip>
                  </td>
                  <td className="max-w-56 px-4 py-2 font-medium text-ink">
                    <span className="line-clamp-2">{s.title}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="flex items-center -space-x-1.5">
                      {equipe.slice(0, 4).map((m) => (
                        <span key={m.id} className="group relative">
                          <Avatar
                            personne={m}
                            taille="h-7 w-7 text-[11px]"
                            dore={m.id === respId}
                            classe={
                              m.id === respId
                                ? ""
                                : "border-2 border-white"
                            }
                          />
                          <Etiquette>
                            {displayName(m)}
                            {m.id === respId ? " · responsable" : ""}
                          </Etiquette>
                        </span>
                      ))}
                      {equipe.length > 4 && (
                        <span className="group relative">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-white bg-surface text-[11px] font-semibold text-mute">
                            +{equipe.length - 4}
                          </span>
                          <Etiquette>
                            {equipe
                              .slice(4)
                              .map((m) => displayName(m))
                              .join(", ")}
                          </Etiquette>
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="max-w-52 px-4 py-2 text-mute">
                    <span className="line-clamp-2">{s.action}</span>
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-2 text-center align-middle ${
                      retard ? "font-medium text-danger" : "text-ink"
                    }`}
                  >
                    {s.due_date
                      ? s.due_date.split("-").reverse().join("/")
                      : "-"}
                  </td>
                  <td className="px-4 py-2 text-center align-middle">
                    <Chip classe={CRITICITES[s.criticite].chip}>
                      {CRITICITES[s.criticite].label}
                    </Chip>
                  </td>
                  <td className="px-4 py-2 text-center align-middle">
                    {s.commentaire && (
                      <button
                        type="button"
                        onClick={() => setFiche(s)}
                        aria-label={`Lire le commentaire de ${s.title}`}
                        title="Lire le commentaire"
                        className="rounded-md p-1.5 text-stone transition hover:bg-surface hover:text-ink"
                      >
                        <IconeCommentaire className="h-4.5 w-4.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Pied compact : compteur + légende sur une ligne. */}
      <section className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-mute">
        <span className="font-semibold text-ink">
          {visibles.length}/{sujets.length} sujet
          {sujets.length > 1 ? "s" : ""}
        </span>
        <span className="text-stone">
          Cliquez sur une ligne pour ouvrir sa fiche
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {Object.entries(ETATS).map(([k, e]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${e.dot}`} />
              {e.label}
            </span>
          ))}
          <span className="text-stone">·</span>
          {Object.entries(CRITICITES).map(([k, c]) => (
            <Chip key={k} classe={c.chip}>
              {c.label}
            </Chip>
          ))}
        </span>
      </section>

      {fiche && (
        <FicheSujet
          sujet={fiche}
          projet={projects.find((p) => p.id === fiche.project_id)}
          today={today}
          onClose={() => setFiche(null)}
          onEdit={() => {
            setModal({ mode: "edit", sujet: fiche });
            setFiche(null);
          }}
        />
      )}

      {modal && (
        <SujetModal
          mode={modal.mode}
          sujet={modal.mode === "edit" ? modal.sujet : undefined}
          projects={projects}
          onClose={closeModal}
        />
      )}
    </main>
  );
}

function Indicateur({
  valeur,
  label,
  ton,
  tint,
  icone,
}: {
  valeur: number | string;
  label: string;
  ton?: string;
  tint: string;
  icone: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-white px-3 py-2.5 shadow-card">
      <span
        aria-hidden="true"
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tint}`}
      >
        {icone}
      </span>
      <span className="min-w-0">
        <span
          className={`block font-display text-[21px] font-semibold leading-tight ${ton ?? "text-ink"}`}
        >
          {valeur}
        </span>
        <span className="block truncate text-xs font-medium text-mute">
          {label}
        </span>
      </span>
    </div>
  );
}

function Icone({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

function IconeDossier() {
  return <Icone d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />;
}
function IconeListe() {
  return <Icone d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />;
}
function IconeTendance() {
  return <Icone d="M3 17l6-6 4 4 8-8m0 0h-5m5 0v5" />;
}
function IconeAlerte() {
  return <Icone d="M12 4 2.5 20h19L12 4Zm0 6v4m0 3v.01" />;
}
function IconeCalendrier() {
  return <Icone d="M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm3-3v4m8-4v4M4 11h16" />;
}
function IconeEquipe() {
  return <Icone d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8 4.5a3.5 3.5 0 0 1 0 7m5 6v-2a4 4 0 0 0-2.5-3.7" />;
}
function IconeCoche() {
  return <Icone d="M20 6 9 17l-5-5" />;
}

function Th({
  centre,
  col,
  tri,
  onTri,
  children,
}: {
  centre?: boolean;
  col: TriCol;
  tri: Tri | null;
  onTri: (col: TriCol) => void;
  children: React.ReactNode;
}) {
  const actif = tri?.col === col;
  return (
    <th
      aria-sort={
        actif ? (tri.sens === 1 ? "ascending" : "descending") : undefined
      }
      className={`sticky top-0 z-10 whitespace-nowrap bg-surface px-4 py-2.5 font-semibold shadow-[inset_0_-1px_0_var(--color-hairline)] ${
        centre ? "text-center" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => onTri(col)}
        title="Trier"
        className={`group inline-flex items-center gap-1 transition hover:text-brand ${
          actif ? "text-brand" : ""
        } ${centre ? "justify-center" : ""}`}
      >
        {children}
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className={`h-3 w-3 shrink-0 transition ${
            actif
              ? tri.sens === -1
                ? "rotate-180 text-brand"
                : "text-brand"
              : "text-transparent group-hover:text-stone"
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 13V3m0 0L4.5 6.5M8 3l3.5 3.5" />
        </svg>
      </button>
    </th>
  );
}

// Étiquette maison affichée instantanément au survol (règle UI : pas
// d'infobulle native). S'affiche sous l'élément survolé.
function Etiquette({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-white group-hover:block">
      {children}
    </span>
  );
}

function Chip({
  classe,
  children,
}: {
  classe: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold ${classe}`}
    >
      {children}
    </span>
  );
}

