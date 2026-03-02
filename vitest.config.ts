import path from "path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  assetsInclude: ["**/*.png", "**/*.svg", "**/*.jpg", "**/*.webp"],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    coverage: {
      provider: "v8",
    },
    passWithNoTests: true,
  },
});
