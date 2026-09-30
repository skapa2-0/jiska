// Logo d'un projet : image importée si présente, sinon la première
// lettre du nom sur fond neutre. Cas particulier « sujet transverse »
// (transverse = true) : petite icône cible / point de mire à la place
// de la lettre, pour ne pas laisser un « S » anonyme là où une tâche
// hors produit apparaît dans une grille de logos (tableau Actions,
// mode réunion…).
export default function ProjetLogo({
  name,
  logo,
  taille = "h-8 w-8 text-base",
  classe = "",
  transverse = false,
  roundedForce,
}: {
  name: string;
  logo?: string | null;
  taille?: string;
  classe?: string;
  transverse?: boolean;
  // Sert au formulaire d'import : l'utilisateur peut tester le rendu
  // sans avoir enregistré. Undefined = comportement automatique (lu
  // depuis l'URL du logo servi).
  roundedForce?: boolean;
}) {
  if (logo) {
    // Marker « &sq=1 » dans l'URL du logo = choix de rendu carré au
    // moment de l'import (lib/media.ts::sqlLogoUrl). Rien = arrondi
    // par défaut. Le prop roundedForce l'override quand on utilise
    // ProjetLogo avec un logo qui n'est pas servi par /api/logos
    // (aperçu du formulaire, data URL locale).
    const carre =
      roundedForce === false ||
      (roundedForce === undefined && /[?&]sq=1(?:&|$)/.test(logo));
    return (
      // eslint-disable-next-line @next/next/no-img-element -- image servie par /api/logos
      <img
        src={logo}
        alt=""
        className={`${taille} shrink-0 object-contain ${carre ? "" : "rounded-lg"} ${classe}`}
      />
    );
  }
  if (transverse) {
    return (
      <span
        aria-hidden="true"
        className={`${taille} grid shrink-0 place-items-center rounded-lg bg-surface text-stone ${classe}`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-[55%] w-[55%]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
        </svg>
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${taille} grid shrink-0 place-items-center rounded-lg bg-surface font-semibold text-ink ${classe}`}
    >
      {name[0]?.toUpperCase()}
    </span>
  );
}
