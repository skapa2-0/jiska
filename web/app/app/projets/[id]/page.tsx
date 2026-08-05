import { redirect } from "next/navigation";

// Ancienne route : les projets sont devenus les produits.
export default async function AncienDetailProjet({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(/^\d+$/.test(id) ? `/app/produits/${id}` : "/app");
}
