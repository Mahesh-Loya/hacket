import { defineConfig } from "vite";

// Wallet libraries expect Node's Buffer/global; give them browser versions.
export default defineConfig({
  resolve: { alias: { buffer: "buffer/" } },
  define: { global: "globalThis" },
});
