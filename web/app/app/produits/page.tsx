import { redirect } from "next/navigation";

// La vue Projets est devenue la page principale de l'espace : cette
// route ne sert plus qu'à rediriger les anciens liens.
export default function ProjetsPage() {
  redirect("/app");
}
