import * as React from "react"
import { Composition } from "remotion"

import { FPS, Guide, H, OUTRO, STEP, TITLE, W, type GuideProps } from "./Guide"
import { frames, Recording, type RecordingProps } from "./Recording"
import { CARD, ClipCut, CUT_FPS, type ClipCutProps } from "./ClipCut"

const SAMPLE: GuideProps = { title: "A guide", subtitle: "Its steps", steps: [] }
const SAMPLE_CUT: ClipCutProps = { src: "clips/dustin-cathcart.mp4", seconds: 28.5, messenger: "Dustin Cathcart", study: "Massachusetts Wave 1", fielded: "Oct 2–7, 2026", armN: 520, placeboN: 494, outcomes: [] }
const SAMPLE_REC: RecordingProps = { title: "A recording", src: "rec/chat.webm", segments: [{ from: 0, to: 2, rate: 1, caption: "A segment" }] }

export function Root() {
  return (
    <>
    <Composition
      id="ClipCut"
      component={ClipCut}
      width={720}
      height={1280}
      fps={CUT_FPS}
      durationInFrames={900}
      defaultProps={SAMPLE_CUT}
      calculateMetadata={({ props }) => ({ durationInFrames: Math.round(props.seconds * CUT_FPS) + CARD })}
    />
    <Composition
      id="Recording"
      component={Recording}
      width={W}
      height={H}
      fps={FPS}
      durationInFrames={TITLE + 60 + OUTRO}
      defaultProps={SAMPLE_REC}
      calculateMetadata={({ props }) => ({ durationInFrames: TITLE + props.segments.reduce((n, s) => n + frames(s), 0) + OUTRO })}
    />
    <Composition
      id="Guide"
      component={Guide}
      width={W}
      height={H}
      fps={FPS}
      durationInFrames={TITLE + STEP + OUTRO}
      defaultProps={SAMPLE}
      calculateMetadata={({ props }) => ({ durationInFrames: TITLE + Math.max(1, props.steps.length) * STEP + OUTRO })}
    />
    </>
  )
}
