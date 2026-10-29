"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { libelleRole } from "@/lib/roles";
import type { Role } from "@/lib/roles";
import { SettingsNavApi } from "../settings-nav";
import type { Categorie, Endpoint } from "./endpoints";

type SessionOAuth = {
  client_id: string;
  client_name: string;
  derniere_utilisation: string | null;
  depuis: string;
};

type Toast = { id: number; ok: boolean; text: string; sortant: boolean };

// Paramètres > API : accès par OAuth 2.1 (plus de jetons manuels).
// L'utilisateur voit ici la liste des applications autorisées (par
// exemple « Claude Desktop ») et peut en révoquer une d'un clic. La doc
// explique le flow côté client et liste les endpoints disponibles pour
// son rôle.
export default function ApiManager({
  role,
  sessions: sessionsInit,
  categories,
  tools,
}: {
  role: Role;
  sessions: SessionOAuth[];
  categories: Categorie[];
  tools: { name: string; description: string }[];
}) {
  const router = useRouter();
  const [sessions, setSessions] = useState(sessionsInit);
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

  async function revoquer(s: SessionOAuth) {
    if (
      !window.confirm(
        `Révoquer l'accès de « ${s.client_name} » ? Cette application devra réautoriser pour continuer.`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(
        `/api/me/sessions/${encodeURIComponent(s.client_id)}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notifier(false, data.error ?? "Échec de la révocation.");
        return;
      }
      setSessions((prev) => prev.filter((x) => x.client_id !== s.client_id));
      notifier(true, "Accès révoqué.");
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

  return (
    <div className="gap-8 lg:flex">
      <SettingsNavApi />

      <div className="mt-6 min-w-0 flex-1 lg:mt-0">
        <div className="flex flex-col gap-4">
          <Bloc
            titre="Applications autorisées"
            detail="Les intégrations qui ont obtenu un accès à votre Jiska via OAuth. Révoquer coupe tous leurs jetons immédiatement."
          >
            {sessions.length === 0 ? (
              <p className="text-sm text-stone">
                Aucune application connectée pour l&apos;instant. Lancez le flow
                depuis votre client (Claude Desktop, Claude Code, …) et il
                apparaîtra ici après consentement.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-hairline">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface text-xs uppercase tracking-wide text-stone">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Application</th>
                      <th className="px-4 py-2.5 font-medium">Autorisée le</th>
                      <th className="px-4 py-2.5 font-medium">Dernière activité</th>
                      <th className="px-4 py-2.5 text-right font-medium">Accès</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {sessions.map((s) => (
                      <tr key={s.client_id}>
                        <td className="px-4 py-3 font-medium text-ink">
                          {s.client_name}
                        </td>
                        <td className="px-4 py-3 text-xs text-stone">
                          {formatDate(s.depuis)}
                        </td>
                        <td className="px-4 py-3 text-xs text-stone">
                          {s.derniere_utilisation
                            ? formatDate(s.derniere_utilisation)
                            : "jamais"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => revoquer(s)}
                            className="rounded-lg px-3 py-1.5 text-sm font-medium text-danger transition hover:bg-danger-soft"
                          >
                            Révoquer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Bloc>

          <Bloc
            titre="Connecter Jiska à une IA"
            detail="Pour piloter Jiska depuis Claude Desktop, Claude Code ou tout autre client compatible Model Context Protocol."
          >
            <McpSection role={role} tools={tools} copier={copier} />
          </Bloc>

          <Bloc
            titre="Documentation des endpoints"
            detail="Pour appeler l'API directement (sans MCP). Filtrés selon votre rôle."
          >
            <IntroApi />
            <div className="mt-6 flex flex-col gap-6">
              {categories.map((cat) => (
                <Section key={cat.cle} categorie={cat} copier={copier} />
              ))}
            </div>
          </Bloc>
        </div>
      </div>

      <ToastHost toasts={toasts} />
    </div>
  );
}

function McpSection({
  role,
  tools,
  copier,
}: {
  role: Role;
  tools: { name: string; description: string }[];
  copier: (valeur: string, message?: string) => void;
}) {
  const configClaudeDesktop = `{
  "mcpServers": {
    "jiska": {
      "type": "http",
      "url": "https://jiska.skapa.design/mcp"
    }
  }
}`;

  const configClaudeCode = `claude mcp add --transport http jiska https://jiska.skapa.design/mcp`;

  return (
    <div className="flex flex-col gap-5 text-sm">
      <div className="rounded-lg bg-surface p-4 text-ink">
        <p>
          <strong>Endpoint :</strong>{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
            https://jiska.skapa.design/mcp
          </code>
        </p>
        <p className="mt-2">
          <strong>Authentification :</strong> OAuth 2.1 avec PKCE et Dynamic
          Client Registration. Au premier appel, votre client vous ouvre
          cette URL de Jiska pour que vous validiez l&apos;accès. Aucun
          secret à copier.
        </p>
        <p className="mt-2 text-xs text-stone">
          Compatible Claude Desktop, Claude Code, Claude.ai web connector, et
          tout client qui respecte la MCP Authorization spec (2025-03-26).
        </p>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-ink">Claude Desktop</h3>
        <p className="mb-2 text-xs text-stone">
          Ajoutez cette entrée dans{" "}
          <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">
            claude_desktop_config.json
          </code>{" "}
          (macOS :{" "}
          <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">
            ~/Library/Application Support/Claude/
          </code>
          ) puis relancez Claude. Il vous ouvrira une page de connexion à la
          première utilisation.
        </p>
        <BlocCode titre="Configuration" code={configClaudeDesktop} copier={copier} />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-ink">Claude Code</h3>
        <p className="mb-2 text-xs text-stone">
          Une seule commande : le CLI déclenche automatiquement l&apos;écran
          de consentement dans votre navigateur à la première utilisation.
        </p>
        <BlocCode titre="Commande" code={configClaudeCode} copier={copier} />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-ink">
          Tools disponibles pour votre rôle ({libelleRole(role)})
        </h3>
        <p className="mb-3 text-xs text-stone">
          {tools.length} tool{tools.length > 1 ? "s" : ""} appelable
          {tools.length > 1 ? "s" : ""}. Les permissions suivent l&apos;API :
          une tentative d&apos;écriture au-delà de vos droits renverra une
          erreur 403.
        </p>
        <div className="overflow-hidden rounded-lg border border-hairline">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-stone">
              <tr>
                <th className="px-4 py-2.5 font-medium">Nom</th>
                <th className="px-4 py-2.5 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {tools.map((t) => (
                <tr key={t.name}>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-ink">
                    {t.name}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-stone">
                    {t.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function IntroApi() {
  return (
    <div className="rounded-lg bg-surface p-4 text-sm text-ink">
      <p>
        <strong>Base :</strong>{" "}
        <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
          https://jiska.skapa.design
        </code>
      </p>
      <p className="mt-2">
        <strong>Authentification :</strong> en-tête
        <code className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-xs">
          Authorization: Bearer &lt;access_token&gt;
        </code>
        obtenu via OAuth 2.1 (
        <code className="rounded bg-white px-1 py-0.5 font-mono text-xs">
          /oauth/authorize
        </code>{" "}
        +{" "}
        <code className="rounded bg-white px-1 py-0.5 font-mono text-xs">
          /oauth/token
        </code>
        ). Métadonnées : <code className="rounded bg-white px-1 py-0.5 font-mono text-xs">/.well-known/oauth-authorization-server</code>.
      </p>
      <p className="mt-2">
        <strong>Erreurs :</strong> réponses JSON
        <code className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-xs">
          {"{ error: string }"}
        </code>
        avec code HTTP adapté (400 payload invalide, 401 token manquant ou
        expiré, 403 permissions insuffisantes, 404 ressource absente, 409
        conflit, 502 erreur côté service tiers).
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
