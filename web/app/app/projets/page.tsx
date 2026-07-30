import { redirect } from "next/navigation";
import { getSessionUser, isResponsable } from "@/lib/auth";
import { query } from "@/lib/db";
import Navbar from "../navbar";
import ListeProjets from "./liste-projets";
import type { CarteProjet } from "./liste-projets";

// Vue par projet : une carte par projet, clic pour entrer dans le détail.
export default async function ProjetsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const dirigeant = user.role === "dirigeant";
  const vis = dirigeant
    ? "SELECT id FROM projects"
    : "SELECT project_id FROM project_members WHERE user_id = $1";
  const visParams = dirigeant ? [] : [user.id];

  const [projetRows, membres] = await Promise.all([
    query<{
      id: string;
      name: string;
      description: string;
      logo: string | null;
      avancement: string | null;
      actifs: string;
      bloques: string;
      responsable_id: string | null;
    }>(
      `SELECT p.id, p.name, p.description, p.logo,
              round(p.jalon_tech * 0.6 + p.jalon_business * 0.4)   AS avancement,
              (SELECT count(*) FROM sujets s
                WHERE s.project_id = p.id AND s.etat <> 'termine') AS actifs,
              (SELECT count(*) FROM sujets s
                WHERE s.project_id = p.id AND s.etat = 'bloque')   AS bloques,
              (SELECT m.user_id FROM project_members m
                WHERE m.project_id = p.id AND m.is_responsable LIMIT 1) AS responsable_id
         FROM projects p
        WHERE p.id IN (${vis})
        ORDER BY p.name`,
      visParams,
    ),
    query<{
      project_id: string;
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      avatar: string | null;
    }>(
      `SELECT m.project_id, u.id, u.email, u.first_name, u.last_name, u.avatar
         FROM project_members m
         JOIN users u ON u.id = m.user_id
        WHERE m.project_id IN (${vis})
        ORDER BY u.email`,
      visParams,
    ),
  ]);

  const projets: CarteProjet[] = projetRows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    logo: p.logo,
    avancement: Number(p.avancement ?? 0),
    actifs: Number(p.actifs),
    bloques: Number(p.bloques),
    responsableId: p.responsable_id,
    equipe: membres
      .filter((m) => m.project_id === p.id)
      .map((m) => ({
        id: m.id,
        email: m.email,
        first_name: m.first_name,
        last_name: m.last_name,
        avatar: m.avatar,
      })),
  }));

  const canCreateSujet = dirigeant || (await isResponsable(user.id));

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} canCreateSujet={canCreateSujet} onglet="projets" />
      <main className="w-full flex-1 px-6 py-8 lg:px-8">
        {projets.length === 0 ? (
          <p className="mt-24 text-center text-[15px] text-stone">
            {dirigeant
              ? "Aucun projet pour l'instant. Créez le premier avec « Nouveau projet »."
              : "Vous ne faites partie d'aucun projet pour l'instant."}
          </p>
        ) : (
          <ListeProjets projets={projets} />
        )}
      </main>
    </div>
  );
}
