"use client";

import { useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
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

// Paramètres du compte : sidebar à gauche, un onglet par sujet à droite.
// Chaque onglet est un formulaire autonome avec son bouton et son propre
// retour visuel (toast en haut à droite). Tout reste en Jiska ; Clerk
// travaille derrière pour le seul mot de passe (voir CLAUDE.md : une
// donnée, un endroit).
type Onglet = "photo" | "identite" | "email" | "mdp" | "role";

type ItemOnglet = {
  cle: Onglet;
  label: string;
  groupe: "profil" | "compte";
  icone: ReactNode;
};

const ONGLETS: ItemOnglet[] = [
  {
    cle: "photo",
    label: "Photo",
    groupe: "profil",
    icone: (
      <path d="M9 3h6l1.5 2H20a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3.5L9 3Zm3 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />
    ),
  },
  {
    cle: "identite",
    label: "Identité",
    groupe: "profil",
    icone: (
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-3.6 0-6.5 2-6.5 4.5V20h13v-1.5C18.5 16 15.6 14 12 14Z" />
    ),
  },
  {
    cle: "email",
    label: "Adresse e-mail",
    groupe: "profil",
    icone: (
      <path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm.6 2 7.4 5.1L19.4 8H4.6Z" />
    ),
  },
  {
    cle: "mdp",
    label: "Mot de passe",
    groupe: "compte",
    icone: (
      <path d="M12 2a5 5 0 0 1 5 5v3h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5Zm3 8V7a3 3 0 1 0-6 0v3h6Z" />
    ),
  },
  {
    cle: "role",
    label: "Rôle",
    groupe: "compte",
    icone: (
      <path d="M12 3 5 6v5.5c0 4 3 7.7 7 8.5 4-.8 7-4.5 7-8.5V6l-7-3Zm0 6a1.6 1.6 0 0 1 .8 3v2.2a.8.8 0 0 1-1.6 0V12A1.6 1.6 0 0 1 12 9Z" />
    ),
  },
];

type Toast = { id: number; ok: boolean; text: string };

export default function ProfilForm({ user }: { user: User }) {
  const router = useRouter();
  const { user: compteClerk } = useUser();
  const [onglet, setOnglet] = useState<Onglet>("photo");

  const [prenom, setPrenom] = useState(user.first_name);
  const [nom, setNom] = useState(user.last_name);
  const [email, setEmail] = useState(user.email);
  const [avatar, setAvatar] = useState<string | null>(user.avatar);
  // `avatar` sert à l'aperçu : au chargement c'est l'URL de la photo
  // servie par /api/avatars, après un choix c'est la nouvelle data URL.
  // `photoModifiee` distingue les deux au moment d'envoyer.
  const [photoModifiee, setPhotoModifiee] = useState(false);
  const [erreurPhoto, setErreurPhoto] = useState<string | null>(null);

  const [mdpActuel, setMdpActuel] = useState("");
  const [mdpNouveau, setMdpNouveau] = useState("");
  const [mdpConfirm, setMdpConfirm] = useState("");
  const [erreurMdp, setErreurMdp] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function notifier(ok: boolean, text: string) {
    const id = Date.now() + Math.random();
    setToasts((liste) => [...liste, { id, ok, text }]);
    setTimeout(
      () => setToasts((liste) => liste.filter((t) => t.id !== id)),
      3500,
    );
  }

  async function choisirPhoto(file: File | undefined) {
    if (!file) return;
    if (!FORMATS_IMAGE.test(file.type)) {
      setErreurPhoto("Formats acceptés : JPEG, PNG ou WebP.");
      return;
    }
    try {
      setAvatar(await reduireImage(file, "cover"));
      setPhotoModifiee(true);
      setErreurPhoto(null);
    } catch {
      setErreurPhoto("Impossible de lire cette image.");
    }
  }

  async function envoyerPatch(
    payload: Record<string, unknown>,
    messageOk: string,
    apres?: () => void,
  ) {
    setLoading(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        notifier(false, data.error ?? "Échec de l'enregistrement.");
        return;
      }
      notifier(true, messageOk);
      apres?.();
      // Rafraîchit la navbar (photo, nom) sans casser le retour visuel.
      router.refresh();
    } catch {
      notifier(false, "Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
    }
  }

  async function enregistrerPhoto(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await envoyerPatch({ avatar }, "Photo mise à jour.", () =>
      setPhotoModifiee(false),
    );
  }

  async function enregistrerIdentite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await envoyerPatch(
      { firstName: prenom, lastName: nom },
      "Identité mise à jour.",
    );
  }

  async function enregistrerEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await envoyerPatch({ email }, "Adresse e-mail mise à jour.");
  }

  // Le mot de passe appartient à Clerk, l'écran appartient à Jiska.
  async function changerMdp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mdpNouveau !== mdpConfirm) {
      setErreurMdp("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    setErreurMdp(null);
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
      notifier(
        true,
        "Mot de passe mis à jour. Vos autres sessions ont été fermées.",
      );
    } catch (err) {
      const e0 = (err as { errors?: { longMessage?: string; message?: string }[] })
        ?.errors?.[0];
      setErreurMdp(e0?.longMessage ?? e0?.message ?? "Échec du changement.");
    } finally {
      setLoading(false);
    }
  }

  const champ =
    "w-full rounded-lg bg-surface px-4 py-3 text-sm text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand disabled:opacity-60";
  const etiquette = "mb-1.5 block text-sm font-medium text-ink";
  const bouton =
    "rounded-lg bg-ink px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40";

  const groupes: { cle: "profil" | "compte"; titre: string }[] = [
    { cle: "profil", titre: "Profil" },
    { cle: "compte", titre: "Compte" },
  ];

  return (
    <div className="mt-8 gap-8 lg:flex">
      {/* Sidebar : colonne à gauche sur desktop, bande d'onglets scrollable
          sur mobile. Les titres de groupe n'apparaissent qu'en desktop. */}
      <nav
        aria-label="Sections des paramètres"
        className="flex gap-1 overflow-x-auto border-b border-hairline pb-2 lg:w-60 lg:shrink-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:border-b-0 lg:pb-0"
      >
        {groupes.map((g) => (
          <div key={g.cle} className="contents lg:block">
            <div className="hidden px-3.5 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wider text-stone first:pt-0 lg:block">
              {g.titre}
            </div>
            {ONGLETS.filter((o) => o.groupe === g.cle).map((o) => {
              const actif = onglet === o.cle;
              return (
                <button
                  key={o.cle}
                  type="button"
                  aria-current={actif ? "page" : undefined}
                  onClick={() => setOnglet(o.cle)}
                  className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition ${
                    actif
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
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-6 min-w-0 flex-1 lg:mt-0">
        {onglet === "photo" && (
          <form onSubmit={enregistrerPhoto}>
            <Bloc
              titre="Photo de profil"
              detail="Visible par votre équipe dans les tableaux et les réunions."
            >
              <div className="flex flex-wrap items-center gap-6">
                <Avatar
                  personne={{
                    id: user.id,
                    email,
                    first_name: prenom,
                    last_name: nom,
                    avatar,
                  }}
                  taille="h-24 w-24 text-3xl"
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
                        setErreurPhoto(null);
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
              {erreurPhoto && (
                <p role="alert" className="mt-3 text-sm text-danger">
                  {erreurPhoto}
                </p>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => choisirPhoto(e.target.files?.[0])}
              />
            </Bloc>

            <div className="mt-6">
              <button
                type="submit"
                disabled={loading || !photoModifiee}
                className={bouton}
              >
                Enregistrer la photo
              </button>
            </div>
          </form>
        )}

        {onglet === "identite" && (
          <form onSubmit={enregistrerIdentite}>
            <Bloc
              titre="Identité"
              detail="Le nom sous lequel on vous reconnaît."
            >
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

            <div className="mt-6">
              <button type="submit" disabled={loading} className={bouton}>
                Enregistrer l&apos;identité
              </button>
            </div>
          </form>
        )}

        {onglet === "email" && (
          <form onSubmit={enregistrerEmail}>
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

            <div className="mt-6">
              <button
                type="submit"
                disabled={loading || !email}
                className={bouton}
              >
                Enregistrer l&apos;adresse
              </button>
            </div>
          </form>
        )}

        {onglet === "mdp" && (
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

              {erreurMdp && (
                <p role="alert" className="mt-4 text-sm text-danger">
                  {erreurMdp}
                </p>
              )}
            </Bloc>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button
                type="submit"
                disabled={loading || !mdpActuel || !mdpNouveau || !mdpConfirm}
                className={bouton}
              >
                Mettre à jour le mot de passe
              </button>
              {/* Sans son mot de passe actuel, le formulaire ci-dessus est
                  inutilisable : le code par e-mail est la seule sortie. */}
              <a
                href="/mot-de-passe-oublie"
                className="text-sm font-medium text-brand transition hover:text-brand-deep"
              >
                Je ne connais plus mon mot de passe
              </a>
            </div>
          </form>
        )}

        {onglet === "role" && (
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
        )}
      </div>

      <ToastHost toasts={toasts} />
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
    <section className="rounded-lg bg-white p-6 shadow-card">
      <h2 className="text-sm font-semibold text-ink">{titre}</h2>
      {detail && <p className="mt-1 mb-4 text-xs text-stone">{detail}</p>}
      {!detail && <div className="mb-4" />}
      {children}
    </section>
  );
}

// Pile de notifications en haut à droite. Auto-dismiss ~3,5 s, empilable.
function ToastHost({ toasts }: { toasts: Toast[] }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed right-4 top-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex items-start gap-3 rounded-lg bg-white p-3.5 pr-4 text-sm text-ink shadow-card ring-1 ${
            t.ok ? "ring-success/25" : "ring-danger/25"
          }`}
        >
          <span
            aria-hidden="true"
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${
              t.ok ? "bg-success" : "bg-danger"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
              {t.ok ? (
                <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 20.6 7.4 19.2 6 9 16.2Z" />
              ) : (
                <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 5h2v7h-2V7Zm0 9h2v2h-2v-2Z" />
              )}
            </svg>
          </span>
          <span className="min-w-0 flex-1 leading-snug">{t.text}</span>
        </div>
      ))}
    </div>
  );
}
