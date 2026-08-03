// Barre de navigation basse, téléphone uniquement : les vues à portée
// de pouce (Sujets, Projets, Profil) et la création de sujet au centre.
export type OngletBas = "sujets" | "projets" | "profil";

export default function BottomNav({
  onglet,
  canCreate,
}: {
  onglet?: OngletBas;
  canCreate: boolean;
}) {
  return (
    <nav
      aria-label="Navigation principale"
      className="sticky bottom-0 z-20 border-t border-hairline bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="flex items-stretch justify-around">
        <Item actif={onglet === "sujets"} href="/app" label="Sujets">
          <path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />
        </Item>
        <Item actif={onglet === "projets"} href="/app/projets" label="Projets">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
        </Item>
        {canCreate && (
          <a
            href="/app?sujet=nouveau"
            aria-label="Nouveau sujet"
            className="flex flex-col items-center justify-center px-4 py-1.5"
          >
            <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-white shadow-card">
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M8 3v10M3 8h10" />
              </svg>
            </span>
          </a>
        )}
        <Item actif={onglet === "profil"} href="/app/profil" label="Profil">
          <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />
        </Item>
      </div>
    </nav>
  );
}

function Item({
  actif,
  href,
  label,
  children,
}: {
  actif: boolean;
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-current={actif ? "page" : undefined}
      className={`flex flex-1 flex-col items-center gap-0.5 px-2 pb-1.5 pt-2 text-[11px] font-medium transition ${
        actif ? "text-brand" : "text-stone hover:text-ink"
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
      {label}
    </a>
  );
}
