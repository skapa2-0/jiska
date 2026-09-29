import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { sqlAvatarUrl } from "@/lib/media";
import BottomNav from "../bottom-nav";
import Navbar from "../navbar";
import TicketsManager from "./tickets-manager";
import type { Ticket } from "./tickets-manager";

// Tickets support : chacun voit et crée les siens ; l'équipe developeur
// voit tous les tickets et peut changer leur statut.
export default async function TicketsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const developeur = user.role === "developeur";

  const rows = await query<{
    id: string;
    titre: string;
    description: string;
    priorite: string;
    statut: string;
    created_at: string;
    updated_at: string;
    auteur_id: string | null;
    auteur_email: string | null;
    auteur_first_name: string | null;
    auteur_last_name: string | null;
    auteur_avatar: string | null;
  }>(
    `SELECT t.id, t.titre, t.description, t.priorite, t.statut,
            t.created_at::text AS created_at,
            t.updated_at::text AS updated_at,
            u.id AS auteur_id, u.email AS auteur_email,
            u.first_name AS auteur_first_name, u.last_name AS auteur_last_name,
            ${sqlAvatarUrl("u")} AS auteur_avatar
       FROM tickets t
       LEFT JOIN users u ON u.id = t.auteur_id
      WHERE $1 OR t.auteur_id = $2
      ORDER BY
        CASE t.statut
          WHEN 'ouvert' THEN 0
          WHEN 'en_cours' THEN 1
          WHEN 'resolu' THEN 2
          WHEN 'ferme' THEN 3
        END,
        CASE t.priorite
          WHEN 'haute' THEN 0
          WHEN 'normale' THEN 1
          WHEN 'basse' THEN 2
        END,
        t.created_at DESC`,
    [developeur, user.id],
  );

  const tickets: Ticket[] = rows.map((r) => ({
    id: r.id,
    titre: r.titre,
    description: r.description,
    priorite: r.priorite,
    statut: r.statut,
    createdAt: r.created_at,
    auteur: r.auteur_id
      ? {
          id: r.auteur_id,
          email: r.auteur_email ?? "",
          first_name: r.auteur_first_name ?? "",
          last_name: r.auteur_last_name ?? "",
          avatar: r.auteur_avatar,
        }
      : null,
  }));

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} canCreateSujet={false} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="font-display text-2xl font-medium tracking-[-0.02em] text-ink">
          {developeur ? "Tickets" : "Signaler un problème"}
        </h1>
        <p className="mt-2 text-sm text-stone">
          {developeur
            ? "Les tickets ouverts par les utilisateurs de la plateforme. Passez leur statut au fil de leur traitement."
            : "Décrivez ce qui ne va pas ou ce qui manque : l'équipe technique reçoit le ticket et vous verrez son statut évoluer ici."}
        </p>
        <TicketsManager tickets={tickets} developeur={developeur} />
      </main>
      <BottomNav canCreate={false} />
    </div>
  );
}
