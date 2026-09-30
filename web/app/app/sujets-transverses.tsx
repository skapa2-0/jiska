import { CRITICITES, ETATS, NOM_TRANSVERSES, TYPES_SUJET } from "@/lib/sujets";
import type { TypeSujet } from "@/lib/sujets";
import Avatar, { displayName } from "./avatar";
import type { Personne } from "./avatar";

// Sujets transverses : tâches et missions qui ne relèvent d'aucun produit.
// Elles vivent sous la grille des produits, dans leur propre section, et
// ne pèsent sur l'avancement d'aucun axe (lib/db.ts).

export type SujetTransverse = {
  id: string;
  titre: string;
  action: string;
  echeance: string | null;
  type: TypeSujet;
  etat: string;
  criticite: string;
  porteur: Personne | null;
};

const jolieDate = (v: string) => v.split("-").reverse().join("/");

// Structure de colonnes commune au header et aux lignes : garantit
// l'alignement sans passer par une <table> (chaque ligne est un <a>).
const COLS =
  "grid-cols-[minmax(0,1fr)_96px_112px_112px_96px_80px]";

export default function SujetsTransverses({
  sujets,
  peutCreer,
  today,
}: {
  sujets: SujetTransverse[];
  peutCreer: boolean;
  today: string;
}) {
  // Section toujours présente quand on peut en créer : une section vide
  // qui explique ce qu'elle attend vaut mieux qu'une section absente
  // qu'on ne découvre jamais.
  if (sujets.length === 0 && !peutCreer) return null;

  return (
    <section className="mb-7 last:mb-0">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="flex items-baseline gap-2 text-sm font-semibold uppercase tracking-wide text-stone">
          {NOM_TRANSVERSES}
          {sujets.length > 0 && (
            <span className="font-medium normal-case tracking-normal">
              {sujets.length}
            </span>
          )}
        </h2>
        <p className="text-xs text-stone">
          Tâches et missions qui ne relèvent d&apos;aucun produit
        </p>
        {peutCreer && (
          <a
            href="/app/actions?sujet=nouveau&transverse=1"
            className="ml-auto rounded-lg border border-hairline bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-surface"
          >
            Nouveau sujet transverse
          </a>
        )}
      </div>

      {sujets.length === 0 ? (
        <p className="rounded-lg bg-surface px-5 py-4 text-sm text-stone">
          Aucun sujet transverse pour l&apos;instant. Les tâches qui ne se
          rattachent à aucun produit se rangent ici, à la main ou depuis une
          réunion.
        </p>
      ) : (
        // Cap à ~5 lignes visibles (h-14 par ligne + header ~40 px ≈ 320
        // px). Au-delà, scroll interne, la mosaïque des produits au-dessus
        // n'est pas repoussée vers le bas à mesure que les transverses
        // grossissent. overflow-auto gère le scroll x (mobile) et y (>5
        // items) sur le même conteneur, header sticky pour rester en
        // place pendant le défilement.
        <div className="max-h-80 overflow-auto rounded-lg bg-white shadow-card">
          <div className="min-w-[640px]">
            <div
              className={`sticky top-0 z-10 grid ${COLS} gap-3 border-b border-hairline bg-white px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-stone`}
            >
              <span>Sujet</span>
              <span className="text-center">Type</span>
              <span className="text-center">Criticité</span>
              <span className="text-center">État</span>
              <span className="text-center">Échéance</span>
              <span className="text-center">Porteur</span>
            </div>
            <ul className="divide-y divide-hairline">
              {sujets.map((s) => (
                <LigneTransverse key={s.id} sujet={s} today={today} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function LigneTransverse({
  sujet: s,
  today,
}: {
  sujet: SujetTransverse;
  today: string;
}) {
  const etatMeta = ETATS[s.etat as keyof typeof ETATS];
  const critMeta = CRITICITES[s.criticite as keyof typeof CRITICITES];
  const typeMeta = TYPES_SUJET[s.type];
  const retard = !!s.echeance && s.echeance < today && s.etat !== "termine";
  const critHaute = s.criticite === "critique" || s.criticite === "haute";

  return (
    <li>
      <a
        href={`/app/actions?sujet=${s.id}`}
        className={`grid ${COLS} items-center gap-3 px-4 py-0 transition hover:bg-surface`}
      >
        <div className="flex h-14 items-center">
          <span className="truncate text-sm font-semibold leading-tight text-ink">
            {s.titre}
          </span>
        </div>
        <div className="flex h-14 items-center justify-center">
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold leading-tight ${typeMeta.chip}`}
          >
            {typeMeta.court}
          </span>
        </div>
        <div className="flex h-14 items-center justify-center">
          {critHaute && critMeta ? (
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold leading-tight ${critMeta.chip}`}
            >
              {critMeta.label}
            </span>
          ) : (
            <span className="text-xs leading-tight text-stone">
              {critMeta?.label ?? "-"}
            </span>
          )}
        </div>
        <div className="flex h-14 items-center justify-center">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold leading-tight ${etatMeta?.chip ?? "bg-surface text-mute"}`}
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${etatMeta?.dot ?? "bg-stone"}`}
            />
            {etatMeta?.label ?? s.etat}
          </span>
        </div>
        <div
          className={`flex h-14 items-center justify-center whitespace-nowrap text-xs leading-tight ${
            retard ? "font-semibold text-danger" : "text-mute"
          }`}
        >
          {s.echeance ? jolieDate(s.echeance) : "-"}
        </div>
        <div className="flex h-14 items-center justify-center">
          {s.porteur ? (
            <span
              className="inline-flex"
              title={displayName(s.porteur)}
              aria-label={displayName(s.porteur)}
            >
              <Avatar personne={s.porteur} taille="h-7 w-7 text-[10px]" />
            </span>
          ) : (
            <span className="text-xs text-stone">-</span>
          )}
        </div>
      </a>
    </li>
  );
}
