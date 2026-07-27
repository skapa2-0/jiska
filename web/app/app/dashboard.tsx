"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  avancementGlobal,
  CRITICITES,
  ETATS,
  JALONS_BUSINESS,
  JALONS_TECH,
} from "@/lib/sujets";
import type { SujetRow } from "@/lib/sujets";
import SujetModal from "./sujet-modal";

export type ProjectOption = {
  id: string;
  name: string;
  color: string;
  icon: string;
  canManage: boolean;
  members: { id: string; email: string }[];
};

// Couleur d'avatar stable par utilisateur (photos de profil à venir).
const AVATAR_COLORS = ["#4b4ee9", "#7c3aed", "#0ea5e9", "#00a87e", "#e61e49"];
function avatarColor(id: string): string {
  return AVATAR_COLORS[Number(id) % AVATAR_COLORS.length];
}

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

  // « Nouveau sujet » de la navbar arrive avec ?sujet=nouveau.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("sujet") === "nouveau") {
      setModal({ mode: "create" });
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

  const responsables = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of projects)
      for (const m of p.members) seen.set(m.id, m.email);
    return [...seen.entries()].map(([id, email]) => ({ id, email }));
  }, [projects]);

  const visibles = sujets.filter((s) => {
    if (filtre === "miens" && s.responsable_id !== meId) return false;
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
    if (responsableId && s.responsable_id !== responsableId) return false;
    if (recherche) {
      const hay =
        `${s.title} ${s.project_name} ${s.responsable_email ?? ""} ${s.action} ${s.commentaire}`.toLowerCase();
      if (!hay.includes(recherche.toLowerCase())) return false;
    }
    return true;
  });

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
        <select
          aria-label="Filtrer par projet"
          value={projetId}
          onChange={(e) => setProjetId(e.target.value)}
          className="rounded-lg border border-hairline bg-white px-4 py-2 text-sm text-mute outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="">Par projet</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.icon} {p.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrer par responsable"
          value={responsableId}
          onChange={(e) => setResponsableId(e.target.value)}
          className="rounded-lg border border-hairline bg-white px-4 py-2 text-sm text-mute outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="">Par responsable</option>
          {responsables.map((r) => (
            <option key={r.id} value={r.id}>
              {r.email}
            </option>
          ))}
        </select>
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
        <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
          <thead>
            <tr className="text-xs text-ink">
              <Th>Projet</Th>
              <Th>Sujet</Th>
              <Th>Équipe</Th>
              <Th>Action de la semaine</Th>
              <Th>Échéance</Th>
              <Th>Technique · 60 %</Th>
              <Th>Business · 40 %</Th>
              <Th>Global</Th>
              <Th>Criticité</Th>
              <Th>État</Th>
              <Th>Commentaire</Th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-16 text-center text-stone">
                  {sujets.length === 0
                    ? "Aucun sujet pour l'instant. Créez le premier avec « Nouveau sujet »."
                    : "Aucun sujet ne correspond aux filtres."}
                </td>
              </tr>
            )}
            {visibles.map((s) => {
              const projet = projects.find((p) => p.id === s.project_id);
              // Responsable en tête, cerclé de doré.
              const equipe = [...(projet?.members ?? [])].sort((a, b) =>
                a.id === s.responsable_id ? -1 : b.id === s.responsable_id ? 1 : 0,
              );
              const global = avancementGlobal(s.jalon_tech, s.jalon_business);
              const retard = s.due_date && s.due_date < today && s.etat !== "termine";
              const semaine =
                s.due_date && s.due_date >= weekStart && s.due_date <= weekEnd;
              const joursRetard = retard
                ? Math.round(
                    (Date.parse(today) - Date.parse(s.due_date!)) / 86400000,
                  )
                : 0;
              return (
                <tr
                  key={s.id}
                  onClick={() => s.can_edit && setModal({ mode: "edit", sujet: s })}
                  className={`border-b border-hairline last:border-b-0 ${
                    s.can_edit ? "cursor-pointer transition hover:bg-surface" : ""
                  }`}
                >
                  <td className="relative px-4 py-3.5">
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-2 left-0 w-1 rounded-r"
                      style={{ backgroundColor: s.project_color }}
                    />
                    <span className="flex items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-base"
                        style={{ backgroundColor: `${s.project_color}1a` }}
                      >
                        {s.project_icon}
                      </span>
                      <span className="font-semibold text-ink">
                        {s.project_name}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-ink">{s.title}</td>
                  <td className="px-4 py-3.5">
                    <span className="flex items-center -space-x-1.5">
                      {equipe.slice(0, 4).map((m) => (
                        <span
                          key={m.id}
                          title={
                            m.id === s.responsable_id
                              ? `${m.email} · responsable`
                              : m.email
                          }
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-white text-[11px] font-semibold text-white ${
                            m.id === s.responsable_id
                              ? "ring-2 ring-amber-400"
                              : ""
                          }`}
                          style={{ backgroundColor: avatarColor(m.id) }}
                        >
                          {m.email[0]?.toUpperCase()}
                        </span>
                      ))}
                      {equipe.length > 4 && (
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-white bg-surface text-[11px] font-semibold text-mute">
                          +{equipe.length - 4}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="max-w-52 px-4 py-3.5 text-mute">{s.action}</td>
                  <td
                    className={`whitespace-nowrap px-4 py-3.5 ${
                      retard
                        ? "font-medium text-danger"
                        : semaine
                          ? "font-medium text-warn"
                          : "text-mute"
                    }`}
                  >
                    {s.due_date
                      ? s.due_date.split("-").reverse().join("/")
                      : "—"}
                    {retard ? (
                      <span className="block text-xs">⚠ {joursRetard} j</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5">
                    <Jauge
                      valeur={s.jalon_tech}
                      label={JALONS_TECH[s.jalon_tech as 0]}
                    />
                  </td>
                  <td className="px-4 py-3.5">
                    <Jauge
                      valeur={s.jalon_business}
                      label={JALONS_BUSINESS[s.jalon_business as 0]}
                    />
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3.5 font-semibold ${
                      global >= 75
                        ? "text-success"
                        : global >= 50
                          ? "text-warn"
                          : "text-danger"
                    }`}
                  >
                    {global} %
                  </td>
                  <td className="px-4 py-3.5">
                    <Chip classe={CRITICITES[s.criticite].chip}>
                      {CRITICITES[s.criticite].label}
                    </Chip>
                  </td>
                  <td className="px-4 py-3.5">
                    <Chip classe={ETATS[s.etat].chip}>
                      {ETATS[s.etat].label}
                    </Chip>
                  </td>
                  <td className="max-w-56 px-4 py-3.5 text-mute">
                    {s.commentaire}
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
          Cliquez sur une ligne pour la mettre à jour
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

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="sticky top-0 z-10 whitespace-nowrap bg-surface px-4 py-2.5 font-semibold shadow-[inset_0_-1px_0_var(--color-hairline)]">
      {children}
    </th>
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

function Jauge({ valeur, label }: { valeur: number; label: string }) {
  return (
    <div className="min-w-32">
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface">
          <div
            className={`h-full rounded-full ${valeur >= 75 ? "bg-success" : "bg-warn"}`}
            style={{ width: `${valeur}%` }}
          />
        </div>
        <span className="text-xs font-medium text-ink">{valeur} %</span>
      </div>
      <p className="mt-1 text-xs text-mute">{label}</p>
    </div>
  );
}
