import type { MetadataRoute } from "next";

/** Makes the site installable as a home-screen app (PWA). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Screening Room",
    short_name: "Screening Room",
    description: "A private place to watch.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0a0a0b",
    theme_color: "#0a0a0b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
