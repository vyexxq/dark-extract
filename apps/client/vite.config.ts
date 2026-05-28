import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@dark-extract/shared": path.resolve(root, "../../packages/shared/src/index.ts"),
    },
  },
  server: {
    port: 5173,
  },
});
