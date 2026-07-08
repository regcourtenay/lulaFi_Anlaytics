import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev server proxies API calls to the local API. In Docker, nginx does this.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: { "/api": "http://localhost:4000" },
  },
  build: { outDir: "dist", sourcemap: false },
});
