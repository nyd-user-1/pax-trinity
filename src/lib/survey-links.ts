// Where Consensus and the message tests live (Brendan, 2026-10-31): inside /survey's inbox, each surface a page
// the rail opens, ?s= naming it. Consensus's tabs keep ?c= for the conversation; a test's pages take ?id=.

export const CONSENSUS_TABS = ["questions", "surveys", "results", "admin"] as const
export type ConsensusTab = (typeof CONSENSUS_TABS)[number]

export const TEST_SURFACES = ["tests", "new-test", "test", "edit-test"] as const
export type TestSurface = (typeof TEST_SURFACES)[number]

export type Surface = ConsensusTab | TestSurface

export const isSurface = (s: unknown): s is Surface => typeof s === "string" && ([...CONSENSUS_TABS, ...TEST_SURFACES] as readonly string[]).includes(s)

export const consensusHref = (tab: ConsensusTab, c?: string | null) => `/survey?s=${tab}${c ? `&c=${encodeURIComponent(c)}` : ""}`

export const testsHref = () => "/survey?s=tests"
export const newTestHref = () => "/survey?s=new-test"
export const testHref = (id: string) => `/survey?s=test&id=${encodeURIComponent(id)}`
export const editTestHref = (id: string) => `/survey?s=edit-test&id=${encodeURIComponent(id)}`
