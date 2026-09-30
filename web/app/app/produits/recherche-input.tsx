"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Champ de recherche du portefeuille : l'état vit dans l'URL (`?q=`)
// pour que l'input puisse être rendu à côté des boutons (server-render)
// et lu ailleurs par la grille (ListeProjets) sans partage de state.
// Débounce à 200 ms : évite un push d'URL par frappe.
export default function RechercheInput() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = params.get("q") ?? "";
  const [valeur, setValeur] = useState(initial);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const suivants = new URLSearchParams(params.toString());
      if (valeur) suivants.set("q", valeur);
      else suivants.delete("q");
      const cible = suivants.toString();
      const url = cible ? `${pathname}?${cible}` : pathname;
      router.replace(url, { scroll: false });
    }, 200);
    return () => window.clearTimeout(id);
    // On dépend seulement de la valeur : les autres ne changent pas ici.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur]);

  return (
    <input
      type="search"
      placeholder="Rechercher un produit…"
      aria-label="Rechercher un produit"
      value={valeur}
      onChange={(e) => setValeur(e.target.value)}
      className="w-full rounded-lg border border-hairline bg-white px-4 py-2 text-sm text-ink placeholder-stone outline-none transition focus:ring-2 focus:ring-brand sm:w-64"
    />
  );
}
