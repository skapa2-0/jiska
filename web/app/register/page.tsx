"use client";

import { useState } from "react";
import type { FormEvent } from "react";

type Status = "idle" | "loading" | "error";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (password !== confirm) {
      setStatus("error");
      setMessage("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Échec de la création du compte.");
        return;
      }

      window.location.href = "/app";
    } catch {
      setStatus("error");
      setMessage("Impossible de joindre le serveur.");
    }
  }

  const loading = status === "loading";

  return (
    <main className="flex flex-1 items-center justify-center bg-background px-6 py-16">
      <section aria-labelledby="register-title" className="w-full max-w-sm">
        <header className="mb-10 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG local, pas d'optimisation utile */}
          <img
            src="/logo.svg"
            alt=""
            aria-hidden="true"
            className="mx-auto mb-8 h-10 w-auto"
          />
          <h1
            id="register-title"
            className="font-display text-[32px] font-medium leading-tight tracking-[-0.02em] text-ink"
          >
            Créer un compte
          </h1>
          <p className="mt-3 text-[15px] text-stone">
            Votre espace Jiska en moins d&apos;une minute
          </p>
        </header>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-ink"
            >
              Adresse e-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="vous@exemple.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="w-full rounded-xl bg-surface px-4 py-3.5 text-[15px] text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand disabled:opacity-60"
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-ink"
            >
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="8 caractères minimum"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={loading}
              className="w-full rounded-xl bg-surface px-4 py-3.5 text-[15px] text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand disabled:opacity-60"
            />
          </div>

          <div className="mb-8">
            <label
              htmlFor="confirm"
              className="mb-2 block text-sm font-medium text-ink"
            >
              Confirmez le mot de passe
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              disabled={loading}
              className="w-full rounded-xl bg-surface px-4 py-3.5 text-[15px] text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand disabled:opacity-60"
            />
          </div>

          {message && (
            <p role="alert" className="mb-4 text-sm text-danger">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password || !confirm}
            className="w-full rounded-full bg-ink py-3.5 text-[15px] font-semibold text-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Création…" : "Créer mon compte"}
          </button>
        </form>

        <footer className="mt-10 text-center text-sm text-mute">
          Déjà un compte ?{" "}
          <a
            href="/login"
            className="font-medium text-brand hover:text-brand-deep"
          >
            Se connecter
          </a>
        </footer>
      </section>
    </main>
  );
}
