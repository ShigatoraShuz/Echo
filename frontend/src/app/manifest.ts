import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ECHO",
    short_name: "ECHO",
    description: "A private space for reflection and wellbeing.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8f5ec",
    theme_color: "#143e32",
    icons: [
      { src: "/echo-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/echo-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
