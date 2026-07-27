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
  canManage: boolean;
  members: { id: string; email: string }[];
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

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function prenom(email: string | null): string {
  if (!email) return "—";
  const p = email.split("@")[0].split(/[._-]/)[0];
  return p.charAt(0).toUpperCase() + p.slice(1);
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
    <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-6">
      {/* Bandeau supérieur : vision immédiate de l'activité (PRD §4A). */}
      <section
        aria-label="Indicateurs"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7"
      >
        <Indicateur valeur={indicateurs.projets} label="Projets actifs" />
        <Indicateur valeur={indicateurs.ouverts} label="Sujets ouverts" />
        <Indicateur
          valeur={`${indicateurs.avancement} %`}
          label="Avancement moyen"
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
          ton={indicateurs.bloques > 0 ? "text-danger" : "text-success"}
        />
        <Indicateur
          valeur={indicateurs.echeances}
          label="Échéances semaine"
        />
        <Indicateur
          valeur={indicateurs.charge}
          label="Sujets / collaborateur"
        />
        <Indicateur
          valeur={indicateurs.clotures}
          label="Clôturés sur 7 jours"
          ton={indicateurs.clotures > 0 ? "text-success" : undefined}
        />
      </section>

      {/* Filtres volontairement limités (PRD §10) + recherche. */}
      <section
        aria-label="Filtres"
        className="mt-6 flex flex-wrap items-center gap-2"
      >
        {FILTRES.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFiltre(f.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
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
          className="rounded-full border border-hairline bg-white px-4 py-2 text-sm text-mute outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="">Par projet</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrer par responsable"
          value={responsableId}
          onChange={(e) => setResponsableId(e.target.value)}
          className="rounded-full border border-hairline bg-white px-4 py-2 text-sm text-mute outline-none focus:ring-2 focus:ring-brand"
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
          className="ml-auto w-full rounded-full bg-surface px-4 py-2 text-sm text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand sm:w-72"
        />
      </section>

      {/* Tableau principal : une ligne = un sujet (PRD §4B). */}
      <section className="mt-4 overflow-x-auto rounded-2xl border border-hairline bg-white">
        <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-hairline text-xs text-stone">
              <Th>Projet</Th>
              <Th>Sujet</Th>
              <Th>Responsable</Th>
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
                    s.can_edit ? "cursor-pointer transition hover:bg-surface/60" : ""
                  }`}
                >
                  <td className="px-4 py-3.5 font-medium text-ink">
                    {s.project_name}
                  </td>
                  <td className="px-4 py-3.5 text-ink">{s.title}</td>
                  <td className="px-4 py-3.5">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-semibold text-white"
                      >
                        {(s.responsable_email ?? "—")[0]?.toUpperCase()}
                      </span>
                      <span className="text-mute">
                        {prenom(s.responsable_email)}
                      </span>
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

      <p className="mt-3 text-xs text-stone">
        {visibles.length} sujet{visibles.length > 1 ? "s" : ""} affiché
        {visibles.length > 1 ? "s" : ""} sur {sujets.length} · cliquez sur une
        ligne pour la mettre à jour
      </p>

      {/* Légende (états, criticités, jalons). */}
      <section className="mt-6 grid gap-3 text-xs text-mute sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-hairline bg-white p-4">
          <p className="mb-2 font-semibold text-ink">État</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {Object.entries(ETATS).map(([k, e]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${e.dot}`} />
                {e.label}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-hairline bg-white p-4">
          <p className="mb-2 font-semibold text-ink">Criticité</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(CRITICITES).map(([k, c]) => (
              <Chip key={k} classe={c.chip}>
                {c.label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-hairline bg-white p-4">
          <p className="mb-2 font-semibold text-ink">Jalons techniques</p>
          {Object.entries(JALONS_TECH).map(([pct, label]) => (
            <p key={pct}>
              {pct} % — {label}
            </p>
          ))}
        </div>
        <div className="rounded-2xl border border-hairline bg-white p-4">
          <p className="mb-2 font-semibold text-ink">Jalons business</p>
          {Object.entries(JALONS_BUSINESS).map(([pct, label]) => (
            <p key={pct}>
              {pct} % — {label}
            </p>
          ))}
        </div>
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
}: {
  valeur: number | string;
  label: string;
  ton?: string;
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-white px-4 py-3.5">
      <p className={`font-display text-2xl font-medium ${ton ?? "text-ink"}`}>
        {valeur}
      </p>
      <p className="mt-0.5 text-xs text-stone">{label}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 font-medium">{children}</th>
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
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${classe}`}
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
      <p className="mt-1 text-xs text-stone">{label}</p>
    </div>
  );
}
