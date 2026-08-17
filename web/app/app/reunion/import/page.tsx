import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { chargerImport, chargerImportsEnAttente } from "@/lib/imports";
import BottomNav from "../../bottom-nav";
import Navbar from "../../navbar";
import { chargerProduits } from "../../charger-produits";
import ImportsEnAttente from "../../imports-en-attente";
import ImportTranscript from "../../import-transcript";

// Portée portefeuille : la réunion hebdomadaire générale, où l'on fait le
// tour de tous les produits. Réservée aux dirigeants, comme la création
// d'un produit.
export default async function ImportReunionPage({
  searchParams,
}: {
  searchParams: Promise<{ reprise?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "dirigeant") redirect("/app");

  const { reprise: repriseId } = await searchParams;
  const [produits, enAttente, reprise] = await Promise.all([
    chargerProduits(null),
    chargerImportsEnAttente(null),
    repriseId ? chargerImport(repriseId, null) : Promise.resolve(null),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} canCreateSujet onglet="produits" />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <a
          href="/app"
          className="text-sm font-medium text-mute transition hover:text-ink"
        >
          ← Tous les produits
        </a>
        <h1 className="mt-3 font-display text-2xl font-medium tracking-[-0.02em] text-ink">
          {reprise
            ? `Vérifier la réunion du ${reprise.dateReunion.split("-").reverse().join("/")}`
            : "Importer une réunion générale"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-stone">
          {reprise
            ? "Analyse déjà effectuée : il reste à accepter, corriger ou rejeter chaque proposition."
            : `Le compte rendu est analysé sur l'ensemble du portefeuille (${produits.length} produit${produits.length > 1 ? "s" : ""}). Rien n'est écrit avant votre validation, proposition par proposition.`}
        </p>

        {!reprise && (
          <ImportsEnAttente imports={enAttente} base="/app/reunion/import" />
        )}

        <ImportTranscript
          produits={produits}
          porteeProjetId={null}
          retour="/app"
          reprise={reprise}
        />
      </main>
      <BottomNav onglet="produits" canCreate />
    </div>
  );
}
