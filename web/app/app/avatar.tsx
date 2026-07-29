// Avatar d'utilisateur : photo de profil si renseignée, sinon initiale
// sur fond coloré stable par personne. `taille` = classes h-*/w-*.

export type Personne = {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string | null;
};

const AVATAR_COLORS = ["#4b4ee9", "#7c3aed", "#0ea5e9", "#00a87e", "#e61e49"];

export function avatarColor(id: string): string {
  return AVATAR_COLORS[Number(id) % AVATAR_COLORS.length];
}

export function displayName(p: Personne): string {
  return p.name?.trim() || p.email;
}

// Anneau du responsable : dégradé aux nuances du bleu Jiska, collé au
// contour de la photo (pas d'espace entre l'anneau et l'avatar).
const ANNEAU_RESPONSABLE =
  "conic-gradient(from 220deg, #2f32b8, #4b4ee9, #8b8df3, #4b4ee9, #23269b, #6a6df0, #2f32b8)";

export default function Avatar({
  personne,
  taille = "h-7 w-7 text-[11px]",
  classe = "",
  dore = false,
}: {
  personne: Personne;
  taille?: string;
  classe?: string;
  dore?: boolean;
}) {
  const noyau = personne.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element -- data URL locale
    <img
      src={personne.avatar}
      alt=""
      className={`${taille} shrink-0 rounded-full object-cover ${dore ? "" : classe}`}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`${taille} grid shrink-0 place-items-center rounded-full font-semibold text-white ${dore ? "" : classe}`}
      style={{ backgroundColor: avatarColor(personne.id) }}
    >
      {displayName(personne)[0]?.toUpperCase()}
    </span>
  );

  if (!dore) return noyau;
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full p-[2.5px] ${classe}`}
      style={{ background: ANNEAU_RESPONSABLE }}
    >
      {noyau}
    </span>
  );
}
