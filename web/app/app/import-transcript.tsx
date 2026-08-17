"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CRITICITES, ETATS, TYPES_SUJET } from "@/lib/sujets";
import type { ChampsProposes, Proposition } from "@/lib/extraction";
import Avatar, { displayName } from "./avatar";
import type { Personne } from "./avatar";
import DatePicker from "./date-picker";
import ProjetLogo from "./projet-logo";
import Select from "./select";

export type ProduitImport = {
  id: string;
  name: string;
  logo: string | null;
  membres: Personne[];
  sujets: { id: string; titre: string }[];
};

type Statut = "attente" | "accepte" | "rejete";

const LIBELLES: Record<keyof ChampsProposes, string> = {
  etat: "État",
  criticite: "Criticité",
  type: "Type",
  action: "Action de la semaine",
  commentaire: "Commentaire",
  dueDate: "Échéance",
  porteurId: "Porteur",
};

const CONFIANCE: Record<string, string> = {
  haute: "bg-success-soft text-success",
  moyenne: "bg-warn-soft text-warn",
  faible: "bg-danger-soft text-danger",
};

const jolieDate = (v: string) => v.split("-").reverse().join("/");

export default function ImportTranscript({
  produits,
  porteeProjetId,
  retour,
}: {
  produits: ProduitImport[];
  porteeProjetId: string | null;
  retour: string;
}) {
  const router = useRouter();
  const [dateReunion, setDateReunion] = useState("");
  const [transcript, setTranscript] = useState("");
  const [nomFichier, setNomFichier] = useState("");
  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState("");

  const [importId, setImportId] = useState<string | null>(null);
  const [propositions, setPropositions] = useState<Proposition[]>([]);
  const [ecartes, setEcartes] = useState<string[]>([]);
  const [statuts, setStatuts] = useState<Record<string, Statut>>({});
  const [retouches, setRetouches] = useState<Record<string, boolean>>({});
  const [edition, setEdition] = useState<string | null>(null);
  const [bilan, setBilan] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parId = useMemo(
    () => new Map(produits.map((p) => [p.id, p])),
    [produits],
  );
  const nomDe = useMemo(() => {
    const m = new Map<string, Personne>();
    for (const p of produits) for (const u of p.membres) m.set(u.id, u);
    return m;
  }, [produits]);

  async function analyser() {
    setChargement(true);
    setMessage("");
    try {
      const res = await fetch("/api/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: porteeProjetId, dateReunion, transcript }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Échec de l'analyse.");
        return;
      }
      setImportId(data.id);
      setPropositions(data.propositions);
      setEcartes(data.ecartes ?? []);
      setStatuts(
        Object.fromEntries(
          (data.propositions as Proposition[]).map((p) => [p.ref, "attente"]),
        ),
      );
    } catch {
      setMessage("Impossible de joindre le serveur.");
    } finally {
      setChargement(false);
    }
  }

  function modifier(ref: string, maj: Partial<Proposition>) {
    setPropositions((ps) =>
      ps.map((p) => (p.ref === ref ? { ...p, ...maj } : p)),
    );
    setRetouches((r) => ({ ...r, [ref]: true }));
  }

  function modifierChamp(ref: string, cle: keyof ChampsProposes, valeur: unknown) {
    setPropositions((ps) =>
      ps.map((p) => {
        if (p.ref !== ref) return p;
        const champs = { ...p.champs };
        if (valeur === "" || valeur === undefined) delete champs[cle];
        else Object.assign(champs, { [cle]: valeur });
        return { ...p, champs };
      }),
    );
    setRetouches((r) => ({ ...r, [ref]: true }));
  }

  async function appliquer() {
    if (!importId) return;
    setChargement(true);
    setMessage("");
    const retenues = propositions
      .filter((p) => statuts[p.ref] === "accepte")
      .map(({ ref, projectId, sujetId, titre, champs }) => ({
        ref,
        projectId,
        sujetId,
        titre,
        champs,
      }));
    try {
      const res = await fetch(`/api/imports/${importId}/appliquer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retenues }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Échec de l'application.");
        return;
      }
      const parts = [
        `${data.majs} mise${data.majs > 1 ? "s" : ""} à jour`,
        `${data.creations} création${data.creations > 1 ? "s" : ""}`,
      ];
      setBilan(
        `${parts.join(" et ")} appliquée${data.majs + data.creations > 1 ? "s" : ""}.` +
          (data.erreurs?.length ? ` ${data.erreurs.length} échec(s).` : ""),
      );
      router.refresh();
    } catch {
      setMessage("Impossible de joindre le serveur.");
    } finally {
      setChargement(false);
    }
  }

  const champ =
    "w-full rounded-lg bg-surface px-3.5 py-2.5 text-sm text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand";

  // ---------- Bilan ----------
  if (bilan) {
    return (
      <div className="mt-10 rounded-lg bg-white p-8 text-center shadow-card">
        <p className="font-display text-xl font-medium text-ink">{bilan}</p>
        <a
          href={retour}
          className="mt-5 inline-block rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-85"
        >
          Revenir au portefeuille
        </a>
      </div>
    );
  }

  // ---------- Dépôt ----------
  if (!importId) {
    return (
      <div className="mt-8 max-w-2xl">
        <label className="mb-2 block text-sm font-medium text-ink">
          Date de la réunion
        </label>
        <DatePicker
          ariaLabel="Date de la réunion"
          value={dateReunion}
          onChange={setDateReunion}
          disabled={chargement}
        />
        <p className="mt-1.5 text-xs text-stone">
          Indispensable : c&apos;est elle qui permet de résoudre « cette semaine »
          ou « le 14 » en vraies échéances.
        </p>

        <div className="mb-2 mt-6 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-ink">Compte rendu Fireflies</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={chargement}
            className="rounded-lg border border-hairline px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-surface"
          >
            {nomFichier || "Importer un fichier"}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.json,.srt,text/plain"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setNomFichier(f.name);
            setTranscript(await f.text());
          }}
        />
        <textarea
          rows={12}
          placeholder="Collez le résumé ou le transcript, ou importez le fichier."
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          disabled={chargement}
          className={`${champ} resize-y font-mono text-[13px]`}
        />
        <p className="mt-1.5 text-xs text-stone">
          {transcript.length.toLocaleString("fr-FR")} caractères. Le résumé donne
          la structure, le transcript brut fournit les citations littérales : les
          deux ensemble donnent le meilleur résultat.
        </p>

        {message && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {message}
          </p>
        )}

        <button
          type="button"
          onClick={analyser}
          disabled={chargement || !dateReunion || transcript.trim().length < 200}
          className="mt-6 w-full rounded-lg bg-ink py-3.5 text-[15px] font-semibold text-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {chargement ? "Analyse en cours…" : "Analyser le compte rendu"}
        </button>
        {chargement && (
          <p className="mt-2 text-center text-xs text-stone">
            Comptez environ une minute pour une réunion d&apos;une heure.
          </p>
        )}
      </div>
    );
  }

  // ---------- Vérification ----------
  const majs = propositions.filter((p) => p.sujetId);
  const creations = propositions.filter((p) => !p.sujetId);
  const retenus = propositions.filter((p) => statuts[p.ref] === "accepte").length;
  const restants = propositions.filter((p) => statuts[p.ref] === "attente").length;

  function Carte({ p }: { p: Proposition }) {
    const produit = parId.get(p.projectId);
    const statut = statuts[p.ref];
    const enEdition = edition === p.ref;
    const membres = produit?.membres ?? [];

    return (
      <li
        className={`rounded-lg bg-white p-5 shadow-card transition ${
          statut === "rejete" ? "opacity-45" : ""
        } ${statut === "accepte" ? "ring-1 ring-success" : ""}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          {produit && (
            <span className="flex items-center gap-1.5 rounded-md bg-surface px-2 py-1 text-xs font-semibold text-mute">
              <ProjetLogo
                name={produit.name}
                logo={produit.logo}
                taille="h-4 w-4 text-[9px]"
              />
              {produit.name}
            </span>
          )}
          <span
            className={`rounded-md px-2 py-1 text-xs font-semibold ${CONFIANCE[p.confiance]}`}
          >
            Confiance {p.confiance}
          </span>
          {!p.sujetId && (
            <span className="rounded-md bg-brand/10 px-2 py-1 text-xs font-semibold text-brand">
              Nouveau sujet
            </span>
          )}
          {retouches[p.ref] && (
            <span className="rounded-md bg-surface px-2 py-1 text-xs font-semibold text-stone">
              Retouché
            </span>
          )}
          <span className="ml-auto font-mono text-xs text-stone">
            {p.horodatage}
          </span>
        </div>

        <h3 className="mt-2.5 font-display text-lg font-semibold text-ink">
          {p.titre}
        </h3>

        {/* Le diff proposé */}
        <div className="mt-2.5 space-y-1.5">
          {(Object.keys(p.champs) as (keyof ChampsProposes)[]).map((cle) => (
            <p key={cle} className="flex flex-wrap items-center gap-1.5 text-sm">
              <span className="text-stone">{LIBELLES[cle]}</span>
              {p.sujetId && (
                <>
                  <span className="text-mute">{rendu(cle, p.avant[cle], nomDe)}</span>
                  <span className="text-stone">→</span>
                </>
              )}
              <span className="font-semibold text-ink">
                {rendu(cle, p.champs[cle], nomDe)}
              </span>
            </p>
          ))}
          {!p.sujetId && (
            <p className="text-xs text-warn">
              Poids à définir : un sujet créé depuis une réunion arrive à 0 %.
            </p>
          )}
        </div>

        <p className="mt-3 border-l-2 border-hairline pl-3 text-sm italic text-mute">
          « {p.citation} »
        </p>

        {/* Correction */}
        {enEdition && (
          <div className="mt-4 space-y-3 rounded-lg bg-surface p-4">
            {porteeProjetId === null && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone">
                  Produit visé
                </p>
                <Select
                  ariaLabel="Produit visé"
                  placeholder="Choisir un produit"
                  variante="champ"
                  value={p.projectId}
                  onChange={(v) =>
                    v && modifier(p.ref, { projectId: v, sujetId: null })
                  }
                  options={produits.map((x) => ({ value: x.id, label: x.name }))}
                />
              </div>
            )}
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone">
                Sujet visé
              </p>
              <Select
                ariaLabel="Sujet visé"
                placeholder="Créer un nouveau sujet"
                variante="champ"
                value={p.sujetId ?? ""}
                onChange={(v) =>
                  modifier(p.ref, {
                    sujetId: v || null,
                    titre:
                      produit?.sujets.find((s) => s.id === v)?.titre ?? p.titre,
                  })
                }
                options={(produit?.sujets ?? []).map((s) => ({
                  value: s.id,
                  label: s.titre,
                }))}
              />
            </div>
            {!p.sujetId && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone">
                  Titre du nouveau sujet
                </p>
                <input
                  type="text"
                  value={p.titre}
                  onChange={(e) => modifier(p.ref, { titre: e.target.value })}
                  className={champ}
                />
              </div>
            )}

            {"etat" in p.champs && (
              <Bloc titre="État">
                <Select
                  ariaLabel="État proposé"
                  placeholder="Ne pas modifier"
                  variante="champ"
                  value={p.champs.etat ?? ""}
                  onChange={(v) => modifierChamp(p.ref, "etat", v)}
                  options={Object.entries(ETATS).map(([k, e]) => ({
                    value: k,
                    label: e.label,
                  }))}
                />
              </Bloc>
            )}
            {"criticite" in p.champs && (
              <Bloc titre="Criticité">
                <Select
                  ariaLabel="Criticité proposée"
                  placeholder="Ne pas modifier"
                  variante="champ"
                  value={p.champs.criticite ?? ""}
                  onChange={(v) => modifierChamp(p.ref, "criticite", v)}
                  options={Object.entries(CRITICITES).map(([k, c]) => ({
                    value: k,
                    label: c.label,
                  }))}
                />
              </Bloc>
            )}
            {!p.sujetId && (
              <Bloc titre="Type">
                <Select
                  ariaLabel="Type du sujet"
                  placeholder="Technique par défaut"
                  variante="champ"
                  value={p.champs.type ?? ""}
                  onChange={(v) => modifierChamp(p.ref, "type", v)}
                  options={Object.entries(TYPES_SUJET).map(([k, t]) => ({
                    value: k,
                    label: t.label,
                  }))}
                />
              </Bloc>
            )}
            {"action" in p.champs && (
              <Bloc titre="Action de la semaine">
                <input
                  type="text"
                  value={p.champs.action ?? ""}
                  onChange={(e) => modifierChamp(p.ref, "action", e.target.value)}
                  className={champ}
                />
              </Bloc>
            )}
            {"commentaire" in p.champs && (
              <Bloc titre="Commentaire">
                <textarea
                  rows={2}
                  value={p.champs.commentaire ?? ""}
                  onChange={(e) =>
                    modifierChamp(p.ref, "commentaire", e.target.value)
                  }
                  className={`${champ} resize-none`}
                />
              </Bloc>
            )}
            {"dueDate" in p.champs && (
              <Bloc titre="Échéance">
                <DatePicker
                  ariaLabel="Échéance proposée"
                  value={p.champs.dueDate ?? ""}
                  onChange={(v) => modifierChamp(p.ref, "dueDate", v || null)}
                />
              </Bloc>
            )}
            {"porteurId" in p.champs && (
              <Bloc titre="Porteur">
                <div className="flex flex-wrap gap-1.5">
                  {membres.map((m) => {
                    const actif = p.champs.porteurId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={actif}
                        onClick={() =>
                          modifierChamp(p.ref, "porteurId", actif ? "" : m.id)
                        }
                        className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold transition ${
                          actif
                            ? "border-brand bg-brand/5 text-ink ring-1 ring-brand"
                            : "border-hairline bg-white text-mute hover:bg-surface"
                        }`}
                      >
                        <Avatar personne={m} taille="h-5 w-5 text-[9px]" />
                        {displayName(m)}
                      </button>
                    );
                  })}
                </div>
              </Bloc>
            )}

            <button
              type="button"
              onClick={() => setEdition(null)}
              className="w-full rounded-lg bg-ink py-2.5 text-sm font-semibold text-white transition hover:opacity-85"
            >
              Terminer la correction
            </button>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setStatuts((s) => ({
                ...s,
                [p.ref]: s[p.ref] === "accepte" ? "attente" : "accepte",
              }))
            }
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              statut === "accepte"
                ? "bg-success text-white"
                : "bg-ink text-white hover:opacity-85"
            }`}
          >
            {statut === "accepte" ? "Retenue" : "Accepter"}
          </button>
          <button
            type="button"
            onClick={() => setEdition(enEdition ? null : p.ref)}
            className="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/5"
          >
            {enEdition ? "Replier" : "Corriger"}
          </button>
          <button
            type="button"
            onClick={() =>
              setStatuts((s) => ({
                ...s,
                [p.ref]: s[p.ref] === "rejete" ? "attente" : "rejete",
              }))
            }
            className="rounded-lg border border-hairline px-4 py-2 text-sm font-medium text-mute transition hover:bg-surface"
          >
            {statut === "rejete" ? "Rejetée" : "Rejeter"}
          </button>
        </div>
      </li>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-white px-5 py-4 shadow-card">
        <p className="font-display text-lg font-semibold text-ink">
          {propositions.length} proposition{propositions.length > 1 ? "s" : ""}
        </p>
        <p className="text-sm text-mute">
          {majs.length} mise{majs.length > 1 ? "s" : ""} à jour ·{" "}
          {creations.length} création{creations.length > 1 ? "s" : ""}
        </p>
        {restants > 0 && (
          <p className="text-sm text-warn">{restants} en attente de décision</p>
        )}
      </div>

      {propositions.length === 0 && (
        <p className="mt-10 text-center text-[15px] text-stone">
          Aucun changement détecté dans ce compte rendu.
        </p>
      )}

      {majs.length > 0 && (
        <Section titre="Mises à jour">
          {majs.map((p) => (
            <Carte key={p.ref} p={p} />
          ))}
        </Section>
      )}
      {creations.length > 0 && (
        <Section titre="Nouveaux sujets">
          {creations.map((p) => (
            <Carte key={p.ref} p={p} />
          ))}
        </Section>
      )}

      {ecartes.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone">
            Écarté, faute de produit correspondant
          </h2>
          <ul className="space-y-1.5 rounded-lg bg-surface p-5">
            {ecartes.map((e, i) => (
              <li key={i} className="text-sm text-mute">
                {e}
              </li>
            ))}
          </ul>
        </section>
      )}

      {message && (
        <p role="alert" className="mt-5 text-sm text-danger">
          {message}
        </p>
      )}

      {propositions.length > 0 && (
        <div className="sticky bottom-0 z-10 mt-8 flex flex-wrap items-center gap-3 border-t border-hairline bg-white/95 py-4 backdrop-blur">
          <a
            href={retour}
            className="rounded-lg border border-hairline px-4 py-2.5 text-sm font-medium text-mute transition hover:bg-surface"
          >
            Abandonner
          </a>
          <button
            type="button"
            onClick={appliquer}
            disabled={chargement || retenus === 0}
            className="flex-1 rounded-lg bg-ink py-3 text-sm font-semibold text-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {chargement
              ? "Application…"
              : `Appliquer ${retenus} changement${retenus > 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}

function Section({
  titre,
  children,
}: {
  titre: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone">
        {titre}
      </h2>
      <ul className="space-y-3">{children}</ul>
    </section>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone">
        {titre}
      </p>
      {children}
    </div>
  );
}

// Rend une valeur de champ en français lisible plutôt qu'en code interne.
function rendu(
  cle: keyof ChampsProposes,
  valeur: unknown,
  nomDe: Map<string, Personne>,
): string {
  if (valeur === undefined || valeur === null || valeur === "") return "-";
  const v = String(valeur);
  if (cle === "etat") return ETATS[v as keyof typeof ETATS]?.label ?? v;
  if (cle === "criticite")
    return CRITICITES[v as keyof typeof CRITICITES]?.label ?? v;
  if (cle === "type") return TYPES_SUJET[v as keyof typeof TYPES_SUJET]?.label ?? v;
  if (cle === "dueDate") return jolieDate(v);
  if (cle === "porteurId") {
    const p = nomDe.get(v);
    return p ? displayName(p) : v;
  }
  return v.length > 90 ? `${v.slice(0, 90)}…` : v;
}
