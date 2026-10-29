"use client";

import { useState } from "react";
import Avatar from "../../app/avatar";
import { libelleRole } from "@/lib/roles";
import type { Role } from "@/lib/roles";

// Page de consentement : qui demande, qui je suis, quels droits sont
// accordés, puis « Autoriser » / « Refuser ». Deux boutons distincts,
// chacun poste un formulaire différent vers /oauth/authorize/decision :
// le serveur signe le code (ou renvoie error=access_denied) et redirige
// vers la redirect_uri.

type Props = {
  clientName: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope: string;
  state: string;
  utilisateur: {
    prenom: string;
    nom: string;
    email: string;
    role: Role;
  };
};

export default function ConsentForm(props: Props) {
  const [envoi, setEnvoi] = useState<"accepter" | "refuser" | null>(null);

  function soumettre(decision: "accepter" | "refuser") {
    setEnvoi(decision);
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/oauth/authorize/decision";
    const champs: Record<string, string> = {
      decision,
      client_id: props.clientId,
      redirect_uri: props.redirectUri,
      code_challenge: props.codeChallenge,
      code_challenge_method: props.codeChallengeMethod,
      scope: props.scope,
      state: props.state,
    };
    for (const [cle, valeur] of Object.entries(champs)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = cle;
      input.value = valeur;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
  }

  return (
    <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-card">
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG local */}
      <img
        src="/logo.svg"
        alt=""
        aria-hidden="true"
        className="mb-6 h-8 w-auto"
      />
      <h1 className="font-display text-xl font-medium tracking-[-0.02em] text-ink">
        Autoriser {props.clientName} à accéder à votre Jiska ?
      </h1>
      <p className="mt-2 text-sm text-mute">
        Cette application pourra agir en votre nom (lecture et écriture) avec
        les mêmes droits que vous.
      </p>

      <section className="mt-6 flex items-center gap-3 rounded-lg bg-surface px-4 py-3">
        <Avatar
          personne={{
            id: "0",
            email: props.utilisateur.email,
            first_name: props.utilisateur.prenom,
            last_name: props.utilisateur.nom,
            avatar: null,
          }}
          taille="h-10 w-10 text-base"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">
            {props.utilisateur.prenom} {props.utilisateur.nom}
          </p>
          <p className="truncate text-xs text-mute">
            {libelleRole(props.utilisateur.role)} · {props.utilisateur.email}
          </p>
        </div>
      </section>

      <section className="mt-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone">
          Ce que cette application pourra faire
        </h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink">
          <Item>Consulter votre profil et la liste de l&apos;équipe.</Item>
          <Item>
            Lire les produits et les sujets auxquels vous avez accès.
          </Item>
          <Item>
            Créer et modifier des produits, des sujets et des tickets en
            votre nom.
          </Item>
          {(props.utilisateur.role === "dirigeant" ||
            props.utilisateur.role === "developeur") && (
            <Item>
              Gérer l&apos;équipe (créer / supprimer des comptes) et
              clôturer la réunion de la semaine.
            </Item>
          )}
        </ul>
      </section>

      <p className="mt-5 text-xs text-stone">
        Vous pouvez révoquer cet accès à tout moment depuis{" "}
        <code className="rounded bg-surface px-1 py-0.5 font-mono text-[11px]">
          /app/profil/api
        </code>
        .
      </p>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => soumettre("refuser")}
          disabled={envoi !== null}
          className="flex-1 rounded-lg border border-hairline bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          {envoi === "refuser" ? "Refus en cours…" : "Refuser"}
        </button>
        <button
          type="button"
          onClick={() => soumettre("accepter")}
          disabled={envoi !== null}
          className="flex-1 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {envoi === "accepter" ? "Autorisation…" : "Autoriser"}
        </button>
      </div>
    </div>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 text-sm">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="mt-0.5 h-4 w-4 shrink-0 text-brand"
        fill="currentColor"
      >
        <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 20.6 7.4 19.2 6 9 16.2Z" />
      </svg>
      <span>{children}</span>
    </li>
  );
}
