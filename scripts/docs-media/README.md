# /docs' pictures and videos

The help center's media (Brendan, 2026-10-31) is made here and served from the clips bucket's `docs/` folder
behind CloudFront (`src/lib/docs/media.ts`), never from the repo.

## Make it again

With the dev server on localhost:3000 (signed in as an admin, so Studio and Dev Tools show):

```
cd scripts/docs-media/capture
node shots.mjs              # every page and state, shots/<name>.jpg (or: node shots.mjs lift,tools)
node guides.mjs             # each guide's steps and the box each step points at, guides/<id>/ and guides/<id>.json
node record.mjs chat        # a screen recording with a timestamp at each beat, rec/chat.webm and rec/chat.json
node record.mjs studio
```

Then render, from the repo's root (the media folder is Remotion's public dir):

```
M=scripts/docs-media/capture
npx remotion render scripts/docs-media/index.ts Guide $M/videos/guide-tools.mp4 --props=$M/guides/tools.json --public-dir=$M --codec=h264 --crf=24
npx remotion still scripts/docs-media/index.ts Guide $M/videos/guide-tools.jpg --props=$M/guides/tools.json --public-dir=$M --frame=20
npx remotion render scripts/docs-media/index.ts Recording $M/videos/record-chat.mp4 --props=$M/chat-edit.json --public-dir=$M --codec=h264 --crf=24
```

`chat-edit.json` and `studio-edit.json` cut a recording into captioned segments, each at its own speed; their
times come from the recording's beats. Upload with
`aws s3 sync <dir> s3://pax-trinity-clips-613473203863/docs/<shots|videos>/ --profile pax-new` (JPEG and MP4
content types). The folder is outside the app's type check (tsconfig's exclude).

- `Guide.tsx`: a title card, then each step's screenshot in a window, the camera easing toward its target, a ring,
  a cursor that travels and clicks, and the step's caption.
- `Recording.tsx`: a recording's segments in the same window and captions.

## Edited cuts of live clips

`ClipCut.tsx` re-cuts a clip from Clips (vertical, with its sound): a lower third naming the messenger and the
test, then an end card with what the test measured, from the clip's report in `src/components/clips/catalog.ts`.
Download the clip from the CDN into `capture/clips/`, then:

```
npx remotion render scripts/docs-media/index.ts ClipCut $M/edits/dustin-cut.mp4 --props=$M/dustin.json --public-dir=$M --codec=h264 --crf=22
```

The first two (Dustin Cathcart and Danielle Allen, Massachusetts Wave 1) are at the CDN's `docs/edits/`.
