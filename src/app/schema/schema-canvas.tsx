"use client"

import * as React from "react"
import {
  Background, BackgroundVariant, BaseEdge, ConnectionMode, Controls, EdgeLabelRenderer, getSmoothStepPath, Handle,
  Position, ReactFlow, ReactFlowProvider, applyNodeChanges,
  type Edge, type EdgeProps, type Node, type NodeChange, type NodeProps,
} from "@xyflow/react"
import { ChevronRight, Database, KeyRound, Link2, RotateCcw, Settings2, Table2 } from "lucide-react"

import { useShellPanel } from "@/components/shell"
import { whiteButton } from "@/components/white-button"
import { cn } from "@/ui/lib/utils"

import { FLOW, HEAD_H, ROW_H, TABLES, build, rowY, tableH, type KeyData, type TableData } from "./schema"

// /schema: the audience store on /erd's canvas (components/factory-canvas.tsx), in its dress. One node kind,
// the table, in the store box's dress with its columns under its name; one line kind, the key, from the
// referring column to the column it names, its chip's words on hover. The gear opens the Schema panel in the
// shell's right slot: Tables and Keys, each entry lighting its boxes and lines and dimming the rest. The boxes
// drag; where they were dragged is kept in this browser until Reset layout puts them back.

const LIGHT = "#3b82f6"

type Focus = { on: "table"; id: string } | { on: "edge"; id: string } | null
type Lit = { nodes: Set<string>; edges: Set<string> } | null

const LitCtx = React.createContext<Lit>(null)
const useLit = (set: "nodes" | "edges", id: string): "lit" | "dim" | null => {
  const lit = React.useContext(LitCtx)
  return lit ? (lit[set].has(id) ? "lit" : "dim") : null
}
const glow = (s: "lit" | "dim" | null) => cn("transition-opacity duration-300", s === "lit" && "erd-lit", s === "dim" && "opacity-20")

function lights(focus: Focus, edges: Edge[]): Lit {
  if (!focus) return null
  const ns = new Set<string>()
  const es = new Set<string>()
  const ends = (e: Edge) => (es.add(e.id), ns.add(e.source), ns.add(e.target))
  if (focus.on === "table") {
    ns.add(focus.id)
    for (const e of edges) (e.source === focus.id || e.target === focus.id) && ends(e)
  }
  if (focus.on === "edge") for (const e of edges) e.id === focus.id && ends(e)
  return { nodes: ns, edges: es }
}

// ---------------------------------------------------------------------------------------------
// Handles: one hidden handle per side, and one on each side of every column ("l-construct", "r-construct"),
// level with its row. The canvas runs in loose mode, so any handle can end a line.

type Side = "t" | "r" | "b" | "l"
const POS: Record<Side, Position> = { t: Position.Top, r: Position.Right, b: Position.Bottom, l: Position.Left }
const HIDDEN = "!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent"

