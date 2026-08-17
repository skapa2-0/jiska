import { query } from "@/lib/db";
import type { ProduitImport } from "./import-transcript";

// Produits, membres et sujets nécessaires à l'écran de vérification.
// projectId non nul = portée produit : la liste est réduite à ce produit,
// ce qui borne aussi les cibles proposées à la correction.
export async function chargerProduits(
  projectId: string | null,
): Promise<ProduitImport[]> {
  const filtre = projectId ? "WHERE p.id = $1" : "";
  const args = projectId ? [projectId] : [];

  const [produits, membres, sujets] = await Promise.all([
    query<{ id: string; name: string; logo: string | null }>(
      `SELECT p.id, p.name, p.logo FROM projects p ${filtre} ORDER BY p.name`,
      args,
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
         JOIN projects p ON p.id = m.project_id ${filtre}
        ORDER BY u.email`,
      args,
    ),
    query<{ id: string; project_id: string; title: string }>(
      `SELECT s.id, s.project_id, s.title
         FROM sujets s JOIN projects p ON p.id = s.project_id ${filtre}
        ORDER BY s.title`,
      args,
    ),
  ]);

  return produits.map((p) => ({
    id: p.id,
    name: p.name,
    logo: p.logo,
    membres: membres
      .filter((m) => m.project_id === p.id)
      .map((m) => ({
        id: m.id,
        email: m.email,
        first_name: m.first_name,
        last_name: m.last_name,
        avatar: m.avatar,
      })),
    sujets: sujets
      .filter((s) => s.project_id === p.id)
      .map((s) => ({ id: s.id, titre: s.title })),
  }));
}
