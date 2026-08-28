// Déployable : un produit annoncé comme livrable en production. L'état est
// affirmé (annonce en réunion validée, ou clic sur la fiche produit), jamais
// déduit de l'avancement : un produit à 100 % n'est pas déployable pour
// autant, et l'inverse est vrai aussi.

// L'état se lit dans les deux sens, partout : sur une grille de produits,
// « non déployable » n'est pas du bruit, c'est la réponse à la question
// qu'on vient poser. Le vert plein signale les produits livrables d'un
// coup d'œil ; l'état négatif reste neutre et cerné, jamais alarmant :
// ne pas être déployable est ordinaire, ce n'est pas une anomalie.
const TONS = {
  oui: "bg-success text-white",
  non: "bg-surface text-mute ring-1 ring-hairline",
};

const TAILLES = {
  sm: { boite: "gap-1.5 rounded-md px-2.5 py-1 text-xs", icone: "h-3.5 w-3.5" },
  md: { boite: "gap-2 rounded-lg px-3.5 py-2 text-sm", icone: "h-4 w-4" },
};

export default function BadgeDeployable({
  deployable,
  taille = "sm",
}: {
  deployable: boolean;
  taille?: keyof typeof TAILLES;
}) {
  const t = TAILLES[taille];
  return (
    <span
      className={`inline-flex shrink-0 items-center font-semibold ${
        deployable ? TONS.oui : TONS.non
      } ${t.boite}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`${t.icone} shrink-0`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Coche pour l'état livrable, cercle barré pour l'état neutre :
            surtout pas de triangle d'alerte, qui ferait lire une panne. */}
        {deployable ? (
          <path d="m5 13 4 4L19 7" />
        ) : (
          <>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M6 18 18 6" />
          </>
        )}
      </svg>
      {deployable ? "Déployable" : "Non déployable"}
    </span>
  );
}
