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

export default function Avatar({
  personne,
  taille = "h-7 w-7 text-[11px]",
  classe = "",
}: {
  personne: Personne;
  taille?: string;
  classe?: string;
}) {
  if (personne.avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- data URL locale
      <img
        src={personne.avatar}
        alt=""
        className={`${taille} shrink-0 rounded-full object-cover ${classe}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${taille} grid shrink-0 place-items-center rounded-full font-semibold text-white ${classe}`}
      style={{ backgroundColor: avatarColor(personne.id) }}
    >
      {displayName(personne)[0]?.toUpperCase()}
    </span>
  );
}
