// Client minimal de l'API GraphQL Fireflies.ai, côté serveur uniquement.
// Deux usages : lister les réunions Fireflies qui ont eu lieu un lundi
// autour de 11h (c'est la réunion hebdo Skapa, le candidat légitime à
// un import en portée portefeuille) et récupérer le transcript complet
// d'une de ces réunions pour le passer dans le flow d'analyse existant.

const ENDPOINT = "https://api.fireflies.ai/graphql";

// Fenêtre autour de l'heure cible, en minutes locales Europe/Paris.
const CIBLE_HEURE = 11;
const DEMI_FENETRE = 30;

export type ReunionLundi = {
  id: string;
  titre: string;
  dateReunion: string; // AAAA-MM-JJ en Europe/Paris
  heureLocale: string; // HH:MM en Europe/Paris
  dureeMinutes: number;
  nbParticipants: number;
};

export type TranscriptComplet = {
  id: string;
  titre: string;
  dateReunion: string; // AAAA-MM-JJ en Europe/Paris
  texte: string; // Prêt pour l'extraction : "Nom : phrase" ligne par ligne
};

async function graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = process.env.FIREFLIES_API_KEY;
  if (!token) {
    throw new Error("FIREFLIES_API_KEY absente : ajoutez-la dans deploy/.env.");
  }
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Fireflies ${res.status} : ${await res.text()}`);
  }
  const payload = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (payload.errors?.length) {
    throw new Error(`Fireflies : ${payload.errors.map((e) => e.message).join(" ; ")}`);
  }
  if (!payload.data) throw new Error("Fireflies : réponse vide.");
  return payload.data;
}

// Composantes locales Europe/Paris d'un instant, utilisées pour décider
// si une réunion a eu lieu "un lundi vers 11h". Intl gère le DST, pas
// besoin de câbler l'offset à la main.
function partiesParis(epochMs: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(epochMs));
  const g = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    weekday: g("weekday"), // "Mon", "Tue", ...
    date: `${g("year")}-${g("month")}-${g("day")}`,
    heure: `${g("hour")}:${g("minute")}`,
    minutes: Number(g("hour")) * 60 + Number(g("minute")),
  };
}

function estLundiVers11h(epochMs: number): boolean {
  const p = partiesParis(epochMs);
  if (p.weekday !== "Mon") return false;
  const bas = CIBLE_HEURE * 60 - DEMI_FENETRE;
  const haut = CIBLE_HEURE * 60 + DEMI_FENETRE;
  return p.minutes >= bas && p.minutes <= haut;
}

// Les 20 derniers lundis Skapa suffisent largement : la page montrera les
// 10 plus récents. On tire 50 transcripts et on filtre côté serveur plutôt
// que de bricoler fromDate/toDate avec DST.
export async function listerLundis(limite = 10): Promise<ReunionLundi[]> {
  const data = await graphql<{
    transcripts: {
      id: string;
      title: string;
      date: number;
      duration: number;
      participants: string[];
    }[];
  }>(
    `{
       transcripts(limit: 50) {
         id
         title
         date
         duration
         participants
       }
     }`,
  );
  return data.transcripts
    .filter((t) => estLundiVers11h(t.date))
    .slice(0, limite)
    .map((t) => {
      const p = partiesParis(t.date);
      return {
        id: t.id,
        titre: t.title ?? "(sans titre)",
        dateReunion: p.date,
        heureLocale: p.heure,
        dureeMinutes: Math.round(t.duration ?? 0),
        nbParticipants: t.participants?.length ?? 0,
      };
    });
}

// Formattage du transcript pour le pipeline d'extraction : une ligne par
// phrase, préfixée du nom du locuteur. Pas d'horodatage par phrase, le
// prompt ne l'exploite pas et il gonflerait la taille sans valeur.
export async function recupererTranscript(id: string): Promise<TranscriptComplet> {
  const data = await graphql<{
    transcript: {
      id: string;
      title: string;
      date: number;
      sentences: { speaker_name: string | null; text: string }[];
    } | null;
  }>(
    `query($id: String!) {
       transcript(id: $id) {
         id
         title
         date
         sentences { speaker_name text }
       }
     }`,
    { id },
  );
  const t = data.transcript;
  if (!t) throw new Error("Transcript Fireflies introuvable.");

  const texte = (t.sentences ?? [])
    .map((s) => `${s.speaker_name ?? "Inconnu"} : ${s.text ?? ""}`.trim())
    .filter((ligne) => ligne.length > 3)
    .join("\n");

  if (texte.length < 200) {
    throw new Error("Transcript trop court : réunion non transcrite ou vide.");
  }

  return {
    id: t.id,
    titre: t.title ?? "(sans titre)",
    dateReunion: partiesParis(t.date).date,
    texte,
  };
}
