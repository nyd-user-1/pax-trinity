// Narration for the docs' videos (Brendan, 2026-10-31): each guide's and recording's title and captions, spoken by
// ElevenLabs' voices (Sarah, Brian…; the key in .env.local) or Amazon Polly's neural voices (Ruth, Matthew…; in the
// old AWS account: the new one's organization policy denies Polly), each line measured so its step or segment is
// long enough to say it. Writes voice/<Voice>/<hash>.mp3 (cached, so a line is never paid for twice) and the props
// to render from, voice/props/<video>.<voice>.json.
//
//   node narrate.mjs Sarah,Ruth            every line
//   node narrate.mjs Sarah notitle         the title card left silent, to spend fewer ElevenLabs characters
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"

const HERE = new URL("./", import.meta.url).pathname
const REPO = new URL("../../../", import.meta.url).pathname
const FFPROBE = `${REPO}node_modules/.bin/remotion`
const VOICES = (process.argv[2] ?? "Ruth,Matthew").split(",")
const SPEAK_TITLE = process.argv[3] !== "notitle"
const FPS = 30
const STEP = 120
const TITLE = 60
const SPEAK_AT = 8

// ElevenLabs' premade voices, as src/lib/studio-style.ts lists them; any other name is a Polly voice.
const ELEVEN = { Sarah: "EXAVITQu4vr4xnSDxMaL", Matilda: "XrExE9yKIg1WjnnlVkGX", Eric: "cjVigY5qzO86Huf0OWal", Brian: "nPczCjzI2devNBz1zQrb", Liam: "TX3LPaxmHKxFdv7VOQHJ", Laura: "FGY2WhTYpPnrIDTdsKH5", Jessica: "cgSgspJ2msm6clMCkdW9", Bill: "pqHfZKP75CvOlQylNhV4", Daniel: "onwK4e9ZLuTAKqWW03F9", Alice: "Xb7hH8MSUJpSbSDYk0k2" }
const GUIDES = ["lift-analysis", "lift-filters", "survey", "tools", "second-panel", "blocks"]
const RECORDINGS = ["chat", "studio"]

const envKey = () => readFileSync(`${REPO}.env.local`, "utf8").match(/^ELEVENLABS_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "")

async function speak(voice, text) {
  const hash = createHash("sha1").update(`${voice}\u0000${text}`).digest("hex").slice(0, 16)
  const rel = `voice/${voice}/${hash}.mp3`
  const file = HERE + rel
  if (!existsSync(file)) {
    mkdirSync(`${HERE}voice/${voice}`, { recursive: true })
    if (ELEVEN[voice]) {
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN[voice]}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": envKey(), "Content-Type": "application/json" },
        body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
      })
      if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}`)
      writeFileSync(file, Buffer.from(await r.arrayBuffer()))
    } else {
      execFileSync("aws", ["polly", "synthesize-speech", "--engine", "neural", "--voice-id", voice, "--output-format", "mp3", "--text", text, file, "--region", "us-east-1"], { stdio: "ignore" })
    }
  }
  const seconds = Number(execFileSync(FFPROBE, ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim())
  return { rel, frames: Math.ceil(seconds * FPS) }
}

mkdirSync(`${HERE}voice/props`, { recursive: true })
for (const voice of VOICES) {
  for (const id of GUIDES) {
    const g = JSON.parse(readFileSync(`${HERE}guides/${id}.json`, "utf8"))
    const intro = SPEAK_TITLE ? await speak(voice, `${g.title}. ${g.subtitle}.`) : null
    const lines = []
    for (const s of g.steps) lines.push(await speak(voice, s.caption))
    const props = {
      ...g,
      narration: { intro: intro?.rel, steps: lines.map((l) => l.rel) },
      titleFrames: intro ? Math.max(TITLE, 6 + intro.frames + 14) : TITLE,
      frames: lines.map((l) => Math.max(STEP, SPEAK_AT + l.frames + 22)),
    }
    writeFileSync(`${HERE}voice/props/guide-${id}.${voice.toLowerCase()}.json`, JSON.stringify(props))
  }
  for (const id of RECORDINGS) {
    const r = JSON.parse(readFileSync(`${HERE}${id}-edit.json`, "utf8"))
    const intro = SPEAK_TITLE ? await speak(voice, `${r.title}. ${r.subtitle}.`) : null
    const segments = []
    for (const s of r.segments) {
      const l = await speak(voice, s.caption)
      // Slow the segment, where need be, so the line is said before it ends.
      const need = 8 + l.frames + 18
      segments.push({ ...s, rate: Math.round(Math.min(s.rate, ((s.to - s.from) * FPS) / need) * 1000) / 1000, audio: l.rel })
    }
    writeFileSync(`${HERE}voice/props/record-${id}.${voice.toLowerCase()}.json`, JSON.stringify({ ...r, intro: intro?.rel, titleFrames: intro ? Math.max(TITLE, 6 + intro.frames + 14) : TITLE, segments }))
  }
  console.log("voiced", voice)
}
