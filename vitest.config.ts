import { defineConfig } from "vitest/config"

// The video layer's tests (npm run test:video). Node, not jsdom: they bundle
// src/video and render stills with @remotion/renderer's headless Chrome.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/video/**/*.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 300_000,
  },
})
