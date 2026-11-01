import { defineConfig } from "vitest/config"

// The video layer's tests (npm run test:video). Node, not jsdom: they bundle
// src/video and render stills with @remotion/renderer's headless Chrome. Beside them,
// the results' pure pieces that feed a video (src/lib/results/video-props.ts), and the marketing flows'
// engine against a table double (src/lib/flows/engine.test.ts).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/video/**/*.test.ts", "src/lib/results/**/*.test.ts", "src/lib/flows/**/*.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 300_000,
  },
})
