"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JALONS, JALONS_BUSINESS, JALONS_TECH } from "@/lib/sujets";
import type { Jalon } from "@/lib/sujets";

// Jalons d'avancement du projet, modifiables en direct (dirigeant et
// responsable du projet) : jamais de pourcentage saisi à la main.
export default function JalonsProjet({
  projetId,
  jalonTech,
  jalonBusiness,
  editable,
}: {
  projetId: string;
  jalonTech: number;
  jalonBusiness: number;
  editable: boolean;
}) {
  const router = useRouter();
  const [tech, setTech] = useState(jalonTech);
  const [business, setBusiness] = useState(jalonBusiness);
  const [message, setMessage] = useState("");

  async function changer(champ: "jalonTech" | "jalonBusiness", valeur: Jalon) {
    const avant = { tech, business };
    if (champ === "jalonTech") setTech(valeur);
    else setBusiness(valeur);
    setMessage("");
    try {
      const res = await fetch(`/api/projects/${projetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [champ]: valeur }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setMessage(data?.error ?? "Échec de la mise à jour.");
        setTech(avant.tech);
        setBusiness(avant.business);
        return;
      }
      router.refresh();
    } catch {
      setMessage("Impossible de joindre le serveur.");
      setTech(avant.tech);
      setBusiness(avant.business);
    }
  }

  return (
    <div className="rounded-lg bg-white p-4 shadow-card">
      <div className="grid gap-5 sm:grid-cols-2">
        <Stepper
          titre="Technique · 60 %"
          labels={JALONS_TECH}
          valeur={tech}
          editable={editable}
          onChange={(v) => changer("jalonTech", v)}
        />
        <Stepper
          titre="Business · 40 %"
          labels={JALONS_BUSINESS}
          valeur={business}
          editable={editable}
          onChange={(v) => changer("jalonBusiness", v)}
        />
      </div>
      {message && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {message}
        </p>
      )}
    </div>
  );
}

function Stepper({
  titre,
  labels,
  valeur,
  editable,
  onChange,
}: {
  titre: string;
  labels: Record<Jalon, string>;
  valeur: number;
  editable: boolean;
  onChange: (v: Jalon) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink">{titre}</p>
      <div className="flex gap-1">
        {JALONS.map((j) => (
          <button
            key={j}
            type="button"
            onClick={() => editable && onChange(j)}
            disabled={!editable}
            aria-pressed={valeur === j}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
              valeur === j
                ? "bg-ink text-white"
                : editable
                  ? "bg-surface text-mute hover:bg-hairline/60"
                  : "bg-surface text-stone"
            }`}
          >
            {j}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-stone">{labels[valeur as Jalon]}</p>
    </div>
  );
}
