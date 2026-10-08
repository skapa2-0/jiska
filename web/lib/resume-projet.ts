// Résumé IA d'un produit : 2 à 3 phrases qui disent ce que la dernière
// réunion appliquée raconte du produit, en appui sur l'état réel des
// sujets. Déclenché à l'application d'un import, pour chaque produit
// touché par au moins une proposition retenue. Pas d'auto-maintenance
// hors import : on veut le contexte dit en réunion, pas un résumé qui
// dérive au fil des saisies manuelles.

import Anthropic from "@anthropic-ai/sdk";
import { ETATS, TYPES_SUJET } from "./sujets";
import type { Criticite, Etat, TypeSujet } from "./sujets";

export type SujetContexte = {
  title: string;
  type: TypeSujet;
  etat: Etat;
  criticite: Criticite;
  action: string;
};

export type ContexteResume = {
  nom: string;
  description: string;
  sujets: SujetContexte[];
};

const SYSTEME = `Tu rédiges un résumé très court (2 à 3 phrases, 300 caractères grand maximum) du contexte d'un produit, à usage de bandeau en haut de la page produit.

Règles absolues :
- Appuie-toi uniquement sur ce qui a été dit en réunion. Aucune spéculation, aucun comblement de trou.
- Si la réunion ne parle pas de ce produit, réponds exactement : "Pas évoqué cette fois.".
- Croise avec l'état actuel des sujets pour rester juste (ex. ne pas dire "en bonne voie" si un sujet est bloqué).
- Pas de liste, pas de titres, pas d'énumération. Du texte courant, direct.
- Pas de tiret cadratin (—). Utilise des deux-points, des parenthèses ou un simple point.
- Pas de superlatifs ("formidable", "excellent"). Un ton factuel d'outil de pilotage.
- Pas de méta ("ce résumé...", "la réunion a abordé...") : va droit au contenu.`;

function contexte(
  produit: ContexteResume,
  dateReunion: string,
  transcript: string,
): string {
  const sujets = produit.sujets
    .map(
      (s) =>
        `- ${s.title} (${TYPES_SUJET[s.type]?.court ?? s.type}, ${ETATS[s.etat]?.label ?? s.etat}, criticité ${s.criticite})` +
        (s.action ? ` : action = ${s.action}` : ""),
    )
    .join("\n");

  return [
    `Produit : ${produit.nom}`,
    produit.description ? `Description : ${produit.description}` : "",
    `Date de la réunion : ${dateReunion}`,
    ``,
    `# Sujets actuels du produit`,
    sujets || "(aucun sujet)",
    ``,
    `# Compte rendu de la réunion`,
    transcript,
  ]
    .filter(Boolean)
    .join("\n");
}

// Retourne null si l'API refuse, est indisponible ou renvoie un texte vide :
// un résumé absent est préférable à un résumé planté. L'appelant stocke
// null et le bandeau ne s'affiche simplement pas.
export async function genererResume(
  produit: ContexteResume,
  dateReunion: string,
  transcript: string,
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const client = new Anthropic();
  try {
    const message = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 400,
      system: SYSTEME,
      messages: [
        { role: "user", content: contexte(produit, dateReunion, transcript) },
      ],
    });
    if (message.stop_reason === "refusal") return null;
    const bloc = message.content.find((b) => b.type === "text");
    const texte = bloc && bloc.type === "text" ? bloc.text.trim() : "";
    return texte || null;
  } catch {
    return null;
  }
}
