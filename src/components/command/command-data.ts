import {
  Archive,
  AudioLines,
  BookA,
  BookOpen,
  Bot,
  ChartColumn,
  CircleHelp,
  Clapperboard,
  ClipboardList,
  Database,
  FileText,
  Film,
  FlaskConical,
  Hash,
  Inbox,
  Landmark,
  LayoutTemplate,
  ListChecks,
  Mail,
  MessageSquareQuote,
  MessagesSquare,
  Mic,
  NotebookPen,
  PanelLeft,
  Plus,
  Shapes,
  Table2,
  Users,
  UsersRound,
  Video,
  Vote,
  type LucideIcon,
} from "lucide-react"

// The ⌘K palette's catalog (Brendan, 2026-10-29): every kind of thing Trinity holds, so the palette can be
// judged against every scenario before it is wired. Unwired on purpose: these are stand-ins written in the
// shapes the real surfaces use (a question's wording and source, a clip's partner and length, a test's
// status), a few of each. The pages and the reports carry their real addresses; the rest have none, so
// choosing one only closes the palette. Wiring means swapping each list for its surface's own index.

export type Kind =
  | "page"
  | "command"
  | "question"
  | "construct"
  | "poll"
  | "result"
  | "source"
  | "topic"
  | "clip"
  | "partner"
  | "recording"
  | "report"
  | "treatment"
  | "ad"
  | "test"
  | "survey"
  | "statement"
  | "thread"
  | "agent"
  | "template"
  | "group"
  | "chat"
  | "script"
  | "voice"
  | "term"
  | "table"

export type CommandItem = { id: string; kind: Kind; title: string; subtitle?: string; href?: string; keywords?: string }

/** Each kind: its section, the word at the row's right, its tile, and the footer's primary action. */
export const KINDS: Record<Kind, { section: string; label: string; icon: LucideIcon; tint: string; action: string }> = {
  page: { section: "Pages", label: "Page", icon: PanelLeft, tint: "#1e3a8a", action: "Open Page" },
  command: { section: "Commands", label: "Command", icon: Plus, tint: "#2563eb", action: "Run Command" },
  question: { section: "America Thinks", label: "Question", icon: CircleHelp, tint: "#0f766e", action: "Open Question" },
  construct: { section: "America Thinks", label: "Construct", icon: Shapes, tint: "#7c3aed", action: "Open Construct" },
  poll: { section: "America Thinks", label: "Poll", icon: ChartColumn, tint: "#0891b2", action: "Open Poll" },
  result: { section: "America Thinks", label: "Result", icon: Landmark, tint: "#475569", action: "Open Result" },
  source: { section: "America Thinks", label: "Source", icon: Database, tint: "#334155", action: "Open Source" },
  topic: { section: "America Thinks", label: "Topic", icon: Hash, tint: "#0d9488", action: "Open Topic" },
  clip: { section: "Clips", label: "Clip", icon: Film, tint: "#dc2626", action: "Play Clip" },
  partner: { section: "Clips", label: "Partner", icon: UsersRound, tint: "#b91c1c", action: "Open Desk" },
  recording: { section: "Clips", label: "Recording", icon: Video, tint: "#ef4444", action: "Play Recording" },
  report: { section: "Reports", label: "Report", icon: FileText, tint: "#1e3a8a", action: "Open Report" },
  treatment: { section: "Lift", label: "Treatment", icon: Clapperboard, tint: "#2563eb", action: "Open in Lift" },
  ad: { section: "Lift", label: "Archive ad", icon: Archive, tint: "#64748b", action: "Open in Lift" },
  test: { section: "Tests", label: "Test", icon: ClipboardList, tint: "#d97706", action: "Open Test" },
  survey: { section: "Surveys", label: "Survey", icon: ListChecks, tint: "#059669", action: "Open Survey" },
  statement: { section: "Consensus", label: "Statement", icon: MessageSquareQuote, tint: "#9333ea", action: "Open Statement" },
  thread: { section: "Inbox", label: "Thread", icon: Mail, tint: "#0284c7", action: "Open Thread" },
  agent: { section: "Inbox", label: "Agent", icon: Bot, tint: "#4f46e5", action: "Open Agent" },
  template: { section: "Inbox", label: "Template", icon: LayoutTemplate, tint: "#0369a1", action: "Open Template" },
  group: { section: "Inbox", label: "Group", icon: Users, tint: "#0e7490", action: "Open Group" },
  chat: { section: "Chat", label: "Chat", icon: MessagesSquare, tint: "#1d4ed8", action: "Open Chat" },
  script: { section: "Chat", label: "Script", icon: NotebookPen, tint: "#c2410c", action: "Use Script" },
  voice: { section: "Chat", label: "Voice", icon: AudioLines, tint: "#a21caf", action: "Hear Voice" },
  term: { section: "Glossary", label: "Term", icon: BookOpen, tint: "#15803d", action: "Read Term" },
  table: { section: "Data dictionary", label: "Table", icon: Table2, tint: "#57534e", action: "Open Table" },
}

