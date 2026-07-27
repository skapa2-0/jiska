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
    <main className="flex flex-1 items-center justify-center bg-background px-6 py-12">
      <section aria-labelledby="login-title" className="w-full max-w-xs">
        <header className="mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG local, pas d'optimisation utile */}
          <img
            src="/logo.svg"
            alt=""
            aria-hidden="true"
            className="mb-6 h-8 w-auto"
          />
          <h1 id="login-title" className="sr-only">
            Jiska
          </h1>
          <p className="text-sm text-zinc-500">Connectez-vous à votre espace</p>
        </header>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-5">
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm text-zinc-700"
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
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-brand disabled:opacity-60"
            />
          </div>

          <div className="mb-5">
            <div className="mb-1.5 flex items-baseline justify-between">
              <label
                htmlFor="password"
                className="block text-sm text-zinc-700"
              >
                Mot de passe
              </label>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="text-xs text-brand hover:underline"
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
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 pr-20 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-brand disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={
                  showPassword
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-1 text-xs text-zinc-500 hover:text-zinc-800"
              >
                {showPassword ? "Masquer" : "Afficher"}
              </button>
            </div>
          </div>

          <label className="mb-5 flex cursor-pointer items-center gap-2 text-sm text-zinc-600">
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
            <p
              role="alert"
              className="mb-4 text-sm text-red-600"
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full rounded-md bg-brand py-2 text-sm font-medium text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <footer className="mt-8 text-sm text-zinc-500">
          Pas encore de compte ?{" "}
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="text-brand hover:underline"
          >
            Contactez-nous
          </a>
        </footer>
      </section>
    </main>
  );
}
