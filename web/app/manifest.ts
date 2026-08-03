import type { MetadataRoute } from "next";

// PWA : Jiska s'installe sur l'écran d'accueil et se lance en plein
// écran (standalone), directement sur le dashboard.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jiska",
    short_name: "Jiska",
    description: "Pilotage hebdomadaire des projets",
    start_url: "/app",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
