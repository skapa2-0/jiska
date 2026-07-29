// Réduction d'image côté client (canvas), avant envoi à l'API.
// - "cover" : recadrage carré centré (photos de profil), sortie JPEG.
// - "contain" : image entière centrée sur fond transparent (logos),
//   sortie PNG pour préserver la transparence.
export async function reduireImage(
  file: File,
  mode: "cover" | "contain",
  taille = 256,
): Promise<string> {
  const image = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = taille;
  canvas.height = taille;
  const ctx = canvas.getContext("2d")!;

  if (mode === "cover") {
    const cote = Math.min(image.width, image.height);
    ctx.drawImage(
      image,
      (image.width - cote) / 2,
      (image.height - cote) / 2,
      cote,
      cote,
      0,
      0,
      taille,
      taille,
    );
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  const ratio = Math.min(taille / image.width, taille / image.height, 1);
  const w = Math.round(image.width * ratio);
  const h = Math.round(image.height * ratio);
  ctx.drawImage(image, (taille - w) / 2, (taille - h) / 2, w, h);
  return canvas.toDataURL("image/png");
}

export const FORMATS_IMAGE = /^image\/(jpeg|png|webp)$/;
