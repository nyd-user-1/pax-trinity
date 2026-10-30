# src/video — PAX's template video layer

A caller (the chat agent, a server action) writes a small JSON object; a Remotion
composition owns every pixel. The JSON must pass the template's zod schema before
a frame is drawn.

## Two rules

1. **Schema first.** Write `schema.ts` before the component. Bounds (string lengths,
   array sizes, enums) live in the schema, so anything the template can't draw is
   refused up front.
2. **Deterministic.** Every pixel is a function of `useCurrentFrame()` and the props.
   No `Math.random`, `Date.now`, `new Date()`, `fetch`, or `fs` inside a template.
   Same props, same video.

Templates import only `remotion`, `@remotion/*`, `react`, `zod`, and `src/video`'s own
files (`../../theme`). They use inline styles, never Tailwind or the app's `@/` paths:
Studio and the renderer bundle `src/video` with their own webpack, where neither
exists. All colors, type sizes, the safe margin, the spring, and the stagger come from
`theme.ts`.

## Adding a template

1. `templates/<id>/schema.ts`: the zod object and its type.
2. `templates/<id>/spec.ts`: `defineSpec({ id, description, propsSchema, fps, width,
   height, durationInFrames, fixture })`. `durationInFrames` is a number, or a function
   of the validated props. `fixture` is a set of props that parses. This file is
   server-safe: zod and `theme.ts` numbers only.
3. `templates/<id>/Composition.tsx`: the component, reading the frame and the props.
4. Add the spec to `SPECS` in `specs.ts`, and the component to `COMPONENTS` in
   `registry.ts`, under the same id.
5. `npm run test:video` (every spec has its component; the fixture parses; bad props
   are refused; frames 0 and last render), then `npm run video:studio` to watch it.

Why the split: Remotion's components need React's client runtime, so server code
(the render route, the agent's tools) imports `specs.ts`. The Player, Studio, and the
renderer use `registry.ts`, which adds the components.

`_example/` is the pattern, small.

## How it is called

- **The agent** reads `listTemplates()` from `specs.ts` (id, description, frame, and the
  JSON Schema of the props) and returns `{ templateId, props }`.
- **In the page**, `<TemplatePlayer templateId props />`
  (`src/components/video/TemplatePlayer.tsx`) validates, then plays the template live
  in the browser. No file is made. A failure shows zod's message in development, and
  a short notice in production.
- **A file**: `POST /api/video/render { templateId, props, format: "mp4" | "webm" }`
  validates, refuses anything over 60 seconds, and returns the file. This runs locally
  in development only. `@remotion/renderer` stays out of the Amplify bundle, and
  production waits on `@remotion/lambda` (the stub is in `render-server.ts`).
