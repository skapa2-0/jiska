// Logo d'un projet : image importée si présente, sinon la première
// lettre du nom sur fond neutre.
export default function ProjetLogo({
  name,
  logo,
  taille = "h-8 w-8 text-base",
  classe = "",
}: {
  name: string;
  logo?: string | null;
  taille?: string;
  classe?: string;
}) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- data URL locale
      <img
        src={logo}
        alt=""
        className={`${taille} shrink-0 rounded-lg object-contain ${classe}`}
      />
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
