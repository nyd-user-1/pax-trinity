// Narration for the docs' videos (Brendan, 2026-10-31): each guide's and recording's title and captions, spoken by
// Amazon Polly's neural voices (the old AWS account: the new one's organization policy denies Polly), each line
// measured so its step or segment is long enough to say it. Writes voice/<Voice>/<hash>.mp3 and the props to render
// from, voice/props/<video>.<voice>.json. ElevenLabs' voices join as more voices once its key has characters.
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"

const HERE = new URL("./", import.meta.url).pathname
const FFPROBE = new URL("../../../node_modules/.bin/remotion", import.meta.url).pathname
const VOICES = (process.argv[2] ?? "Ruth,Matthew").split(",")
const FPS = 30
const STEP = 120
const TITLE = 60
const SPEAK_AT = 8

const GUIDES = ["lift-analysis", "lift-filters", "survey", "tools", "second-panel", "blocks"]
const RECORDINGS = ["chat", "studio"]

function speak(voice, text) {
  const hash = createHash("sha1").update(`${voice}\u0000${text}`).digest("hex").slice(0, 16)
  const rel = `voice/${voice}/${hash}.mp3`
  const file = HERE + rel
  if (!existsSync(file)) {
    mkdirSync(`${HERE}voice/${voice}`, { recursive: true })
    execFileSync("aws", ["polly", "synthesize-speech", "--engine", "neural", "--voice-id", voice, "--output-format", "mp3", "--text", text, file, "--region", "us-east-1"], { stdio: "ignore" })
  }
  const seconds = Number(execFileSync(FFPROBE, ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim())
  return { rel, frames: Math.ceil(seconds * FPS) }
}

mkdirSync(`${HERE}voice/props`, { recursive: true })
for (const voice of VOICES) {
  for (const id of GUIDES) {
    const g = JSON.parse(readFileSync(`${HERE}guides/${id}.json`, "utf8"))
    const intro = speak(voice, `${g.title}. ${g.subtitle}.`)
    const lines = g.steps.map((s) => speak(voice, s.caption))
    const props = {
      ...g,
      narration: { intro: intro.rel, steps: lines.map((l) => l.rel) },
      titleFrames: Math.max(TITLE, 6 + intro.frames + 14),
      frames: lines.map((l) => Math.max(STEP, SPEAK_AT + l.frames + 22)),
    }
    writeFileSync(`${HERE}voice/props/guide-${id}.${voice.toLowerCase()}.json`, JSON.stringify(props))
  }
  for (const id of RECORDINGS) {
    const r = JSON.parse(readFileSync(`${HERE}${id}-edit.json`, "utf8"))
    const intro = speak(voice, `${r.title}. ${r.subtitle}.`)
    const segments = r.segments.map((s) => {
      const l = speak(voice, s.caption)
      // Slow the segment, where need be, so the line is said before it ends.
      const need = 8 + l.frames + 18
      const rate = Math.min(s.rate, ((s.to - s.from) * FPS) / need)
      return { ...s, rate: Math.round(rate * 1000) / 1000, audio: l.rel }
    })
    writeFileSync(`${HERE}voice/props/record-${id}.${voice.toLowerCase()}.json`, JSON.stringify({ ...r, intro: intro.rel, titleFrames: Math.max(TITLE, 6 + intro.frames + 14), segments }))
  }
  console.log("voiced", voice)
}
