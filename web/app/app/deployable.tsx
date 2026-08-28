// Déployable : un produit annoncé comme livrable en production. L'état est
// affirmé (annonce en réunion validée, ou clic sur la fiche produit), jamais
// déduit de l'avancement : un produit à 100 % n'est pas déployable pour
// autant, et l'inverse est vrai aussi.

// Sur une grille de produits, seul l'état positif porte une information :
// afficher « non déployable » partout ferait un mur de mentions inutiles.
// La fiche du produit, elle, répond explicitement dans les deux sens.
export default function BadgeDeployable({
  deployable,
  taille = "text-xs",
}: {
  deployable: boolean;
  taille?: string;
}) {
  const ton = deployable
    ? "bg-success-soft text-success"
    : "bg-surface text-stone";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 font-semibold ${ton} ${taille}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {deployable ? (
          <path d="m5 13 4 4L19 7" />
        ) : (
          <path d="M12 8v5m0 3.5v.5M12 3l9 16H3l9-16Z" />
        )}
      </svg>
      {deployable ? "Déployable" : "Non déployable"}
    </span>
  );
}
