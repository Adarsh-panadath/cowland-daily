import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Built files go to the repo root so GitHub Pages (main branch, / root) serves them directly.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { outDir: "..", emptyOutDir: false, chunkSizeWarningLimit: 1200 },
});
