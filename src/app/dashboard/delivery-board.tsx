"use client"

import * as React from "react"
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  Code,
  Copy,
  Ellipsis,
  Flame,
  Folder,
  Globe,
  MessageSquare,
  Plus,
  ScanSearch,
  Search,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  User,
  Video,
  Zap,
} from "lucide-react"

import { cn } from "@/lib/utils"

// The Delivery Board, laid out from Brendan's reference (2026-10-29): a
// title, its crumbs and tabs; four fact cards; the week's worklogs, each
// person's day as hours over a bar in the kind of work it was; and three
// cards of apps, workflows and checks. Sample data; the filters, the week,
// the pages and the Connect and add buttons all work on it.

type Kind = "Client" | "Internal" | "Support" | "Off"
type Day = { h: number; kind: Kind }
type Person = { name: string; role: string; tone: string; days: Day[]; pct: number }

const OFF: Day = { h: 0, kind: "Off" }
const d = (h: number, kind: Exclude<Kind, "Off">): Day => ({ h, kind })

const PEOPLE: Person[] = [
  { name: "Amara Ortiz", role: "Client delivery lead", tone: "bg-rose-100 text-rose-700", pct: 92, days: [d(6.5, "Client"), d(5.5, "Internal"), d(7, "Client"), d(6, "Client"), d(4.5, "Client"), OFF, OFF] },
  { name: "Theo Mercer", role: "Platform engineer", tone: "bg-slate-200 text-slate-700", pct: 99, days: [d(8, "Client"), d(8, "Client"), d(7.5, "Client"), d(8, "Client"), d(8, "Client"), OFF, OFF] },
  { name: "Lena Hoffman", role: "Content systems editor", tone: "bg-sky-100 text-sky-700", pct: 73, days: [d(5, "Internal"), d(4.5, "Client"), d(5, "Internal"), d(3.5, "Client"), d(4, "Client"), OFF, OFF] },
  { name: "Iris Calder", role: "Design systems lead", tone: "bg-amber-100 text-amber-800", pct: 91, days: [d(6, "Client"), d(6.5, "Client"), d(6, "Internal"), d(6.5, "Client"), d(4, "Client"), OFF, OFF] },
  { name: "Samir Vale", role: "Partner success manager", tone: "bg-stone-200 text-stone-700", pct: 103, days: [d(7, "Support"), d(7.5, "Support"), d(6.5, "Client"), d(8, "Client"), d(7, "Support"), OFF, OFF] },
  { name: "Noah Brandt", role: "Data engineer", tone: "bg-emerald-100 text-emerald-700", pct: 95, days: [d(7, "Client"), d(7, "Client"), d(6, "Internal"), d(7.5, "Client"), d(6, "Client"), OFF, OFF] },
  { name: "Priya Nair", role: "QA specialist", tone: "bg-violet-100 text-violet-700", pct: 88, days: [d(6, "Client"), d(6, "Support"), d(7, "Client"), d(5.5, "Client"), d(5, "Client"), OFF, OFF] },
  { name: "Jonah Reyes", role: "Solutions architect", tone: "bg-orange-100 text-orange-700", pct: 76, days: [d(4, "Internal"), d(6, "Client"), d(6.5, "Client"), d(5, "Client"), d(3, "Internal"), OFF, OFF] },
  { name: "Maya Lindqvist", role: "Account manager", tone: "bg-teal-100 text-teal-700", pct: 85, days: [d(5, "Support"), d(5.5, "Client"), d(4, "Support"), d(6, "Client"), d(5, "Client"), OFF, OFF] },
]

/** The week the sample logs belong to: Monday, March 23, 2026. */
const WEEK0 = new Date(2026, 2, 23)
const DAY_MS = 86_400_000

const BAR: Record<Kind, string> = { Client: "bg-emerald-500", Internal: "bg-blue-500", Support: "bg-amber-500", Off: "bg-transparent" }

const hours = (h: number) => {
  const whole = Math.floor(h)
  const mins = Math.round((h - whole) * 60)
  return mins ? `${whole}h ${mins}m` : `${whole}h`
}
const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")

function Avatar({ name, tone, className }: { name: string; tone: string; className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-2 ring-background", tone, className)}>
      {initials(name)}
    </span>
  )
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="inline-flex size-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted">
      {children}
    </button>
  )
}

