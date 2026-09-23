"use client";

import { useEffect, useRef, useState } from "react";
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

// Paramètres du compte : sidebar à gauche, deux volets à droite. « Profil »
// regroupe ce qu'on montre aux autres (photo, identité, e-mail en lecture),
// « Sécurité » ce qui protège l'accès (mot de passe, rôle). Chaque volet a
// son bouton et son propre retour visuel (toast en haut à droite). Tout
// reste en Jiska ; Clerk travaille derrière pour le seul mot de passe (voir
// CLAUDE.md : une donnée, un endroit).
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

type Toast = { id: number; ok: boolean; text: string; sortant: boolean };

export default function ProfilForm({ user }: { user: User }) {
  const router = useRouter();
  const { user: compteClerk } = useUser();
  const [onglet, setOnglet] = useState<Onglet>("profil");

  const [prenom, setPrenom] = useState(user.first_name);
  const [nom, setNom] = useState(user.last_name);
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
    setToasts((liste) => [...liste, { id, ok, text, sortant: false }]);
    // À 3 s : on marque sortant pour déclencher l'animation de sortie.
    setTimeout(
      () =>
        setToasts((liste) =>
          liste.map((t) => (t.id === id ? { ...t, sortant: true } : t)),
        ),
      3000,
    );
    // À 3,3 s : le retrait effectif du DOM (300 ms d'anim de sortie).
    setTimeout(
      () => setToasts((liste) => liste.filter((t) => t.id !== id)),
      3300,
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

  async function enregistrerProfil(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: prenom,
          lastName: nom,
          ...(photoModifiee ? { avatar } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notifier(false, data.error ?? "Échec de l'enregistrement.");
        return;
      }
      setPhotoModifiee(false);
      notifier(true, "Profil mis à jour.");
      // Rafraîchit la navbar (photo, nom) sans casser le retour visuel.
      router.refresh();
    } catch {
      notifier(false, "Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="gap-8 lg:flex">
      {/* Sidebar : vrai panneau gris à gauche sur desktop, tab-switcher au
          même look en haut sur mobile. Le titre « Paramètres » vit en tête
          du panneau plutôt qu'en haut de la page pour rapprocher le contenu
          du haut. L'onglet actif « pop » en blanc pour se détacher du fond. */}
      <div className="rounded-lg bg-surface p-3 lg:w-60 lg:shrink-0 lg:self-start">
        <div className="mb-3 px-1">
          <h1 className="font-display text-lg font-medium tracking-[-0.02em] text-ink">
            Paramètres
          </h1>
          <p className="mt-0.5 text-xs text-stone">
            Votre profil et la sécurité de votre accès.
          </p>
        </div>
        <nav
          aria-label="Sections des paramètres"
          className="flex gap-1 lg:flex-col lg:gap-1"
        >
          {ONGLETS.map((o) => {
          const actif = onglet === o.cle;
          return (
            <button
              key={o.cle}
              type="button"
              aria-current={actif ? "page" : undefined}
              onClick={() => setOnglet(o.cle)}
              className={`flex flex-1 items-center justify-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition lg:flex-none lg:justify-start ${
                actif
                  ? "bg-white text-brand shadow-sm"
                  : "text-mute hover:bg-white/60 hover:text-ink"
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
        </nav>
      </div>

      <div className="mt-6 min-w-0 flex-1 lg:mt-0">
        {onglet === "profil" ? (
          <form onSubmit={enregistrerProfil} className="flex flex-col gap-4">
            <Bloc
              titre="Photo"
              detail="Visible par votre équipe dans les tableaux et les réunions."
            >
              <div className="flex flex-wrap items-center gap-6">
                <Avatar
                  personne={{
                    id: user.id,
                    email: user.email,
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

            {/* Adresse e-mail : en lecture seule côté profil. Sa modification
                passe par un dirigeant depuis /app/equipe. */}
            <Bloc
              titre="Adresse e-mail"
              detail="Sert à vous identifier à la connexion."
            >
              <p className="text-sm font-medium text-ink">{user.email}</p>
              <p className="mt-2 text-xs text-stone">
                Pour la modifier, contactez un dirigeant.
              </p>
            </Bloc>

            <div className="mt-2">
              <button type="submit" disabled={loading} className={bouton}>
                Enregistrer les modifications
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={changerMdp} className="flex flex-col gap-4">
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

              <div className="mt-5 flex flex-wrap items-center gap-4">
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

// Notifications intégrées à la navbar : pill compact centré à sa hauteur,
// de la même famille visuelle que les boutons/onglets de l'en-tête. Fond
// pastel, texte teinté (vert succès / rouge erreur), icône à gauche. Chaque
// toast tombe à l'ouverture et remonte à la fermeture ; l'anim de sortie
// est pilotée par `sortant` (voir `notifier`).
function ToastHost({ toasts }: { toasts: Toast[] }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed left-1/2 top-2.5 z-50 flex -translate-x-1/2 flex-col items-center gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  // `monte` passe à true au frame suivant pour déclencher la transition
  // d'entrée (Tailwind ne peut pas animer depuis un "initial" invisible
  // sans ce cycle : mount avec état initial, puis switch vers l'état actif).
  const [monte, setMonte] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMonte(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const visible = monte && !toast.sortant;
  return (
    <div
      role="status"
      className={`pointer-events-auto inline-flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-sm ring-1 transition-all duration-300 ease-out ${
        toast.ok
          ? "bg-success-soft text-success ring-success/20"
          : "bg-danger-soft text-danger ring-danger/20"
      } ${visible ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4 shrink-0"
        fill="currentColor"
      >
        {toast.ok ? (
          <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 20.6 7.4 19.2 6 9 16.2Z" />
        ) : (
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 5h2v7h-2V7Zm0 9h2v2h-2v-2Z" />
        )}
      </svg>
      <span className="leading-tight">{toast.text}</span>
    </div>
  );
}
