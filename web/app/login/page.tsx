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

      // Quand l'authentification sera branchée sur PostgreSQL,
      // on redirigera ici vers l'espace connecté.
      setStatus("idle");
    } catch {
      setStatus("error");
      setMessage("Impossible de joindre le serveur.");
    }
  }

  const loading = status === "loading";

  return (
    <main className="flex flex-1 items-center justify-center bg-background px-6 py-16">
      <section aria-labelledby="login-title" className="w-full max-w-sm">
        <header className="mb-10 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG local, pas d'optimisation utile */}
          <img
            src="/logo-mark.svg"
            alt=""
            aria-hidden="true"
            className="mx-auto mb-8 h-9 w-auto"
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
              className="w-full rounded-xl bg-surface px-4 py-3.5 text-[15px] text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand disabled:opacity-60"
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
                className="w-full rounded-xl bg-surface px-4 py-3.5 pr-24 text-[15px] text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={
                  showPassword
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-xs font-medium text-mute hover:bg-hairline/60"
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
            className="w-full rounded-full bg-ink py-3.5 text-[15px] font-semibold text-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <footer className="mt-10 text-center text-sm text-mute">
          Pas encore de compte ?{" "}
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="font-medium text-brand hover:text-brand-deep"
          >
            Contactez-nous
          </a>
        </footer>
      </section>
    </main>
  );
}
