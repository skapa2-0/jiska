"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useUser } from "@clerk/nextjs";
import { FORMATS_IMAGE, reduireImage } from "@/lib/image";
import Avatar from "../avatar";

type User = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar: string | null;
};

export default function ProfilForm({ user }: { user: User }) {
  const { user: compteClerk } = useUser();
  const [prenom, setPrenom] = useState(user.first_name);
  const [nom, setNom] = useState(user.last_name);
  const [email, setEmail] = useState(user.email);
  const [avatar, setAvatar] = useState<string | null>(user.avatar);
  // `avatar` sert à l'aperçu : au chargement c'est l'URL de la photo
  // servie par /api/avatars, après un choix c'est la nouvelle data URL.
  // Seul ce second cas est envoyé à l'API.
  const [photoModifiee, setPhotoModifiee] = useState(false);
  const [infoMsg, setInfoMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [mdpActuel, setMdpActuel] = useState("");
  const [mdpNouveau, setMdpNouveau] = useState("");
  const [mdpConfirm, setMdpConfirm] = useState("");
  const [mdpMsg, setMdpMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function choisirPhoto(file: File | undefined) {
    if (!file) return;
    if (!FORMATS_IMAGE.test(file.type)) {
      setInfoMsg({ ok: false, text: "Formats acceptés : JPEG, PNG ou WebP." });
      return;
    }
    try {
      setAvatar(await reduireImage(file, "cover"));
      setPhotoModifiee(true);
      setInfoMsg(null);
    } catch {
      setInfoMsg({ ok: false, text: "Impossible de lire cette image." });
    }
  }

  // Le mot de passe appartient à Clerk, mais l'écran appartient à Jiska :
  // pas d'interface tierce encastrée, et un seul endroit pour la photo,
  // le nom et l'adresse, qui restent gérés par la plateforme.
  async function changerMdp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mdpNouveau !== mdpConfirm) {
      setMdpMsg({ ok: false, text: "Les deux mots de passe ne correspondent pas." });
      return;
    }
    setLoading(true);
    setMdpMsg(null);
    try {
      await compteClerk?.updatePassword({
        currentPassword: mdpActuel,
        newPassword: mdpNouveau,
        // Un mot de passe changé doit fermer les sessions ouvertes
        // ailleurs : c'est souvent la raison même du changement.
        signOutOfOtherSessions: true,
      });
      setMdpActuel("");
      setMdpNouveau("");
      setMdpConfirm("");
      setMdpMsg({ ok: true, text: "Mot de passe mis à jour." });
    } catch (err) {
      const message = (err as { errors?: { longMessage?: string; message?: string }[] })
        ?.errors?.[0];
      setMdpMsg({
        ok: false,
        text: message?.longMessage ?? message?.message ?? "Échec du changement.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function enregistrerInfos(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setInfoMsg(null);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: prenom,
          lastName: nom,
          email,
          ...(photoModifiee ? { avatar } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInfoMsg({ ok: false, text: data.error ?? "Échec de l'enregistrement." });
        return;
      }
      // Recharge pour rafraîchir la navbar (avatar, nom) partout.
      window.location.reload();
    } catch {
      setInfoMsg({ ok: false, text: "Impossible de joindre le serveur." });
    } finally {
      setLoading(false);
    }
  }


  const champ =
    "w-full rounded-lg bg-surface px-4 py-3 text-sm text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand disabled:opacity-60";
  const etiquette = "mb-1.5 block text-sm font-medium text-ink";

  return (
    <>
      {/* Photo + informations */}
      <form
        onSubmit={enregistrerInfos}
        className="mt-8 rounded-lg bg-white p-6 shadow-card"
      >
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
          <Avatar
            personne={{
              id: user.id,
              email,
              first_name: prenom,
              last_name: nom,
              avatar,
            }}
            taille="h-20 w-20 text-2xl"
          />
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={loading}
                className="rounded-lg border border-hairline px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface"
              >
                {avatar ? "Changer la photo" : "Ajouter une photo"}
              </button>
              {avatar && (
                <button
                  type="button"
                  onClick={() => {
                    setAvatar(null);
                    setPhotoModifiee(true);
                  }}
                  disabled={loading}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-danger transition hover:bg-danger-soft"
                >
                  Retirer
                </button>
              )}
            </div>
            <p className="text-xs text-stone">
              JPEG, PNG ou WebP : recadrée en carré et réduite automatiquement.
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => choisirPhoto(e.target.files?.[0])}
          />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="p-prenom" className={etiquette}>
              Prénom
            </label>
            <input
              id="p-prenom"
              type="text"
              autoComplete="given-name"
              placeholder="Camille"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              disabled={loading}
              className={champ}
            />
          </div>
          <div>
            <label htmlFor="p-nom" className={etiquette}>
              Nom
            </label>
            <input
              id="p-nom"
              type="text"
              autoComplete="family-name"
              placeholder="Durand"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              disabled={loading}
              className={champ}
            />
          </div>
          <div>
            <label htmlFor="p-email" className={etiquette}>
              Adresse e-mail
            </label>
            <input
              id="p-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className={champ}
            />
          </div>
        </div>

        {infoMsg && (
          <p
            role="alert"
            className={`mt-4 text-sm ${infoMsg.ok ? "text-success" : "text-danger"}`}
          >
            {infoMsg.text}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !email}
          className="mt-6 rounded-lg bg-ink px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Enregistrer
        </button>
      </form>

      {/* Mot de passe */}
      <form
        onSubmit={changerMdp}
        className="mt-6 rounded-lg bg-white p-6 shadow-card"
      >
        <h2 className="text-sm font-semibold text-ink">Changer le mot de passe</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="p-actuel" className={etiquette}>
              Actuel
            </label>
            <input
              id="p-actuel"
              type="password"
              autoComplete="current-password"
              value={mdpActuel}
              onChange={(e) => setMdpActuel(e.target.value)}
              required
              disabled={loading}
              className={champ}
            />
          </div>
          <div>
            <label htmlFor="p-nouveau" className={etiquette}>
              Nouveau
            </label>
            <input
              id="p-nouveau"
              type="password"
              autoComplete="new-password"
              placeholder="8 caractères min."
              value={mdpNouveau}
              onChange={(e) => setMdpNouveau(e.target.value)}
              required
              minLength={8}
              disabled={loading}
              className={champ}
            />
          </div>
          <div>
            <label htmlFor="p-confirm" className={etiquette}>
              Confirmation
            </label>
            <input
              id="p-confirm"
              type="password"
              autoComplete="new-password"
              value={mdpConfirm}
              onChange={(e) => setMdpConfirm(e.target.value)}
              required
              disabled={loading}
              className={champ}
            />
          </div>
        </div>

        {mdpMsg && (
          <p
            role="alert"
            className={`mt-4 text-sm ${mdpMsg.ok ? "text-success" : "text-danger"}`}
          >
            {mdpMsg.text}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !mdpActuel || !mdpNouveau || !mdpConfirm}
          className="mt-6 rounded-lg bg-ink px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Mettre à jour
        </button>
      </form>
    </>
  );
}
