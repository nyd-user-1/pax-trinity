"use client"

import * as React from "react"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  EllipsisVertical,
  FileText,
  Film,
  FlaskConical,
  HardDrive,
  Hash,
  Inbox,
  KeyRound,
  ListFilter,
  Mail,
  MessageSquare,
  MessagesSquare,
  Monitor,
  Play,
  Plus,
  Puzzle,
  Search,
  Send,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Upload,
  User2,
  UserPlus,
  Users,
  X,
} from "lucide-react"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/ui/components/nova/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/components/nova/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/components/nova/select"
import { whiteButton } from "@/components/white-button"
import { MEMBERS, type Role } from "@/lib/roles"
import { cn } from "@/ui/lib/utils"

import { Avatar, Badge, Block, Chip, FIELD, ICON_BUTTON, PageTabs, PRIMARY, Row, SMALL, SMALL_PRIMARY, Tile, type Tone } from "./blocks"
import { Choice, Field, Tick, Ticks, Toggle } from "./controls"

// /settings (Brendan, 2026-10-29): the account menu's Profile, Account, Notifications and Settings, as one
// page of six tabs after his reference. Account folds Members and Permissions, Settings folds General and
// Integrations. Every section is a Block. Unwired: Cancel puts the tab back as it was, Update keeps the
// changes for this visit, and nothing saves. Members reads the roster in lib/roles.ts.

export type SettingsTab = "general" | "profile" | "members" | "permissions" | "notifications" | "integrations"
type User = { name: string; email: string }

export const SETTINGS_TABS: { key: SettingsTab; label: string; icon: typeof Bell }[] = [
  { key: "general", label: "General", icon: SlidersHorizontal },
  { key: "profile", label: "Profile", icon: User2 },
  { key: "members", label: "Members", icon: Users },
  { key: "permissions", label: "Permissions", icon: Shield },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "integrations", label: "Integrations", icon: Puzzle },
]

export const settingsHref = (tab: SettingsTab) => (tab === "general" ? "/settings" : `/settings?tab=${tab}`)

const MENU = "w-auto min-w-44 rounded-xl border border-slate-200 bg-pax2-surface p-1 shadow-e2 ring-0"
const MENU_ITEM = "gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] [&_svg]:size-4 [&_svg]:text-slate-500"
// A press on any of these is an edit, and wakes Cancel and Update.
const EDITS = '[role="switch"],[role="checkbox"],[role="option"],[role="menuitemradio"],[role="radio"],[aria-pressed],[data-edit]'

export function SettingsPage({ tab }: { tab: SettingsTab }) {
  const [user, setUser] = React.useState<User | null | undefined>(undefined)
  React.useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { user: User | null }) => setUser(d.user))
      .catch(() => setUser(null))
  }, [])
  // Cancel remounts the tab (`round`), which puts every control back; an edit marks this tab and round.
  const [round, setRound] = React.useState(0)
  const [edited, setEdited] = React.useState<string | null>(null)
  const here = `${tab}:${round}`
  const dirty = edited === here
  const mark = () => setEdited(here)

  return (
    <div className="mx-auto w-full max-w-[920px] space-y-8 pb-10">
      <PageTabs
        tabs={SETTINGS_TABS.map((t) => ({ ...t, href: settingsHref(t.key) }))}
        active={tab}
        trailing={
          <>
            <button type="button" disabled={!dirty} onClick={() => setRound(round + 1)} className={whiteButton("md", "py-2 shadow-e1")}>
              Cancel
            </button>
            <button type="button" disabled={!dirty} onClick={() => setEdited(null)} className={PRIMARY}>
              Update
            </button>
          </>
        }
      />
      {user !== undefined && (
        <div
          key={here}
          className="space-y-8"
          onChangeCapture={mark}
          onClickCapture={(e) => {
            if ((e.target as HTMLElement).closest(EDITS)) mark()
          }}
        >
          {tab === "general" && <General />}
          {tab === "profile" && <Profile user={user} />}
          {tab === "members" && <Members user={user} />}
          {tab === "permissions" && <Permissions />}
          {tab === "notifications" && <Notifications />}
          {tab === "integrations" && <Integrations />}
        </div>
      )}
    </div>
  )
}

const TIMEZONES = ["Eastern (New York)", "Central (Chicago)", "Mountain (Denver)", "Pacific (Los Angeles)", "UTC"]

