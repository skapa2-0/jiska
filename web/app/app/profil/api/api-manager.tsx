"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { libelleRole } from "@/lib/roles";
import type { Role } from "@/lib/roles";
import { SettingsNavApi } from "../settings-nav";
import type { Categorie, Endpoint } from "./endpoints";

type Token = {
  id: string;
  label: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

type Toast = { id: number; ok: boolean; text: string; sortant: boolean };

// Page de gestion des jetons d'API et doc d'utilisation. Jamais
// d'expiration, pas de limite par utilisateur : on crée, on révoque,
// on documente. Le secret complet n'est visible qu'à la création.
export default function ApiManager({
  role,
  tokensInitiaux,
  categories,
}: {
  role: Role;
  tokensInitiaux: Token[];
  categories: Categorie[];
}) {
  const router = useRouter();
  const [tokens, setTokens] = useState<Token[]>(tokensInitiaux);
  const [label, setLabel] = useState("");
  const [enCreation, setEnCreation] = useState(false);
  const [secretAffiche, setSecretAffiche] = useState<{
    secret: string;
    label: string;
  } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  function notifier(ok: boolean, text: string) {
    const id = Date.now() + Math.random();
    setToasts((liste) => [...liste, { id, ok, text, sortant: false }]);
    setTimeout(
      () =>
        setToasts((liste) =>
          liste.map((t) => (t.id === id ? { ...t, sortant: true } : t)),
        ),
      3000,
    );
    setTimeout(
      () => setToasts((liste) => liste.filter((t) => t.id !== id)),
      3300,
    );
  }

  async function creer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nom = label.trim();
    if (!nom) {
      setErreur("Donnez un nom à ce jeton.");
      return;
    }
    setEnCreation(true);
    setErreur(null);
    try {
      const res = await fetch("/api/me/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: nom }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErreur(data.error ?? "Échec de la création.");
        return;
      }
      setTokens((prev) => [data.token, ...prev]);
      setSecretAffiche({ secret: data.secret, label: data.token.label });
      setLabel("");
      router.refresh();
    } catch {
      setErreur("Impossible de joindre le serveur.");
    } finally {
      setEnCreation(false);
    }
  }

  async function revoquer(token: Token) {
    if (
      !window.confirm(
        `Révoquer le jeton « ${token.label} » ? Les clients qui l'utilisent perdront immédiatement l'accès.`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/me/tokens/${token.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notifier(false, data.error ?? "Échec de la révocation.");
        return;
      }
      setTokens((prev) =>
        prev.map((t) =>
          t.id === token.id ? { ...t, revoked_at: new Date().toISOString() } : t,
        ),
      );
      notifier(true, "Jeton révoqué.");
      router.refresh();
    } catch {
      notifier(false, "Impossible de joindre le serveur.");
    }
  }

  async function copier(valeur: string, message = "Copié dans le presse-papiers.") {
    try {
      await navigator.clipboard.writeText(valeur);
      notifier(true, message);
    } catch {
      notifier(false, "Impossible de copier automatiquement.");
    }
  }

  const actifs = useMemo(
    () => tokens.filter((t) => !t.revoked_at).length,
    [tokens],
  );

  return (
    <div className="gap-8 lg:flex">
      <SettingsNavApi />

      <div className="mt-6 min-w-0 flex-1 lg:mt-0">
        <div className="flex flex-col gap-4">
          <Bloc
            titre="Jetons d'API"
            detail="Un jeton porte toutes vos permissions. Toute requête faite avec reste imputable à votre compte."
          >
            <p className="mb-4 text-sm text-ink">
              {actifs === 0
                ? "Aucun jeton actif pour l'instant."
                : actifs === 1
                  ? "1 jeton actif."
                  : `${actifs} jetons actifs.`}{" "}
              <span className="text-stone">
                Rôle courant : {libelleRole(role)}.
              </span>
            </p>

            <form onSubmit={creer} className="flex flex-wrap items-end gap-3">
              <div className="min-w-[16rem] flex-1">
                <label htmlFor="t-label" className="mb-1.5 block text-sm font-medium text-ink">
                  Nom du jeton
                </label>
                <input
                  id="t-label"
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Script de synchro, intégration Zapier, ..."
                  maxLength={80}
                  disabled={enCreation}
                  className="w-full rounded-lg bg-surface px-4 py-3 text-sm text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand disabled:opacity-60"
                />
              </div>
              <button
                type="submit"
                disabled={enCreation}
                className="rounded-lg bg-ink px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Créer un jeton
              </button>
            </form>
            {erreur && (
              <p role="alert" className="mt-3 text-sm text-danger">
                {erreur}
              </p>
            )}

            {tokens.length > 0 && (
              <div className="mt-6 overflow-hidden rounded-lg border border-hairline">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface text-xs uppercase tracking-wide text-stone">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Nom</th>
                      <th className="px-4 py-2.5 font-medium">Préfixe</th>
                      <th className="px-4 py-2.5 font-medium">Créé le</th>
                      <th className="px-4 py-2.5 font-medium">Dernière utilisation</th>
                      <th className="px-4 py-2.5 font-medium text-right">État</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {tokens.map((t) => (
                      <tr key={t.id} className={t.revoked_at ? "opacity-55" : ""}>
                        <td className="px-4 py-3 font-medium text-ink">{t.label}</td>
                        <td className="px-4 py-3 font-mono text-xs text-stone">
                          {t.prefix}...
                        </td>
                        <td className="px-4 py-3 text-xs text-stone">
                          {formatDate(t.created_at)}
                        </td>
                        <td className="px-4 py-3 text-xs text-stone">
                          {t.last_used_at ? formatDate(t.last_used_at) : "jamais"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {t.revoked_at ? (
                            <span className="text-xs text-stone">
                              Révoqué le {formatDate(t.revoked_at)}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => revoquer(t)}
                              className="rounded-lg px-3 py-1.5 text-sm font-medium text-danger transition hover:bg-danger-soft"
                            >
                              Révoquer
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Bloc>

          <Bloc titre="Documentation" detail="Les endpoints que vous pouvez appeler avec un jeton. Filtrés selon votre rôle.">
            <Intro />
            <div className="mt-6 flex flex-col gap-6">
              {categories.map((cat) => (
                <Section key={cat.cle} categorie={cat} copier={copier} />
              ))}
            </div>
          </Bloc>
        </div>
      </div>

      {secretAffiche && (
        <ModaleSecret
          secret={secretAffiche.secret}
          label={secretAffiche.label}
          onFermer={() => setSecretAffiche(null)}
          onCopier={() =>
            copier(secretAffiche.secret, "Secret copié. Ne le partagez pas.")
          }
        />
      )}

      <ToastHost toasts={toasts} />
    </div>
  );
}

function Intro() {
  return (
    <div className="rounded-lg bg-surface p-4 text-sm text-ink">
      <p>
        <strong>Base :</strong>{" "}
        <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
          https://jiska.skapa.design
        </code>
      </p>
      <p className="mt-2">
        <strong>Authentification :</strong> ajoutez l&apos;en-tête
        <code className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-xs">
          Authorization: Bearer &lt;votre jeton&gt;
        </code>
        à chaque requête. Toutes les réponses sont en JSON.
      </p>
      <p className="mt-2">
        <strong>Erreurs :</strong> en cas d&apos;échec, le serveur renvoie
        un objet{" "}
        <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
          {"{ error: string }"}
        </code>{" "}
        avec un code HTTP adapté (400 payload invalide, 401 jeton manquant
        ou expiré, 403 permissions insuffisantes, 404 ressource absente,
        409 conflit, 502 erreur côté service tiers).
      </p>
    </div>
  );
}

function Section({
  categorie,
  copier,
}: {
  categorie: Categorie;
  copier: (valeur: string, message?: string) => void;
}) {
  return (
    <section>
      <header className="mb-3 border-b border-hairline pb-2">
        <h3 className="text-sm font-semibold text-ink">{categorie.titre}</h3>
        <p className="mt-1 text-xs text-stone">{categorie.description}</p>
      </header>
      <div className="flex flex-col gap-4">
        {categorie.endpoints.map((ep) => (
          <EndpointBloc
            key={`${ep.methode} ${ep.chemin}`}
            endpoint={ep}
            copier={copier}
          />
        ))}
      </div>
    </section>
  );
}

function EndpointBloc({
  endpoint,
  copier,
}: {
  endpoint: Endpoint;
  copier: (valeur: string, message?: string) => void;
}) {
  return (
    <article className="rounded-lg border border-hairline bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <PastilleMethode methode={endpoint.methode} />
        <code className="font-mono text-sm font-semibold text-ink">
          {endpoint.chemin}
        </code>
        <PastilleAcces acces={endpoint.acces} />
      </div>
      <h4 className="mt-2 text-sm font-semibold text-ink">{endpoint.titre}</h4>
      <p className="mt-1 text-sm text-stone">{endpoint.description}</p>

      {endpoint.notes && endpoint.notes.length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-xs text-stone">
          {endpoint.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}

      {endpoint.payload && (
        <BlocCode titre="Corps attendu" code={endpoint.payload} copier={copier} />
      )}
      {endpoint.reponse && (
        <BlocCode titre="Réponse" code={endpoint.reponse} copier={copier} />
      )}
      {endpoint.curl && (
        <BlocCode titre="Exemple curl" code={endpoint.curl} copier={copier} />
      )}
    </article>
  );
}

function PastilleMethode({ methode }: { methode: Endpoint["methode"] }) {
  const couleurs: Record<Endpoint["methode"], string> = {
    GET: "bg-info-soft text-info",
    POST: "bg-success-soft text-success",
    PATCH: "bg-warn-soft text-warn",
    DELETE: "bg-danger-soft text-danger",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 font-mono text-xs font-bold ${couleurs[methode]}`}
    >
      {methode}
    </span>
  );
}

function PastilleAcces({ acces }: { acces: Endpoint["acces"] }) {
  const libelle: Record<Endpoint["acces"], string> = {
    connecte: "Tout utilisateur",
    "membre-produit": "Membre du produit",
    admin: "Dirigeant",
    developeur: "Développeur",
  };
  return (
    <span className="ml-auto rounded bg-surface px-2 py-0.5 text-xs text-stone">
      {libelle[acces]}
    </span>
  );
}

function BlocCode({
  titre,
  code,
  copier,
}: {
  titre: string;
  code: string;
  copier: (valeur: string, message?: string) => void;
}) {
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-stone">
          {titre}
        </span>
        <button
          type="button"
          onClick={() => copier(code)}
          className="rounded px-2 py-1 text-xs font-medium text-brand transition hover:bg-info-soft"
        >
          Copier
        </button>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-ink/95 p-3 text-xs leading-relaxed text-white">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ModaleSecret({
  secret,
  label,
  onFermer,
  onCopier,
}: {
  secret: string;
  label: string;
  onFermer: () => void;
  onCopier: () => void;
}) {
  // Secret montré une seule fois : la modale bloque toute autre action
  // tant que l'utilisateur ne confirme pas qu'il a copié. On ne stocke
  // que le hash côté serveur, impossible de rejouer cet écran.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
      <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-card">
        <h2 className="text-base font-semibold text-ink">
          Jeton créé : {label}
        </h2>
        <p className="mt-2 text-sm text-stone">
          Copiez ce secret maintenant. Il ne vous sera plus jamais montré.
          Nous n&apos;en gardons qu&apos;un hachage.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-surface p-3 font-mono text-xs text-ink">
          <code>{secret}</code>
        </pre>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCopier}
            className="rounded-lg border border-hairline px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface"
          >
            Copier le secret
          </button>
          <button
            type="button"
            onClick={onFermer}
            className="rounded-lg bg-ink px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-85"
          >
            J&apos;ai copié, fermer
          </button>
        </div>
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
    <section className="rounded-lg bg-white p-6 shadow-card">
      <h2 className="text-sm font-semibold text-ink">{titre}</h2>
      {detail && <p className="mt-1 mb-4 text-xs text-stone">{detail}</p>}
      {!detail && <div className="mb-4" />}
      {children}
    </section>
  );
}

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

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
