"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";

// Deux étapes : demander le code, puis le saisir avec le nouveau mot de
// passe. Clerk envoie un code à six chiffres, pas un lien : un code expire
// vite et ne se transfère pas par erreur dans une conversation.
export default function OublieForm() {
  const router = useRouter();
  // API « future » de Clerk : useSignIn renvoie la ressource, et les
  // méthodes ne lèvent pas d'exception, elles renvoient { error }.
  const { signIn } = useSignIn();

  const [etape, setEtape] = useState<"demande" | "code">("demande");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mdp, setMdp] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function erreurLisible(error: unknown): string {
    const e = error as {
      errors?: { longMessage?: string; message?: string }[];
      message?: string;
    } | null;
    const e0 = e?.errors?.[0];
    return (
      e0?.longMessage ?? e0?.message ?? e?.message ?? "Une erreur est survenue."
    );
  }

  async function demanderCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!signIn) return;
    setLoading(true);
    setMessage("");
    try {
      const ouvert = await signIn.create({
        identifier: email.trim().toLowerCase(),
      });
      if (ouvert.error) {
        setMessage(erreurLisible(ouvert.error));
        return;
      }
      const envoi = await signIn.resetPasswordEmailCode.sendCode();
      if (envoi.error) {
        setMessage(erreurLisible(envoi.error));
        return;
      }
      setEtape("code");
    } catch (err) {
      setMessage(erreurLisible(err));
    } finally {
      setLoading(false);
    }
  }

  // Trois temps imposés par Clerk : vérifier le code, poser le nouveau
  // mot de passe, puis ouvrir la session.
  async function validerCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!signIn) return;
    setLoading(true);
    setMessage("");
    try {
      const verif = await signIn.resetPasswordEmailCode.verifyCode({
        code: code.trim(),
      });
      if (verif.error) {
        setMessage(erreurLisible(verif.error));
        return;
      }
      const pose = await signIn.resetPasswordEmailCode.submitPassword({
        password: mdp,
        // Réinitialiser depuis un « mot de passe oublié » doit fermer les
        // sessions ouvertes ailleurs : on ne sait pas qui les détient.
        signOutOfOtherSessions: true,
      });
      if (pose.error) {
        setMessage(erreurLisible(pose.error));
        return;
      }
      const fin = await signIn.finalize({ navigate: () => router.push("/app") });
      if (fin.error) setMessage(erreurLisible(fin.error));
    } catch (err) {
      setMessage(erreurLisible(err));
    } finally {
      setLoading(false);
    }
  }

  const champ =
    "w-full rounded-lg bg-surface px-4 py-3 text-sm text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand disabled:opacity-60";
  const etiquette = "mb-2 block text-sm font-medium text-ink";
  const bouton =
    "mt-6 w-full rounded-lg bg-ink py-3 text-[15px] font-semibold text-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <section className="w-full max-w-sm rounded-lg bg-white p-7 shadow-card">
      {etape === "demande" ? (
        <form onSubmit={demanderCode} noValidate>
          <label htmlFor="mdp-email" className={etiquette}>
            Adresse e-mail
          </label>
          <input
            id="mdp-email"
            type="email"
            autoComplete="email"
            placeholder="prenom@entreprise.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className={champ}
          />
          <button
            type="submit"
            disabled={loading || !email}
            className={bouton}
          >
            {loading ? "Envoi…" : "Recevoir le code"}
          </button>
        </form>
      ) : (
        <form onSubmit={validerCode} noValidate>
          <p className="mb-5 text-sm text-mute">
            Un code vient d&apos;être envoyé à <strong>{email}</strong>.
            Regardez vos indésirables s&apos;il tarde.
          </p>
          <label htmlFor="mdp-code" className={etiquette}>
            Code reçu
          </label>
          <input
            id="mdp-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            disabled={loading}
            className={`${champ} font-mono tracking-widest`}
          />
          <label htmlFor="mdp-nouveau" className={`${etiquette} mt-4`}>
            Nouveau mot de passe
          </label>
          <input
            id="mdp-nouveau"
            type="password"
            autoComplete="new-password"
            placeholder="8 caractères min."
            value={mdp}
            onChange={(e) => setMdp(e.target.value)}
            required
            minLength={8}
            disabled={loading}
            className={champ}
          />
          <button
            type="submit"
            disabled={loading || !code || !mdp}
            className={bouton}
          >
            {loading ? "Validation…" : "Choisir ce mot de passe"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEtape("demande");
              setMessage("");
            }}
            disabled={loading}
            className="mt-3 w-full text-center text-sm font-medium text-mute transition hover:text-ink"
          >
            Changer d&apos;adresse
          </button>
        </form>
      )}

      {message && (
        <p role="alert" className="mt-5 text-sm text-danger">
          {message}
        </p>
      )}

      <p className="mt-6 border-t border-hairline pt-5 text-center text-sm text-stone">
        <Link
          href="/login"
          className="font-semibold text-brand transition hover:text-brand-deep"
        >
          Revenir à la connexion
        </Link>
      </p>
    </section>
  );
}
