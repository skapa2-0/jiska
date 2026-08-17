import { redirect } from "next/navigation";
import { canManageSujets, getSessionUser, isResponsable } from "@/lib/auth";
import BottomNav from "../../../bottom-nav";
import Navbar from "../../../navbar";
import { chargerProduits } from "../../../charger-produits";
import ImportTranscript from "../../../import-transcript";

// Portée produit : une réunion qui ne porte que sur ce produit. Le
// catalogue envoyé au modèle est réduit à ce produit, et la route
// d'application refuse toute écriture ailleurs.
export default async function ImportProduitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  if (!/^\d+$/.test(id)) redirect("/app");
  if (!(await canManageSujets(user, id))) redirect(`/app/produits/${id}`);

  const produits = await chargerProduits(id);
  const produit = produits[0];
  if (!produit) redirect("/app");

  const canCreateSujet =
    user.role === "dirigeant" || (await isResponsable(user.id));

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} canCreateSujet={canCreateSujet} onglet="produits" />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <a
          href={`/app/produits/${id}`}
          className="text-sm font-medium text-mute transition hover:text-ink"
        >
          ← Retour au produit
        </a>
        <h1 className="mt-3 font-display text-2xl font-medium tracking-[-0.02em] text-ink">
          Importer une réunion « {produit.name} »
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-stone">
          L&apos;analyse est limitée à ce produit et à ses{" "}
          {produit.sujets.length} sujet
          {produit.sujets.length > 1 ? "s" : ""} : aucune proposition ne peut
          concerner un autre produit.
        </p>
        <ImportTranscript
          produits={produits}
          porteeProjetId={id}
          retour={`/app/produits/${id}`}
        />
      </main>
      <BottomNav onglet="produits" canCreate={canCreateSujet} />
    </div>
  );
}
