import type { MetadataRoute } from "next";

/** Web app manifest, so "Add to Home Screen" gets the tiki icon and name. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Equal Parts",
    short_name: "Equal Parts",
    description: "JB & GM's home bar: tasting log, bar inventory and recipes.",
    start_url: "/",
    display: "standalone",
    background_color: "#fff7e8",
    theme_color: "#0b4f4a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
