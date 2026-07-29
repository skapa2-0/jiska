import { redirect } from "next/navigation";
import { getSessionUser, isResponsable } from "@/lib/auth";
import { query } from "@/lib/db";
import Avatar from "../avatar";
import Navbar from "../navbar";
import ProjetLogo from "../projet-logo";
import Roue, { tonAvancement } from "../roue";

type ProjetCarte = {
  id: string;
  name: string;
  description: string;
  logo: string | null;
  avancement: string | null;
  actifs: string;
  bloques: string;
  responsable_id: string | null;
};

// Vue par projet : une carte par projet, clic pour entrer dans le détail.
export default async function ProjetsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const dirigeant = user.role === "dirigeant";
  const vis = dirigeant
    ? "SELECT id FROM projects"
    : "SELECT project_id FROM project_members WHERE user_id = $1";
  const visParams = dirigeant ? [] : [user.id];

  const [projets, membres] = await Promise.all([
    query<ProjetCarte>(
      `SELECT p.id, p.name, p.description, p.logo,
              (SELECT round(avg(jalon_tech * 0.6 + jalon_business * 0.4))
                 FROM sujets s WHERE s.project_id = p.id)          AS avancement,
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
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projets.map((p) => {
              const equipe = membres.filter((m) => m.project_id === p.id);
              const avancement = Number(p.avancement ?? 0);
              return (
                <li key={p.id}>
                  <a
                    href={`/app/projets/${p.id}`}
                    className="block rounded-lg bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgb(25_28_31/0.08),0_8px_20px_rgb(25_28_31/0.10)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <ProjetLogo
                        name={p.name}
                        logo={p.logo}
                        taille="h-10 w-10 text-xl"
                      />
                      <Roue
                        valeur={avancement}
                        ton={tonAvancement(avancement)}
                        taille="h-11 w-11"
                      />
                    </div>
                    <h2 className="mt-3 line-clamp-1 font-display text-lg font-semibold text-ink">
                      {p.name}
                    </h2>
                    <p className="mt-1 line-clamp-2 min-h-10 text-sm text-mute">
                      {p.description || "Aucune description."}
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="flex items-center -space-x-1.5">
                        {equipe.slice(0, 4).map((m) => (
                          <Avatar
                            key={m.id}
                            personne={m}
                            taille="h-7 w-7 text-[11px]"
                            dore={m.id === p.responsable_id}
                            classe={
                              m.id === p.responsable_id
                                ? ""
                                : "border-2 border-white"
                            }
                          />
                        ))}
                        {equipe.length > 4 && (
                          <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-surface text-[11px] font-semibold text-mute">
                            +{equipe.length - 4}
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-2 text-xs font-medium">
                        <span className="text-mute">
                          {p.actifs} actif{Number(p.actifs) > 1 ? "s" : ""}
                        </span>
                        {Number(p.bloques) > 0 && (
                          <span className="rounded-md bg-danger-soft px-2 py-0.5 font-semibold text-danger">
                            {p.bloques} bloqué{Number(p.bloques) > 1 ? "s" : ""}
                          </span>
                        )}
                      </span>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
