import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["test/**/*.test.{ts,tsx}"],
    server: {
      deps: {
        // @vuu-ui packages import their inlined CSS as "./X.css", which only
        // a bundler resolves (to X.css.js).
        inline: [/@vuu-ui\//],
      },
    },
  },
});
