import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@bot": path.resolve(__dirname, "src/bot"),
      "@commands": path.resolve(__dirname, "src/commands"),
      "@events": path.resolve(__dirname, "src/events"),
      "@jobs": path.resolve(__dirname, "src/jobs"),
      "@providers": path.resolve(__dirname, "src/providers"),
      "@services": path.resolve(__dirname, "src/services"),
      "@embeds": path.resolve(__dirname, "src/embeds"),
      "@config": path.resolve(__dirname, "src/config"),
      "@utils": path.resolve(__dirname, "src/utils"),
      "@flight-types": path.resolve(__dirname, "src/types"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
    },
  },
});
