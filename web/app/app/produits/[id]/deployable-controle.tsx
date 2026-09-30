"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/lib/notifications";

// Sur la fiche produit, la déployabilité se lit dans les deux sens et se
// pose d'un clic : c'est le filet de sécurité de la détection en réunion,
// qui préfère ne rien annoncer plutôt que se tromper. Rendu en toggle
// (switch) pour que la question et sa réponse tiennent en une ligne
// compacte à côté de la répartition des sujets.
export default function DeployableControle({
  projetId,
  initial,
  peutMarquer,
}: {
  projetId: string;
  initial: boolean;
  peutMarquer: boolean;
}) {
  const router = useRouter();
  const { notifier } = useNotifications();
  const [deployable, setDeployable] = useState(initial);
  const [chargement, setChargement] = useState(false);

  async function basculer() {
    const cible = !deployable;
    setChargement(true);
    try {
      const res = await fetch(`/api/projects/${projetId}/deployable`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deployable: cible }),
      });
      const data = await res.json();
      if (!res.ok) {
        notifier({
          ton: "error",
          texte: data.error ?? "Échec du marquage.",
          autoClose: true,
        });
        return;
      }
      setDeployable(data.deployable);
      router.refresh();
    } catch {
      notifier({
        ton: "error",
        texte: "Impossible de joindre le serveur.",
        autoClose: true,
      });
    } finally {
      setChargement(false);
    }
  }

  const desactive = chargement || !peutMarquer;
  return (
    <div className="flex h-full items-center justify-between gap-4 rounded-lg bg-white p-4 shadow-card">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">Déployable</p>
        <p className="mt-0.5 text-xs text-mute">
          {deployable
            ? "Ce produit est annoncé comme livrable."
            : "Ce produit n'est pas annoncé comme livrable."}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={deployable}
        aria-label="Marquer le produit comme déployable"
        onClick={basculer}
        disabled={desactive}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          deployable ? "bg-success" : "bg-hairline"
        } ${desactive ? "opacity-50" : ""} ${
          peutMarquer ? "cursor-pointer" : "cursor-not-allowed"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
            deployable ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
