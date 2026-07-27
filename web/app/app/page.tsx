import { redirect } from "next/navigation";
import { getSessionUser, isResponsable } from "@/lib/auth";
import { query } from "@/lib/db";
import Navbar from "./navbar";

type ProjectRow = {
  id: string;
  name: string;
  description: string;
  responsable: string | null;
  members: string;
};

// L'espace connecté : les dirigeants voient tous les projets (vue
// d'ensemble), les collaborateurs uniquement les leurs.
export default async function AppPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const dirigeant = user.role === "dirigeant";
  const projects = await query<ProjectRow>(
    `SELECT p.id, p.name, p.description,
            (SELECT u.email FROM project_members m JOIN users u ON u.id = m.user_id
              WHERE m.project_id = p.id AND m.is_responsable LIMIT 1) AS responsable,
            (SELECT count(*) FROM project_members m WHERE m.project_id = p.id) AS members
       FROM projects p
      ${dirigeant ? "" : "WHERE EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.user_id = $1)"}
      ORDER BY p.created_at DESC`,
    dirigeant ? [] : [user.id],
  );

  const canCreateSujet = dirigeant || (await isResponsable(user.id));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar
        email={user.email}
        role={user.role}
        canCreateSujet={canCreateSujet}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        {projects.length === 0 ? (
          <p className="mt-24 text-center text-[15px] text-stone">
            {dirigeant
              ? "Aucun projet pour l'instant. Créez le premier avec « Nouveau projet »."
              : "Vous ne faites partie d'aucun projet pour l'instant."}
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <li
                key={p.id}
                className="rounded-2xl border border-hairline bg-white p-5"
              >
                <h2 className="font-display text-lg font-medium text-ink">
                  {p.name}
                </h2>
                {p.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-mute">
                    {p.description}
                  </p>
                )}
                <p className="mt-4 text-xs text-stone">
                  {p.responsable
                    ? `Responsable : ${p.responsable}`
                    : "Sans responsable"}
                  {" · "}
                  {p.members} membre{Number(p.members) > 1 ? "s" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
