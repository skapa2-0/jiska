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
    <main className="flex flex-1 items-center justify-center bg-background px-6 py-12 [background-image:radial-gradient(600px_400px_at_20%_10%,rgba(75,78,233,0.08),transparent),radial-gradient(500px_350px_at_85%_90%,rgba(75,78,233,0.05),transparent)]">
      <section
        aria-labelledby="login-title"
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl shadow-zinc-900/5"
      >
        <header className="mb-7 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG local, pas d'optimisation utile */}
          <img
            src="/logo.svg"
            alt=""
            aria-hidden="true"
            className="mx-auto mb-4 h-10 w-auto"
          />
          <h1 id="login-title" className="sr-only">
            Jiska
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Connectez-vous à votre espace
          </p>
        </header>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-zinc-700"
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
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25 disabled:opacity-60"
            />
          </div>

          <div className="mb-4">
            <div className="mb-1.5 flex items-baseline justify-between">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-zinc-700"
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
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 pr-20 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25 disabled:opacity-60"
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
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <footer className="mt-6 text-center text-sm text-zinc-500">
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
