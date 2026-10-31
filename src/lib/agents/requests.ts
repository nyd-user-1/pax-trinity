// The Inbox's two requests to the Pollster (moved from the inbox page, Brendan, 2026-10-31): a test of a clip and a
// survey, each a message already addressed with its fields to fill. They sit at the head of the rail's Templates.

export type Request = { kind: "test" | "survey"; name: string; to: string[]; subject: string; body: string }

export const REQUESTS: Request[] = [
  {
    kind: "test",
    name: "New test",
    to: ["tracker"],
    subject: "New test: ",
    body: "**Test:** ma-wave-3\n\n**Question card:** \n\n**Quota:** per the test\n\n**Close by:** ",
  },
  {
    kind: "survey",
    name: "New survey",
    to: ["tracker"],
    subject: "New survey: ",
    body: "**Survey:** open-primaries\n\n**Quota:** \n\n**Close by:** \n\n**Panels to build from it:** ",
  },
]

export const requestOf = (kind: Request["kind"]) => REQUESTS.find((r) => r.kind === kind)!
