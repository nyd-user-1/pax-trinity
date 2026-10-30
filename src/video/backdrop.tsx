import * as React from "react"
import { AbsoluteFill, Img, OffthreadVideo } from "remotion"

// What a vertical card sits over: a recorded take (Chat's Record flow, the clips CDN) plays; a picture
// is drawn; without either, a plain grey field stands in for the footage. Shared by the Enhance flow's
// graphics (src/components/studio/graphic-video.tsx) and the yes-on-3-card template.

export const PLAIN_FIELD = "linear-gradient(165deg, #cbd5e1 0%, #94a3b8 55%, #475569 100%)"

const VIDEO = /\.(mp4|webm|mov|m4v)(\?|#|$)/i

export function Backdrop({ src }: { src: string }) {
  const fill = { width: "100%", height: "100%", objectFit: "cover" } as const
  return <AbsoluteFill>{VIDEO.test(src) ? <OffthreadVideo src={src} style={fill} /> : <Img src={src} style={fill} />}</AbsoluteFill>
}
