import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import Navbar from "../../../navbar";
import ProjetForm from "../../projet-form";

// Édition d'un projet : réservée aux dirigeants.
export default async function ModifierProjetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "dirigeant") redirect("/app/projets");

  const { id } = await params;
  if (!/^\d+$/.test(id)) redirect("/app/projets");

  const [projets, membres, people] = await Promise.all([
    query<{
      id: string;
      name: string;
      description: string;
      logo: string | null;
    }>("SELECT id, name, description, logo FROM projects WHERE id = $1", [id]),
    query<{ user_id: string; is_responsable: boolean }>(
      "SELECT user_id, is_responsable FROM project_members WHERE project_id = $1",
      [id],
    ),
    query<{
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      avatar: string | null;
      role: string;
    }>(
      "SELECT id, email, first_name, last_name, avatar, role FROM users ORDER BY last_name, first_name, email",
    ),
  ]);

  const projet = projets[0];
  if (!projet) redirect("/app/projets");

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} canCreateSujet onglet="projets" />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <a
          href={`/app/projets/${projet.id}`}
          className="text-sm font-medium text-mute transition hover:text-ink"
        >
          ← Retour au projet
        </a>
        <h1 className="mt-3 font-display text-2xl font-medium tracking-[-0.02em] text-ink">
          Modifier « {projet.name} »
        </h1>
        <ProjetForm
          people={people}
          initial={{
            id: projet.id,
            name: projet.name,
            description: projet.description,
            logo: projet.logo,
            memberIds: membres.map((m) => m.user_id),
            responsableId:
              membres.find((m) => m.is_responsable)?.user_id ?? "",
          }}
        />
      </main>
    </div>
  );
}