/** The sections in the order the palette lists them. */
export const SECTIONS = ["Pages", "Commands", "America Thinks", "Clips", "Reports", "Lift", "Tests", "Surveys", "Consensus", "Inbox", "Chat", "Glossary", "Data dictionary"]

const r = (kind: Kind, title: string, subtitle?: string, href?: string, keywords?: string): CommandItem => ({ id: `${kind}:${title}`, kind, title, subtitle, href, keywords })

export const ITEMS: CommandItem[] = [
  // Pages: the sidebar's, A to Z, and the pages a page leads to.
  r("page", "America Thinks", "What America thinks, question by question", "/america-thinks", "audience normative database"),
  r("page", "Chat", "Ask, write a script, record", "/chat"),
  r("page", "Clips", "The partners' library", "/clips", "videos"),
  r("page", "Consensus", "Statements voted agree, disagree or pass", "/consensus"),
  r("page", "Constructs", "One idea across sources", "/constructs"),
  r("page", "Data dictionary", "Every table and field", "/data-dictionary"),
  r("page", "Electorate", "Massachusetts registration and turnout", "/electorate"),
  r("page", "Dashboard", "Admin", "/dashboard", "delivery board worklogs"),
  r("page", "Inbox", "The Pollster, the Analyst and the Assistant", "/inbox", "mail agents"),
  r("page", "Lift", "Every lift against its placebo", "/lift", "results benchmarks"),
  r("page", "Tests", "Admin", "/message-tests", "message tests setup field kit"),
  r("page", "Reports", "Every report as a card", "/reports"),
  r("page", "Survey", "Toplines and consensus surveys", "/survey"),

  // Commands
  r("command", "New Chat", "Chat", "/chat"),
  r("command", "Record a Video", "Chat · record mode", "/chat?record=1", "camera teleprompter"),
  r("command", "New Test", "Tests", "/message-tests/new", "message test"),
  r("command", "New Survey", "Inbox · to the Pollster"),
  r("command", "Field a Test", "Inbox · to a contact group"),
  r("command", "Make a Question Card", "Consensus · from the results"),
  r("command", "Upload a Clip", "Clips"),
  r("command", "Toggle Sidebar", "Shell"),

  // America Thinks
  r("question", "Confidence in Congress", "GSS · CONLEGIS · 1973–2024 · 33 waves", undefined, "trust institutions"),
  r("question", "Confidence in the press", "GSS · CONPRESS · 1973–2024 · 33 waves"),
  r("question", "Abortion if the woman wants it for any reason", "GSS · ABANY · 1977–2024"),
  r("question", "Is the country headed in the right direction?", "ANES · 2008–2024 · 5 waves"),
  r("question", "Support for a top-two open primary", "Poll · Massachusetts · 2026"),
  r("question", "Voted in the 2022 midterm", "CPS · Massachusetts · 2010–2022"),
  r("question", "Party registration, unenrolled", "MA enrollment · 2008–2026 · 10 elections"),
  r("construct", "Confidence in Congress", "GSS Key Trends · 3 sources"),
  r("construct", "Confidence in the press", "GSS replicating core · 2 sources"),
  r("construct", "Legal abortion for any reason", "MR133 · GSS Key Trends"),
  r("construct", "Affirmative action in hiring", "ANES Guide · 2 sources"),
  r("poll", "MA Question 3 (top-two open primary)", "Tracking · 2026 · Yes 46% · No 38%", "/america-thinks?source=POLL"),
  r("poll", "Top-four primary favorability", "Public poll · 2024"),
  r("poll", "Closed primaries favorability", "Public poll · 2022"),
  r("result", "Alaska Measure 2 (2020)", "Official result · top-four with ranked choice · passed"),
  r("result", "Massachusetts Question 2 (2020)", "Official result · ranked-choice voting · failed"),
  r("source", "General Social Survey", "GSS · 1972–2024", "/america-thinks?source=GSS"),
  r("source", "American National Election Studies", "ANES", "/america-thinks?source=ANES"),
  r("source", "Cooperative Election Study", "CES", "/america-thinks?source=CES"),
  r("source", "U.S. Census", "ACS 5-year", "/america-thinks?source=ACS"),
  r("topic", "Trust & values", "1,204 questions"),
  r("topic", "Elections & voting", "842 questions"),
  r("topic", "Politics & government", "1,918 questions"),

  // Clips
  r("clip", "Danielle Allen", "PAX · 35 s · Wave 1 · +18 pp", "/clips?c=px-danielle"),
  r("clip", "Jesse Littlewood", "PAX · 49 s · Wave 1 · +15 pp"),
  r("clip", "Hold Them Accountable", "Yes on 3 · 37 s · official campaign ad"),
  r("clip", "Why independents are locked out — Gaby", "Voter Freedom · 46 s · Open Primaries · +12.7 pp"),
  r("clip", "Closed Primaries Fuel Extremes", "Voter Freedom · 55 s · untested"),
  r("clip", "Fix American Politics", "Unite America · e² · 41 s"),
  r("partner", "Voter Freedom", "Desk · 118 videos"),
  r("partner", "Unite America", "Desk · 51 videos"),
  r("partner", "Yes on 3", "Desk · 24 videos"),
  r("partner", "PAX", "Desk · 16 videos"),
  r("recording", "Why open primaries matter to me", "Your library · 24 s · private"),

  // Reports: the real pages.
  r("report", "Executive summary", "Massachusetts Message Testing · 13 of 16 videos detectable", "/reports/massachusetts-message-testing/summary"),
  r("report", "Massachusetts Wave 1", "October 2–7, 2026 · 3,600 respondents", "/reports/massachusetts-message-testing/wave-1"),
  r("report", "Massachusetts Wave 2", "October 12–15, 2026 · 2,400 respondents", "/reports/massachusetts-message-testing/wave-2"),
  r("report", "Massachusetts Wave 3", "October 29, 2026 · simulated respondents", "/reports/massachusetts-message-testing/wave-3"),
  r("report", "Open Primaries Message Test", "October 26–29, 2026 · 2,503 respondents", "/reports/open-primaries-message-test/wave-1"),
  r("report", "Methodology", "How the reports are made", "/reports/methodology"),

  // Lift
  r("treatment", "Danielle Allen", "Tests · Wave 1 · support +18 pp · detectable", "/lift?source=PAX_TEST"),
  r("treatment", "DiZoglio", "Tests · Wave 2 · support ≈+11 pp · detectable"),
  r("treatment", "Pahlow", "Tests · Wave 2 · comprehension ≈+11 pp"),
  r("ad", "Ad 0412", "Archive · vote choice +2.1 pp · contrast · 30 s", "/lift?source=LIFT_ARCHIVE"),
  r("ad", "Ad 1187", "Archive · favorability −0.8 pp · testimonial"),

  // Message tests
  r("test", "Massachusetts Wave 3", "ma-wave-3 · fielding · 7 arms", "/message-tests/ma-wave-3"),
  r("test", "A short survey", "open-primaries-1 · fielding · 5 arms · 500 an arm", "/message-tests/open-primaries-1"),
  r("test", "Massachusetts Wave 4", "Draft · 4 arms"),

  // Surveys
  r("survey", "Open primaries", "Topline · 4 questions · 10 respondents", "/survey/open-primaries"),
  r("survey", "Record experience", "Pretraining · 5 statements"),

  // Consensus
  r("statement", "Allowing unaffiliated voters to choose one party's ballot is a fair middle ground.", "Every group agreed · 61% agree"),
  r("statement", "Congress should require states to let unaffiliated voters vote in federal primaries.", "The sharpest divide"),
  r("statement", "Unenrolled voters, the largest group in Massachusetts, should not have to pick a party's ballot to vote in a primary.", "49% agree · 3 groups"),

  // Inbox
  r("thread", "Massachusetts Wave 2 closed, read", "Analyst · Oct 16 · Green +14, DiZoglio and Matt Wilson +11"),
  r("thread", "Massachusetts Wave 3 in the field", "Pollster · today · 12 of 14 finished"),
  r("thread", "Weekly digest", "Assistant · Monday"),
  r("agent", "Pollster", "Fields surveys and tests, follows up, closes at quota"),
  r("agent", "Analyst", "Writes question cards, toplines and readouts"),
  r("agent", "Assistant", "Notices, reminders, digests, onboarding"),
  r("template", "Test invitation", "Tests · Resend"),
  r("template", "Results are in", "Results · Resend"),
  r("group", "MA independents", "812 · from the Open primaries survey"),
  r("group", "Test panel", "14 · all at brendan@nysgpt.com"),

  // Chat
  r("chat", "Script for a Worcester teacher", "Yesterday · record mode"),
  r("chat", "What is a Resonance score?", "Oct 29"),
  r("script", "No Need to Listen", "Script · 52 words · 24 s"),
  r("script", "The Primary Has the Power", "Script · 58 words · 26 s"),
  r("voice", "Stephen", "Amazon Polly"),
  r("voice", "Matilda", "ElevenLabs"),

  // Glossary
  r("term", "Resonance", "The percentile of a video's lift among every lift on file", "/glossary"),
  r("term", "Lift", "A video's level minus its placebo's, in points"),
  r("term", "Detectable", "Meets the wave's stated criterion against its placebo"),
  r("term", "Outlier Score", "A short's views over its channel's median"),

  // Data dictionary
  r("table", "pax-trinity-test-responses", "DynamoDB · test, id · responses, fieldings, results, clips", "/data-dictionary"),
  r("table", "pax-trinity-tests", "DynamoDB · id · one item per test"),
  r("table", "pax_test", "Audience export · 1,236 rows · 14 fields"),
]

/** What the palette suggests before anything is typed. */
export const SUGGESTED = ["report:Massachusetts Wave 1", "command:Record a Video", "question:Confidence in Congress", "clip:Danielle Allen", "thread:Massachusetts Wave 3 in the field"]

/** The surfaces the Ask view offers to point at (@). */
export const ASK_AT: { label: string; icon: LucideIcon; tint: string }[] = [
  { label: "America Thinks", icon: Users, tint: "#0f766e" },
  { label: "Clips", icon: Film, tint: "#dc2626" },
  { label: "Lift", icon: FlaskConical, tint: "#2563eb" },
  { label: "Chat", icon: Mic, tint: "#1e3a8a" },
  { label: "Reports", icon: FileText, tint: "#1d4ed8" },
  { label: "Consensus", icon: Vote, tint: "#9333ea" },
  { label: "Inbox", icon: Inbox, tint: "#0284c7" },
  { label: "Data dictionary", icon: BookA, tint: "#57534e" },
]
