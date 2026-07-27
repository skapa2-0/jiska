import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

// Aiguillage : espace connecté si session valide, sinon portail de connexion.
export default async function Home() {
  const user = await getSessionUser();
  redirect(user ? "/app" : "/login");
}
