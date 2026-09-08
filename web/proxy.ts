import { clerkMiddleware } from "@clerk/nextjs/server";

// Next.js 16 a renommé le middleware en « proxy » (node_modules/next/dist/
// docs/01-app/01-getting-started/16-proxy.md). Son seul rôle ici : rendre
// la session Clerk lisible par auth(). Les autorisations restent où elles
// sont, dans chaque page et chaque route, via getSessionUser() : un seul
// endroit décide qui voit quoi, et il est côté serveur.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Tout, sauf les fichiers statiques et les ressources internes de Next.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    // Chemin interne de Clerk : sans lui, le proxy ne relaie pas ses
    // appels et la session n'est jamais lue.
    "/__clerk/:path*",
  ],
};
