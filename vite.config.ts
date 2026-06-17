import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    // Must come before @vitejs/plugin-react.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    VitePWA({
      // injectManifest: we ship our own SW (src/sw.ts) because the
      // Web Share Target POST handler isn't expressible through the
      // generateSW config — Workbox doesn't have a built-in plugin
      // for it.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: "auto",
      devOptions: {
        // Enable when iterating on the SW locally.
        enabled: false,
        type: "module",
      },
      manifest: {
        name: "Pressroom",
        short_name: "Pressroom",
        description: "Image-effects & generative SVG tools.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f5f0e0",
        theme_color: "#0a0a0a",
        orientation: "any",
        icons: [
          // Home-screen tile. Solid cream background + dark dots so it
          // doesn't disappear into a dark wallpaper — iOS rasterizes
          // the icon at install time and ignores any prefers-color-
          // scheme media queries inside the SVG, so adaptive icons
          // wouldn't survive there. Same file serves both `any` and
          // `maskable` because the dot grid stays well inside the
          // safe zone (16px inset on a 192-unit viewBox).
          {
            src: "/icon-512.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icon-512.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
        // Web Share Target — register pressroom as a destination in
        // the OS share sheet. Android Chrome supports files fully;
        // iOS Safari is rolling support out.
        share_target: {
          action: "/share",
          method: "POST",
          enctype: "multipart/form-data",
          params: {
            title: "title",
            text: "text",
            url: "url",
            files: [
              {
                name: "image",
                accept: [
                  "image/png",
                  "image/jpeg",
                  "image/webp",
                  "image/gif",
                  "image/bmp",
                  "image/svg+xml",
                ],
              },
            ],
          },
        },
      },
    }),
  ],
});
