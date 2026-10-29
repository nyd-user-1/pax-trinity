"use client"

import * as React from "react"
import { Dialog } from "@base-ui/react/dialog"
import { Tabs } from "@base-ui/react/tabs"
import { Switch } from "@base-ui/react/switch"
import { Checkbox } from "@base-ui/react/checkbox"
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

// Settings (Brendan, 2026-10-29): the account menu's Profile, Account, Notifications and Settings open one
// dialog, six tabs after his reference (General, Profile, Members, Permissions, Notifications, Integrations).
// Account folds Members and Permissions; Settings folds General and Integrations. Unwired: every control
// keeps its own state while the dialog is open and nothing saves. Members reads the roster in lib/roles.ts.

export type SettingsTab = "general" | "profile" | "members" | "permissions" | "notifications" | "integrations"
type User = { name: string; email: string }

const TABS: { id: SettingsTab; label: string; icon: typeof Bell }[] = [
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "profile", label: "Profile", icon: User2 },
  { id: "members", label: "Members", icon: Users },
  { id: "permissions", label: "Permissions", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "integrations", label: "Integrations", icon: Puzzle },
]

// The staff photos (public/), as the inbox's address book carries them.
const PHOTO: Record<string, string> = {
  "brendan@nysgpt.com": "/brendan.jpg",
  "sajeela@parallaxinnovations.com": "/sajeela.jpeg",
  "garrett@parallaxinnovations.com": "/garrett.jpeg",
  "ted@parallaxinnovations.com": "/ted.jpeg",
  "ted@uniteamerica.org": "/partners/unite-america.jpg",
}

const PRIMARY = "inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-pax2-blue bg-pax2-blue px-5 py-2.5 text-sm font-semibold text-white shadow-e1 transition-colors outline-none hover:border-pax2-light-blue hover:bg-pax2-light-blue focus-visible:ring-3 focus-visible:ring-pax2-light-blue/30 disabled:opacity-50"
const SMALL = "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-e1 transition-colors outline-none hover:border-pax2-blue hover:text-pax2-blue focus-visible:ring-3 focus-visible:ring-pax2-light-blue/30 [&_svg]:size-3.5"
const SMALL_PRIMARY = "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full bg-pax2-blue px-3.5 text-[13px] font-semibold text-white shadow-e1 transition-colors outline-none hover:bg-pax2-light-blue focus-visible:ring-3 focus-visible:ring-pax2-light-blue/30"
const ICON_BUTTON = "flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors outline-none hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-3 focus-visible:ring-pax2-light-blue/30 data-[popup-open]:bg-slate-100 data-[popup-open]:text-slate-700"
const FIELD = "rounded-lg border border-slate-200 bg-white text-sm text-slate-900 shadow-e1 transition-colors focus-within:border-pax2-light-blue focus-within:ring-3 focus-within:ring-pax2-light-blue/15"
const MENU = "w-auto min-w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-e2 ring-0"
const MENU_ITEM = "gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] [&_svg]:size-4 [&_svg]:text-slate-500"

