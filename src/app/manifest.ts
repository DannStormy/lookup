import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Look Up",
    short_name: "Look Up",
    description: "The exact sky above your exact spot, and when to look up.",
    start_url: "/",
    display: "standalone",
    background_color: "#05060d",
    theme_color: "#05060d",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
