// Habillage des composants Clerk aux jetons de la plateforme (globals.css).
// Règle UI du projet : aucun contrôle au style natif d'un tiers ; les
// écrans de connexion doivent ressembler au reste de Jiska.
export const apparenceClerk = {
  variables: {
    colorPrimary: "#4b4ee9",
    colorText: "#191c1f",
    colorTextSecondary: "#66707a",
    colorBackground: "#ffffff",
    colorInputBackground: "#f2f2f5",
    colorDanger: "#e23b4a",
    colorSuccess: "#00a87e",
    colorWarning: "#ec7e00",
    borderRadius: "0.5rem",
  },
  elements: {
    card: "shadow-card border-0",
    formButtonPrimary:
      "bg-ink text-white hover:opacity-85 text-sm font-semibold normal-case",
    footerActionLink: "text-brand hover:text-brand-deep",
  },
} as const;
