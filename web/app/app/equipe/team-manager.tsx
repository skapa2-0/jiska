"use client";

import { Fragment, useState } from "react";
import type { FormEvent } from "react";
import Avatar, { displayName } from "../avatar";
import Confirmation from "../confirmer";

type Member = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar: string | null;
  role: string;
  created_at: string;
  // Compte rattaché à Clerk, donc capable de se connecter. Tant que c'est
  // faux, la personne existe dans Jiska mais n'a aucun moyen d'entrer.
  active: boolean;
};

export default function TeamManager({
  members,
  selfId,
}: {
  members: Member[];
  selfId: string;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("collaborateur");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [aSupprimer, setASupprimer] = useState<Member | null>(null);
  // Invitation en cours de saisie : l'adresse est modifiable, parce que la
  // personne se connectera peut-être avec une autre boîte que celle
  // enregistrée à la création de son compte.
  const [invite, setInvite] = useState<{ id: string; email: string } | null>(
    null,
  );
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  async function envoyerInvitation() {
    if (!invite) return;
    setLoading(true);
    setInviteMsg(null);
    try {
      const res = await fetch(`/api/users/${invite.id}/inviter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: invite.email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteMsg({ ok: false, text: data.error ?? "Échec de l'envoi." });
        return;
      }
      setInvite(null);
      setInviteMsg({
        ok: true,
        text: `Invitation envoyée à ${data.email}.`,
      });
    } catch {
      setInviteMsg({ ok: false, text: "Impossible de joindre le serveur." });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Échec de la création du compte.");
        return;
      }
      // Le compte peut exister sans que l'invitation soit partie : il
      // faut le dire plutôt que recharger comme si tout allait bien.
      if (data.avertissement) {
        setMessage(data.avertissement);
        return;
      }
      window.location.reload();
    } catch {
      setMessage("Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(member: Member) {
    setASupprimer(null);
    const res = await fetch(`/api/users/${member.id}`, { method: "DELETE" });
    if (res.ok) window.location.reload();
    else {
      const data = await res.json().catch(() => null);
      setMessage(data?.error ?? "Échec de la suppression.");
    }
  }

  return (
    <>
      {inviteMsg && (
        <p
          role="alert"
          className={`mt-6 rounded-lg px-4 py-3 text-sm ${
            inviteMsg.ok
              ? "bg-success-soft text-success"
              : "bg-danger-soft text-danger"
          }`}
        >
          {inviteMsg.text}
        </p>
      )}

      <ul className="mt-8 divide-y divide-hairline rounded-lg bg-white shadow-card">
        {members.map((m) => (
          // Deux <li> par personne : la ligne, et le formulaire
          // d'invitation quand il est déplié sous elle.
          <Fragment key={m.id}>
          <li className="flex items-center gap-3 px-5 py-3.5">
            <Avatar personne={m} taille="h-8 w-8 text-sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {displayName(m)}
              </p>
              <p className="truncate text-xs text-mute">{m.email}</p>
              <p className="truncate text-xs text-stone">
                {m.role === "dirigeant" ? "Dirigeant" : "Collaborateur"} ·
                depuis le {m.created_at.split("-").reverse().join("/")} ·{" "}
                <span className={m.active ? "text-success" : "text-warn"}>
                  {m.active ? "accès activé" : "jamais connecté"}
                </span>
              </p>
            </div>
            {!m.active && (
              <button
                type="button"
                onClick={() => {
                  setInviteMsg(null);
                  setInvite(
                    invite?.id === m.id ? null : { id: m.id, email: m.email },
                  );
                }}
                className="rounded-md px-3 py-1 text-xs font-semibold text-brand transition hover:bg-brand/5"
              >
                {invite?.id === m.id ? "Annuler" : "Inviter"}
              </button>
            )}
            {m.id !== selfId && (
              <button
                type="button"
                onClick={() => setASupprimer(m)}
                className="rounded-md px-3 py-1 text-xs font-medium text-danger transition hover:bg-surface"
              >
                Supprimer
              </button>
            )}
          </li>
          {invite?.id === m.id && (
            <li className="bg-surface px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone">
                Adresse qui recevra l&apos;invitation
              </p>
              <p className="mt-1 text-xs text-mute">
                C&apos;est la seule avec laquelle cette personne pourra se
                connecter. Modifiez-la si elle utilise une autre boîte.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  type="email"
                  aria-label="Adresse d'invitation"
                  value={invite.email}
                  onChange={(e) =>
                    setInvite({ id: m.id, email: e.target.value })
                  }
                  disabled={loading}
                  className="min-w-0 flex-1 rounded-lg bg-white px-4 py-2.5 text-sm text-ink outline-none transition focus:ring-2 focus:ring-brand"
                />
                <button
                  type="button"
                  onClick={envoyerInvitation}
                  disabled={loading || !invite.email}
                  className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-85 disabled:opacity-40"
                >
                  {loading ? "Envoi…" : "Envoyer l'invitation"}
                </button>
              </div>
            </li>
          )}
          </Fragment>
        ))}
      </ul>

      <form
        onSubmit={handleCreate}
        className="mt-8 rounded-lg bg-white shadow-card p-5"
      >
        <h2 className="text-sm font-semibold text-ink">Ajouter un compte</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            type="email"
            aria-label="Adresse e-mail"
            placeholder="prenom@entreprise.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="w-full rounded-lg bg-surface px-4 py-3 text-sm text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand"
          />
        </div>
        <p className="mt-2 text-xs text-stone">
          Une invitation part par e-mail : la personne choisit son mot de
          passe elle-même, vous n&apos;avez pas à en inventer un.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {/* Choix du rôle en pastilles maison (règle : pas de radio
              au style natif). */}
          <div className="flex gap-1.5">
            {(
              [
                ["collaborateur", "Collaborateur"],
                ["dirigeant", "Dirigeant"],
              ] as const
            ).map(([valeur, label]) => (
              <button
                key={valeur}
                type="button"
                aria-pressed={role === valeur}
                onClick={() => setRole(valeur)}
                disabled={loading}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  role === valeur
                    ? "border-brand bg-brand/5 text-ink ring-1 ring-brand"
                    : "border-hairline text-mute hover:bg-surface"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={loading || !email}
            className="rounded-lg bg-ink px-5 py-2 text-sm font-semibold text-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Envoi…" : "Créer et inviter"}
          </button>
        </div>
        {message && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {message}
          </p>
        )}
      </form>

      {aSupprimer && (
        <Confirmation
          titre="Supprimer le compte ?"
          message={`${aSupprimer.email} sera retiré de tous les produits.`}
          onConfirm={() => handleDelete(aSupprimer)}
          onCancel={() => setASupprimer(null)}
        />
      )}
    </>
  );
}
