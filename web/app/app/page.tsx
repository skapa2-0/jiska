import { redirect } from "next/navigation";
import { getSessionUser, isResponsable } from "@/lib/auth";
import { chargerImportsEnAttente } from "@/lib/imports";
import { query } from "@/lib/db";
import { sqlAvatarUrl, sqlLogoUrl } from "@/lib/media";
import BottomNav from "./bottom-nav";
import Navbar from "./navbar";
import ListeProjets from "./produits/liste-projets";
import type { CarteProjet } from "./produits/liste-projets";

// Page principale de l'espace : la vue par produit. Un bandeau de
// synthèse du portefeuille, puis une carte par produit ; le tableau
// de pilotage vit sur la page Actions.
export default async function AppPage() {
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
      deployable: boolean;
      tech: string;
      business: string;
      attrib_tech: string;
      attrib_business: string;
      actifs: string;
      bloques: string;
      retards: string;
      semaine: string;
      total: string;
      derniere: string | null;
      echeance: string | null;
      responsable_id: string | null;
    }>(
      `SELECT p.id, p.name, p.description, p.deployable,
              ${sqlLogoUrl("p")} AS logo,
              least(100, COALESCE((SELECT round(sum(s.poids * CASE s.etat WHEN 'termine' THEN 1 WHEN 'en_validation' THEN 0.5 ELSE 0 END)) FROM sujets s
                WHERE s.project_id = p.id AND s.type = 'technique'), 0)) AS tech,
              least(100, COALESCE((SELECT round(sum(s.poids * CASE s.etat WHEN 'termine' THEN 1 WHEN 'en_validation' THEN 0.5 ELSE 0 END)) FROM sujets s
                WHERE s.project_id = p.id AND s.type = 'business'), 0))  AS business,
              COALESCE((SELECT sum(s.poids) FROM sujets s
                WHERE s.project_id = p.id AND s.type = 'technique'), 0) AS attrib_tech,
              COALESCE((SELECT sum(s.poids) FROM sujets s
                WHERE s.project_id = p.id AND s.type = 'business'), 0)  AS attrib_business,
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

  const projets: CarteProjet[] = projetRows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    logo: p.logo,
    deployable: p.deployable,
    avancement: Math.round(Number(p.tech) * 0.6 + Number(p.business) * 0.4),
    jalonTech: Number(p.tech),
    jalonBusiness: Number(p.business),
    attribTech: Number(p.attrib_tech),
    attribBusiness: Number(p.attrib_business),
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
  }));

  // Synthèse du portefeuille : moyenne sur les produits pondérés,
  // signaux d'alerte agrégés.
  const pondere = projetRows.filter((p) => Number(p.total) > 0);
  const avancementMoyen = pondere.length
    ? Math.round(
        pondere.reduce(
          (acc, p) => acc + Number(p.tech) * 0.6 + Number(p.business) * 0.4,
          0,
        ) / pondere.length,
      )
    : 0;
  const aRisque = projets.filter((p) => p.bloques > 0 || p.retards > 0).length;
  const bloquesTotal = projets.reduce((acc, p) => acc + p.bloques, 0);
  const semaineTotal = projetRows.reduce(
    (acc, p) => acc + Number(p.semaine),
    0,
  );

  const canCreateSujet = dirigeant || (await isResponsable(user.id));
  // Une analyse déjà payée qui dort en base doit se voir depuis l'accueil.
  const enAttente = dirigeant ? await chargerImportsEnAttente(null) : [];

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} canCreateSujet={canCreateSujet} onglet="produits" />
      <main className="w-full flex-1 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
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
          </div>
        </div>

        {projets.length > 0 && (
          <section
            aria-label="Synthèse du portefeuille"
            className="mb-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4"
          >
            <Tuile
              valeur={`${avancementMoyen} %`}
              label="Avancement du portefeuille"
              tint="bg-success-soft text-success"
              ton={
                avancementMoyen >= 75
                  ? "text-success"
                  : avancementMoyen >= 50
                    ? "text-warn"
                    : "text-ink"
              }
              icone="M3 17l6-6 4 4 8-8m0 0h-5m5 0v5"
            />
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

        {projets.length === 0 ? (
          <p className="mt-24 text-center text-[15px] text-stone">
            {dirigeant
              ? "Aucun produit pour l'instant. Créez le premier avec « Nouveau produit »."
              : "Vous ne faites partie d'aucun produit pour l'instant."}
          </p>
        ) : (
          <ListeProjets projets={projets} today={today} />
        )}
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
    href ? "transition hover:-translate-y-0.5" : ""
  }`;
  if (href)
    return (
      <a href={href} className={classe}>
        {contenu}
      </a>
    );
  return <div className={classe}>{contenu}</div>;
}
