import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cabinet Cut Optimizer",
    short_name: "Cutlist",
    description:
      "Cabinet cut list optimizer with sheet layout planning and 3D preview.",
    start_url: "/",
    display: "standalone",
    background_color: "#eef3f4",
    theme_color: "#4a6572",
    lang: "ar",
    dir: "rtl",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}