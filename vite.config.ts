import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
  server: {
    port: 5183,
    proxy: { "/api": "http://localhost:8797" },
  },
  test: {
    environment: "node",
    // Only workerd has this module; see the stub for what the tests need of it.
    alias: { "cloudflare:workers": new URL("./test/stubs/cloudflare-workers.ts", import.meta.url).pathname },
    // Run through Vite, so that the alias above reaches the library's own import.
    server: { deps: { inline: ["@cloudflare/workers-oauth-provider"] } },
    include: ["test/**/*.test.ts"],
    coverage: { include: ["shared/**", "worker/**", "src/lib/**"] },
  },
});
