"use client";

import { useState } from "react";
import type { FormEvent } from "react";

type Status = "idle" | "loading" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Échec de la connexion.");
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
    <main className="flex flex-1 flex-col items-center justify-center gap-10 bg-background px-6 py-16 lg:flex-row lg:items-center lg:gap-16">
      <section aria-labelledby="login-title" className="w-full max-w-sm">
        <header className="mb-10 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG local, pas d'optimisation utile */}
          <img
            src="/logo.svg"
            alt=""
            aria-hidden="true"
            className="mx-auto mb-8 h-10 w-auto"
          />
          <h1
            id="login-title"
            className="font-display text-[32px] font-medium leading-tight tracking-[-0.02em] text-ink"
          >
            Connexion à Jiska
          </h1>
          <p className="mt-3 text-[15px] text-stone">
            Retrouvez votre espace en quelques secondes
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
              className="w-full rounded-lg bg-surface px-4 py-3.5 text-[15px] text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand disabled:opacity-60"
            />
          </div>

          <div className="mb-4">
            <div className="mb-2 flex items-baseline justify-between">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-ink"
              >
                Mot de passe
              </label>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="text-sm font-medium text-brand hover:text-brand-deep"
              >
                Mot de passe oublié ?
              </a>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full rounded-lg bg-surface px-4 py-3.5 pr-24 text-[15px] text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={
                  showPassword
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2.5 py-1 text-xs font-medium text-mute hover:bg-hairline/60"
              >
                {showPassword ? "Masquer" : "Afficher"}
              </button>
            </div>
          </div>

          <label className="mb-8 flex cursor-pointer items-center gap-2.5 text-sm text-mute">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={loading}
              className="h-4 w-4 accent-brand"
            />
            <span>Rester connecté</span>
          </label>

          {message && (
            <p role="alert" className="mb-4 text-sm text-danger">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full rounded-lg bg-ink py-3.5 text-[15px] font-semibold text-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <footer className="mt-10 text-center text-sm text-mute">
          Pas encore de compte ?{" "}
          <a
            href="/register"
            className="font-medium text-brand hover:text-brand-deep"
          >
            Créer un compte
          </a>
        </footer>
      </section>

      {/* Comptes de démonstration : un par type de profil. */}
      <aside
        aria-label="Comptes de démonstration"
        className="w-full max-w-sm rounded-lg bg-white shadow-card p-6 lg:w-72"
      >
        <h2 className="text-sm font-semibold text-ink">
          Comptes de démonstration
        </h2>
        <dl className="mt-4 space-y-5">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-stone">
              Dirigeant
            </dt>
            <dd className="mt-1.5 space-y-0.5 text-sm text-ink">
              <p className="font-mono text-[13px]">dirigeant@jiska.fr</p>
              <p className="font-mono text-[13px] text-mute">demo-dirigeant</p>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-stone">
              Collaborateur
            </dt>
            <dd className="mt-1.5 space-y-0.5 text-sm text-ink">
              <p className="font-mono text-[13px]">collaborateur@jiska.fr</p>
              <p className="font-mono text-[13px] text-mute">
                demo-collaborateur
              </p>
            </dd>
          </div>
        </dl>
      </aside>
    </main>
  );
}
