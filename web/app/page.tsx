import { redirect } from "next/navigation";

// Pas encore de page d'accueil : tout passe par le portail de connexion.
export default function Home() {
  redirect("/login");
}
