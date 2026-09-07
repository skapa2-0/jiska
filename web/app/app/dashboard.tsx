"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CRITICITES, ETATS, TYPES_SUJET } from "@/lib/sujets";
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
  avancement: number;
  poidsTech: number;
  poidsBusiness: number;
  canManage: boolean;
  members: Personne[];
};

type Indicateurs = {
  projets: number;
  ouverts: number;
  avancement: number;
  bloques: number;
  echeances: number;
  retard: number;
  clotures: number;
  // Avancement des actions engagées cette semaine (lib/semaine.ts).
  // 0 engagement n'est pas 0 % : l'indicateur le dit autrement.
  semEngages: number;
  semAvancement: number;
};

const FILTRES = [
  { key: "tous", label: "Tous les sujets" },
  { key: "miens", label: "Mes sujets" },
  { key: "bloques", label: "Bloqués" },
  { key: "semaine", label: "Cette semaine" },
  { key: "retard", label: "En retard" },
  { key: "neuf", label: "Du neuf (7 j)" },
] as const;
type FiltreKey = (typeof FILTRES)[number]["key"];

// Tri par clic sur les en-têtes de colonnes.
type TriCol =
  | "projet"
  | "etat"
  | "sujet"
  | "type"
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
  dirigeant,
  sujets,
  projects,
  indicateurs,
}: {
  meId: string;
  // Seul un dirigeant crée un sujet hors produit (lib/sujets-write.ts).
  dirigeant: boolean;
  sujets: SujetRow[];
  projects: ProjectOption[];
  indicateurs: Indicateurs;
}) {
  const router = useRouter();
  const [filtre, setFiltre] = useState<FiltreKey>("tous");
  // Aperçu unique du glissement gauche (découvrabilité du geste).
  const [apercuId, setApercuId] = useState<string | null>(null);
  const [projetId, setProjetId] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [recherche, setRecherche] = useState("");
  const [modal, setModal] = useState<
    | { mode: "create"; transverse?: boolean }
    | { mode: "edit"; sujet: SujetRow }
    | null
  >(null);
  const [fiche, setFiche] = useState<SujetRow | null>(null);
  const [tri, setTri] = useState<Tri | null>(null);
  const zoneRef = useRef<HTMLElement>(null);
  // 11 lignes remplissent exactement la zone visible ; au-delà, on scrolle.
  const [hauteurLigne, setHauteurLigne] = useState(60);
  // Tirer vers le bas pour rafraîchir (liste mobile).
  const [tirage, setTirage] = useState(0);
  const [actualise, setActualise] = useState(false);
  const tirageDepart = useRef<number | null>(null);

  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    function calc() {
      if (!zone) return;
      const entete = zone.querySelector("thead")?.getBoundingClientRect().height ?? 38;
      setHauteurLigne(Math.max(44, (zone.clientHeight - entete) / 11));
    }
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(zone);
    return () => ro.disconnect();
  }, []);

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
    // ?sujet=nouveau ouvre la création ; &transverse=1 la préoriente
    // hors produit (bouton de la section « Sujets transverses »).
    if (params.get("sujet") === "nouveau") {
      setModal({ mode: "create", transverse: params.get("transverse") === "1" });
    }
    const projet = params.get("projet");
    if (projet) setProjetId(projet);
    // Dernier filtre choisi, restauré d'une visite à l'autre ; un
    // ?filtre= explicite (tuiles de l'accueil) prend le dessus.
    const memorise = window.localStorage.getItem("jiska-filtre");
    if (memorise && FILTRES.some((f) => f.key === memorise)) {
      setFiltre(memorise as FiltreKey);
    }
    // En arrivant sur un produit précis, on repart de « tous » pour
    // ne rien masquer.
    if (projet) setFiltre("tous");
    const demande = params.get("filtre");
    if (demande && FILTRES.some((f) => f.key === demande)) {
      setFiltre(demande as FiltreKey);
    }
    if (params.get("sujet") || projet || demande) {
      window.history.replaceState(null, "", "/app/actions");
    }
  }, []);

  function choisirFiltre(k: FiltreKey) {
    setFiltre(k);
    window.localStorage.setItem("jiska-filtre", k);
  }

  // À la première visite mobile, entrouvre les actions de la première
  // carte éditable pour révéler le geste de glissement.
  useEffect(() => {
    if (window.innerWidth >= 768) return;
    if (window.localStorage.getItem("jiska-apercu-glisse")) return;
    const premier = sujets.find((s) => s.can_edit && s.etat !== "termine");
    if (!premier) return;
    window.localStorage.setItem("jiska-apercu-glisse", "1");
    const t = window.setTimeout(() => setApercuId(premier.id), 600);
    // L'aperçu ne joue qu'une fois : on efface l'état après coup pour
    // qu'un re-rendu de la carte ne le rejoue pas.
    const fin = window.setTimeout(() => setApercuId(null), 2400);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(fin);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bornes temporelles calculées une fois par rendu.
  const { today, weekStart, weekEnd, depuis7j } = useMemo(() => {
    const now = new Date();
    const day = (now.getDay() + 6) % 7; // lundi = 0
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const ilYA7j = new Date(now);
    ilYA7j.setDate(now.getDate() - 7);
    return {
      today: isoDate(now),
      weekStart: isoDate(start),
      weekEnd: isoDate(end),
      depuis7j: isoDate(ilYA7j),
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

  // Toutes les personnes visibles, tous produits confondus : c'est le
  // vivier des porteurs d'un sujet transverse, qui n'a pas d'équipe.
  const tousMembres = useMemo(() => {
    const m = new Map<string, Personne>();
    for (const p of projects) for (const u of p.members) m.set(u.id, u);
    return m;
  }, [projects]);

  const visibles = sujets.filter((s) => {
    if (filtre === "miens" && s.porteur_id !== meId) return false;
    if (filtre === "neuf" && s.updated_at < depuis7j) return false;
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
      projetDe.get(s.project_id ?? "")?.responsableId !== responsableId
    )
      return false;
    if (recherche) {
      const projet = projetDe.get(s.project_id ?? "");
      const responsable = projet?.members.find(
        (m) => m.id === projet?.responsableId,
      );
      const hay =
        `${s.title} ${s.project_name} ${responsable ? displayName(responsable) : ""} ${s.action} ${s.commentaire}`.toLowerCase();
      if (!hay.includes(recherche.toLowerCase())) return false;
    }
    return true;
  });

  // Un sujet transverse n'a pas d'équipe produit où chercher son
  // porteur : on le retrouve parmi les membres de tous les produits
  // visibles.
  function porteurDe(s: SujetRow): Personne | undefined {
    if (!s.porteur_id) return undefined;
    if (s.project_id === null) return tousMembres.get(s.porteur_id);
    return projetDe
      .get(s.project_id)
      ?.members.find((m) => m.id === s.porteur_id);
  }

  // Tri actif appliqué après filtrage ; les valeurs vides vont en fin.
  // Sans tri choisi : ordre réunion (terminés en bas, retards en tête,
  // puis échéance croissante).
  let lignes = visibles;
  if (!tri) {
    lignes = [...visibles].sort((a, b) => {
      const ta = a.etat === "termine";
      const tb = b.etat === "termine";
      if (ta !== tb) return ta ? 1 : -1;
      const ra = !ta && !!a.due_date && a.due_date < today;
      const rb = !tb && !!b.due_date && b.due_date < today;
      if (ra !== rb) return ra ? -1 : 1;
      if (a.due_date !== b.due_date) {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }
      return a.project_name.localeCompare(b.project_name, "fr");
    });
  }
  if (tri) {
    const cle = (s: SujetRow): string | number | null => {
      switch (tri.col) {
        case "projet":
          return s.project_name.toLowerCase();
        case "etat":
          return ETAT_ORDRE[s.etat];
        case "sujet":
          return s.title.toLowerCase();
        case "type":
          return (s.type === "technique" ? 0 : 1000) + (100 - s.poids);
        case "equipe": {
          const p = porteurDe(s);
          return p ? displayName(p).toLowerCase() : null;
        }
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

  // Tirer la liste vers le bas depuis le haut pour recharger les
  // données (mobile uniquement).
  function onZoneTouchStart(e: React.TouchEvent) {
    if (window.innerWidth >= 768) return;
    if ((zoneRef.current?.scrollTop ?? 1) > 0) return;
    tirageDepart.current = e.touches[0].clientY;
  }
  function onZoneTouchMove(e: React.TouchEvent) {
    if (tirageDepart.current === null) return;
    const delta = e.touches[0].clientY - tirageDepart.current;
    setTirage(delta > 0 ? Math.min(90, delta * 0.45) : 0);
  }
  function onZoneTouchEnd() {
    const assez = tirage > 55;
    tirageDepart.current = null;
    setTirage(0);
    if (assez) {
      setActualise(true);
      router.refresh();
      window.setTimeout(() => setActualise(false), 900);
    }
  }

  // Mise à jour rapide depuis un glissement de carte (mobile).
  async function changerEtat(s: SujetRow, etat: string) {
    await fetch(`/api/sujets/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ etat }),
    }).catch(() => null);
    router.refresh();
  }

  // Liste mobile : sections dans l'ordre réunion, en-têtes collants.
  const groupes = [
    { titre: "En retard", items: [] as SujetRow[] },
    { titre: "Cette semaine", items: [] as SujetRow[] },
    { titre: "À venir", items: [] as SujetRow[] },
    { titre: "Terminés", items: [] as SujetRow[] },
  ];
  for (const s of lignes) {
    const i =
      s.etat === "termine"
        ? 3
        : s.due_date && s.due_date < today
          ? 0
          : s.due_date && s.due_date <= weekEnd
            ? 1
            : 2;
    groupes[i].items.push(s);
  }

  return (
    <main className="flex min-h-0 w-full flex-1 flex-col gap-3 px-4 py-3 lg:px-6">
      {/* Bandeau supérieur : vision immédiate de l'activité (PRD §4A).
          Sur téléphone il défile horizontalement pour ne pas manger la
          hauteur ; en grille à partir de sm. */}
      <section
        aria-label="Indicateurs"
        className="-m-1 flex gap-2.5 overflow-x-auto p-1 [scrollbar-width:none] sm:m-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:p-0 lg:grid-cols-7"
      >
        {/* Sur mobile, l'ordre remet les alertes en tête de carrousel :
            bloqués et retards d'abord, le reste ensuite. */}
        <Indicateur
          valeur={indicateurs.bloques}
          label="Sujets bloqués"
          tint="bg-danger-soft text-danger"
          icone={<IconeAlerte />}
          ton={indicateurs.bloques > 0 ? "text-danger" : "text-success"}
          onClick={() => choisirFiltre("bloques")}
          classe="order-1 sm:order-4"
        />
        <Indicateur
          valeur={indicateurs.retard}
          label="En retard"
          tint="bg-danger-soft text-danger"
          icone={<IconeHorloge />}
          ton={indicateurs.retard > 0 ? "text-danger" : "text-success"}
          onClick={() => choisirFiltre("retard")}
          classe="order-2 sm:order-6"
        />
        <Indicateur
          valeur={indicateurs.echeances}
          label="Échéances semaine"
          tint="bg-warn-soft text-warn"
          icone={<IconeCalendrier />}
          onClick={() => choisirFiltre("semaine")}
          classe="order-3 sm:order-5"
        />
        <Indicateur
          valeur={indicateurs.ouverts}
          label="Sujets ouverts"
          tint="bg-purple-50 text-purple-600"
          icone={<IconeListe />}
          onClick={() => choisirFiltre("tous")}
          classe="order-4 sm:order-2"
        />
        <Indicateur
          valeur={
            indicateurs.semEngages === 0
              ? "-"
              : `${indicateurs.semAvancement} %`
          }
          label={
            indicateurs.semEngages === 0
              ? "Rien d'engagé cette semaine"
              : `Semaine · ${indicateurs.semEngages} action${indicateurs.semEngages > 1 ? "s" : ""}`
          }
          tint="bg-brand/10 text-brand"
          icone={<IconeTendance />}
          ton={
            indicateurs.semEngages === 0
              ? undefined
              : indicateurs.semAvancement >= 75
                ? "text-success"
                : indicateurs.semAvancement >= 40
                  ? "text-warn"
                  : "text-ink"
          }
          classe="order-3 sm:order-4"
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
          classe="order-5 sm:order-3"
        />
        <Indicateur
          valeur={indicateurs.projets}
          label="Produits actifs"
          tint="bg-brand/10 text-brand"
          icone={<IconeDossier />}
          classe="order-6 sm:order-1"
        />
        <Indicateur
          valeur={indicateurs.clotures}
          label="Clôturés sur 7 jours"
          tint="bg-success-soft text-success"
          icone={<IconeCoche />}
          ton={indicateurs.clotures > 0 ? "text-success" : undefined}
          onClick={() => choisirFiltre("neuf")}
          classe="order-7 sm:order-7"
        />
      </section>

      {/* Filtres volontairement limités (PRD §10) + recherche. Sur
          téléphone : une rangée défilante de pilules, recherche en
          dessous ; à partir de md tout revient sur une ligne. */}
      <section
        aria-label="Filtres"
        className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center"
      >
        {/* Seules les pilules défilent : les Select doivent rester hors
            de tout conteneur overflow, sinon leur panneau est rogné. */}
        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] md:contents">
          {FILTRES.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => choisirFiltre(f.key)}
              className={`shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
                filtre === f.key
                  ? "bg-ink text-white"
                  : "border border-hairline text-mute hover:bg-surface"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 md:contents">
          <Select
            ariaLabel="Filtrer par produit"
            placeholder="Par produit"
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
        </div>
        <input
          type="search"
          placeholder="Rechercher un sujet, produit, responsable…"
          aria-label="Rechercher"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="w-full rounded-lg border border-hairline bg-white px-4 py-2 text-sm text-ink placeholder-stone outline-none transition focus:ring-2 focus:ring-brand md:ml-auto md:w-72"
        />
      </section>

      {/* Tableau principal : une ligne = un sujet (PRD §4B). Il occupe
          tout l'espace restant et scrolle en interne : la page, elle,
          tient dans le viewport. Sur téléphone le tableau laisse place
          à une liste de cartes, une carte = un sujet. */}
      <section
        ref={zoneRef}
        onTouchStart={onZoneTouchStart}
        onTouchMove={onZoneTouchMove}
        onTouchEnd={onZoneTouchEnd}
        className="min-h-0 flex-1 overflow-auto overscroll-contain rounded-lg bg-white shadow-card"
      >
        {/* Indicateur de rafraîchissement, révélé par le tirage. */}
        <div
          aria-hidden={!actualise && tirage === 0}
          style={{
            height: actualise ? 40 : tirage,
            transition: tirageDepart.current ? "none" : "height 200ms",
          }}
          className="flex items-center justify-center overflow-hidden text-stone md:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-5 w-5 ${actualise ? "animate-spin" : ""}`}
            style={
              actualise
                ? undefined
                : { transform: `rotate(${tirage * 3}deg)` }
            }
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-3-6.7M21 3v5h-5" />
          </svg>
        </div>
        <ul className="md:hidden">
          {visibles.length === 0 && (
            <li className="px-4 py-16 text-center text-sm text-stone">
              {sujets.length === 0
                ? "Aucun sujet pour l'instant. Créez le premier avec « Nouveau sujet »."
                : "Aucun sujet ne correspond aux filtres."}
            </li>
          )}
          {groupes.map(
            (g) =>
              g.items.length > 0 && (
                <Fragment key={g.titre}>
                  <li className="sticky top-0 z-10 border-b border-hairline bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-stone">
                    {g.titre}
                    <span className="ml-1.5 font-medium normal-case tracking-normal">
                      {g.items.length}
                    </span>
                  </li>
                  {g.items.map((s) => (
                    <CarteSujet
                      key={s.id}
                      sujet={s}
                      porteur={porteurDe(s)}
                      today={today}
                      apercu={s.id === apercuId}
                      onOuvrir={() => setFiche(s)}
                      onEtat={(etat) => changerEtat(s, etat)}
                    />
                  ))}
                </Fragment>
              ),
          )}
        </ul>
        <table className="hidden w-full min-w-[1250px] table-fixed border-collapse text-left text-sm md:table">
          {/* Largeurs figées (table-fixed) : Projet/Sujet/Action se
              partagent l'espace restant, le reste est en pixels. */}
          <colgroup>
            <col />
            <col style={{ width: 110 }} />
            <col />
            <col style={{ width: 120 }} />
            <col style={{ width: 130 }} />
            <col />
            <col style={{ width: 115 }} />
            <col style={{ width: 115 }} />
            <col style={{ width: 110 }} />
          </colgroup>
          <thead>
            <tr className="divide-x divide-hairline text-xs text-ink">
              <Th col="projet" tri={tri} onTri={basculerTri}>
                Produit
              </Th>
              <Th centre col="etat" tri={tri} onTri={basculerTri}>
                État
              </Th>
              <Th col="sujet" tri={tri} onTri={basculerTri}>
                Sujet
              </Th>
              <Th centre col="type" tri={tri} onTri={basculerTri}>
                Type · Poids
              </Th>
              <Th col="equipe" tri={tri} onTri={basculerTri}>
                Porteur
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
                <td colSpan={9} className="px-4 py-16 text-center text-stone">
                  {sujets.length === 0
                    ? "Aucun sujet pour l'instant. Créez le premier avec « Nouveau sujet »."
                    : "Aucun sujet ne correspond aux filtres."}
                </td>
              </tr>
            )}
            {lignes.map((s) => {
              const retard = s.due_date && s.due_date < today && s.etat !== "termine";
              return (
                <tr
                  key={s.id}
                  onClick={() => setFiche(s)}
                  style={{ height: hauteurLigne }}
                  className="divide-x divide-hairline border-b border-hairline last:border-b-0 cursor-pointer transition hover:bg-surface"
                >
                  <td className="px-4 py-2 align-middle">
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
                  <td className="px-2 py-2 align-middle">
                    <span className="flex items-center justify-center">
                      <Chip classe={ETATS[s.etat].chip}>
                        {ETATS[s.etat].label}
                      </Chip>
                    </span>
                  </td>
                  <td className="max-w-56 px-4 py-2 align-middle font-medium text-ink">
                    <span className="line-clamp-2">{s.title}</span>
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <span className="flex items-center justify-center">
                      <Chip classe={TYPES_SUJET[s.type].chip}>
                        {TYPES_SUJET[s.type].court} · {s.poids} %
                      </Chip>
                    </span>
                  </td>
                  <td className="px-4 py-2 align-middle">
                    {(() => {
                      const porteur = porteurDe(s);
                      if (!porteur)
                        return <span className="text-stone">-</span>;
                      return (
                        <span className="flex items-center gap-2">
                          <Avatar
                            personne={porteur}
                            taille="h-7 w-7 text-[11px]"
                          />
                          <span className="min-w-0 truncate text-mute">
                            {displayName(porteur)}
                          </span>
                        </span>
                      );
                    })()}
                  </td>
                  <td className="max-w-52 px-4 py-2 align-middle text-mute">
                    <span className="line-clamp-2">{s.action}</span>
                  </td>
                  <td
                    className={`whitespace-nowrap px-2 py-2 align-middle ${
                      retard ? "font-medium text-danger" : "text-ink"
                    }`}
                  >
                    <span className="flex items-center justify-center">
                      {s.due_date
                        ? s.due_date.split("-").reverse().join("/")
                        : "-"}
                    </span>
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <span className="flex items-center justify-center">
                      <Chip classe={CRITICITES[s.criticite].chip}>
                        {CRITICITES[s.criticite].label}
                      </Chip>
                    </span>
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <span className="flex items-center justify-center">
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
                    </span>
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
        <span className="hidden text-stone sm:inline">
          Cliquez sur une ligne pour ouvrir sa fiche
        </span>
        <span className="ml-auto hidden flex-wrap items-center gap-x-4 gap-y-1.5 lg:flex">
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
        />
      )}

      {modal && (
        <SujetModal
          peutTransverse={dirigeant}
          transverseParDefaut={
            modal.mode === "create" && modal.transverse === true
          }
          mode={modal.mode}
          sujet={modal.mode === "edit" ? modal.sujet : undefined}
          projects={projects}
          onClose={closeModal}
        />
      )}
    </main>
  );
}

// Largeur des actions révélées par le glissement d'une carte.
const LARGEUR_ACTIONS = 148;

// Carte d'un sujet dans la liste mobile : tap pour ouvrir la fiche,
// glissement vers la gauche pour les actions rapides (si éditable).
function CarteSujet({
  sujet: s,
  porteur,
  today,
  apercu = false,
  onOuvrir,
  onEtat,
}: {
  sujet: SujetRow;
  porteur?: Personne;
  today: string;
  apercu?: boolean;
  onOuvrir: () => void;
  onEtat: (etat: string) => void;
}) {
  const [dx, setDx] = useState(0);
  const [ouvert, setOuvert] = useState(false);
  const depart = useRef<{ x: number; y: number } | null>(null);
  const aGlisse = useRef(false);

  // Démonstration du geste : les actions s'entrouvrent puis se
  // referment, une seule fois, à la première visite.
  useEffect(() => {
    if (!apercu) return;
    setDx(-LARGEUR_ACTIONS + 40);
    const t = window.setTimeout(() => setDx(0), 1100);
    return () => window.clearTimeout(t);
  }, [apercu]);

  function onTouchStart(e: React.TouchEvent) {
    if (!s.can_edit) return;
    depart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!depart.current) return;
    const ex = e.touches[0].clientX - depart.current.x;
    const ey = e.touches[0].clientY - depart.current.y;
    // On ne suit le doigt que si le geste est franchement horizontal.
    if (Math.abs(ex) < 8 || Math.abs(ex) < Math.abs(ey) * 1.2) return;
    aGlisse.current = true;
    const base = ouvert ? -LARGEUR_ACTIONS : 0;
    setDx(Math.max(-LARGEUR_ACTIONS, Math.min(0, base + ex)));
  }
  function onTouchEnd() {
    depart.current = null;
    const ouvrir = dx < -LARGEUR_ACTIONS / 2;
    setOuvert(ouvrir);
    setDx(ouvrir ? -LARGEUR_ACTIONS : 0);
  }

  function agir(etat: string) {
    setOuvert(false);
    setDx(0);
    onEtat(etat);
  }

  const retard = s.due_date && s.due_date < today && s.etat !== "termine";
  return (
    <li className="relative overflow-hidden border-b border-hairline [touch-action:pan-y] last:border-b-0">
      {/* Actions derrière la carte, révélées par le glissement. */}
      {s.can_edit && (
        <span className="absolute inset-y-0 right-0 flex" aria-hidden={!ouvert}>
          <button
            type="button"
            tabIndex={ouvert ? 0 : -1}
            onClick={() =>
              agir(s.etat === "termine" ? "en_cours" : "termine")
            }
            className="w-[74px] bg-success text-xs font-semibold text-white"
          >
            {s.etat === "termine" ? "Rouvrir" : "Terminer"}
          </button>
          <button
            type="button"
            tabIndex={ouvert ? 0 : -1}
            onClick={() => agir(s.etat === "bloque" ? "en_cours" : "bloque")}
            className="w-[74px] bg-danger text-xs font-semibold text-white"
          >
            {s.etat === "bloque" ? "Débloquer" : "Bloquer"}
          </button>
        </span>
      )}
      <button
        type="button"
        onClick={() => {
          if (aGlisse.current) {
            aGlisse.current = false;
            return;
          }
          if (ouvert) {
            setOuvert(false);
            setDx(0);
          } else onOuvrir();
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${dx}px)`,
          transition: depart.current ? "none" : "transform 250ms",
        }}
        className="relative w-full bg-white px-4 py-2.5 text-left transition active:bg-surface"
      >
        <span className="flex items-center gap-2.5">
          <ProjetLogo
            name={s.project_name}
            logo={s.project_logo}
            taille="h-7 w-7 text-sm"
          />
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-stone">
            {s.project_name}
          </span>
          <Chip classe={ETATS[s.etat].chip}>{ETATS[s.etat].label}</Chip>
        </span>
        <span className="mt-2 block text-sm font-semibold leading-snug text-ink">
          {s.title}
        </span>
        {s.action && (
          <span className="mt-1 line-clamp-1 block text-[13px] leading-snug text-mute">
            {s.action}
          </span>
        )}
        <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <Chip classe={TYPES_SUJET[s.type].chip}>
            {TYPES_SUJET[s.type].court} · {s.poids} %
          </Chip>
          <Chip classe={CRITICITES[s.criticite].chip}>
            {CRITICITES[s.criticite].label}
          </Chip>
          <span
            className={`text-xs font-medium ${
              retard ? "text-danger" : "text-mute"
            }`}
          >
            {s.due_date
              ? s.due_date.split("-").reverse().join("/")
              : "Sans échéance"}
          </span>
          {retard && (
            <span className="rounded bg-danger-soft px-1.5 py-0.5 text-[10px] font-semibold text-danger">
              +
              {Math.round(
                (Date.parse(today) - Date.parse(s.due_date as string)) /
                  86400000,
              )}{" "}
              j
            </span>
          )}
          {s.commentaire && (
            <IconeCommentaire className="h-4 w-4 text-stone" />
          )}
          {porteur && (
            <span className="ml-auto flex items-center gap-1.5">
              <Avatar personne={porteur} taille="h-5 w-5 text-[9px]" />
              <span className="max-w-28 truncate text-xs text-mute">
                {displayName(porteur)}
              </span>
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

function Indicateur({
  valeur,
  label,
  ton,
  tint,
  icone,
  onClick,
  classe = "",
}: {
  valeur: number | string;
  label: string;
  ton?: string;
  tint: string;
  icone: React.ReactNode;
  onClick?: () => void;
  classe?: string;
}) {
  const Balise = onClick ? "button" : "div";
  return (
    <Balise
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex min-w-36 shrink-0 items-center gap-2.5 rounded-lg bg-white px-3 py-2 text-left shadow-card sm:min-w-0 sm:py-2.5 ${classe} ${
        onClick ? "transition hover:-translate-y-0.5 cursor-pointer" : ""
      }`}
    >
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
    </Balise>
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
function IconeHorloge() {
  return <Icone d="M12 7v5l3.5 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />;
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

