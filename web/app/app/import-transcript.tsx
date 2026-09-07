"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CRITICITES, ETATS, TYPES_SUJET } from "@/lib/sujets";
import { NOM_TRANSVERSE } from "@/lib/sujets";
import type {
  ChampsProposes,
  Proposition,
  PropositionDeploiement,
} from "@/lib/extraction";

// Valeur du sélecteur pour « aucun produit » : projectId vaut null.
const TRANSVERSE = "transverse";
import BadgeDeployable from "./deployable";
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

// Un import déjà analysé, rouvert pour être vérifié : l'analyse coûte une
// minute, un onglet fermé ne doit pas la faire perdre.
export type Reprise = {
  id: string;
  dateReunion: string;
  propositions: Proposition[];
  ecartes: string[];
  deploiements: PropositionDeploiement[];
};

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
  sujetsTransverses = [],
  porteeProjetId,
  retour,
  reprise = null,
}: {
  produits: ProduitImport[];
  // Sujets transverses existants : cibles possibles d'une correction.
  sujetsTransverses?: { id: string; titre: string }[];
  porteeProjetId: string | null;
  retour: string;
  reprise?: Reprise | null;
}) {
  const router = useRouter();
  const [dateReunion, setDateReunion] = useState(reprise?.dateReunion ?? "");
  const [transcript, setTranscript] = useState("");
  const [nomFichier, setNomFichier] = useState("");
  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState("");

  const [importId, setImportId] = useState<string | null>(reprise?.id ?? null);
  const [propositions, setPropositions] = useState<Proposition[]>(
    reprise?.propositions ?? [],
  );
  const [ecartes, setEcartes] = useState<string[]>(reprise?.ecartes ?? []);
  // Les annonces de déployabilité portent des références distinctes (« d0 »
  // contre « p0 ») : un seul registre de statuts suffit pour les deux.
  const [deploiements, setDeploiements] = useState<PropositionDeploiement[]>(
    reprise?.deploiements ?? [],
  );
  const [statuts, setStatuts] = useState<Record<string, Statut>>(() =>
    Object.fromEntries(
      [
        ...(reprise?.propositions ?? []),
        ...(reprise?.deploiements ?? []),
      ].map((p) => [p.ref, "attente" as Statut]),
    ),
  );
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
      setDeploiements(data.deploiements ?? []);
      setStatuts(
        Object.fromEntries(
          [
            ...(data.propositions as Proposition[]),
            ...((data.deploiements ?? []) as PropositionDeploiement[]),
          ].map((p) => [p.ref, "attente"]),
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
    const deploiementsRetenus = deploiements
      .filter((d) => statuts[d.ref] === "accepte")
      .map(({ ref, projectId, deployable }) => ({ ref, projectId, deployable }));
    try {
      const res = await fetch(`/api/imports/${importId}/appliquer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retenues, deploiementsRetenus }),
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
      if (data.deploiements > 0) {
        parts.push(
          `${data.deploiements} produit${data.deploiements > 1 ? "s" : ""} marqué${data.deploiements > 1 ? "s" : ""}`,
        );
      }
      const total = data.majs + data.creations + (data.deploiements ?? 0);
      setBilan(
        `${parts.join(", ")} : ${total} changement${total > 1 ? "s" : ""} appliqué${total > 1 ? "s" : ""}.` +
          (data.erreurs?.length ? ` ${data.erreurs.length} échec(s).` : ""),
      );
      router.refresh();
    } catch {
      setMessage("Impossible de joindre le serveur.");
    } finally {
      setChargement(false);
    }
  }

  async function abandonner() {
    if (importId) {
      await fetch(`/api/imports/${importId}/abandonner`, {
        method: "POST",
      }).catch(() => null);
    }
    window.location.href = retour;
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
  const aDecider = [...propositions, ...deploiements];
  const retenus = aDecider.filter((p) => statuts[p.ref] === "accepte").length;
  const restants = aDecider.filter((p) => statuts[p.ref] === "attente").length;

  function Carte({ p }: { p: Proposition }) {
    const produit = p.projectId ? parId.get(p.projectId) : undefined;
    const statut = statuts[p.ref];
    const enEdition = edition === p.ref;
    // Un sujet transverse n'a pas d'équipe : ses porteurs possibles sont
    // les membres de tous les produits.
    const membres = p.projectId
      ? (produit?.membres ?? [])
      : [...new Map(produits.flatMap((x) => x.membres).map((m) => [m.id, m])).values()];
    // Cibles possibles du « sujet visé » : ceux du produit, ou les
    // transverses existants quand la proposition ne vise aucun produit.
    const cibles = p.projectId ? (produit?.sujets ?? []) : sujetsTransverses;

    return (
      <li
        className={`rounded-lg bg-white p-5 shadow-card transition ${
          statut === "rejete" ? "opacity-45" : ""
        } ${statut === "accepte" ? "ring-1 ring-success" : ""}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          {produit ? (
            <span className="flex items-center gap-1.5 rounded-md bg-surface px-2 py-1 text-xs font-semibold text-mute">
              <ProjetLogo
                name={produit.name}
                logo={produit.logo}
                taille="h-4 w-4 text-[9px]"
              />
              {produit.name}
            </span>
          ) : (
            <span className="rounded-md bg-surface px-2 py-1 text-xs font-semibold text-mute">
              {NOM_TRANSVERSE}
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

        {/* Ce que c'était, ce que ça devient */}
        <div className="mt-3 space-y-2">
          {(Object.keys(p.champs) as (keyof ChampsProposes)[]).map((cle) => (
            <Diff
              key={cle}
              cle={cle}
              avant={p.avant[cle]}
              apres={p.champs[cle]}
              creation={!p.sujetId}
              nomDe={nomDe}
            />
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
                  value={p.projectId ?? TRANSVERSE}
                  onChange={(v) =>
                    v &&
                    modifier(p.ref, {
                      projectId: v === TRANSVERSE ? null : v,
                      sujetId: null,
                    })
                  }
                  options={[
                    ...produits.map((x) => ({ value: x.id, label: x.name })),
                    { value: TRANSVERSE, label: NOM_TRANSVERSE },
                  ]}
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
                    titre: cibles.find((s) => s.id === v)?.titre ?? p.titre,
                  })
                }
                options={cibles.map((s) => ({
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

  // Une annonce de déployabilité ne se corrige pas : soit la réunion l'a
  // dite, soit elle ne l'a pas dite. On la retient ou on la rejette.
  function CarteDeploiement({ d }: { d: PropositionDeploiement }) {
    const produit = parId.get(d.projectId);
    const statut = statuts[d.ref];

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
          <span className="ml-auto font-mono text-xs text-stone">
            {d.horodatage}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <BadgeDeployable deployable={d.avant} />
          <span aria-hidden="true" className="text-stone">
            →
          </span>
          <BadgeDeployable deployable={d.deployable} />
        </div>

        <p className="mt-3 border-l-2 border-hairline pl-3 text-sm italic text-mute">
          « {d.citation} »
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setStatuts((s) => ({
                ...s,
                [d.ref]: s[d.ref] === "accepte" ? "attente" : "accepte",
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
            onClick={() =>
              setStatuts((s) => ({
                ...s,
                [d.ref]: s[d.ref] === "rejete" ? "attente" : "rejete",
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
          {aDecider.length} proposition{aDecider.length > 1 ? "s" : ""}
        </p>
        <p className="text-sm text-mute">
          {majs.length} mise{majs.length > 1 ? "s" : ""} à jour ·{" "}
          {creations.length} création{creations.length > 1 ? "s" : ""}
          {deploiements.length > 0 &&
            ` · ${deploiements.length} déployabilité${deploiements.length > 1 ? "s" : ""}`}
        </p>
        {restants > 0 && (
          <p className="text-sm text-warn">{restants} en attente de décision</p>
        )}
      </div>

      {aDecider.length === 0 && (
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

      {deploiements.length > 0 && (
        <Section titre="Déployabilité annoncée en réunion">
          {deploiements.map((d) => (
            <CarteDeploiement key={d.ref} d={d} />
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

      {aDecider.length > 0 && (
        <div className="sticky bottom-0 z-10 mt-8 flex flex-wrap items-center gap-3 border-t border-hairline bg-white/95 py-4 backdrop-blur">
          <button
            type="button"
            onClick={abandonner}
            disabled={chargement}
            className="rounded-lg border border-hairline px-4 py-2.5 text-sm font-medium text-mute transition hover:bg-surface disabled:opacity-50"
          >
            Abandonner
          </button>
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

// Les textes longs ne se comparent pas sur une ligne : au-delà de deux
// mots, « ancien → nouveau » devient illisible et il faut tronquer.
const CHAMPS_LONGS: (keyof ChampsProposes)[] = ["action", "commentaire"];

const VIDE: Partial<Record<keyof ChampsProposes, string>> = {
  dueDate: "Aucune échéance",
  porteurId: "Aucun porteur",
  action: "Aucune action",
  commentaire: "Aucun commentaire",
};

const texteBrut = (v: unknown) =>
  v === undefined || v === null ? "" : String(v).trim();

// Ce que c'était, ce que ça devient. Deux traitements : les valeurs
// courtes se comparent d'un coup d'œil sur une ligne, avec les pastilles
// du reste de l'application ; les textes longs se superposent en avant et
// après, entiers, sans troncature.
function Diff({
  cle,
  avant,
  apres,
  creation,
  nomDe,
}: {
  cle: keyof ChampsProposes;
  avant: unknown;
  apres: unknown;
  creation: boolean;
  nomDe: Map<string, Personne>;
}) {
  const long = CHAMPS_LONGS.includes(cle);
  const vide = VIDE[cle] ?? "Vide";

  return (
    <div className="rounded-lg bg-surface px-3.5 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone">
        {LIBELLES[cle]}
      </p>

      {long ? (
        <div className="mt-1.5 space-y-1">
          {!creation && (
            <div className="flex gap-2.5">
              <span className="w-[3.4rem] shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-stone">
                Avant
              </span>
              <span className="text-sm leading-snug text-stone line-through decoration-stone/40">
                {texteBrut(avant) || vide}
              </span>
            </div>
          )}
          <div className="flex gap-2.5">
            <span className="w-[3.4rem] shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-success">
              {creation ? "Valeur" : "Après"}
            </span>
            <span className="text-sm font-medium leading-snug text-ink">
              {texteBrut(apres) || vide}
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {!creation && (
            <>
              <Valeur cle={cle} valeur={avant} nomDe={nomDe} passe />
              <span aria-hidden="true" className="text-stone">
                →
              </span>
            </>
          )}
          <Valeur cle={cle} valeur={apres} nomDe={nomDe} />
        </div>
      )}
    </div>
  );
}

// Une valeur courte, rendue comme partout ailleurs dans Jiska : pastille
// d'état, de criticité ou de type, avatar pour un porteur. « passe » grise
// l'ancienne valeur pour que la nouvelle ressorte.
function Valeur({
  cle,
  valeur,
  nomDe,
  passe = false,
}: {
  cle: keyof ChampsProposes;
  valeur: unknown;
  nomDe: Map<string, Personne>;
  passe?: boolean;
}) {
  const v = texteBrut(valeur);
  const attenue = passe ? "opacity-55" : "";

  if (!v) {
    return (
      <span className={`text-sm text-stone ${attenue}`}>
        {VIDE[cle] ?? "Vide"}
      </span>
    );
  }

  if (cle === "etat") {
    const e = ETATS[v as keyof typeof ETATS];
    return e ? <Chip classe={e.chip} attenue={passe}>{e.label}</Chip> : <>{v}</>;
  }
  if (cle === "criticite") {
    const c = CRITICITES[v as keyof typeof CRITICITES];
    return c ? <Chip classe={c.chip} attenue={passe}>{c.label}</Chip> : <>{v}</>;
  }
  if (cle === "type") {
    const t = TYPES_SUJET[v as keyof typeof TYPES_SUJET];
    return t ? <Chip classe={t.chip} attenue={passe}>{t.label}</Chip> : <>{v}</>;
  }
  if (cle === "porteurId") {
    const p = nomDe.get(v);
    return (
      <span
        className={`flex items-center gap-1.5 text-sm font-medium text-ink ${attenue}`}
      >
        <Avatar
          personne={p ?? { id: v, email: v }}
          taille="h-5 w-5 text-[9px]"
        />
        {p ? displayName(p) : v}
      </span>
    );
  }
  if (cle === "dueDate") {
    return (
      <span
        className={`rounded-md bg-white px-2 py-1 text-xs font-semibold text-ink ${attenue}`}
      >
        {jolieDate(v)}
      </span>
    );
  }
  return <span className={`text-sm text-ink ${attenue}`}>{v}</span>;
}

function Chip({
  classe,
  attenue,
  children,
}: {
  classe: string;
  attenue?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold ${classe} ${
        attenue ? "opacity-55" : ""
      }`}
    >
      {children}
    </span>
  );
}
