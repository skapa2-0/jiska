"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BadgeDeployable from "../../deployable";

// Sur la fiche produit, la déployabilité se lit dans les deux sens et se
// pose d'un clic : c'est le filet de sécurité de la détection en réunion,
// qui préfère ne rien annoncer plutôt que se tromper.
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
  const [deployable, setDeployable] = useState(initial);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  async function basculer() {
    const cible = !deployable;
    setChargement(true);
    setErreur("");
    try {
      const res = await fetch(`/api/projects/${projetId}/deployable`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deployable: cible }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErreur(data.error ?? "Échec du marquage.");
        return;
      }
      setDeployable(data.deployable);
      router.refresh();
    } catch {
      setErreur("Impossible de joindre le serveur.");
    } finally {
      setChargement(false);
    }
  }

  if (!peutMarquer) return <BadgeDeployable deployable={deployable} />;

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <BadgeDeployable deployable={deployable} />
      <button
        type="button"
        onClick={basculer}
        disabled={chargement}
        className="rounded-md px-2 py-0.5 text-xs font-semibold text-brand transition hover:bg-brand/5 disabled:opacity-50"
      >
        {chargement
          ? "…"
          : deployable
            ? "Retirer la mention"
            : "Marquer déployable"}
      </button>
      {erreur && (
        <span role="alert" className="text-xs text-danger">
          {erreur}
        </span>
      )}
    </span>
  );
}
