import { redirect } from "next/navigation";

// Ancienne route : les projets sont devenus les produits.
export default function AncienneListeProjets() {
  redirect("/app");
}