/* ─── General ───────────────────────────────────────────────────────────────────────────────────── */

const ACCENTS = [
  { name: "PAX blue", hex: "#1e3a8a" },
  { name: "Bright blue", hex: "#2563eb" },
  { name: "Violet", hex: "#7c3aed" },
  { name: "Red", hex: "#dc2626" },
  { name: "Green", hex: "#16a34a" },
  { name: "Slate", hex: "#475569" },
]

function General() {
  const [domains, setDomains] = React.useState(["parallaxinnovations.com", "nysgpt.com", "uniteamerica.org"])
  const [adding, setAdding] = React.useState<string | null>(null)
  const [accent, setAccent] = React.useState(ACCENTS[0]!.hex)
  const addDomain = () => {
    const d = (adding ?? "").trim().toLowerCase().replace(/^@/, "")
    if (d.includes(".") && !domains.includes(d)) setDomains([...domains, d])
    setAdding(null)
  }
  return (
    <>
      <Block title="Workspace">
        <Row label="Workspace name" hint="On shared reports, invites and the inbox's mail.">
          <Field aria-label="Workspace name" defaultValue="Parallax" />
        </Row>
        <Row label="Workspace address" hint="Invites and share links use it.">
          <Field aria-label="Workspace address" lead="pax.nysgpt.com/" defaultValue="parallax" />
        </Row>
        <Row label="Invite domains" hint="Sign-ups from these domains join without review." top wide>
          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
            {domains.map((d) => (
              <Chip key={d} label={d} onRemove={() => setDomains(domains.filter((x) => x !== d))}>
                {d}
              </Chip>
            ))}
            {adding === null ? (
              <button type="button" onClick={() => setAdding("")} className={SMALL}>
                <Plus /> Add domain
              </button>
            ) : (
              <input
                autoFocus
                value={adding}
                onChange={(e) => setAdding(e.target.value)}
                onBlur={addDomain}
                onKeyDown={(e) => e.key === "Enter" && addDomain()}
                placeholder="example.org"
                aria-label="New invite domain"
                className={cn(FIELD, "h-8 w-40 px-2.5 outline-none")}
              />
            )}
          </div>
        </Row>
        <Row label="Accent color" hint="Links and status.">
          <div className="flex gap-2.5" role="radiogroup" aria-label="Accent color">
            {ACCENTS.map((a) => (
              <button
                key={a.hex}
                type="button"
                role="radio"
                aria-checked={accent === a.hex}
                aria-label={a.name}
                onClick={() => setAccent(a.hex)}
                className={cn("size-7 rounded-full ring-offset-2 transition-shadow outline-none focus-visible:ring-3 focus-visible:ring-pax2-light-blue/40", accent === a.hex && "ring-2 ring-slate-400")}
                style={{ background: a.hex }}
              />
            ))}
          </div>
        </Row>
      </Block>

      <Block title="Region">
        <Row label="Language">
          <Choice label="Language" options={["English (US)", "Español"]} defaultValue="English (US)" />
        </Row>
        <Row label="Timezone" hint="Digests, schedules and fielding windows.">
          <Choice label="Timezone" options={TIMEZONES} defaultValue="Eastern (New York)" />
        </Row>
        <Row label="Week starts">
          <Choice label="Week starts" options={["Sunday", "Monday"]} defaultValue="Sunday" />
        </Row>
        <Row label="Date format" hint="Reports, exports and the inbox.">
          <Choice label="Date format" options={["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]} defaultValue="MM/DD/YYYY" />
        </Row>
      </Block>

      <Block title="Editing">
        <Row label="Send on Enter" hint="In the chat box. Shift+Enter starts a new line.">
          <Toggle label="Send on Enter" defaultOn />
        </Row>
        <Row label="Markdown shortcuts" hint="Bold, lists and links as you type.">
          <Toggle label="Markdown shortcuts" defaultOn />
        </Row>
        <Row label="Compact tables" hint="More rows in crosstabs and the data dictionary.">
          <Toggle label="Compact tables" defaultOn />
        </Row>
      </Block>
    </>
  )
}

/* ─── Profile ───────────────────────────────────────────────────────────────────────────────────── */

function Profile({ user }: { user: User | null }) {
  const [photo, setPhoto] = React.useState(true)
  const name = user?.name ?? ""
  const email = user?.email ?? ""
  return (
    <>
      <Block title="Personal details">
        <Row label="Profile photo" hint="In the inbox, comments and the member list.">
          <div className="flex items-center gap-2">
            {photo ? <Avatar name={name} email={email} size={40} fallback="/avatars/default.jpg" /> : <Avatar name={name || "?"} size={40} />}
            <button type="button" data-edit onClick={() => setPhoto(true)} className={SMALL}>
              <Upload /> Change
            </button>
            <button type="button" data-edit onClick={() => setPhoto(false)} className={SMALL}>
              <X /> Remove
            </button>
          </div>
        </Row>
        <Row label="Full name" hint="On reports, comments and invites.">
          <Field aria-label="Full name" defaultValue={name} />
        </Row>
        <Row label="Email address" badge={email ? <Badge tone="green">Verified</Badge> : undefined} hint="Sign-in and mail.">
          <Field aria-label="Email address" type="email" defaultValue={email} />
        </Row>
        <Row label="Phone number" hint="Account recovery only.">
          <Field aria-label="Phone number" type="tel" lead="+1" placeholder="212 555 0100" />
        </Row>
        <Row label="Username" hint="For @mentions in comments and the inbox.">
          <Field aria-label="Username" lead="@" defaultValue={email.split("@")[0]} />
        </Row>
      </Block>

      <Block title="Public profile">
        <Row label="Title" hint="Beside the name on shared reports.">
          <Field aria-label="Title" placeholder="Pollster" />
        </Row>
        <Row label="Timezone" hint="On profile hovers and review schedules.">
          <Choice label="Timezone" options={TIMEZONES} defaultValue="Eastern (New York)" />
        </Row>
        <Row label="Website">
          <Field aria-label="Website" lead="https://" placeholder="nysgpt.com" />
        </Row>
        <Row label="Bio" hint="For teammates and partners." top wide>
          <textarea aria-label="Bio" rows={3} className={cn(FIELD, "block w-full resize-none px-3 py-2 outline-none")} />
        </Row>
      </Block>

      <Block title="Display">
        <Row label="Landing page" hint="Where sign-in lands.">
          <Choice label="Landing page" options={["Chat", "America Thinks", "Clips", "Inbox", "Reports"]} defaultValue="Chat" />
        </Row>
        <Row label="Profile visibility" hint="Who sees the title, bio and local time.">
          <Choice label="Profile visibility" options={["Workspace", "Staff and admins", "Admins only"]} defaultValue="Workspace" />
        </Row>
        <Row label="Show local time" hint="On profile hovers.">
          <Toggle label="Show local time" defaultOn />
        </Row>
      </Block>
    </>
  )
}

/* ─── Members ───────────────────────────────────────────────────────────────────────────────────── */

const ROLE_LABEL: Record<Role, string> = { superadmin: "Super admin", admin: "Admin", staff: "Staff", partner: "Partner" }
const ROLE_TONE: Record<Role, Tone> = { superadmin: "blue", admin: "violet", staff: "slate", partner: "amber" }
const ROLE_RANK: Record<Role, number> = { superadmin: 0, admin: 1, staff: 2, partner: 3 }
type Status = "Active" | "Invited" | "No email"
const STATUS_TONE: Record<Status, Tone> = { Active: "green", Invited: "violet", "No email": "amber" }
type Person = { name: string; email?: string; role: Role; status: Status; you?: boolean }

const AREAS = [
  { id: "chat", label: "Chat", icon: MessagesSquare, tint: "#1e3a8a" },
  { id: "america-thinks", label: "America Thinks", icon: Users, tint: "#2563eb" },
  { id: "clips", label: "Clips", icon: Film, tint: "#dc2626" },
  { id: "inbox", label: "Inbox", icon: Inbox, tint: "#7c3aed" },
  { id: "lift", label: "Lift", icon: FlaskConical, tint: "#16a34a" },
  { id: "reports", label: "Reports", icon: FileText, tint: "#475569" },
]

function roster(user: User | null): Person[] {
  // The members as lib/roles.ts names them, Ted's Unite America partner account among them. The accounts were
  // made on 2026-10-29 and wait on a first sign-in; the two staff without an address can't be invited yet.
  const people = MEMBERS.map((m): Person => ({ ...m, status: !m.email ? "No email" : m.role === "superadmin" ? "Active" : "Invited" }))
  if (!user) return people
  const me = people.find((p) => p.email?.toLowerCase() === user.email.toLowerCase())
  if (me) Object.assign(me, { you: true, status: "Active" })
  else people.unshift({ name: user.name, email: user.email, role: "admin", status: "Active", you: true })
  return people
}

function Members({ user }: { user: User | null }) {
  const [areas, setAreas] = React.useState(new Set(["chat", "america-thinks", "reports"]))
  const [people, setPeople] = React.useState(() => roster(user))
  const [q, setQ] = React.useState("")
  const [status, setStatus] = React.useState<"All" | Status>("All")
  const [sort, setSort] = React.useState<{ key: "name" | "role"; dir: 1 | -1 }>({ key: "name", dir: 1 })
  const [perPage, setPerPage] = React.useState(5)
  const [page, setPage] = React.useState(0)

  const shown = React.useMemo(() => {
    const needle = q.trim().toLowerCase()
    return people
      .filter((p) => (status === "All" || p.status === status) && (!needle || `${p.name} ${p.email ?? ""} ${ROLE_LABEL[p.role]}`.toLowerCase().includes(needle)))
      .sort((a, b) => sort.dir * (sort.key === "name" ? a.name.localeCompare(b.name) : ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.name.localeCompare(b.name)))
  }, [people, q, status, sort])
  const pages = Math.max(1, Math.ceil(shown.length / perPage))
  const at = Math.min(page, pages - 1)
  const slice = shown.slice(at * perPage, at * perPage + perPage)

  const toggleSort = (key: "name" | "role") => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))
  const sortIcon = (k: "name" | "role") => (sort.key !== k ? <ArrowUpDown className="size-3.5 text-slate-300" /> : sort.dir === 1 ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />)
  const update = (email: string | undefined, name: string, patch: Partial<Person> | null) =>
    setPeople((ps) => (patch ? ps.map((p) => (p.name === name && p.email === email ? { ...p, ...patch } : p)) : ps.filter((p) => !(p.name === name && p.email === email))))

  return (
    <>
      <Block title="Invite defaults">
        <Row label="Default role" hint="What a new member starts as.">
          <Choice label="Default role" options={["Admin", "Staff", "Partner"]} defaultValue="Staff" />
        </Row>
        <Row label="Roster visibility" hint="How much of the team partners see.">
          <Choice label="Roster visibility" options={["Full roster", "Limited roster", "Admins only"]} defaultValue="Limited roster" />
        </Row>
        <div className="px-4 py-3.5 sm:px-5">
          <p className="text-sm font-medium text-slate-900">Workspace access</p>
          <p className="mt-0.5 text-[13px] text-slate-500">Where a new member can go on day one.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AREAS.map((a) => {
              const on = areas.has(a.id)
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setAreas((s) => {
                      const next = new Set(s)
                      if (!next.delete(a.id)) next.add(a.id)
                      return next
                    })
                  }
                  className={cn("flex items-center gap-3 rounded-xl border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-pax2-light-blue/30", on ? "border-pax2-blue bg-pax2-lavender/40" : "border-slate-200 bg-pax2-surface hover:border-slate-300")}
                >
                  <Tile icon={a.icon} tint={a.tint} />
                  <span className="flex-1 text-sm font-medium text-slate-900">{a.label}</span>
                  <span className={cn("flex size-5 items-center justify-center rounded-full border", on ? "border-pax2-blue bg-pax2-blue text-white" : "border-slate-300 bg-pax2-surface")}>{on && <Check className="size-3" strokeWidth={3} />}</span>
                </button>
              )
            })}
          </div>
        </div>
      </Block>

      <Block title="Workspace members" action={<InviteMember onInvite={(p) => setPeople((ps) => [...ps, p])} />}>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
          <label className={cn(FIELD, "flex h-9 min-w-0 flex-1 items-center gap-2 px-3 sm:max-w-80")}>
            <Search className="size-4 shrink-0 text-slate-400" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(0)
              }}
              placeholder="Search members…"
              aria-label="Search members"
              className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
            />
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(SMALL, "h-9", status !== "All" && "border-pax2-blue text-pax2-blue")}>
              <ListFilter /> {status === "All" ? "Status" : status}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className={MENU}>
              <DropdownMenuRadioGroup
                value={status}
                onValueChange={(v) => {
                  setStatus(v as typeof status)
                  setPage(0)
                }}
              >
                {(["All", "Active", "Invited", "No email"] as const).map((s) => (
                  <DropdownMenuRadioItem key={s} value={s} closeOnClick className={MENU_ITEM}>
                    {s}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="ml-auto text-[13px] text-slate-500">{people.length} members</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[13px] text-slate-500">
                <th className="px-5 py-2 font-medium">
                  <button type="button" onClick={() => toggleSort("name")} className="inline-flex items-center gap-1 hover:text-slate-900">
                    Member {sortIcon("name")}
                  </button>
                </th>
                <th className="px-3 py-2 font-medium">
                  <button type="button" onClick={() => toggleSort("role")} className="inline-flex items-center gap-1 hover:text-slate-900">
                    Role {sortIcon("role")}
                  </button>
                </th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="w-12 px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {slice.map((p) => (
                <tr key={`${p.name}:${p.email ?? ""}`}>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={p.name} email={p.email} fallback={p.you ? "/avatars/default.jpg" : undefined} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-medium text-slate-900">
                          <span className="truncate">{p.name}</span>
                          {p.you && <Badge tone="slate">You</Badge>}
                        </div>
                        {p.email && <div className="truncate text-[13px] text-slate-500">{p.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={ROLE_TONE[p.role]}>{ROLE_LABEL[p.role]}</Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger aria-label={`Actions for ${p.name}`} className={ICON_BUTTON}>
                        <EllipsisVertical className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className={MENU}>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger disabled={p.role === "superadmin"} className={cn(MENU_ITEM, "data-disabled:opacity-40")}>
                            <Shield /> Change role
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className={MENU}>
                            <DropdownMenuRadioGroup value={p.role} onValueChange={(v) => update(p.email, p.name, { role: v as Role })}>
                              {(["admin", "staff", "partner"] as const).map((r) => (
                                <DropdownMenuRadioItem key={r} value={r} closeOnClick className={MENU_ITEM}>
                                  {ROLE_LABEL[r]}
                                </DropdownMenuRadioItem>
                              ))}
                            </DropdownMenuRadioGroup>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuItem disabled={p.status !== "Invited"} className={cn(MENU_ITEM, "data-disabled:opacity-40")}>
                          <Mail /> Resend invite
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          data-edit
                          disabled={p.role === "superadmin" || p.you}
                          onClick={() => update(p.email, p.name, null)}
                          className={cn(MENU_ITEM, "text-pax2-red-deep data-disabled:opacity-40 [&_svg]:text-pax2-red-deep")}
                        >
                          <X /> Remove from workspace
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {!slice.length && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-500">
                    No one matches.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 text-[13px] text-slate-500 sm:px-5">
          <span>Rows per page</span>
          <Select
            value={String(perPage)}
            onValueChange={(v) => {
              setPerPage(Number(v))
              setPage(0)
            }}
          >
            <SelectTrigger aria-label="Rows per page" size="sm" className="h-8 w-16 rounded-lg border-slate-200 bg-pax2-surface shadow-e1 dark:bg-pax2-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="min-w-20 rounded-xl border border-slate-200 bg-pax2-surface p-1 shadow-e2 ring-0">
              {["5", "10", "20"].map((n) => (
                <SelectItem key={n} value={n} className="rounded-lg px-2.5 py-1.5">
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="ml-auto tabular-nums">{shown.length ? `${at * perPage + 1}–${Math.min(shown.length, (at + 1) * perPage)} of ${shown.length}` : "0 of 0"}</span>
          <button type="button" aria-label="Previous page" disabled={at === 0} onClick={() => setPage(at - 1)} className={cn(ICON_BUTTON, "disabled:pointer-events-none disabled:opacity-30")}>
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" aria-label="Next page" disabled={at >= pages - 1} onClick={() => setPage(at + 1)} className={cn(ICON_BUTTON, "-ml-2 disabled:pointer-events-none disabled:opacity-30")}>
            <ChevronRight className="size-4" />
          </button>
        </div>
      </Block>
    </>
  )
}

/** Invite member: an address and a role. Unwired, so no mail goes out; the row joins the list as Invited. */
function InviteMember({ onInvite }: { onInvite: (p: Person) => void }) {
  const [open, setOpen] = React.useState(false)
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState<Role>("staff")
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const send = () => {
    if (!valid) return
    const address = email.trim().toLowerCase()
    onInvite({ name: address.split("@")[0]!, email: address, role, status: "Invited" })
    setEmail("")
    setOpen(false)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={SMALL}>
        <UserPlus /> Invite member
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 rounded-xl border border-slate-200 bg-pax2-surface p-4 shadow-e2 ring-0">
        <Field autoFocus type="email" aria-label="Email address" placeholder="name@example.org" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <div className="flex items-center gap-2">
          <Select value={role} onValueChange={(v) => v && setRole(v as Role)}>
            <SelectTrigger aria-label="Role" className="h-8 flex-1 rounded-lg border-slate-200 bg-pax2-surface shadow-e1 dark:bg-pax2-surface">
              <SelectValue>{() => ROLE_LABEL[role]}</SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-slate-200 bg-pax2-surface p-1 shadow-e2 ring-0">
              {(["admin", "staff", "partner"] as const).map((r) => (
                <SelectItem key={r} value={r} className="rounded-lg px-2.5 py-1.5">
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button type="button" data-edit disabled={!valid} onClick={send} className={cn(SMALL_PRIMARY, "disabled:opacity-40")}>
            Invite
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ─── Permissions ───────────────────────────────────────────────────────────────────────────────── */

const ROLES: Role[] = ["superadmin", "admin", "staff", "partner"]
// Which roles hold each capability, in ROLES' order. The super admin holds every one, fixed.
const CAPABILITIES: { title: string; rows: [string, boolean[]][] }[] = [
  {
    title: "Workspace permissions",
    rows: [
      ["Edit workspace settings", [true, true, false, false]],
      ["Invite and remove members", [true, true, false, false]],
      ["Manage integrations", [true, true, false, false]],
    ],
  },
  {
    title: "Research permissions",
    rows: [
      ["Field surveys from the inbox", [true, true, true, false]],
      ["Publish reports", [true, true, false, false]],
      ["Run Lift tests", [true, true, true, false]],
      ["Share clips with partners", [true, true, true, false]],
      ["Comment on partner desks", [true, true, true, true]],
    ],
  },
]

function Permissions() {
  const [notice, setNotice] = React.useState(true)
  return (
    <>
      {notice && (
        <div className="flex items-center gap-3 rounded-[18px] border border-amber-200 bg-amber-50/70 px-4 py-3">
          <ShieldCheck className="size-4 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium text-slate-900">Access review is on.</p>
            <p className="text-[13px] text-slate-600">Role and integration changes wait for the super admin&apos;s approval.</p>
          </div>
          <button type="button" onClick={() => setNotice(false)} className={SMALL}>
            Dismiss
          </button>
        </div>
      )}

      {CAPABILITIES.map((group) => (
        <Block key={group.title} title={group.title}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-[13px] text-slate-500">
                  <th className="px-5 pt-3 pb-2 text-left font-medium">
                    <span className="sr-only">Capability</span>
                  </th>
                  {ROLES.map((r) => (
                    <th key={r} className="w-24 px-3 pt-3 pb-2 text-center font-medium whitespace-nowrap">
                      {ROLE_LABEL[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 border-t border-slate-200">
                {group.rows.map(([label, held]) => (
                  <tr key={label}>
                    <td className="px-5 py-3 text-slate-700">{label}</td>
                    {ROLES.map((r, i) => (
                      <td key={r} className="px-3 py-3">
                        <div className="flex justify-center">
                          <Tick label={`${label}: ${ROLE_LABEL[r]}`} defaultOn={held[i]} disabled={r === "superadmin"} />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Block>
      ))}

      <Block title="Security">
        <Row label="Require two-factor sign-in" hint="For admins and the super admin.">
          <Toggle label="Require two-factor sign-in" defaultOn />
        </Row>
        <Row label="Session timeout" hint="Signs out idle sessions.">
          <Choice label="Session timeout" options={["1 hour", "4 hours", "8 hours", "24 hours", "7 days"]} defaultValue="8 hours" />
        </Row>
        <Row label="Trusted device review" hint="Confirm a new browser before trusting it.">
          <Toggle label="Trusted device review" defaultOn />
        </Row>
      </Block>

      <Block title="Approvals">
        <Row label="Approvers" hint="Review role, member and integration changes." top wide>
          <Approvers />
        </Row>
        <Row label="Review digest" hint="How pending approvals are bundled.">
          <Choice label="Review digest" options={["Instant", "Hourly", "Daily"]} defaultValue="Hourly" />
        </Row>
        <Row label="Dual approval" hint="Two approvers for critical changes.">
          <Toggle label="Dual approval" defaultOn />
        </Row>
      </Block>
    </>
  )
}

function Approvers() {
  const staff = MEMBERS.filter((m) => m.email)
  const [chosen, setChosen] = React.useState(["brendan@nysgpt.com", "sajeela@parallaxinnovations.com", "garrett@parallaxinnovations.com"])
  const [q, setQ] = React.useState("")
  const needle = q.trim().toLowerCase()
  const offers = needle ? staff.filter((m) => !chosen.includes(m.email!) && m.name.toLowerCase().includes(needle)) : []
  const add = (email: string) => {
    setChosen([...chosen, email])
    setQ("")
  }
  return (
    <div className="relative w-full">
      <div className={cn(FIELD, "flex flex-wrap items-center gap-1.5 p-1.5")}>
        {chosen.map((email) => {
          const m = staff.find((s) => s.email === email)!
          return (
            <Chip key={email} label={m.name} onRemove={() => setChosen(chosen.filter((e) => e !== email))}>
              <Avatar name={m.name} email={email} size={18} />
              {m.name}
            </Chip>
          )
        })}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && offers[0] && add(offers[0].email!)}
          placeholder="Add approvers…"
          aria-label="Add approvers"
          className="h-7 min-w-32 flex-1 bg-transparent px-1.5 outline-none placeholder:text-slate-400"
        />
      </div>
      {offers.length > 0 && (
        <div className="absolute inset-x-0 top-full z-10 mt-1 rounded-xl border border-slate-200 bg-pax2-surface p-1 shadow-e2">
          {offers.map((m) => (
            <button key={m.email} type="button" data-edit onClick={() => add(m.email!)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-slate-700 hover:bg-slate-100">
              <Avatar name={m.name} email={m.email} size={20} />
              {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Notifications ─────────────────────────────────────────────────────────────────────────────── */

function Notifications() {
  return (
    <>
      <Block title="Digests">
        <Row label="Digest cadence" hint="Routine updates in one mail.">
          <Choice label="Digest cadence" options={["Morning brief", "Evening wrap-up", "Weekly summary", "Off"]} defaultValue="Morning brief" />
        </Row>
        <Row label="Quiet hours" hint="Holds low-priority alerts.">
          <Choice label="Quiet hours" options={["After hours", "Overnight", "Never"]} defaultValue="After hours" />
        </Row>
        <Row label="Quiet weekends" hint="Holds routine updates from Friday evening.">
          <Toggle label="Quiet weekends" defaultOn />
        </Row>
        <Row label="Digest content" top>
          <Ticks
            items={[
              ["Survey responses", true],
              ["Inbox replies", true],
              ["Clip reviews", false],
              ["Member access changes", true],
            ]}
          />
        </Row>
      </Block>

      <Block title="Channels">
        <Row label="Email" lead={<Tile icon={Mail} tint="#1e3a8a" />} badge={<Badge tone="green">Recommended</Badge>} hint="Inbox replies and access reviews.">
          <Choice label="Email" options={["Everything", "Important only", "Off"]} defaultValue="Important only" />
        </Row>
        <Row label="Desktop" lead={<Tile icon={Monitor} tint="#475569" />} hint="In this browser.">
          <Toggle label="Desktop" defaultOn />
        </Row>
        <Row label="Mobile" lead={<Tile icon={Smartphone} tint="#475569" />} hint="Urgent alerts by text.">
          <Toggle label="Mobile" />
        </Row>
        <Row label="Slack" lead={<Tile icon={MessageSquare} tint="#4a154b" />} hint="Mentions and escalations in a channel.">
          <Toggle label="Slack" />
        </Row>
      </Block>

      <Block title="Alerts">
        <Row label="Fielding" hint="When a wave closes or stalls.">
          <Toggle label="Fielding" defaultOn />
        </Row>
        <Row label="Clip reviews" hint="When a partner comments on a cut.">
          <Toggle label="Clip reviews" defaultOn />
        </Row>
        <Row label="Approval reminders" hint="How often pending approvals are nudged.">
          <Choice label="Approval reminders" options={["Instant", "Hourly", "Daily"]} defaultValue="Instant" />
        </Row>
        <Row label="Skip the digest" hint="Sent the moment they happen." top>
          <Ticks
            items={[
              ["Permission escalations", true],
              ["Partner invites", true],
              ["Failed sends", false],
            ]}
          />
        </Row>
      </Block>
    </>
  )
}

/* ─── Integrations ──────────────────────────────────────────────────────────────────────────────── */

type Tool = { id: string; name: string; does: string; detail?: string; icon: typeof Bell; tint: string; state: "Connected" | "Available" | "Needs setup" }
const TOOL_TONE: Record<Tool["state"], Tone> = { Connected: "green", Available: "slate", "Needs setup": "amber" }

const TOOLS: { title: string; tools: Tool[] }[] = [
  {
    title: "Connected tools",
    tools: [
      { id: "youtube", name: "YouTube", does: "Partner channels for Clips.", detail: "Voter Freedom, Unite America, Yes on 3", icon: Play, tint: "#dc2626", state: "Connected" },
      { id: "agentmail", name: "AgentMail", does: "The inbox's agent mailboxes.", detail: "pax-pollster, pax-analyst", icon: Inbox, tint: "#1e3a8a", state: "Connected" },
      { id: "resend", name: "Resend", does: "Survey invitations and reports by mail.", detail: "From nysgpt.com", icon: Send, tint: "#0f172a", state: "Connected" },
      { id: "slack", name: "Slack", does: "Reports and clip reviews in channels.", icon: Hash, tint: "#4a154b", state: "Available" },
    ],
  },
  {
    title: "Storage and sign-in",
    tools: [
      { id: "s3", name: "Amazon S3", does: "Clip media and survey files.", detail: "Served through CloudFront", icon: Database, tint: "#e25444", state: "Connected" },
      { id: "cognito", name: "Amazon Cognito", does: "Sign-in for staff and partners.", detail: "Shared by dev and production", icon: KeyRound, tint: "#dd344c", state: "Connected" },
      { id: "drive", name: "Google Drive", does: "Decks and transcripts.", detail: "Needs a shared folder", icon: HardDrive, tint: "#1a73e8", state: "Needs setup" },
      { id: "calendar", name: "Google Calendar", does: "Fielding windows on the team calendar.", icon: CalendarDays, tint: "#188038", state: "Available" },
    ],
  },
]

function Integrations() {
  const [state, setState] = React.useState<Record<string, Tool["state"]>>({})
  return (
    <>
      {TOOLS.map((group) => (
        <Block key={group.title} title={group.title}>
          {group.tools.map((t) => {
            const s = state[t.id] ?? t.state
            const connected = s === "Connected"
            return (
              <div key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-5">
                <Tile icon={t.icon} tint={t.tint} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{t.name}</p>
                  <p className="text-[13px] text-slate-500">{t.does}</p>
                  {(s !== t.state || t.detail) && <p className="text-[13px] text-slate-400">{s === t.state ? t.detail : connected ? "Connected just now" : "Disconnected"}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {s !== "Available" && <Badge tone={TOOL_TONE[s]}>{s}</Badge>}
                  {connected ? (
                    <button type="button" className={SMALL}>
                      Manage
                    </button>
                  ) : (
                    <button type="button" data-edit onClick={() => setState({ ...state, [t.id]: "Connected" })} className={SMALL_PRIMARY}>
                      Connect
                    </button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger aria-label={`More for ${t.name}`} className={ICON_BUTTON}>
                      <EllipsisVertical className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className={MENU}>
                      <DropdownMenuItem disabled={!connected} className={cn(MENU_ITEM, "data-disabled:opacity-40")}>
                        <ArrowUpDown /> Sync now
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        data-edit
                        disabled={!connected}
                        onClick={() => setState({ ...state, [t.id]: "Available" })}
                        className={cn(MENU_ITEM, "text-pax2-red-deep data-disabled:opacity-40 [&_svg]:text-pax2-red-deep")}
                      >
                        <X /> Disconnect
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })}
        </Block>
      ))}

      <Block title="Sync defaults">
        <Row label="Report delivery" hint="Where a finished report goes.">
          <Choice label="Report delivery" options={["Email", "Slack", "Google Drive"]} defaultValue="Email" />
        </Row>
        <Row label="Calendar sync" hint="Fielding windows on the shared calendar.">
          <Toggle label="Calendar sync" />
        </Row>
        <Row label="Daily recap" hint="An end-of-day summary in Slack.">
          <Toggle label="Daily recap" />
        </Row>
      </Block>
    </>
  )
}
