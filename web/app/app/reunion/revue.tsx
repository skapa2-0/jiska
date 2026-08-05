"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CRITICITES, ETATS, TYPES_SUJET } from "@/lib/sujets";
import type { SujetRow } from "@/lib/sujets";
import Avatar, { displayName } from "../avatar";
import type { ProjectOption } from "../dashboard";
import FicheSujet from "../fiche-sujet";
import ProjetLogo from "../projet-logo";
import Roue, { tonAvancement } from "../roue";

export type EtapeRevue = {
  projet: ProjectOption;
  tech: number;
  business: number;
  sujets: SujetRow[];
  termines: number;
  bloques: number;
  retards: number;
};

// Déroulé de la revue hebdomadaire : un produit par écran, navigation
// Précédent/Suivant (ou flèches clavier), fiches éditables en direct.
export default function Revue({
  etapes,
  today,
}: {
  etapes: EtapeRevue[];
  today: string;
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [fiche, setFiche] = useState<SujetRow | null>(null);
  // L'ordre est figé au lancement : les mises à jour en cours de
  // réunion ne réordonnent pas les étapes sous les pieds.
  const ordre = useRef(etapes.map((e) => e.projet.id));
  const parId = new Map(etapes.map((e) => [e.projet.id, e]));
  const revue = ordre.current
    .map((id) => parId.get(id))
    .filter((e): e is EtapeRevue => e !== undefined);

  const etape = revue[Math.min(idx, revue.length - 1)];
  const dernier = idx >= revue.length - 1;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (fiche) return;
      if (e.key === "ArrowRight" && !dernier) setIdx((i) => i + 1);
      if (e.key === "ArrowLeft" && idx > 0) setIdx((i) => i - 1);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [fiche, dernier, idx]);

  if (!etape) return null;
  const p = etape.projet;
  const respId = p.responsableId;
  const responsable = p.members.find((m) => m.id === respId);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white">
      {/* En-tête minimal : progression + sortie. */}
      <header className="border-b border-hairline">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG local */}
          <img src="/logo.svg" alt="Jiska" className="h-5 w-auto" />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
            Revue hebdomadaire
            <span className="ml-2 font-medium text-stone">
              {idx + 1}/{revue.length}
            </span>
          </p>
          <a
            href="/app"
            className="shrink-0 rounded-lg border border-hairline px-3 py-1.5 text-sm font-medium text-mute transition hover:bg-surface hover:text-ink"
          >
            Quitter
          </a>
        </div>
        <div aria-hidden="true" className="h-1 bg-surface">
          <div
            className="h-full bg-brand transition-all duration-300"
            style={{ width: `${((idx + 1) / revue.length) * 100}%` }}
          />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6">
          {/* Le produit du moment */}
          <div className="flex items-center gap-4">
            <ProjetLogo name={p.name} logo={p.logo} taille="h-12 w-12 text-2xl" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-2xl font-medium tracking-[-0.02em] text-ink">
                {p.name}
              </h1>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-mute">
                <span className="flex items-center -space-x-1">
                  {p.members.slice(0, 5).map((m) => (
                    <Avatar
                      key={m.id}
                      personne={m}
                      taille="h-5 w-5 text-[9px]"
                      dore={m.id === respId}
                      classe={m.id === respId ? "" : "border border-white"}
                    />
                  ))}
                </span>
                {responsable && (
                  <span className="min-w-0 truncate">
                    {displayName(responsable)}
                  </span>
                )}
              </p>
            </div>
            <Roue
              valeur={p.avancement}
              ton={tonAvancement(p.avancement)}
              taille="h-12 w-12"
            />
          </div>

          {/* Axes et signaux */}
          <div className="mt-4 grid gap-x-6 gap-y-2 rounded-lg bg-white p-4 shadow-card sm:grid-cols-2">
            <BarreAxe nom="Technique · 60 %" valeur={etape.tech} />
            <BarreAxe nom="Business · 40 %" valeur={etape.business} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="rounded-md bg-surface px-2 py-1 text-mute">
              {etape.sujets.length} sujet{etape.sujets.length > 1 ? "s" : ""}{" "}
              actif{etape.sujets.length > 1 ? "s" : ""}
            </span>
            {etape.bloques > 0 && (
              <span className="rounded-md bg-danger-soft px-2 py-1 font-semibold text-danger">
                {etape.bloques} bloqué{etape.bloques > 1 ? "s" : ""}
              </span>
            )}
            {etape.retards > 0 && (
              <span className="rounded-md bg-danger-soft px-2 py-1 font-semibold text-danger">
                {etape.retards} retard{etape.retards > 1 ? "s" : ""}
              </span>
            )}
            {etape.termines > 0 && (
              <span className="rounded-md bg-success-soft px-2 py-1 text-success">
                {etape.termines} terminé{etape.termines > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Les actions à passer en revue */}
          {etape.sujets.length === 0 ? (
            <p className="mt-6 rounded-lg bg-surface px-4 py-8 text-center text-sm text-stone">
              Aucun sujet actif sur ce produit.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-hairline rounded-lg bg-white shadow-card">
              {etape.sujets.map((s) => {
                const retard =
                  !!s.due_date && s.due_date < today && s.etat !== "termine";
                const porteur = p.members.find((m) => m.id === s.porteur_id);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setFiche(s)}
                      className="w-full px-4 py-3 text-left transition hover:bg-surface active:bg-surface"
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          title={ETATS[s.etat].label}
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${ETATS[s.etat].dot}`}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                          {s.title}
                        </span>
                        <span
                          className={`hidden rounded-md px-2 py-0.5 text-xs font-semibold sm:inline ${TYPES_SUJET[s.type].chip}`}
                        >
                          {TYPES_SUJET[s.type].court} · {s.poids} %
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${CRITICITES[s.criticite].chip}`}
                        >
                          {CRITICITES[s.criticite].label}
                        </span>
                        <span
                          className={`w-20 shrink-0 whitespace-nowrap text-right text-xs ${
                            retard ? "font-semibold text-danger" : "text-mute"
                          }`}
                        >
                          {s.due_date
                            ? s.due_date.split("-").reverse().join("/")
                            : "-"}
                        </span>
                      </span>
                      <span className="mt-1 flex items-center gap-2 pl-5">
                        <span className="min-w-0 flex-1 truncate text-[13px] text-mute">
                          {s.action || (
                            <span className="text-stone">
                              Aucune action définie
                            </span>
                          )}
                        </span>
                        {porteur && (
                          <span className="flex shrink-0 items-center gap-1.5 text-xs text-mute">
                            <Avatar
                              personne={porteur}
                              taille="h-5 w-5 text-[9px]"
                            />
                            {displayName(porteur)}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>

      {/* Navigation de la revue */}
      <footer className="flex items-center gap-3 border-t border-hairline px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        <button
          type="button"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface disabled:opacity-40"
        >
          ← Précédent
        </button>
        <span className="flex-1 text-center text-xs font-medium text-stone">
          {p.name}
        </span>
        {dernier ? (
          <button
            type="button"
            onClick={() => router.push("/app")}
            className="rounded-lg bg-success px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-85"
          >
            Terminer la revue
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIdx((i) => i + 1)}
            className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-85"
          >
            Suivant →
          </button>
        )}
      </footer>

      {fiche && (
        <FicheSujet
          sujet={fiche}
          projet={p}
          today={today}
          onClose={() => setFiche(null)}
        />
      )}
    </div>
  );
}

function BarreAxe({ nom, valeur }: { nom: string; valeur: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-ink">{nom}</p>
        <p className="text-xs font-semibold text-ink">{valeur} %</p>
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