function Sides({ columns }: { columns: string[] }) {
  return (
    <>
      {(["t", "r", "b", "l"] as Side[]).map((s) => <Handle key={s} id={s} type="source" position={POS[s]} isConnectable={false} className={HIDDEN} />)}
      {columns.flatMap((c, i) =>
        (["l", "r"] as Side[]).map((s) => (
          <Handle key={`${s}-${c}`} id={`${s}-${c}`} type="source" position={POS[s]} isConnectable={false} className={HIDDEN} style={{ top: rowY(i) }} />
        )),
      )}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// The table: the store box's dress (its name in mono beside the database icon), its columns beneath, each
// with its type. A key marks the primary key; a link marks a column that names another table's row.

function TableNode({ id, data: d }: NodeProps<Node<TableData>>) {
  return (
    <div title={d.about} style={{ width: d.w, height: tableH(d) }} className={cn("flex flex-col rounded-[14px_14px_10px_10px] border border-slate-300 bg-slate-50 px-3", glow(useLit("nodes", id)))}>
      <p style={{ height: HEAD_H }} className="flex shrink-0 items-center gap-1.5 border-b border-slate-200 font-mono text-[13px] font-semibold text-slate-900">
        <Database className="size-3.5 shrink-0 text-slate-500" />
        {d.id}
      </p>
      <ul>
        {d.columns.map((c) => (
          <li key={c.name} title={c.note} style={{ height: ROW_H }} className="flex items-center gap-1.5 text-[12px] leading-none">
            <span className="flex w-3.5 shrink-0 justify-center text-slate-400">
              {c.key === "primary" ? <KeyRound className="size-3 text-pax2-blue" /> : c.key === "refers" ? <Link2 className="size-3" /> : null}
            </span>
            <span className={cn("min-w-0 flex-1 truncate font-mono", c.key === "primary" ? "font-semibold text-slate-900" : "text-slate-700")}>{c.name}</span>
            <span className="shrink-0 font-mono text-[11px] text-slate-400">
              {c.type}
              {c.key === "unique" && " unique"}
            </span>
          </li>
        ))}
      </ul>
      <Sides columns={d.columns.map((c) => c.name)} />
    </div>
  )
}

const nodeTypes = { table: TableNode }

// ---------------------------------------------------------------------------------------------
// The key line: /erd's rounded orthogonal path, carrying its chip. Lit, it carries a travelling light.

function KeyChip({ d, big = false, className, style }: { d: KeyData; big?: boolean; className?: string; style?: React.CSSProperties }) {
  const Icon = d.icon
  return (
    <span title={d.label} style={style} className={cn("relative flex shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-pax2-blue", big ? "size-8" : "size-7", className)}>
      <Icon className={big ? "size-4" : "size-3.5"} strokeWidth={2} />
    </span>
  )
}

function KeyEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd }: EdgeProps<Edge<KeyData>>) {
  const d = data!
  const lit = useLit("edges", id)
  const [path, x, y] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 14, offset: d.offset ?? 22 })
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke: FLOW, strokeWidth: 1.75 + (lit === "lit" ? 1 : 0), opacity: lit === "dim" ? 0.15 : 1, transition: "opacity 300ms" }} />
      {lit === "lit" && <path d={path} fill="none" stroke={LIGHT} strokeWidth={5} className="erd-travel" style={{ filter: `drop-shadow(0 0 4px ${LIGHT})` }} />}
      <EdgeLabelRenderer>
        <KeyChip
          d={d}
          style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`, zIndex: 10 }}
          className={cn("pointer-events-auto absolute transition-opacity duration-300", lit === "dim" && "opacity-20", lit === "lit" && "ring-2 ring-sky-300")}
        />
      </EdgeLabelRenderer>
    </>
  )
}

const edgeTypes = { key: KeyEdge }

// ---------------------------------------------------------------------------------------------
// The Schema panel, in the shell's right slot: two rows, Tables and Keys, each drilling down to its list. An
// entry lights what it names; a second click, Escape, a click on the canvas, or closing the panel puts the
// lights out.

const same = (a: Focus, b: Focus) => JSON.stringify(a) === JSON.stringify(b)

function Entry({ focus, current, onFocus, sample, children }: { focus: Focus; current: Focus; onFocus: (f: Focus) => void; sample: React.ReactNode; children: React.ReactNode }) {
  const on = same(focus, current)
  return (
    <button type="button" onClick={() => onFocus(on ? null : focus)} aria-pressed={on} className={cn("-mx-2 flex w-[calc(100%+16px)] items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-white", on && "bg-white ring-1 ring-pax2-light-blue")}>
      <span className="flex min-h-8 w-14 shrink-0 items-center justify-center">{sample}</span>
      <span className="min-w-0">{children}</span>
    </button>
  )
}

const Name = ({ children }: { children: React.ReactNode }) => <span className="block font-mono text-[13px] font-semibold text-slate-900">{children}</span>
const Def = ({ children }: { children: React.ReactNode }) => <span className="block text-xs leading-snug text-slate-500">{children}</span>

type View = "rows" | "tables" | "keys"

function PanelRow({ icon, label, sub, onClick }: { icon: React.ReactNode; label: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex w-full items-center gap-3 border-b border-slate-200/70 px-6 py-4 text-left transition-colors hover:bg-white/70">
      <span className="flex size-4 shrink-0 items-center justify-center text-slate-400 group-hover:text-pax2-blue">{icon}</span>
      <span className="flex-1">
        <span className="block text-[15px] font-medium text-slate-900 group-hover:text-pax2-blue">{label}</span>
        <span className="block text-xs text-slate-500">{sub}</span>
      </span>
      <ChevronRight className="size-4 text-slate-400 group-hover:text-pax2-blue" />
    </button>
  )
}

function SchemaPanel({ view, edges, focus, onFocus, onOpen }: { view: View; edges: Edge[]; focus: Focus; onFocus: (f: Focus) => void; onOpen: (v: View) => void }) {
  if (view === "rows")
    return (
      <div>
        <PanelRow icon={<Table2 className="size-4" />} label="Tables" sub={`${TABLES.length} tables and what each holds`} onClick={() => onOpen("tables")} />
        <PanelRow icon={<KeyRound className="size-4" />} label="Keys" sub={`${edges.length} lines and what holds each one`} onClick={() => onOpen("keys")} />
      </div>
    )
  if (view === "tables")
    return (
      <div className="space-y-1">
        {TABLES.map((t) => (
          <Entry
            key={t.id}
            focus={{ on: "table", id: t.id }}
            current={focus}
            onFocus={onFocus}
            sample={<span className="flex h-6 w-14 items-center justify-center rounded-[10px_10px_6px_6px] border border-slate-300 bg-slate-50"><Database className="size-3.5 text-slate-500" /></span>}
          >
            <Name>{t.id}</Name>
            <Def>{t.about}</Def>
          </Entry>
        ))}
      </div>
    )
  return (
    <div className="space-y-1">
      {edges.map((e) => (
        <Entry key={e.id} focus={{ on: "edge", id: e.id }} current={focus} onFocus={onFocus} sample={<KeyChip d={e.data as KeyData} big />}>
          <Def>{(e.data as KeyData).label}</Def>
        </Entry>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------

function Canvas({ nodes, edges, onNodesChange, onPane }: { nodes: Node[]; edges: Edge[]; onNodesChange: (changes: NodeChange[]) => void; onPane: () => void }) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      connectionMode={ConnectionMode.Loose}
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable={false}
      onPaneClick={onPane}
      fitView
      fitViewOptions={{ padding: 0.02 }}
      minZoom={0.08}
      maxZoom={2.5}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="#cbd5e1" />
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  )
}

const LAYOUT_KEY = "schema-layout-v1" // a new key whenever the default layout changes, so old moves don't stack on it
const PANEL_KEY = "schema-panel"

export function SchemaCanvas() {
  const base = React.useMemo(() => build(), [])
  const { edges } = base
  // Where the drawing puts each box; a kept layout holds each moved box's offset from that home.
  const home = React.useMemo(() => new Map(base.nodes.map((n) => [n.id, n.position])), [base])
  const [nodes, setNodes] = React.useState(base.nodes)
  React.useEffect(() => {
    let moves: Record<string, { dx: number; dy: number }> = {}
    try {
      const kept = JSON.parse(window.localStorage.getItem(LAYOUT_KEY) ?? "null") as { v?: number; moves?: Record<string, { dx: number; dy: number }> } | null
      moves = kept?.v === 2 ? (kept.moves ?? {}) : {}
    } catch {
      moves = {}
    }
    setNodes(base.nodes.map((n) => (moves[n.id] ? { ...n, position: { x: n.position.x + moves[n.id].dx, y: n.position.y + moves[n.id].dy } } : n)))
  }, [base])
  const onNodesChange = React.useCallback((changes: NodeChange[]) => setNodes((ns) => applyNodeChanges(changes, ns)), [])
  const moved = React.useMemo(() => {
    const out = new Set<string>()
    for (const n of nodes) {
      const h = home.get(n.id)
      if (h && (h.x !== n.position.x || h.y !== n.position.y)) out.add(n.id)
    }
    return out
  }, [nodes, home])
  // Kept once a drag ends, not on every frame of it.
  React.useEffect(() => {
    if (nodes.some((n) => n.dragging)) return
    try {
      const moves = Object.fromEntries(nodes.filter((n) => moved.has(n.id)).map((n) => [n.id, { dx: n.position.x - home.get(n.id)!.x, dy: n.position.y - home.get(n.id)!.y }]))
      if (moved.size) window.localStorage.setItem(LAYOUT_KEY, JSON.stringify({ v: 2, moves }))
      else window.localStorage.removeItem(LAYOUT_KEY)
    } catch {
      // storage full or off: the layout lasts the visit
    }
  }, [nodes, moved, home])
  const reset = () => setNodes(base.nodes)
  const [focus, setFocus] = React.useState<Focus>(null)
  // The Schema panel: handed to the shell's right slot, handed again whenever what it shows changes.
  const { openAside, asideKey } = useShellPanel()
  const showing = asideKey === PANEL_KEY
  const [view, setView] = React.useState<View>("rows")
  const panel = React.useCallback(
    (v: View) =>
      openAside(
        v === "rows"
          ? { key: PANEL_KEY, title: "Schema", flush: true, body: <SchemaPanel view="rows" edges={edges} focus={focus} onFocus={setFocus} onOpen={setView} /> }
          : { key: PANEL_KEY, title: v === "tables" ? "Tables" : "Keys", back: () => setView("rows"), body: <SchemaPanel view={v} edges={edges} focus={focus} onFocus={setFocus} onOpen={setView} /> },
      ),
    [openAside, edges, focus],
  )
  React.useEffect(() => {
    if (showing) panel(view)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, focus])
  // Closing the panel puts the lights out.
  React.useEffect(() => {
    if (!showing) setFocus(null)
  }, [showing])
  const lit = React.useMemo(() => lights(focus, edges), [focus, edges])
  React.useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && setFocus(null)
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [])
  return (
    <div className="relative flex min-h-[70dvh] min-w-0 flex-1 overflow-hidden bg-pax2-mist">
      <LitCtx.Provider value={lit}>
        <ReactFlowProvider>
          <Canvas nodes={nodes} edges={edges} onNodesChange={onNodesChange} onPane={() => setFocus(null)} />
        </ReactFlowProvider>
      </LitCtx.Provider>
      {moved.size > 0 && (
        <button type="button" onClick={reset} className={whiteButton("md", "absolute left-4 top-4 z-10 h-10 py-0")}>
          <RotateCcw className="size-4" /> Reset layout
        </button>
      )}
      <button
        type="button"
        onClick={() => (showing ? openAside(null) : (setView("rows"), panel("rows")))}
        aria-pressed={showing}
        aria-label="Schema"
        title="Schema"
        className={whiteButton("circle", "absolute right-4 top-4 z-10")}
      >
        <Settings2 className="size-4" />
      </button>
    </div>
  )
}
