import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { chargerClient, SCOPE_PAR_DEFAUT } from "@/lib/oauth";
import ConsentForm from "./consent-form";

// Point d'entrée du flow OAuth : affiche la page de consentement
// à l'utilisateur authentifié. Les erreurs qui concernent le client
// (redirect_uri inconnue, client_id invalide) s'affichent dans Jiska
// et ne redirigent nulle part (sinon on offrirait une porte à des
// URL arbitraires). Les erreurs sur les autres paramètres redirigent
// vers la redirect_uri avec `error=` une fois celle-ci validée.

type Params = {
  client_id?: string;
  redirect_uri?: string;
  response_type?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
  scope?: string;
};

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const q = await searchParams;

  if (!q.client_id) return <ErreurPage titre="Paramètre client_id manquant." />;
  if (!q.redirect_uri)
    return <ErreurPage titre="Paramètre redirect_uri manquant." />;

  const client = await chargerClient(q.client_id);
  if (!client) {
    return <ErreurPage titre="Client inconnu. Enregistrez-le d'abord via /oauth/register." />;
  }
  if (!client.redirect_uris.includes(q.redirect_uri)) {
    return (
      <ErreurPage
        titre="redirect_uri non enregistrée pour ce client."
        detail="Pour des raisons de sécurité, la redirect_uri doit correspondre à l'une de celles déclarées lors de l'enregistrement du client."
      />
    );
  }

  // À partir d'ici la redirect_uri est validée : on peut y rebondir
  // avec `error=` quand un autre paramètre est fautif.
  if (q.response_type !== "code") {
    return redirect(
      formerErreurRedirect(q.redirect_uri, "unsupported_response_type", q.state),
    );
  }
  if (!q.code_challenge || q.code_challenge_method !== "S256") {
    return redirect(
      formerErreurRedirect(q.redirect_uri, "invalid_request", q.state),
    );
  }
  const scope = q.scope?.trim() ? q.scope.trim() : SCOPE_PAR_DEFAUT;

  const me = await getSessionUser();
  if (!me) {
    // Pas de session Clerk : on détourne vers /login puis on revient.
    const url = new URL("/login", "https://host.invalid"); // base ignorée
    const next =
      "/oauth/authorize?" + new URLSearchParams(q as Record<string, string>).toString();
    url.searchParams.set("next", next);
    redirect(`${url.pathname}?${url.searchParams.toString()}`);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-5 py-10">
      <ConsentForm
        clientName={client.client_name}
        clientId={client.client_id}
        redirectUri={q.redirect_uri}
        codeChallenge={q.code_challenge}
        codeChallengeMethod={q.code_challenge_method}
        scope={scope}
        state={q.state ?? ""}
        utilisateur={{
          prenom: me.first_name,
          nom: me.last_name,
          email: me.email,
          role: me.role,
        }}
      />
    </main>
  );
}

function ErreurPage({ titre, detail }: { titre: string; detail?: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-5 py-10">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG local */}
        <img
          src="/logo.svg"
          alt=""
          aria-hidden="true"
          className="mb-6 h-8 w-auto"
        />
        <h1 className="text-lg font-semibold text-ink">Autorisation impossible</h1>
        <p className="mt-3 text-sm text-mute">{titre}</p>
        {detail && <p className="mt-2 text-xs text-stone">{detail}</p>}
      </div>
    </main>
  );
}

function formerErreurRedirect(
  redirect_uri: string,
  code: string,
  state?: string,
): string {
  const url = new URL(redirect_uri);
  url.searchParams.set("error", code);
  if (state) url.searchParams.set("state", state);
  return url.toString();
}
