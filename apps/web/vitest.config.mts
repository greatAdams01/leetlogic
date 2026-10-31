import { defineConfig } from "vitest/config";

export default defineConfig({
  // Shared hooks live in the mobile app, which uses a different React version.
  // Match Next's single React runtime instead of resolving React per source app.
  resolve: { dedupe: ["react", "react-dom"] },
});
