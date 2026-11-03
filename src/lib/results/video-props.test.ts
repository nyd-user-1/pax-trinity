import { describe, expect, it } from "vitest"

import { liftCardSpec } from "../../video/templates/lift-card/spec"
import { validate } from "../../video/specs"
import MA_WAVE_3 from "./computed/ma-wave-3-computed.json"
import OPEN_PRIMARIES_1 from "./computed/open-primaries-1-computed.json"
import type { ResultSet } from "./types"
import { liftCardProps } from "./video-props"

const partner = (clipId: string) => ({ "px-dustin": "@pax", "px-gaby": "@voterfreedom" })[clipId]

describe("liftCardProps", () => {
  it("draws Massachusetts Wave 3's strongest treatment as the lift card's own fixture does, simulated as the result is", () => {
    // The fixture was written from this result: Dustin Cathcart against the placebo, everyone. The result is
    // a seeded demo run (simulated: true), so neither the card nor the fixture claims a trial.
    expect((MA_WAVE_3 as ResultSet).simulated).toBe(true)
    const props = liftCardProps(MA_WAVE_3 as ResultSet, partner)
    expect(props).toEqual(liftCardSpec.fixture)
    expect(validate("lift-card", props).ok).toBe(true)
  })

  it("draws the open primaries test's strongest treatment, both outcomes, and passes the schema", () => {
    const props = liftCardProps(OPEN_PRIMARIES_1 as ResultSet, partner)
    expect(props).toEqual({
      treatment: { title: "Why independents are locked out — Gaby", partner: "@voterfreedom" },
      segment: "Everyone",
      metrics: [
        { name: "Support", control: 48.7, lift: 12.7, significant: true },
        { name: "Comprehension", control: 43.7, lift: 12.6, significant: true },
      ],
      rct: true,
      simulated: false,
      n: 485,
    })
    const v = validate("lift-card", props)
    expect(v.ok, v.ok ? "" : v.error).toBe(true)
  })

  it("marks a lift that did not clear its test, and leaves the partner off when the clip has none", () => {
    const props = liftCardProps(MA_WAVE_3 as ResultSet)
    expect(props?.treatment).toEqual({ title: "Dustin Cathcart" })
    const rs = structuredClone(MA_WAVE_3) as ResultSet
    rs.toplines.find((t) => t.armId === "px-dustin" && t.outcomeId === "comprehension")!.verdict = "inconclusive"
    expect(liftCardProps(rs)?.metrics[1]).toEqual({ name: "Comprehension", control: 51.4, lift: -9.1, significant: false })
  })

  it("is null when no treatment has a lift", () => {
    const rs = structuredClone(MA_WAVE_3) as ResultSet
    rs.toplines = rs.toplines.filter((t) => t.armId === "placebo")
    expect(liftCardProps(rs)).toBeNull()
  })

  it("shortens a name past the schema's 60 characters", () => {
    const rs = structuredClone(OPEN_PRIMARIES_1) as ResultSet
    rs.arms.find((a) => a.id === "px-gaby")!.name = "Why independents are locked out of the primaries in Massachusetts — Gaby"
    const props = liftCardProps(rs)!
    expect(props.treatment.title.length).toBeLessThanOrEqual(60)
    expect(validate("lift-card", props).ok).toBe(true)
  })
})
