import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves a project site from /<repo>/, so assets need that base.
// A user/organisation site or a custom domain would set VITE_BASE=/ instead.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? "/bookmappy/",
  build: {
    // Firebase and the world geometry both change far less often than app code;
    // keeping them in their own chunks means a redeploy only busts the small one.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("/firebase") || id.includes("@firebase")) return "firebase";
          if (id.includes("world-atlas") || id.includes("topojson") || id.includes("d3-geo"))
            return "atlas";
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
