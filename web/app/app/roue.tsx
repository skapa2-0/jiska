// Anneau d'avancement : l'arc se remplit avec le pourcentage, la
// valeur est inscrite au centre. Partagé entre le tableau des sujets
// et les vues projet.
export default function Roue({
  valeur,
  ton,
  taille = "h-10 w-10",
  texte = "text-[7.5px]",
}: {
  valeur: number;
  ton: string;
  taille?: string;
  texte?: string;
}) {
  const rayon = 15.5;
  const perimetre = 2 * Math.PI * rayon;
  return (
    <svg
      viewBox="0 0 36 36"
      className={`mx-auto ${taille} ${ton}`}
      role="img"
      aria-label={`Avancement ${valeur} %`}
    >
      <circle
        cx="18"
        cy="18"
        r={rayon}
        fill="none"
        stroke="var(--color-surface)"
        strokeWidth="3.5"
      />
      <circle
        cx="18"
        cy="18"
        r={rayon}
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={`${(valeur / 100) * perimetre} ${perimetre}`}
        transform="rotate(-90 18 18)"
      />
      <text
        x="18"
        y="18"
        textAnchor="middle"
        dominantBaseline="central"
        className={`fill-ink font-sans font-bold ${texte}`}
      >
        {valeur}%
      </text>
    </svg>
  );
}

// Couleur selon le niveau d'avancement (seuils partagés).
export function tonAvancement(valeur: number): string {
  return valeur >= 75
    ? "text-success"
    : valeur >= 50
      ? "text-warn"
      : "text-danger";
}
