import { redirect } from "next/navigation";
import { estAdmin, getSessionUser, isResponsable } from "@/lib/auth";
import { chargerImportsEnAttente } from "@/lib/imports";
import { query } from "@/lib/db";
import { sqlAvatarUrl, sqlLogoUrl } from "@/lib/media";
import { lireSemaine, sqlSemaine } from "@/lib/semaine";
import type { SemaineRow } from "@/lib/semaine";
import BottomNav from "./bottom-nav";
import Navbar from "./navbar";
import ListeProjets from "./produits/liste-projets";
import RechercheInput from "./produits/recherche-input";
import SujetsTransverses from "./sujets-transverses";
import type { SujetTransverse } from "./sujets-transverses";
import type { CarteProjet } from "./produits/liste-projets";

// Page principale de l'espace : la vue par produit. Un bandeau de
// synthèse du portefeuille, puis une carte par produit ; le tableau
// de pilotage vit sur la page Actions.
export default async function AppPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const dirigeant = estAdmin(user);
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
      deployable: boolean;
      tech: string;
      business: string;
      actifs: string;
      bloques: string;
      retards: string;
      semaine: string;
      total: string;
      derniere: string | null;
      echeance: string | null;
      responsable_id: string | null;
    } & SemaineRow>(
      `SELECT p.id, p.name, p.description, p.deployable,
              ${sqlSemaine("p")},
              ${sqlLogoUrl("p")} AS logo,
              (SELECT count(*) FROM sujets s
                WHERE s.project_id = p.id AND s.type = 'technique') AS tech,
              (SELECT count(*) FROM sujets s
                WHERE s.project_id = p.id AND s.type = 'business')  AS business,
              (SELECT min(s.due_date)::text FROM sujets s
                WHERE s.project_id = p.id AND s.etat <> 'termine'
                  AND s.due_date IS NOT NULL)                      AS echeance,
              (SELECT count(*) FROM sujets s
                WHERE s.project_id = p.id AND s.etat <> 'termine') AS actifs,
              (SELECT count(*) FROM sujets s
                WHERE s.project_id = p.id AND s.etat = 'bloque')   AS bloques,
              (SELECT count(*) FROM sujets s
                WHERE s.project_id = p.id AND s.etat <> 'termine'
                  AND s.due_date < current_date)                   AS retards,
              (SELECT count(*) FROM sujets s
                WHERE s.project_id = p.id AND s.etat <> 'termine'
                  AND s.due_date >= date_trunc('week', current_date)::date
                  AND s.due_date <  date_trunc('week', current_date)::date + 7) AS semaine,
              (SELECT count(*) FROM sujets s
                WHERE s.project_id = p.id)                         AS total,
              (SELECT max(s.updated_at)::date::text FROM sujets s
                WHERE s.project_id = p.id)                         AS derniere,
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
      `SELECT m.project_id, u.id, u.email, u.first_name, u.last_name,
              ${sqlAvatarUrl("u")} AS avatar
         FROM project_members m
         JOIN users u ON u.id = m.user_id
        WHERE m.project_id IN (${vis})
        ORDER BY u.email`,
      visParams,
    ),
  ]);

  const projets: CarteProjet[] = projetRows.map((p) => {
    const tech = Number(p.tech);
    const business = Number(p.business);
    const total = tech + business;
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      logo: p.logo,
      deployable: p.deployable,
      semaine: lireSemaine(p),
      repartition: {
        tech,
        business,
        total,
        partTech: total ? Math.round((tech / total) * 100) : 0,
        partBusiness: total ? 100 - Math.round((tech / total) * 100) : 0,
      },
      echeance: p.echeance,
      actifs: Number(p.actifs),
      bloques: Number(p.bloques),
      retards: Number(p.retards),
      derniere: p.derniere,
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
    };
  });

  // Synthèse du portefeuille : les signaux d'alerte agrégés. L'avancement
  // moyen a été retiré (plus de pondération produit).
  const aRisque = projets.filter((p) => p.bloques > 0 || p.retards > 0).length;
  const bloquesTotal = projets.reduce((acc, p) => acc + p.bloques, 0);
  const semaineTotal = projetRows.reduce(
    (acc, p) => acc + Number(p.semaine),
    0,
  );

  // Sujets transverses : aucun produit, donc aucun filtre d'appartenance.
  // Ils concernent l'entreprise, tout le monde les voit.
  const transverseRows = await query<{
    id: string;
    title: string;
    action: string;
    due_date: string | null;
    type: "technique" | "business";
    etat: string;
    criticite: string;
    porteur_id: string | null;
    porteur_email: string | null;
    porteur_first_name: string | null;
    porteur_last_name: string | null;
    porteur_avatar: string | null;
  }>(
    `SELECT s.id, s.title, s.action, s.due_date::text AS due_date,
            s.type, s.etat, s.criticite, s.porteur_id,
            u.email AS porteur_email,
            u.first_name AS porteur_first_name,
            u.last_name AS porteur_last_name,
            ${sqlAvatarUrl("u")} AS porteur_avatar
       FROM sujets s
       LEFT JOIN users u ON u.id = s.porteur_id
      WHERE s.project_id IS NULL
      ORDER BY s.etat = 'termine', s.due_date NULLS LAST, s.id`,
  );
  const transverses: SujetTransverse[] = transverseRows.map((s) => ({
    id: s.id,
    titre: s.title,
    action: s.action,
    echeance: s.due_date,
    type: s.type,
    etat: s.etat,
    criticite: s.criticite,
    porteur: s.porteur_id
      ? {
          id: s.porteur_id,
          email: s.porteur_email ?? "",
          first_name: s.porteur_first_name,
          last_name: s.porteur_last_name,
          avatar: s.porteur_avatar,
        }
      : null,
  }));

  const canCreateSujet = dirigeant || (await isResponsable(user.id));
  // Une analyse déjà payée qui dort en base doit se voir depuis l'accueil.
  const enAttente = dirigeant ? await chargerImportsEnAttente(null) : [];

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} canCreateSujet={canCreateSujet} onglet="produits" />
      {/* Pas de padding-bottom : le bloc viewport-lock plus bas gère
          la hauteur restante, un pb ajouterait du scroll fantôme. */}
      <main className="w-full flex-1 px-4 pt-5 sm:px-6 sm:pt-8 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-medium tracking-[-0.02em] text-ink">
            Produits
          </h1>
          <div className="flex flex-wrap items-center gap-2">
          {dirigeant && (
            <a
              href="/app/reunion/import"
              className="flex items-center gap-1.5 rounded-lg border border-hairline px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 16V4m0 0L8 8m4-4 4 4M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
              </svg>
              Importer une réunion
              {enAttente.length > 0 && (
                <span className="rounded-md bg-warn-soft px-1.5 py-0.5 text-xs font-semibold text-warn">
                  {enAttente.length}
                </span>
              )}
            </a>
          )}
          {projets.length > 0 && (
            <a
              href="/app/reunion"
              className="flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:opacity-85"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 2.5 12.5 8 4 13.5V2.5Z" />
              </svg>
              Passer en revue
            </a>
          )}
          {projets.length > 0 && <RechercheInput />}
          </div>
        </div>

        {/* Viewport-lock à partir des tuiles synthèse : sur lg+ la hauteur
            est exactement viewport - navbar (57 px). Une fois qu'on a
            scrollé la barre du haut (titre + boutons + recherche), les
            tuiles se calent sous la navbar, et la mosaïque + les
            transverses défilent en interne sans jamais faire déborder la
            page. Sur mobile, scroll classique. */}
        <div className="mt-5 lg:flex lg:h-[calc(100dvh-57px)] lg:flex-col lg:pt-4 lg:pb-4">
          {projets.length > 0 && (
            <section
              aria-label="Synthèse du portefeuille"
              className="mb-4 grid shrink-0 grid-cols-3 gap-2.5"
            >
              <Tuile
                valeur={aRisque}
                label="Produits à risque"
                tint="bg-danger-soft text-danger"
                ton={aRisque > 0 ? "text-danger" : "text-success"}
                icone="M12 4 2.5 20h19L12 4Zm0 6v4m0 3v.01"
              />
              <Tuile
                valeur={bloquesTotal}
                label="Sujets bloqués"
                tint="bg-danger-soft text-danger"
                ton={bloquesTotal > 0 ? "text-danger" : "text-success"}
                icone="M7 10V7a5 5 0 0 1 10 0v3m-11 0h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"
                href="/app/actions?filtre=bloques"
              />
              <Tuile
                valeur={semaineTotal}
                label="Échéances cette semaine"
                tint="bg-warn-soft text-warn"
                icone="M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm3-3v4m8-4v4M4 11h16"
                href="/app/actions?filtre=semaine"
              />
            </section>
          )}

          {/* Zone scrollable : mosaïque des produits puis transverses,
              une seule barre de défilement pour l'ensemble. Sur mobile
              (< lg), pas de min-h-0 ni d'overflow, donc la page défile
              comme d'habitude. */}
          <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
            {projets.length === 0 ? (
              <p className="mt-24 text-center text-[15px] text-stone">
                {dirigeant
                  ? "Aucun produit pour l'instant. Créez le premier avec « Nouveau produit »."
                  : "Vous ne faites partie d'aucun produit pour l'instant."}
              </p>
            ) : (
              <ListeProjets projets={projets} today={today} />
            )}

            {/* Ce qui ne relève d'aucun produit se range ici, sous la grille. */}
            <div className={projets.length === 0 ? "mt-10" : "mt-7"}>
              <SujetsTransverses
                sujets={transverses}
                peutCreer={dirigeant}
                today={today}
              />
            </div>
          </div>
        </div>
      </main>
      <BottomNav onglet="produits" canCreate={canCreateSujet} />
    </div>
  );
}

// Tuile de synthèse : cliquable quand elle mène à la page Actions
// filtrée.
function Tuile({
  valeur,
  label,
  tint,
  ton,
  icone,
  href,
}: {
  valeur: number | string;
  label: string;
  tint: string;
  ton?: string;
  icone: string;
  href?: string;
}) {
  const contenu = (
    <>
      <span
        aria-hidden="true"
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tint}`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={icone} />
        </svg>
      </span>
      <span className="min-w-0">
        <span
          className={`block font-display text-[21px] font-semibold leading-tight ${ton ?? "text-ink"}`}
        >
          {valeur}
        </span>
        <span className="block truncate text-xs font-medium text-mute">
          {label}
        </span>
      </span>
    </>
  );
  const classe = `flex items-center gap-2.5 rounded-lg bg-white px-3 py-2.5 text-left shadow-card ${
    href
      ? "ring-1 ring-transparent transition duration-150 hover:ring-brand/40"
      : ""
  }`;
  if (href)
    return (
      <a href={href} className={classe}>
        {contenu}
      </a>
    );
  return <div className={classe}>{contenu}</div>;
}
