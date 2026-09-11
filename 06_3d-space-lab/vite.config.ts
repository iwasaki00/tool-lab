import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    outDir: "app",
    emptyOutDir: true,
    sourcemap: false,
  },
});