/** A native select in the board's dress: the bordered box and its chevron. */
function Picker({ value, onChange, options, label, className }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-lg border bg-background pr-9 pl-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

/** A section's grey ground: its title and line on it, its white card inside. */
function Section({ title, sub, action, children, className }: { title: string; sub: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-muted/40 p-1.5", className)}>
      <div className="flex items-start justify-between gap-4 px-4 pt-3 pb-3.5">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{sub}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

const TABS = ["Overview", "Worklog", "Files", "Reports"] as const

export function DeliveryBoard() {
  const [tab, setTab] = React.useState<(typeof TABS)[number]>("Overview")
  return (
    <div className="mx-auto w-full max-w-[1560px] px-6 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Delivery Board</h1>
      <div className="mt-2 flex items-center justify-between gap-4">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[15px]">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Folder className="size-4" />
            Accounts
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Folder className="size-4" />
            Delivery
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
          <span className="truncate">Northstar Rollout</span>
        </nav>
        <div className="flex items-center gap-1">
          <IconButton label="Search">
            <Search className="size-5" />
          </IconButton>
          <IconButton label="Favorite">
            <Star className="size-5" />
          </IconButton>
          <IconButton label="More">
            <Ellipsis className="size-5" />
          </IconButton>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-b">
        <div role="tablist" className="flex gap-5">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn("-mb-px border-b-2 pb-3 text-[17px] transition-colors", tab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 pb-2">
          <button type="button" aria-label="Add" title="Add" className="inline-flex size-9 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-85">
            <Plus className="size-5" />
          </button>
          <span aria-hidden className="h-6 w-px bg-border" />
          <div className="flex items-center">
            {PEOPLE.slice(0, 3).map((p, i) => (
              <Avatar key={p.name} name={p.name} tone={p.tone} className={cn(i > 0 && "-ml-2.5")} />
            ))}
            <span className="-ml-2.5 inline-flex size-9 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background">+{PEOPLE.length - 3}</span>
          </div>
        </div>
      </div>

      {tab === "Overview" ? (
        <div className="mt-8 flex flex-col gap-6">
          <Facts />
          <Worklogs />
          <div className="grid gap-4 lg:grid-cols-3">
            <DeliveryApps />
            <ManualWorkflows />
            <DeliveryChecks />
          </div>
        </div>
      ) : (
        <p className="mt-16 text-center text-sm text-muted-foreground">{tab} is empty in the sample.</p>
      )}
    </div>
  )
}

function Facts() {
  const owner = PEOPLE[0]
  const card = "flex min-h-44 flex-col justify-between rounded-xl border bg-card p-5 shadow-xs"
  const head = (label: string, Icon: React.ComponentType<{ className?: string }>) => (
    <div className="flex items-center justify-between text-muted-foreground">
      <span className="text-[17px]">{label}</span>
      <Icon className="size-5" />
    </div>
  )
  return (
    <div className="grid gap-1.5 rounded-2xl border bg-muted/40 p-1.5 sm:grid-cols-2 xl:grid-cols-4">
      <div className={card}>
        {head("Account", Copy)}
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[17px] font-medium">Northstar Commerce</p>
            <p className="text-[17px] text-muted-foreground">Enterprise rollout</p>
          </div>
          <Flame className="size-6 fill-orange-500 text-red-500" />
        </div>
      </div>
      <div className={card}>
        {head("Workspace", Globe)}
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[17px] font-medium">portal.northstar.io</p>
            <p className="text-[17px] text-muted-foreground">Requests: 124k/day</p>
          </div>
          <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-200">Running</span>
        </div>
      </div>
      <div className={card}>
        {head("Next Review", Calendar)}
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[17px] font-medium">Apr 3, 2026</p>
            <p className="text-[17px] text-muted-foreground">Client steering</p>
          </div>
          <div className="flex items-center">
            {PEOPLE.slice(1, 4).map((p, i) => (
              <Avatar key={p.name} name={p.name} tone={p.tone} className={cn("size-7 text-[10px]", i > 0 && "-ml-2")} />
            ))}
            <span className="-ml-2 inline-flex size-7 items-center justify-center rounded-full bg-muted text-[11px] text-muted-foreground ring-2 ring-background">+1</span>
          </div>
        </div>
      </div>
      <div className={card}>
        {head("Owner", User)}
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[17px] font-medium">{owner.name}</p>
            <p className="text-[17px] text-muted-foreground">Delivery lead</p>
          </div>
          <Avatar name={owner.name} tone={owner.tone} className="size-8 text-[11px]" />
        </div>
      </div>
    </div>
  )
}

function Worklogs() {
  const [search, setSearch] = React.useState("")
  const [person, setPerson] = React.useState("all")
  const [tracked, setTracked] = React.useState("all")
  const [billable, setBillable] = React.useState("all")
  const [week, setWeek] = React.useState(0)
  const [per, setPer] = React.useState(5)
  const [page, setPage] = React.useState(0)
  React.useEffect(() => setPage(0), [search, person, per])

  const monday = new Date(WEEK0.getTime() + week * 7 * DAY_MS)
  const days = Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * DAY_MS))
  const md = (x: Date) => x.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  const sunday = days[6]
  const range = monday.getMonth() === sunday.getMonth() ? `${md(monday)} - ${sunday.getDate()}` : `${md(monday)} - ${md(sunday)}`

  const q = search.trim().toLowerCase()
  const rows = PEOPLE.filter((p) => (person === "all" || p.name === person) && (!q || p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q)))
  const pages = Math.max(1, Math.ceil(rows.length / per))
  const shown = rows.slice(page * per, page * per + per)
  // A cell outside the tracked kind or the billable status picked fades.
  const kept = (day: Day) =>
    (tracked === "all" || day.kind === tracked) && (billable === "all" || (billable === "billable" ? day.kind === "Client" : day.kind === "Internal" || day.kind === "Support"))
  const logged = week === 0

  return (
    <Section
      title="Worklogs"
      sub="Weekly client delivery hours"
      action={
        <button type="button" className="rounded-lg bg-foreground px-3.5 py-2 text-[15px] font-medium text-background transition-opacity hover:opacity-85">
          New Log
        </button>
      }
    >
      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="flex flex-wrap items-center gap-3 p-3">
          <div className="flex h-10 w-64 items-center gap-2 rounded-lg border px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </div>
          <Picker label="People" className="w-60" value={person} onChange={setPerson} options={[{ value: "all", label: "People" }, ...PEOPLE.map((p) => ({ value: p.name, label: p.name }))]} />
          <Picker
            label="Tracked time"
            className="w-60"
            value={tracked}
            onChange={setTracked}
            options={[
              { value: "all", label: "Tracked time" },
              { value: "Client", label: "Client" },
              { value: "Internal", label: "Internal" },
              { value: "Support", label: "Support" },
            ]}
          />
          <Picker
            label="Billable status"
            className="w-60"
            value={billable}
            onChange={setBillable}
            options={[
              { value: "all", label: "Billable status" },
              { value: "billable", label: "Billable" },
              { value: "non", label: "Non-billable" },
            ]}
          />
          <div className="ml-auto flex h-10 items-center rounded-lg border">
            <button type="button" aria-label="Previous week" onClick={() => setWeek((w) => w - 1)} className="inline-flex h-full w-10 items-center justify-center border-r hover:bg-muted">
              <ChevronLeft className="size-4" />
            </button>
            <span className="flex h-full items-center gap-6 px-3 text-[15px] tabular-nums">
              {range}
              <Calendar className="size-4 text-muted-foreground" />
            </span>
            <button type="button" aria-label="Next week" onClick={() => setWeek((w) => w + 1)} className="inline-flex h-full w-10 items-center justify-center border-l hover:bg-muted">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-y text-muted-foreground">
                <th className="w-80 px-3 py-2.5 text-left font-normal">People</th>
                {days.map((x) => (
                  <th key={x.getTime()} className="border-l px-2 py-2.5 text-center font-normal whitespace-nowrap">
                    {x.toLocaleDateString("en-US", { weekday: "short" })}, {md(x)}
                  </th>
                ))}
                <th className="border-l px-3 py-2.5 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {!logged ? (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center text-muted-foreground">
                    No time logged {range}.
                  </td>
                </tr>
              ) : shown.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center text-muted-foreground">
                    No one matches.
                  </td>
                </tr>
              ) : (
                shown.map((p) => {
                  const total = p.days.reduce((s, x) => s + x.h, 0)
                  const up = p.pct >= 80
                  return (
                    <tr key={p.name} className="border-b">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={p.name} tone={p.tone} className="size-11 text-sm" />
                          <div>
                            <p className="text-[15px] font-medium">{p.name}</p>
                            <p className="text-muted-foreground">{p.role}</p>
                          </div>
                        </div>
                      </td>
                      {p.days.map((x, i) => (
                        <td key={i} className={cn("border-l px-2 py-3 text-center transition-opacity", !kept(x) && "opacity-30")}>
                          <p className={cn("text-[15px]", x.h ? "font-medium" : "text-muted-foreground")}>{x.h ? hours(x.h) : "-"}</p>
                          <div className="mx-auto mt-1.5 h-1 w-[75px] overflow-hidden rounded-full bg-muted">
                            <div className={cn("h-full rounded-full", BAR[x.kind])} style={{ width: `${Math.min(100, (x.h / 8) * 100)}%` }} />
                          </div>
                          <p className="mt-1.5 text-xs text-muted-foreground">{x.kind}</p>
                        </td>
                      ))}
                      <td className="border-l px-3 py-3 text-right">
                        <p className="text-[15px] font-semibold">{hours(total)}</p>
                        <p className={cn("mt-1 inline-flex items-center gap-1 text-sm", up ? "text-emerald-600" : "text-amber-600")}>
                          {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                          {p.pct}%
                        </p>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-4 px-5 py-3">
          <label className="flex items-center gap-3 text-[15px] text-muted-foreground">
            Rows per page
            <Picker
              label="Rows per page"
              className="w-[84px] text-foreground"
              value={String(per)}
              onChange={(v) => setPer(Number(v))}
              options={[
                { value: "5", label: "5" },
                { value: "10", label: "10" },
              ]}
            />
          </label>
          <div className="flex items-center gap-2 text-[15px]">
            <span className="mr-3 tabular-nums">
              {rows.length ? `${page * per + 1} - ${Math.min(rows.length, page * per + per)} of ${rows.length}` : "0 of 0"}
            </span>
            <button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => setPage((x) => x - 1)} className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40">
              <ChevronLeft className="size-4" />
            </button>
            {Array.from({ length: pages }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-current={page === i ? "page" : undefined}
                onClick={() => setPage(i)}
                className={cn("inline-flex size-9 items-center justify-center rounded-lg tabular-nums", page === i ? "border bg-background shadow-xs" : "text-muted-foreground hover:bg-muted")}
              >
                {i + 1}
              </button>
            ))}
            <button type="button" aria-label="Next page" disabled={page >= pages - 1} onClick={() => setPage((x) => x + 1)} className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </Section>
  )
}

/** A card of rows on the section's ground, its one wide button under it. */
function ListCard({ title, sub, more, children }: { title: string; sub: string; more: string; children: React.ReactNode }) {
  return (
    <Section title={title} sub={sub} className="flex flex-col">
      <div className="flex-1 rounded-xl border bg-card px-4 py-1 shadow-xs">
        <ul className="divide-y divide-dashed">{children}</ul>
      </div>
      <button type="button" className="mt-1.5 rounded-lg border bg-background py-2 text-[15px] font-medium shadow-xs transition-colors hover:bg-muted">
        {more}
      </button>
    </Section>
  )
}

function Row({ lead, title, sub, end }: { lead: React.ReactNode; title: string; sub: string; end: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-3.5">
      {lead}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">{title}</p>
        <p className="truncate text-sm text-muted-foreground">{sub}</p>
      </div>
      {end}
    </li>
  )
}

function Tile({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">{children}</span>
}

const APPS: { name: string; sub: string; mark: React.ReactNode }[] = [
  {
    name: "Zoom",
    sub: "Client calls",
    mark: (
      <span className="inline-flex size-8 items-center justify-center rounded-full bg-[#2d8cff] text-white">
        <Video className="size-4 fill-white" />
      </span>
    ),
  },
  {
    name: "Slack",
    sub: "Launch room",
    // eslint-disable-next-line @next/next/no-img-element -- a fixed 32px logo from public/
    mark: <img src="/logos/slack.png" alt="" className="size-8 object-contain" />,
  },
  { name: "Supabase", sub: "Usage store", mark: <Zap className="size-8 fill-[#3ecf8e] text-[#3ecf8e]" /> },
  {
    name: "Clerk",
    sub: "SSO gate",
    mark: (
      <span className="relative inline-flex size-8 items-center justify-center rounded-full border-[5px] border-[#6c47ff] border-r-[#c4b5fd]">
        <span className="size-2 rounded-full bg-[#6c47ff]" />
      </span>
    ),
  },
]

function DeliveryApps() {
  const [on, setOn] = React.useState<string[]>([])
  return (
    <ListCard title="Delivery Apps" sub="Live project connectors" more="See All">
      {APPS.map((a) => {
        const connected = on.includes(a.name)
        return (
          <Row
            key={a.name}
            lead={<span className="inline-flex size-10 shrink-0 items-center justify-center">{a.mark}</span>}
            title={a.name}
            sub={a.sub}
            end={
              <button
                type="button"
                onClick={() => setOn((prev) => (connected ? prev.filter((x) => x !== a.name) : [...prev, a.name]))}
                className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[15px] font-medium shadow-xs transition-colors", connected ? "bg-muted" : "bg-background hover:bg-muted")}
              >
                {connected && <Check className="size-4 text-emerald-600" />}
                {connected ? "Connected" : "Connect"}
              </button>
            }
          />
        )
      })}
    </ListCard>
  )
}

const WORKFLOWS = [
  { name: "Data Audit", sub: "Clean rollout exports", Icon: Code },
  { name: "Risk Sweep", sub: "Flag delivery drift", Icon: ScanSearch },
  { name: "Launch Recap", sub: "Draft client summary", Icon: Sparkles },
  { name: "Support Bot", sub: "Route handoff notes", Icon: MessageSquare },
]

function ManualWorkflows() {
  const [added, setAdded] = React.useState<string[]>([])
  return (
    <ListCard title="Manual Workflows" sub="Optional workflow add-ons" more="Browse More">
      {WORKFLOWS.map(({ name, sub, Icon }) => {
        const on = added.includes(name)
        return (
          <Row
            key={name}
            lead={
              <Tile>
                <Icon className="size-4" />
              </Tile>
            }
            title={name}
            sub={sub}
            end={
              <button
                type="button"
                aria-label={on ? `Remove ${name}` : `Add ${name}`}
                aria-pressed={on}
                onClick={() => setAdded((prev) => (on ? prev.filter((x) => x !== name) : [...prev, name]))}
                className="inline-flex size-9 items-center justify-center rounded-lg border bg-background shadow-xs transition-colors hover:bg-muted"
              >
                {on ? <Check className="size-4 text-emerald-600" /> : <Plus className="size-4" />}
              </button>
            }
          />
        )
      })}
    </ListCard>
  )
}

const CHECKS = [
  { name: "Scope Check", sub: "Confirm launch criteria", Icon: ClipboardList, status: "Ready", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { name: "QA Handoff", sub: "Send tester notes", Icon: CircleCheck, status: "Due", tone: "bg-amber-50 text-amber-700 ring-amber-200" },
  { name: "Stakeholder Sync", sub: "Align decision owners", Icon: User, status: "Review", tone: "bg-violet-50 text-violet-700 ring-violet-200" },
  { name: "Client Recap", sub: "Queue weekly update", Icon: MessageSquare, status: "Queued", tone: "bg-muted text-foreground ring-border" },
]

function DeliveryChecks() {
  return (
    <ListCard title="Delivery Checks" sub="Launch readiness tasks" more="View Tasks">
      {CHECKS.map(({ name, sub, Icon, status, tone }) => (
        <Row
          key={name}
          lead={
            <Tile>
              <Icon className="size-4" />
            </Tile>
          }
          title={name}
          sub={sub}
          end={<span className={cn("rounded-md px-2 py-0.5 text-sm font-medium ring-1", tone)}>{status}</span>}
        />
      ))}
    </ListCard>
  )
}
