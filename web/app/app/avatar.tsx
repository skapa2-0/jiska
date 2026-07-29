// Avatar d'utilisateur : photo de profil si renseignée, sinon initiale
// sur fond coloré stable par personne. `taille` = classes h-*/w-*.

export type Personne = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  avatar?: string | null;
};

const AVATAR_COLORS = ["#4b4ee9", "#7c3aed", "#0ea5e9", "#00a87e", "#e61e49"];

export function avatarColor(id: string): string {
  return AVATAR_COLORS[Number(id) % AVATAR_COLORS.length];
}

export function displayName(p: Personne): string {
  const complet = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  return complet || p.email;
}

// Anneau du responsable : bleu Jiska uni, séparé de la photo par un
// liseré blanc.
const ANNEAU_RESPONSABLE = "var(--color-brand)";

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
  const bordure = dore ? "border-2 border-white" : classe;
  const noyau = personne.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element -- data URL locale
    <img
      src={personne.avatar}
      alt=""
      className={`${taille} shrink-0 rounded-full object-cover ${bordure}`}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`${taille} grid shrink-0 place-items-center rounded-full font-semibold text-white ${bordure}`}
      style={{ backgroundColor: avatarColor(personne.id) }}
    >
      {displayName(personne)[0]?.toUpperCase()}
    </span>
  );

  if (!dore) return noyau;
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full p-[2px] ${classe}`}
      style={{ background: ANNEAU_RESPONSABLE }}
    >
      {noyau}
    </span>
  );
}
