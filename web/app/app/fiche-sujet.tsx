"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CRITICITES, ETATS, TYPES_SUJET } from "@/lib/sujets";
import type { SujetRow } from "@/lib/sujets";
import Avatar, { displayName } from "./avatar";
import Confirmation from "./confirmer";
import type { ProjectOption } from "./dashboard";
import DatePicker from "./date-picker";
import ProjetLogo from "./projet-logo";
import Select from "./select";
import Roue, { tonAvancement } from "./roue";

// Fiche détaillée d'un sujet : panneau qui glisse depuis la droite.
// Édition directe sur la fiche (selon permissions) : les chips
// s'enregistrent au clic, les textes en quittant le champ.
export default function FicheSujet({
  sujet,
  projet,
  today,
  onClose,
}: {
  sujet: SujetRow;
  projet?: ProjectOption;
  today: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState(sujet.title);
  const [action, setAction] = useState(sujet.action);
  const [dueDate, setDueDate] = useState(sujet.due_date ?? "");
  const [etat, setEtat] = useState<string>(sujet.etat);
  const [criticite, setCriticite] = useState<string>(sujet.criticite);
  const [commentaire, setCommentaire] = useState(sujet.commentaire);
  const [type, setType] = useState<string>(sujet.type);
  const [poids, setPoids] = useState(String(sujet.poids));
  const [poidsSauve, setPoidsSauve] = useState(sujet.poids);
  const [porteurId, setPorteurId] = useState(sujet.porteur_id);
  const [sauve, setSauve] = useState({
    title: sujet.title,
    action: sujet.action,
    commentaire: sujet.commentaire,
  });
  const [statut, setStatut] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [confirmer, setConfirmer] = useState(false);
  // Glissement vers le bas pour fermer (bottom sheet, téléphone).
  const [drag, setDrag] = useState(0);
  const dragDepart = useRef<number | null>(null);
  const editable = sujet.can_edit;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") fermer();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fermer() {
    // Sauvegarde des saisies en cours avant fermeture (Échap, clic
    // sur le fond) : rien ne doit se perdre silencieusement.
    if (editable) {
      if (title.trim() && title.trim() !== sauve.title)
        patch({ title: title.trim() });
      if (action !== sauve.action) patch({ action });
      if (commentaire !== sauve.commentaire) patch({ commentaire });
      blurPoids();
    }
    setVisible(false);
    window.setTimeout(onClose, 250);
  }

  async function patch(donnees: Record<string, unknown>): Promise<boolean> {
    setStatut(null);
    try {
      const res = await fetch(`/api/sujets/${sujet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(donnees),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setStatut({
          ok: false,
          text: data?.error ?? "Échec de l'enregistrement.",
        });
        return false;
      }
      setStatut({ ok: true, text: "Enregistré" });
      router.refresh();
      return true;
    } catch {
      setStatut({ ok: false, text: "Impossible de joindre le serveur." });
      return false;
    }
  }

  function blurTexte(
    cle: "title" | "action" | "commentaire",
    valeur: string,
    remettre: (v: string) => void,
  ) {
    const propre = cle === "title" ? valeur.trim() : valeur;
    if (cle === "title" && !propre) {
      remettre(sauve.title);
      return;
    }
    if (propre === sauve[cle]) return;
    patch({ [cle]: propre }).then((ok) => {
      if (ok) setSauve((s) => ({ ...s, [cle]: propre }));
      else remettre(sauve[cle]);
    });
  }

  function changerDate(v: string) {
    const avant = dueDate;
    setDueDate(v);
    patch({ dueDate: v || null }).then((ok) => {
      if (!ok) setDueDate(avant);
    });
  }

  function changerChip(cle: "etat" | "criticite" | "type", v: string) {
    if (!v) return;
    const avant = cle === "etat" ? etat : cle === "criticite" ? criticite : type;
    const poser =
      cle === "etat" ? setEtat : cle === "criticite" ? setCriticite : setType;
    if (v === avant) return;
    poser(v);
    patch({ [cle]: v }).then((ok) => {
      if (!ok) poser(avant);
    });
  }

  function blurPoids() {
    const n = Math.min(100, Math.max(0, Math.round(Number(poids) || 0)));
    setPoids(String(n));
    if (n === poidsSauve) return;
    patch({ poids: n }).then((ok) => {
      if (ok) setPoidsSauve(n);
      else setPoids(String(poidsSauve));
    });
  }

  function changerPorteur(v: string | null) {
    const avant = porteurId;
    if (v === avant) return;
    setPorteurId(v);
    patch({ porteurId: v }).then((ok) => {
      if (!ok) setPorteurId(avant);
    });
  }

  async function supprimer() {
    setConfirmer(false);
    const res = await fetch(`/api/sujets/${sujet.id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
      fermer();
    } else {
      const data = await res.json().catch(() => null);
      setStatut({ ok: false, text: data?.error ?? "Échec de la suppression." });
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    // Uniquement en présentation bottom sheet (sous sm).
    if (window.innerWidth >= 640) return;
    dragDepart.current = e.touches[0].clientY;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (dragDepart.current === null) return;
    setDrag(Math.max(0, e.touches[0].clientY - dragDepart.current));
  }
  function onTouchEnd() {
    const distance = drag;
    dragDepart.current = null;
    setDrag(0);
    if (distance > 90) fermer();
  }

  const retard = dueDate && dueDate < today && etat !== "termine";
  const joursRetard = retard
    ? Math.round((Date.parse(today) - Date.parse(dueDate)) / 86400000)
    : 0;
  const respId = projet?.responsableId ?? null;
  const equipe = [...(projet?.members ?? [])].sort((a, b) =>
    a.id === respId ? -1 : b.id === respId ? 1 : 0,
  );

  const champ =
    "w-full rounded-lg bg-surface px-3.5 py-2.5 text-sm text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand";

  return (
    <div className="fixed inset-0 z-30">
      <div
        aria-hidden="true"
        onClick={fermer}
        className={`absolute inset-0 bg-ink/30 transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* Bottom sheet sur téléphone (glisse depuis le bas, poignée,
          fermeture au geste) ; panneau latéral droit à partir de sm. */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Fiche du sujet ${sujet.title}`}
        style={
          drag > 0
            ? { transform: `translateY(${drag}px)`, transition: "none" }
            : undefined
        }
        className={`absolute inset-x-0 bottom-0 flex h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-[0_-12px_32px_rgb(25_28_31/0.18)] transition-transform duration-300 sm:inset-x-auto sm:right-0 sm:top-0 sm:h-full sm:max-w-md sm:rounded-none sm:shadow-[-12px_0_32px_rgb(25_28_31/0.18)] ${
          visible
            ? "translate-x-0 translate-y-0"
            : "translate-y-full sm:translate-x-full sm:translate-y-0"
        }`}
      >
        <div
          className="shrink-0 touch-none pt-2.5 sm:hidden"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <span
            aria-hidden="true"
            className="mx-auto block h-1 w-10 rounded-full bg-hairline"
          />
        </div>
        <header
          className="flex items-center gap-3 border-b border-hairline px-5 py-4 pt-2.5 sm:px-6 sm:pt-4"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <ProjetLogo
            name={sujet.project_name}
            logo={sujet.project_logo}
            taille="h-9 w-9 text-lg"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-stone">
              {sujet.project_name}
            </span>
            <span className="block truncate font-semibold text-ink">
              Fiche sujet
            </span>
          </span>
          <button
            type="button"
            onClick={fermer}
            aria-label="Fermer la fiche"
            className="rounded-lg px-2.5 py-1 text-lg text-mute transition hover:bg-surface"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 divide-y divide-hairline overflow-y-auto">
          <div className="px-5 py-5 sm:px-6">
            {editable ? (
              <input
                type="text"
                aria-label="Titre du sujet"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => blurTexte("title", title, setTitle)}
                className="-mx-2 w-full rounded-lg px-2 py-1 font-display text-2xl font-medium leading-tight tracking-[-0.01em] text-ink outline-none transition hover:bg-surface focus:bg-surface"
              />
            ) : (
              <h2 className="font-display text-2xl font-medium leading-tight tracking-[-0.01em] text-ink">
                {title}
              </h2>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone">
                  État
                </p>
                {editable ? (
                  <Select
                    ariaLabel="État du sujet"
                    placeholder="État"
                    variante="champ"
                    value={etat}
                    onChange={(v) => changerChip("etat", v)}
                    options={Object.entries(ETATS).map(([k, e]) => ({
                      value: k,
                      label: e.label,
                    }))}
                  />
                ) : (
                  <Chip classe={ETATS[etat as keyof typeof ETATS].chip}>
                    {ETATS[etat as keyof typeof ETATS].label}
                  </Chip>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone">
                  Criticité
                </p>
                {editable ? (
                  <Select
                    ariaLabel="Criticité du sujet"
                    placeholder="Criticité"
                    variante="champ"
                    value={criticite}
                    onChange={(v) => changerChip("criticite", v)}
                    options={Object.entries(CRITICITES).map(([k, c]) => ({
                      value: k,
                      label: c.label,
                    }))}
                  />
                ) : (
                  <Chip
                    classe={
                      CRITICITES[criticite as keyof typeof CRITICITES].chip
                    }
                  >
                    {CRITICITES[criticite as keyof typeof CRITICITES].label}
                  </Chip>
                )}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {editable ? (
                <>
                  {Object.entries(TYPES_SUJET).map(([k, t]) => (
                    <Pastille
                      key={k}
                      actif={type === k}
                      classe={t.chip}
                      onClick={() => changerChip("type", k)}
                    >
                      {t.label}
                    </Pastille>
                  ))}
                  <label className="ml-1 flex items-center gap-1.5 text-xs font-medium text-mute">
                    Poids
                    <input
                      type="number"
                      aria-label="Poids dans le projet (%)"
                      min={0}
                      max={100}
                      step={5}
                      value={poids}
                      onChange={(e) => setPoids(e.target.value)}
                      onBlur={blurPoids}
                      className="w-16 rounded-lg bg-surface px-2 py-1 text-xs font-semibold text-ink outline-none transition focus:bg-white focus:ring-2 focus:ring-brand"
                    />
                    %
                  </label>
                  <BudgetAxe
                    projet={projet}
                    type={type}
                    poidsInitial={sujet.type === type ? sujet.poids : 0}
                    poidsActuel={Math.round(Number(poids) || 0)}
                  />
                </>
              ) : (
                <Chip classe={TYPES_SUJET[type as keyof typeof TYPES_SUJET].chip}>
                  {TYPES_SUJET[type as keyof typeof TYPES_SUJET].label} ·{" "}
                  {poids} %
                </Chip>
              )}
            </div>
          </div>

          <div className="space-y-5 px-5 py-5 sm:px-6">
          <Bloc titre="Porteur de l'action">
            <div className="flex flex-wrap gap-1.5">
              {(projet?.members ?? []).map((m) => {
                const actif = porteurId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={!editable}
                    aria-pressed={actif}
                    onClick={() =>
                      editable && changerPorteur(actif ? null : m.id)
                    }
                    className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold transition disabled:opacity-70 ${
                      actif
                        ? "border-brand bg-brand/5 text-ink ring-1 ring-brand"
                        : "border-hairline text-mute hover:bg-surface"
                    }`}
                  >
                    <Avatar personne={m} taille="h-5 w-5 text-[9px]" />
                    {displayName(m)}
                  </button>
                );
              })}
              {(projet?.members ?? []).length === 0 && (
                <span className="text-sm text-stone">-</span>
              )}
            </div>
          </Bloc>

          <Bloc titre="Action de la semaine">
            {editable ? (
              <input
                type="text"
                aria-label="Action de la semaine"
                placeholder="Décidée lors du dernier comité"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                onBlur={() => blurTexte("action", action, setAction)}
                className={champ}
              />
            ) : (
              <p className="text-sm text-ink">
                {action || (
                  <span className="text-stone">Aucune action définie</span>
                )}
              </p>
            )}
          </Bloc>

          <Bloc titre="Échéance">
            {editable ? (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <DatePicker
                    ariaLabel="Échéance"
                    value={dueDate}
                    onChange={changerDate}
                  />
                </div>
                {retard && (
                  <span className="shrink-0 rounded-md bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">
                    ⚠ {joursRetard} j
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm font-medium text-ink">
                {dueDate
                  ? dueDate.split("-").reverse().join("/")
                  : "Aucune échéance"}
                {retard && (
                  <span className="ml-2 rounded-md bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">
                    ⚠ {joursRetard} jour{joursRetard > 1 ? "s" : ""} de retard
                  </span>
                )}
              </p>
            )}
          </Bloc>

          {(editable || commentaire) && (
            <Bloc titre="Commentaire">
              {editable ? (
                <textarea
                  aria-label="Commentaire"
                  rows={3}
                  placeholder="Dernière information utile…"
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  onBlur={() =>
                    blurTexte("commentaire", commentaire, setCommentaire)
                  }
                  className={`${champ} resize-none`}
                />
              ) : (
                <div className="flex gap-2.5 rounded-lg bg-surface p-4">
                  <IconeCommentaire className="mt-0.5 h-4 w-4 shrink-0 text-stone" />
                  <p className="whitespace-pre-wrap text-sm text-ink">
                    {commentaire}
                  </p>
                </div>
              )}
            </Bloc>
          )}
          </div>

          {/* Suppression volontairement hors de la barre basse : action
              rare, loin de la zone du pouce, derrière confirmation. */}
          {sujet.can_manage && (
            <div className="px-5 py-3 sm:px-6">
              <button
                type="button"
                onClick={() => setConfirmer(true)}
                className="w-full rounded-lg py-2.5 text-sm font-medium text-danger transition hover:bg-danger-soft"
              >
                Supprimer le sujet
              </button>
            </div>
          )}

          {/* Le projet du sujet, en léger : logo, avancement, équipe. */}
          {projet && (
            <a
              href={`/app/projets/${projet.id}`}
              className="block bg-surface/60 px-5 py-4 transition hover:bg-surface sm:px-6"
            >
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-stone">
                Projet
              </p>
              <span className="flex items-center gap-3">
                <ProjetLogo
                  name={projet.name}
                  logo={projet.logo}
                  taille="h-9 w-9 text-base"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {projet.name}
                  </span>
                  <span className="mt-1 flex items-center -space-x-1">
                    {equipe.slice(0, 5).map((m) => (
                      <Avatar
                        key={m.id}
                        personne={m}
                        taille="h-5 w-5 text-[9px]"
                        dore={m.id === respId}
                        classe={m.id === respId ? "" : "border border-white"}
                      />
                    ))}
                    {equipe.length > 5 && (
                      <span className="pl-2 text-[11px] font-medium text-stone">
                        +{equipe.length - 5}
                      </span>
                    )}
                  </span>
                </span>
                <Roue
                  valeur={projet.avancement}
                  ton={tonAvancement(projet.avancement)}
                  taille="h-9 w-9"
                  texte="text-[8px]"
                />
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className="h-4 w-4 shrink-0 text-stone"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 3.5 10.5 8 6 12.5" />
                </svg>
              </span>
            </a>
          )}
        </div>

        <footer className="flex min-h-[57px] items-center gap-3 border-t border-hairline px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <p
            role={statut && !statut.ok ? "alert" : undefined}
            className={`min-w-0 flex-1 truncate text-sm ${
              statut
                ? statut.ok
                  ? "text-success"
                  : "text-danger"
                : "text-stone"
            }`}
          >
            {statut
              ? statut.text
              : editable
                ? "Enregistré automatiquement"
                : "Lecture seule"}
          </p>
        </footer>
      </aside>

      {confirmer && (
        <Confirmation
          titre="Supprimer le sujet ?"
          message={`« ${title} » et son historique seront supprimés.`}
          onConfirm={supprimer}
          onCancel={() => setConfirmer(false)}
        />
      )}
    </div>
  );
}

// Budget de l'axe : poids des autres sujets + celui-ci, reste à 100.
function BudgetAxe({
  projet,
  type,
  poidsInitial,
  poidsActuel,
}: {
  projet?: ProjectOption;
  type: string;
  poidsInitial: number;
  poidsActuel: number;
}) {
  if (!projet) return null;
  const attribueAxe =
    type === "technique" ? projet.poidsTech : projet.poidsBusiness;
  const autres = Math.max(0, attribueAxe - poidsInitial);
  const total = autres + poidsActuel;
  const reste = 100 - total;
  return (
    <span
      className={`text-[11px] font-medium ${reste < 0 ? "text-danger" : "text-stone"}`}
    >
      {reste < 0
        ? `Dépasse le budget de l'axe de ${-reste} % (${total} % attribués)`
        : `Axe à ${total} % attribués · reste ${reste} %`}
    </span>
  );
}

function Bloc({
  titre,
  children,
}: {
  titre: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone">
        {titre}
      </h3>
      {children}
    </section>
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

function Pastille({
  actif,
  classe,
  onClick,
  children,
}: {
  actif: boolean;
  classe: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
        actif
          ? `${classe} ring-1 ring-current`
          : "border border-hairline text-mute hover:bg-surface"
      }`}
    >
      {children}
    </button>
  );
}

export function IconeCommentaire({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a8 8 0 0 1-8 8H4l2.4-2.4A8 8 0 1 1 21 12Z" />
    </svg>
  );
}
