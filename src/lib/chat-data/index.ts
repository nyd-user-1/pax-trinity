// The index of what the platform holds (Brendan, 2026-11-02: "an index and tools for chat to use so that
// it has instant and accurate access to all of the tables/databases in the platform"). One entry per
// store: what it holds, its keys or shape, the code that reads it, and the chat tool that reaches it.
// Chat's system prompt carries the one-line form (dataIndexPrompt); the full entries are the record of
// where everything lives. The tools themselves are in ./tools.ts. Plain data, safe anywhere.

export type Store = {
  name: string
  kind: "dynamodb" | "s3" | "code" | "aurora"
  holds: string
  keys: string
  readWith: string
  /** The chat tool that reads it; none where chat has no business there. */
  tool: string | null
}

export const STORES: Store[] = [
  {
    name: "America Thinks (exports)",
    kind: "s3",
    holds: "The normative database: 8,028 constructs from the GSS, ANES, CES, CPS, ACS, CVAP, public polls (378 POLL questions), election results, MA enrollment, the Lift archive and PAX's own tests, each with its wording, years, answer options and estimates by place and breakdown.",
    keys: "audience bucket exports/: index.json (constructs, questions, geographies, sources); q/<source>/<id>.json, one question's rows [metric, geo, start, end, option, dim, value, estimate, type, moe, item text, n, url]",
    readWith: "lib/chat-data/america-thinks.ts (atlas, questionRows, topline); the page's own app/america-thinks/audience-data.ts",
    tool: "find_questions, question_topline",
  },
  {
    name: "Topline surveys",
    kind: "code",
    holds: "The surveys a respondent can answer (Open primaries), each question an America Thinks construct.",
    keys: "SURVEYS in lib/surveys/catalog.ts; answers in pax-trinity-test-responses under survey:<slug>",
    readWith: "lib/surveys/responses.ts (topline)",
    tool: "survey_results, list_records",
  },
  {
    name: "Consensus surveys",
    kind: "code",
    holds: "The Consensus conversations: statements, votes (agree, disagree, pass) and opinion groups. Aurora when configured; today the committed seed (its votes are invented).",
    keys: "lib/consensus/store.ts (consensus_conversations, consensus_statements); seed lib/consensus/seed.json",
    readWith: "conversations(), conversation(slug)",
    tool: "survey_results, list_records",
  },
  {
    name: "Pretrainings",
    kind: "code",
    holds: "Question sets fielded before a test (two seeds), each question an America Thinks construct.",
    keys: "PRETRAININGS in lib/consensus/pretrainings.ts; a browser's own draft in its localStorage",
    readWith: "lib/consensus/pretrainings.ts",
    tool: "list_records, find_questions",
  },
  {
    name: "Question Bank",
    kind: "code",
    holds: "Every question from every survey, test and pretraining, once each, with where it was asked.",
    keys: "buildBank over the surveys, Consensus, tests and pretrainings",
    readWith: "lib/surveys/question-bank.ts",
    tool: "find_questions",
  },
  {
    name: "pax-trinity-tests",
    kind: "dynamodb",
    holds: "The message tests (admins only): title, status, arms, target per arm, entry, ballot and comprehension questions.",
    keys: "pk id; the seed test open-primaries-1 served from code",
    readWith: "lib/tests/store.ts (listTests, getTest)",
    tool: "list_records, survey_results",
  },
  {
    name: "pax-trinity-test-responses",
    kind: "dynamodb",
    holds: "Append-only, shared by partition: a test's respondents (<test id>: start, complete, screenout), its derived results (result:<test>), topline survey answers (survey:<slug>), Consensus answers by hashed email (consensus:<slug>), fieldings (fieldings, fielding:<fid>), the Delivery Board (delivery:<partner>), recordings kept as clips (clips).",
    keys: "pk test, sk id (ULID, or latest / video / <env>:u:<sha256 email>)",
    readWith: "lib/tests/responses.ts, lib/results/complete.ts, lib/surveys/responses.ts, lib/consensus/taken.ts, lib/fielding/store.ts, lib/delivery/store.ts, lib/clips/recorded.ts",
    tool: "survey_results, list_records, person_state",
  },
  {
    name: "Results register",
    kind: "code",
    holds: "The Lift results of the message tests (admins only): arms, outcomes, toplines with lifts and verdicts, subgroups.",
    keys: "RESULT_SETS in lib/results (MA waves 1 and 2, the computed ma-wave-3 and open-primaries-1)",
    readWith: "lib/results/index.ts, latestResult",
    tool: "survey_results, list_records",
  },
  {
    name: "pax-trinity-ledger",
    kind: "dynamodb",
    holds: "Append-only and many-partitioned: findings, snapshots and forecasts (TAKE#, SNAP#), Consensus votes (VOTE#), Boosts, marketing flows (FLOW#, FLOWSEND#), saved chats (CHAT#), notes, originals, the usage log, connected YouTube channels.",
    keys: "pk, sk; the partitions are listed in lib/ledger.ts and each owner's module",
    readWith: "lib/ledger.ts and the modules named there",
    tool: null,
  },
  {
    name: "pax-trinity-housekeeping",
    kind: "dynamodb",
    holds: "Dev Comments: the admins' comments on the app, direct messages and the Admin channel.",
    keys: "pk STREAM | DM#<a>|<b> | ADMIN, sk <iso>#<id>",
    readWith: "lib/housekeeping.ts",
    tool: null,
  },
  {
    name: "pax-trinity-video-versions",
    kind: "dynamodb",
    holds: "The videos a person made from templates in Chat and the Studio, every version.",
    keys: "pk USER#<email>, sk <templateId>#<n>",
    readWith: "lib/video-versions.ts (list, get)",
    tool: "list_records (my_videos)",
  },
  {
    name: "Shorts",
    kind: "s3",
    holds: "The shorts PAX2 holds: the 5,379 baseline shorts, the feed and the tracked channels, with views, Outlier Score, channel and Resonance.",
    keys: "audience bucket generated/question-bank.json, app/feed-index.json; velocity bucket velocity/catalog.json and polls/<day>.jsonl",
    readWith: "lib/chat-videos.ts, lib/feed-data.ts, lib/velocity-store.ts",
    tool: "find_shorts",
  },
  {
    name: "Clips",
    kind: "code",
    holds: "The published clip catalog: the cuts, their messengers, partners and lengths; the videos in the clips bucket behind the clips CDN.",
    keys: "PUBLISHED in components/clips/catalog.ts; clips bucket; Aurora when configured",
    readWith: "components/clips/catalog.ts, lib/clips/server.ts",
    tool: "list_records",
  },
  {
    name: "People",
    kind: "code",
    holds: "The staff and partners with their roles; sign-in itself is Cognito.",
    keys: "MEMBERS and PARTNERS in lib/roles.ts",
    readWith: "memberByEmail",
    tool: "person_state",
  },
]

/** The index as the system prompt carries it: one line per store a tool reaches. */
export function dataIndexPrompt(): string {
  const lines = STORES.filter((s) => s.tool).map((s) => `- ${s.name}: ${s.holds} (${s.tool})`)
  return `=== WHAT I CAN LOOK UP ===
These tools read the platform's own data, read-only and instantly. When a question turns on a number, a wording, a result or a record, look it up rather than answer from memory, and quote what the tool returns. A tool's reply says how many matched (total) beside the rows it shows. Look things up without announcing it: no "let me check", no running commentary; write the answer once, from what came back, and say plainly when a lookup found nothing.
${lines.join("\n")}
=== END ===`
}
