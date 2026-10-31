import type { SourceRow } from "@/app/america-thinks/audience-data"
import { share, type Conversation, type Statement, type Tally } from "@/lib/consensus/data"

// A Consensus statement's results as America Thinks' rows (Brendan,
// 2026-10-31), so Survey's open question reads in America Thinks' own pane:
// its Data rows, Crosstab, Trend, Topline and Global view, and the About panel
// a clicked value opens. The bands are Agree, Disagree and Pass; the segments
// are everyone and each opinion group, from the statement's own votes.
//
// Demo rows: while the votes are the committed seed's invented ones (no
// database configured), the statement also gets breakdowns by age, education,
// party and sex, and two earlier yearly waves, generated here from a seed of
// the statement's own so they read the same on every load. They are made up
// for the demo, like the votes under them; a real survey's rows replace them.

/** The rows' source key, and Massachusetts' geography code in the export (its FIPS). */
export const CONSENSUS = "CONSENSUS"
export const MASSACHUSETTS = "25"

/** The wave the votes on file belong to, and the demo's earlier ones. */
const LATEST = 2026
const EARLIER = [2024, 2025]

const BANDS = ["Agree", "Disagree", "Pass"] as const

/** Massachusetts adults' make-up, the breakdowns' shares of a wave. */
const SEGMENTS: { dim: string; values: { v: string; share: number; pos: number }[] }[] = [
  {
    dim: "age",
    values: [
      { v: "18-29", share: 0.19, pos: -1.5 },
      { v: "30-44", share: 0.25, pos: -0.5 },
      { v: "45-64", share: 0.33, pos: 0.5 },
      { v: "65+", share: 0.23, pos: 1.5 },
    ],
  },
  {
    dim: "educ",
    values: [
      { v: "HS or less", share: 0.3, pos: -1.5 },
      { v: "Some college", share: 0.22, pos: -0.5 },
      { v: "BA", share: 0.27, pos: 0.5 },
      { v: "Grad", share: 0.21, pos: 1.5 },
    ],
  },
  {
    // Massachusetts registers most voters as unenrolled, its word for independent.
    dim: "party",
    values: [
      { v: "Democrat", share: 0.31, pos: -0.6 },
      { v: "Republican", share: 0.09, pos: -1.2 },
      { v: "Unenrolled", share: 0.6, pos: 1 },
    ],
  },
  {
    dim: "sex",
    values: [
      { v: "Female", share: 0.52, pos: -1 },
      { v: "Male", share: 0.48, pos: 1 },
    ],
  },
]

/** A number from a string, FNV-1a, to seed a statement's own generator. */
function hash(text: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: the same draws for the same seed. */
function generator(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Shares = { agree: number; disagree: number; pass: number }

const round1 = (x: number) => Math.round(x * 10) / 10
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

/** Agree and disagree moved, pass taking the rest, none below 2%. */
function moved(base: Shares, dAgree: number, dDisagree: number): Shares {
  const agree = clamp(base.agree + dAgree, 2, 94)
  const disagree = clamp(base.disagree + dDisagree, 2, 96 - agree)
  return { agree, disagree, pass: 100 - agree - disagree }
}

/** The 95% margin of error on a share of n, in points. */
const moeOf = (pct: number, n: number) => round1(1.96 * Math.sqrt(((pct / 100) * (1 - pct / 100)) / Math.max(n, 1)) * 100)

export function statementRows(conversation: Conversation, statement: Statement, metric: string, demo: boolean): SourceRow[] {
  const rows: SourceRow[] = []
  const push = (y: number, s: Shares, n: number, dim: string | null, value: string | null) => {
    const est = { Agree: round1(s.agree), Disagree: round1(s.disagree), Pass: 0 }
    est.Pass = round1(100 - est.Agree - est.Disagree)
    for (const band of BANDS) rows.push([metric, MASSACHUSETTS, `${y}-01-01`, `${y}-12-31`, band, dim, value, est[band], "pct", moeOf(est[band], n), null, n, null])
  }
  const tallyShares = (t: Tally): Shares => share(t)
  const groups = conversation.groups.filter((g) => statement.byGroup[String(g.id)]?.seen)
  const letter = (id: number) => String.fromCharCode(65 + id)

  const random = generator(hash(`${conversation.slug}:${statement.tid}`))
  const between = (lo: number, hi: number) => lo + random() * (hi - lo)

  // Each wave: its everyone, its n, and how far its groups sit from the latest.
  const latest = tallyShares(statement.votes)
  const waves: { y: number; all: Shares; n: number; shift: { agree: number; disagree: number } }[] = []
  if (demo) {
    // A statement's own drift, points a year, carried back from the latest wave.
    const trend = between(-2.5, 2.5)
    for (const y of EARLIER) {
      const back = LATEST - y
      const shift = { agree: -trend * back + between(-1.5, 1.5), disagree: 0.7 * trend * back + between(-1.5, 1.5) }
      waves.push({ y, all: moved(latest, shift.agree, shift.disagree), n: Math.round(statement.votes.seen * between(0.8, 1.15)), shift })
    }
  }
  waves.push({ y: LATEST, all: latest, n: statement.votes.seen, shift: { agree: 0, disagree: 0 } })

  // The breakdowns' leanings, drawn once per statement so every wave shares them.
  const lean = SEGMENTS.map((seg) => {
    // Party splits a primaries question widest; age, education and sex a few points.
    const scale = seg.dim === "party" ? between(-9, 9) : between(-3, 3)
    const raw = seg.values.map((v) => v.pos * scale)
    // Centred on the wave's everyone: the breakdown's weighted mean is no shift.
    const mean = raw.reduce((sum, x, i) => sum + x * seg.values[i].share, 0)
    return raw.map((x) => x - mean)
  })

  for (const wave of waves) {
    push(wave.y, wave.all, wave.n, null, null)
    for (const g of groups) {
      const t = statement.byGroup[String(g.id)]
      const n = wave.y === LATEST ? t.seen : Math.max(12, Math.round((t.seen * wave.n) / Math.max(statement.votes.seen, 1)))
      const s = wave.y === LATEST ? tallyShares(t) : moved(tallyShares(t), wave.shift.agree + between(-2, 2), wave.shift.disagree + between(-2, 2))
      push(wave.y, s, n, "group", letter(g.id))
    }
    if (!demo) continue
    SEGMENTS.forEach((seg, k) => {
      seg.values.forEach((v, i) => {
        const n = Math.max(12, Math.round(wave.n * v.share * between(0.9, 1.1)))
        const dAgree = lean[k][i] + between(-2.5, 2.5)
        push(wave.y, moved(wave.all, dAgree, -0.75 * dAgree + between(-1.5, 1.5)), n, seg.dim, v.v)
      })
    })
  }
  return rows
}