export function SettingsDialog({ open, onOpenChange, tab, onTab, user }: { open: boolean; onOpenChange: (open: boolean) => void; tab: SettingsTab; onTab: (tab: SettingsTab) => void; user: User }) {
  const body = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (body.current) body.current.scrollTop = 0
  }, [tab])
  const close = () => onOpenChange(false)
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-slate-900/15 backdrop-blur-[2px] transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex h-[min(880px,calc(100dvh-2rem))] w-[min(980px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-e3 outline-none transition-[opacity,scale] duration-150 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
          <Tabs.Root value={tab} onValueChange={(v) => onTab(v as SettingsTab)} className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-4 px-5 pt-6 sm:px-8 sm:pt-7">
              <Dialog.Title className="font-display text-2xl font-semibold tracking-tight text-slate-900">Settings</Dialog.Title>
              <div className="flex shrink-0 gap-2">
                <Dialog.Close className={whiteButton("md", "shadow-e1")}>Cancel</Dialog.Close>
                <button type="button" onClick={close} className={PRIMARY}>
                  Update
                </button>
              </div>
            </div>
            <Tabs.List className="mt-5 flex shrink-0 gap-6 overflow-x-auto border-b border-slate-200 px-5 sm:px-8">
              {TABS.map(({ id, label, icon: Icon }) => (
                <Tabs.Tab
                  key={id}
                  value={id}
                  className="-mb-px flex shrink-0 items-center gap-2 border-b-2 border-transparent pt-1 pb-3 text-sm font-medium whitespace-nowrap text-slate-500 outline-none transition-colors hover:text-slate-900 focus-visible:text-slate-900 data-active:border-pax2-blue data-active:text-slate-900 [&_svg]:size-4"
                >
                  <Icon /> {label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            <div ref={body} className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-5 py-8 sm:px-8">
              <Tabs.Panel value="general" keepMounted className="space-y-10">
                <General />
              </Tabs.Panel>
              <Tabs.Panel value="profile" keepMounted className="space-y-10">
                <Profile user={user} />
              </Tabs.Panel>
              <Tabs.Panel value="members" keepMounted className="space-y-10">
                <Members user={user} />
              </Tabs.Panel>
              <Tabs.Panel value="permissions" keepMounted className="space-y-10">
                <Permissions />
              </Tabs.Panel>
              <Tabs.Panel value="notifications" keepMounted className="space-y-10">
                <Notifications />
              </Tabs.Panel>
              <Tabs.Panel value="integrations" keepMounted className="space-y-10">
                <Integrations />
              </Tabs.Panel>
            </div>
          </Tabs.Root>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/* ─── The parts every tab is built from ─────────────────────────────────────────────────────────── */

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex min-h-8 items-end justify-between gap-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white shadow-e1", className)}>{children}</div>
}

/** One setting: its name and a short line on the left, its control on the right. */
function Row({ label, hint, badge, lead, top, children }: { label: string; hint?: string; badge?: React.ReactNode; lead?: React.ReactNode; top?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("grid gap-3 px-5 py-4 md:grid-cols-2 md:gap-8", top ? "md:items-start" : "md:items-center")}>
      <div className="flex min-w-0 items-start gap-3">
        {lead}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
            {label}
            {badge}
          </div>
          {hint && <p className="mt-0.5 text-[13px] text-slate-500">{hint}</p>}
        </div>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

type Tone = "green" | "violet" | "amber" | "slate" | "blue"
const TONE: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/25",
  slate: "bg-white text-slate-600 ring-slate-300",
  blue: "bg-pax2-lavender text-pax2-blue ring-pax2-blue/20",
}

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset", TONE[tone])}>{children}</span>
}

/** A text field; `lead` sits inside its left edge (a scheme, an @, a country code). */
function Field({ lead, className, ...props }: React.ComponentProps<"input"> & { lead?: React.ReactNode }) {
  return (
    <label className={cn(FIELD, "flex h-9 w-full items-center", className)}>
      {lead && <span className="shrink-0 pl-3 text-slate-400">{lead}</span>}
      <input {...props} className={cn("h-full min-w-0 flex-1 rounded-lg bg-transparent pr-3 outline-none placeholder:text-slate-400", lead ? "pl-1" : "pl-3")} />
    </label>
  )
}

function Choice({ label, options, defaultValue }: { label: string; options: string[]; defaultValue: string }) {
  return (
    <Select defaultValue={defaultValue}>
      <SelectTrigger aria-label={label} className="h-9 w-full rounded-lg border-slate-200 bg-white pl-3 shadow-e1 data-[size=default]:h-9 dark:bg-white">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-xl border border-slate-200 bg-white p-1 shadow-e2 ring-0">
        {options.map((o) => (
          <SelectItem key={o} value={o} className="rounded-lg px-2.5 py-1.5">
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Toggle({ label, on, onChange, defaultOn }: { label: string; on?: boolean; onChange?: (on: boolean) => void; defaultOn?: boolean }) {
  return (
    <Switch.Root
      aria-label={label}
      checked={on}
      defaultChecked={defaultOn}
      onCheckedChange={onChange}
      className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-slate-200 p-0.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-pax2-light-blue/30 data-checked:bg-pax2-blue"
    >
      <Switch.Thumb className="size-4 rounded-full bg-white shadow-sm transition-transform duration-150 data-checked:translate-x-4" />
    </Switch.Root>
  )
}

function Tick({ label, defaultOn, disabled, children }: { label: string; defaultOn?: boolean; disabled?: boolean; children?: React.ReactNode }) {
  const box = (
    <Checkbox.Root
      aria-label={children ? undefined : label}
      defaultChecked={defaultOn}
      disabled={disabled}
      className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-slate-300 bg-white transition-colors outline-none focus-visible:ring-3 focus-visible:ring-pax2-light-blue/30 data-checked:border-pax2-blue data-checked:bg-pax2-blue data-disabled:cursor-not-allowed data-disabled:opacity-50"
    >
      <Checkbox.Indicator className="flex text-white">
        <Check className="size-3" strokeWidth={3} />
      </Checkbox.Indicator>
    </Checkbox.Root>
  )
  if (!children) return box
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
      {box}
      {children}
    </label>
  )
}

function Ticks({ items }: { items: [string, boolean][] }) {
  return (
    <div className="space-y-2">
      {items.map(([label, on]) => (
        <Tick key={label} label={label} defaultOn={on}>
          {label}
        </Tick>
      ))}
    </div>
  )
}

/** A colored square holding an icon, the ⌘K palette's tile. */
function Tile({ icon: Icon, tint, size = 32 }: { icon: typeof Bell; tint: string; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-lg text-white shadow-[inset_0_-1px_0_rgb(0_0_0/0.12)]" style={{ width: size, height: size, background: tint }}>
      <Icon className="size-4" strokeWidth={2} />
    </span>
  )
}

function Chip({ children, onRemove, label }: { children: React.ReactNode; onRemove: () => void; label: string }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 pr-1 pl-2 text-[13px] text-slate-700">
      {children}
      <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="flex size-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700">
        <X className="size-3" />
      </button>
    </span>
  )
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")

function Avatar({ name, email, size = 32, fallback }: { name: string; email?: string; size?: number; fallback?: string }) {
  const src = (email && PHOTO[email.toLowerCase()]) || fallback
  if (src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-600" style={{ width: size, height: size }}>
      {initialsOf(name)}
    </span>
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
      <Section title="Workspace">
        <Card>
          <Row label="Workspace name" hint="On shared reports, invites and the inbox's mail.">
            <Field aria-label="Workspace name" defaultValue="Parallax" />
          </Row>
          <Row label="Workspace address" hint="Invites and share links use it.">
            <Field aria-label="Workspace address" lead="pax.nysgpt.com/" defaultValue="parallax" />
          </Row>
          <Row label="Invite domains" hint="Sign-ups from these domains join without review." top>
            <div className="flex flex-wrap items-center gap-1.5">
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
        </Card>
      </Section>

      <Section title="Region">
        <Card>
          <Row label="Language">
            <Choice label="Language" options={["English", "Español"]} defaultValue="English" />
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
        </Card>
      </Section>

      <Section title="Editing">
        <Card>
          <Row label="Send on Enter" hint="In the chat box. Shift+Enter starts a new line.">
            <Toggle label="Send on Enter" defaultOn />
          </Row>
          <Row label="Markdown shortcuts" hint="Bold, lists and links as you type.">
            <Toggle label="Markdown shortcuts" defaultOn />
          </Row>
          <Row label="Compact tables" hint="More rows in crosstabs and the data dictionary.">
            <Toggle label="Compact tables" defaultOn />
          </Row>
        </Card>
      </Section>
    </>
  )
}

/* ─── Profile ───────────────────────────────────────────────────────────────────────────────────── */

function Profile({ user }: { user: User }) {
  const [photo, setPhoto] = React.useState(true)
  return (
    <>
      <Section title="Personal details">
        <Card>
          <Row label="Profile photo" hint="In the inbox, comments and the member list.">
            <div className="flex items-center gap-2">
              {photo ? <Avatar name={user.name} email={user.email} size={40} fallback="/avatars/default.jpg" /> : <Avatar name={user.name} size={40} />}
              <button type="button" onClick={() => setPhoto(true)} className={SMALL}>
                <Upload /> Change
              </button>
              <button type="button" onClick={() => setPhoto(false)} className={SMALL}>
                <X /> Remove
              </button>
            </div>
          </Row>
          <Row label="Full name" hint="On reports, comments and invites.">
            <Field aria-label="Full name" defaultValue={user.name} />
          </Row>
          <Row label="Email address" badge={<Badge tone="green">Verified</Badge>} hint="Sign-in and mail.">
            <Field aria-label="Email address" type="email" defaultValue={user.email} />
          </Row>
          <Row label="Phone number" hint="Account recovery only.">
            <Field aria-label="Phone number" type="tel" lead="+1" placeholder="212 555 0100" />
          </Row>
          <Row label="Username" hint="For @mentions in comments and the inbox.">
            <Field aria-label="Username" lead="@" defaultValue={user.email.split("@")[0]} />
          </Row>
        </Card>
      </Section>

      <Section title="Public profile">
        <Card>
          <Row label="Title" hint="Beside the name on shared reports.">
            <Field aria-label="Title" placeholder="Pollster" />
          </Row>
          <Row label="Timezone" hint="On profile hovers and review schedules.">
            <Choice label="Timezone" options={TIMEZONES} defaultValue="Eastern (New York)" />
          </Row>
          <Row label="Website">
            <Field aria-label="Website" lead="https://" placeholder="nysgpt.com" />
          </Row>
          <Row label="Bio" hint="For teammates and partners." top>
            <textarea aria-label="Bio" rows={3} className={cn(FIELD, "block w-full resize-none px-3 py-2 outline-none")} />
          </Row>
        </Card>
      </Section>

      <Section title="Display">
        <Card>
          <Row label="Landing page" hint="Where sign-in lands.">
            <Choice label="Landing page" options={["Chat", "America Thinks", "Clips", "Inbox", "Reports"]} defaultValue="Chat" />
          </Row>
          <Row label="Profile visibility" hint="Who sees the title, bio and local time.">
            <Choice label="Profile visibility" options={["Workspace", "Staff and admins", "Admins only"]} defaultValue="Workspace" />
          </Row>
          <Row label="Show local time" hint="On profile hovers.">
            <Toggle label="Show local time" defaultOn />
          </Row>
        </Card>
      </Section>
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

function roster(user: User): Person[] {
  // The staff as lib/roles.ts names them, Unite America's contact as the inbox does. The admins' accounts were
  // made on 2026-10-29 and wait on a first sign-in; the two staff without an address can't be invited yet.
  const people = MEMBERS.map((m): Person => ({ ...m, status: !m.email ? "No email" : m.role === "superadmin" ? "Active" : "Invited" }))
  people.push({ name: "Unite America", email: "ted@uniteamerica.org", role: "partner", status: "Invited" })
  const me = people.find((p) => p.email?.toLowerCase() === user.email.toLowerCase())
  if (me) Object.assign(me, { you: true, status: "Active" })
  else people.unshift({ name: user.name, email: user.email, role: "admin", status: "Active", you: true })
  return people
}

function Members({ user }: { user: User }) {
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
      <Section title="Invite defaults">
        <Card>
          <Row label="Default role" hint="What a new member starts as.">
            <Choice label="Default role" options={["Admin", "Staff", "Partner"]} defaultValue="Staff" />
          </Row>
          <Row label="Roster visibility" hint="How much of the team partners see.">
            <Choice label="Roster visibility" options={["Full roster", "Limited roster", "Admins only"]} defaultValue="Limited roster" />
          </Row>
          <div className="px-5 py-4">
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
                    className={cn("flex items-center gap-3 rounded-xl border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-pax2-light-blue/30", on ? "border-pax2-blue bg-pax2-lavender/40" : "border-slate-200 bg-white hover:border-slate-300")}
                  >
                    <Tile icon={a.icon} tint={a.tint} />
                    <span className="flex-1 text-sm font-medium text-slate-900">{a.label}</span>
                    <span className={cn("flex size-5 items-center justify-center rounded-full border", on ? "border-pax2-blue bg-pax2-blue text-white" : "border-slate-300 bg-white")}>{on && <Check className="size-3" strokeWidth={3} />}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </Card>
      </Section>

      <Section title="Workspace members" action={<InviteMember onInvite={(p) => setPeople((ps) => [...ps, p])} />}>
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-5 py-3">
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
                <tr className="border-y border-slate-200 bg-slate-50/70 text-[13px] text-slate-500">
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
          <div className="flex items-center gap-3 border-t border-slate-200 px-5 py-3 text-[13px] text-slate-500">
            <span>Rows per page</span>
            <Select
              value={String(perPage)}
              onValueChange={(v) => {
                setPerPage(Number(v))
                setPage(0)
              }}
            >
              <SelectTrigger aria-label="Rows per page" size="sm" className="h-8 w-16 rounded-lg border-slate-200 bg-white shadow-e1 dark:bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="min-w-20 rounded-xl border border-slate-200 bg-white p-1 shadow-e2 ring-0">
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
        </Card>
      </Section>
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
      <PopoverContent align="end" className="w-80 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-e2 ring-0">
        <Field autoFocus type="email" aria-label="Email address" placeholder="name@example.org" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <div className="flex items-center gap-2">
          <Select value={role} onValueChange={(v) => v && setRole(v as Role)}>
            <SelectTrigger aria-label="Role" className="h-8 flex-1 rounded-lg border-slate-200 bg-white shadow-e1 dark:bg-white">
              <SelectValue>{() => ROLE_LABEL[role]}</SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-slate-200 bg-white p-1 shadow-e2 ring-0">
              {(["admin", "staff", "partner"] as const).map((r) => (
                <SelectItem key={r} value={r} className="rounded-lg px-2.5 py-1.5">
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button type="button" disabled={!valid} onClick={send} className={cn(SMALL_PRIMARY, "disabled:opacity-40")}>
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
    title: "Workspace",
    rows: [
      ["Edit workspace settings", [true, true, false, false]],
      ["Invite and remove members", [true, true, false, false]],
      ["Manage integrations", [true, true, false, false]],
    ],
  },
  {
    title: "Research",
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
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3">
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

      <Section title="Role permissions">
        <div className="space-y-4">
          {CAPABILITIES.map((group) => (
            <Card key={group.title} className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-[13px] text-slate-500">
                      <th className="px-5 pt-4 pb-2 text-left text-sm font-semibold text-slate-900">{group.title}</th>
                      {ROLES.map((r) => (
                        <th key={r} className="w-24 px-3 pt-4 pb-2 text-center font-medium whitespace-nowrap">
                          {ROLE_LABEL[r]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
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
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Security">
        <Card>
          <Row label="Require two-factor sign-in" hint="For admins and the super admin.">
            <Toggle label="Require two-factor sign-in" defaultOn />
          </Row>
          <Row label="Session timeout" hint="Signs out idle sessions.">
            <Choice label="Session timeout" options={["1 hour", "4 hours", "8 hours", "24 hours", "7 days"]} defaultValue="8 hours" />
          </Row>
          <Row label="Trusted device review" hint="Confirm a new browser before trusting it.">
            <Toggle label="Trusted device review" defaultOn />
          </Row>
        </Card>
      </Section>

      <Section title="Approvals">
        <Card>
          <Row label="Approvers" hint="Review role, member and integration changes." top>
            <Approvers />
          </Row>
          <Row label="Review digest" hint="How pending approvals are bundled.">
            <Choice label="Review digest" options={["Instant", "Hourly", "Daily"]} defaultValue="Hourly" />
          </Row>
          <Row label="Dual approval" hint="Two approvers for critical changes.">
            <Toggle label="Dual approval" defaultOn />
          </Row>
        </Card>
      </Section>
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
    <div className="relative">
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
        <div className="absolute inset-x-0 top-full z-10 mt-1 rounded-xl border border-slate-200 bg-white p-1 shadow-e2">
          {offers.map((m) => (
            <button key={m.email} type="button" onClick={() => add(m.email!)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-slate-700 hover:bg-slate-100">
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
      <Section title="Digests">
        <Card>
          <Row label="Digest cadence" hint="Routine updates in one mail.">
            <Choice label="Digest cadence" options={["Morning brief", "Evening wrap-up", "Weekly", "Off"]} defaultValue="Morning brief" />
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
        </Card>
      </Section>

      <Section title="Channels">
        <Card>
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
        </Card>
      </Section>

      <Section title="Alerts">
        <Card>
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
        </Card>
      </Section>
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
        <Section key={group.title} title={group.title}>
          <Card>
            {group.tools.map((t) => {
              const s = state[t.id] ?? t.state
              const connected = s === "Connected"
              return (
                <div key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
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
                      <button type="button" onClick={() => setState({ ...state, [t.id]: "Connected" })} className={SMALL_PRIMARY}>
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
          </Card>
        </Section>
      ))}

      <Section title="Sync defaults">
        <Card>
          <Row label="Report delivery" hint="Where a finished report goes.">
            <Choice label="Report delivery" options={["Email", "Slack", "Google Drive"]} defaultValue="Email" />
          </Row>
          <Row label="Calendar sync" hint="Fielding windows on the shared calendar.">
            <Toggle label="Calendar sync" />
          </Row>
          <Row label="Daily recap" hint="An end-of-day summary in Slack.">
            <Toggle label="Daily recap" />
          </Row>
        </Card>
      </Section>
    </>
  )
}
