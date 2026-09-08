"use client";

import { useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
import { FORMATS_IMAGE, reduireImage } from "@/lib/image";
import Avatar from "../avatar";

type User = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar: string | null;
  role: string;
};

// Paramètres du compte, en deux volets comme on s'y attend : ce qu'on
// montre aux autres, et ce qui protège l'accès. Tout est en Jiska ; Clerk
// travaille derrière pour le seul mot de passe (voir CLAUDE.md : une
// donnée, un endroit).
type Onglet = "profil" | "securite";

const ONGLETS: { cle: Onglet; label: string; icone: ReactNode }[] = [
  {
    cle: "profil",
    label: "Profil",
    icone: (
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-3.6 0-6.5 2-6.5 4.5V20h13v-1.5C18.5 16 15.6 14 12 14Z" />
    ),
  },
  {
    cle: "securite",
    label: "Sécurité",
    icone: (
      <path d="M12 3 5 6v5.5c0 4 3 7.7 7 8.5 4-.8 7-4.5 7-8.5V6l-7-3Zm0 6a1.6 1.6 0 0 1 .8 3v2.2a.8.8 0 0 1-1.6 0V12A1.6 1.6 0 0 1 12 9Z" />
    ),
  },
];

export default function ProfilForm({ user }: { user: User }) {
  const { user: compteClerk } = useUser();
  const [onglet, setOnglet] = useState<Onglet>("profil");

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
      // Recharge pour rafraîchir la navbar (photo, nom) partout.
      window.location.reload();
    } catch {
      setInfoMsg({ ok: false, text: "Impossible de joindre le serveur." });
    } finally {
      setLoading(false);
    }
  }

  // Le mot de passe appartient à Clerk, l'écran appartient à Jiska.
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
        // Changer son mot de passe doit fermer les sessions ouvertes
        // ailleurs : c'est souvent la raison même du changement.
        signOutOfOtherSessions: true,
      });
      setMdpActuel("");
      setMdpNouveau("");
      setMdpConfirm("");
      setMdpMsg({
        ok: true,
        text: "Mot de passe mis à jour. Vos autres sessions ont été fermées.",
      });
    } catch (err) {
      const e0 = (err as { errors?: { longMessage?: string; message?: string }[] })
        ?.errors?.[0];
      setMdpMsg({
        ok: false,
        text: e0?.longMessage ?? e0?.message ?? "Échec du changement.",
      });
    } finally {
      setLoading(false);
    }
  }

  const champ =
    "w-full rounded-lg bg-surface px-4 py-3 text-sm text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand disabled:opacity-60";
  const etiquette = "mb-1.5 block text-sm font-medium text-ink";

  return (
    <div className="mt-8 gap-8 lg:flex">
      {/* Navigation des volets : colonne à gauche sur grand écran,
          onglets en ligne sur téléphone. */}
      <nav
        aria-label="Sections des paramètres"
        className="flex gap-1 overflow-x-auto border-b border-hairline pb-2 lg:w-52 lg:shrink-0 lg:flex-col lg:border-b-0 lg:pb-0"
      >
        {ONGLETS.map((o) => (
          <button
            key={o.cle}
            type="button"
            aria-current={onglet === o.cle ? "page" : undefined}
            onClick={() => setOnglet(o.cle)}
            className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition ${
              onglet === o.cle
                ? "bg-brand/5 text-brand"
                : "text-mute hover:bg-surface hover:text-ink"
            }`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4 shrink-0"
              fill="currentColor"
            >
              {o.icone}
            </svg>
            {o.label}
          </button>
        ))}
      </nav>

      <div className="mt-6 min-w-0 flex-1 lg:mt-0">
        {onglet === "profil" ? (
          <form onSubmit={enregistrerInfos}>
            <Bloc
              titre="Photo"
              detail="Visible par votre équipe dans les tableaux et les réunions."
            >
              <div className="flex flex-wrap items-center gap-5">
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
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={loading}
                    className="rounded-lg border border-hairline px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface"
                  >
                    {avatar ? "Changer" : "Ajouter une photo"}
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
              </div>
              <p className="mt-3 text-xs text-stone">
                JPEG, PNG ou WebP : recadrée en carré et réduite
                automatiquement.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => choisirPhoto(e.target.files?.[0])}
              />
            </Bloc>

            <Bloc titre="Identité" detail="Le nom sous lequel on vous reconnaît.">
              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
              <p className="mt-3 text-xs text-stone">
                C&apos;est aussi ce nom que l&apos;analyse d&apos;un compte
                rendu cherche pour vous attribuer une action.
              </p>
            </Bloc>

            <Bloc
              titre="Adresse e-mail"
              detail="Sert à vous identifier à la connexion."
            >
              <input
                id="p-email"
                type="email"
                aria-label="Adresse e-mail"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className={champ}
              />
            </Bloc>

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
              Enregistrer les modifications
            </button>
          </form>
        ) : (
          <form onSubmit={changerMdp}>
            <Bloc
              titre="Mot de passe"
              detail="Le modifier fermera vos sessions ouvertes sur d'autres appareils."
            >
              <div className="grid gap-4 sm:grid-cols-3">
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
                className="mt-5 rounded-lg bg-ink px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Mettre à jour le mot de passe
              </button>
            </Bloc>

            <Bloc
              titre="Rôle"
              detail="Défini par un dirigeant, il décide de ce que vous voyez."
            >
              <p className="text-sm font-medium text-ink">
                {user.role === "dirigeant" ? "Dirigeant" : "Collaborateur"}
              </p>
              <p className="mt-1 text-xs text-stone">
                {user.role === "dirigeant"
                  ? "Vous voyez tous les produits et gérez les comptes."
                  : "Vous voyez les produits dont vous êtes membre."}
              </p>
            </Bloc>
          </form>
        )}
      </div>
    </div>
  );
}

function Bloc({
  titre,
  detail,
  children,
}: {
  titre: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-4 rounded-lg bg-white p-6 shadow-card last:mb-0">
      <h2 className="text-sm font-semibold text-ink">{titre}</h2>
      {detail && <p className="mt-1 mb-4 text-xs text-stone">{detail}</p>}
      {!detail && <div className="mb-4" />}
      {children}
    </section>
  );
}
