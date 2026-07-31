import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages serves this under /ai-learn-hub/
export default defineConfig({
  base: "/ai-learn-hub/",
  plugins: [react(), tailwindcss()],
  build: {
    target: "es2020",
    outDir: "dist",
  },
});
