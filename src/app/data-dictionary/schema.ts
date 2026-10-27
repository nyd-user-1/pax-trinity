import { MarkerType, type Edge, type Node } from "@xyflow/react"
import { GitFork, Library, ListOrdered, MapPin, Tags, type LucideIcon } from "lucide-react"

// /schema's content: the audience store's tables as audience/audience/migrations (001-007) and migrate.py
// create them, and the keys the code holds them to. None is a database foreign key: upsert_norms, the audit,
// the geographies refresh and the export enforce or join on them (the 001 comment on norms.construct).
// Types are the Postgres ones; DuckDB, the store's default, takes JSON for text[] and DECIMAL(38,10) for
// numeric. Laid out the way components/factory-canvas.tsx lays out the factory: every position derives
// from the column and row constants above build().

export type Column = { name: string; type: string; key?: "primary" | "unique" | "refers"; note?: string }
export type Table = { id: string; about: string; columns: Column[] }

const ARRAY = "text[]"
const NUMERIC = "numeric"
const ARRAY_NOTE = "JSON in DuckDB"
const NUMERIC_NOTE = "DECIMAL(38,10) in DuckDB"
const LEVELS = "US | STATE | COUNTY | TOWN | BLOCKGROUP"

export const TABLES: Table[] = [
  {
    id: "concordance",
    about: "One row per construct: its label and definition, and the variable names each source reads it from (001)",
    columns: [
      { name: "construct", type: "text", key: "primary" },
      { name: "label", type: "text" },
      { name: "definition", type: "text" },
      { name: "anes_var", type: ARRAY, note: ARRAY_NOTE },
      { name: "gss_var", type: ARRAY, note: ARRAY_NOTE },
      { name: "ces_var", type: ARRAY, note: ARRAY_NOTE },
      { name: "wvs_var", type: ARRAY, note: ARRAY_NOTE },
      { name: "acs_table", type: "text" },
      { name: "cps_var", type: "text" },
      { name: "notes", type: "text" },
    ],
  },
  {
    id: "sources",
    about: "One row per source: its name, URL, license and access notes (001)",
    columns: [
      { name: "source", type: "text", key: "primary" },
      { name: "name", type: "text" },
      { name: "url", type: "text" },
      { name: "license", type: "text" },
      { name: "access_notes", type: "text" },
      { name: "last_loaded", type: "timestamptz" },
    ],
  },
  {
    id: "norms",
    about: "Every estimate: one cell of a source's construct for a place, a period, a response option and a subgroup (001)",
    columns: [
      { name: "norm_id", type: "uuid", key: "primary", note: "uuid5 of natural_key, so a row keeps its id across reruns" },
      { name: "natural_key", type: "text", key: "unique", note: "the sha256 the loaders upsert on" },
      { name: "source", type: "text", key: "refers" },
      { name: "source_version", type: "text" },
      { name: "geography", type: "text", note: LEVELS },
      { name: "geo_code", type: "text", key: "refers" },
      { name: "period_start", type: "date" },
      { name: "period_end", type: "date" },
      { name: "construct", type: "text", key: "refers" },
      { name: "item_text", type: "text" },
      { name: "response_option", type: "text" },
      { name: "subgroup_dim", type: "text" },
      { name: "subgroup_value", type: "text" },
      { name: "estimate", type: NUMERIC, note: NUMERIC_NOTE },
      { name: "estimate_type", type: "text", note: "pct | mean | count | lift_pp" },
      { name: "n", type: "integer" },
      { name: "se", type: NUMERIC, note: NUMERIC_NOTE },
      { name: "moe", type: NUMERIC, note: NUMERIC_NOTE },
      { name: "weight_var", type: "text" },
      { name: "provenance_url", type: "text", note: "CHECK (provenance_url <> '')" },
      { name: "provenance_note", type: "text" },
      { name: "extracted_at", type: "timestamptz" },
    ],
  },
  {
    id: "geographies",
    about: "Every geo_code in norms, named from the Census files (005)",
    columns: [
      { name: "geo_code", type: "text", key: "primary" },
      { name: "name", type: "text" },
      { name: "level", type: "text", note: `${LEVELS}, as norms.geography` },
      { name: "parent_code", type: "text", key: "refers", note: "the containing geography's geo_code; NULL for the US" },
    ],
  },
  {
    id: "response_order",
    about: "The coded order of a bulk-tier construct's response options, which the export lists them in (007)",
    columns: [
      { name: "source", type: "text", key: "primary" },
      { name: "construct", type: "text", key: "primary" },
      { name: "response_option", type: "text", key: "primary" },
      { name: "ordinal", type: "integer" },
    ],
  },
  {
    id: "schema_migrations",
    about: "Each migration applied, by version (audience/migrate.py)",
    columns: [
      { name: "version", type: "text", key: "primary" },
      { name: "applied_at", type: "timestamptz" },
    ],
  },
]

/** A key line: from the referring column to the column it names. `label` is its hover and its words in the
 *  Schema panel. */
export type KeyData = { label: string; icon: LucideIcon; offset?: number }
type KeyLine = { id: string; from: [string, string, "l" | "r"]; to: [string, string, "l" | "r"]; data: KeyData }

export const KEYS: KeyLine[] = [
  {
    id: "norms-concordance", from: ["norms", "construct", "l"], to: ["concordance", "construct", "r"],
    data: { icon: Tags, label: "Each estimate's construct has its concordance row: upsert_norms refuses an unknown one, and the audit checks again" },
  },
  {
    id: "norms-sources", from: ["norms", "source", "l"], to: ["sources", "source", "r"],
    data: { icon: Library, label: "Each estimate's source is a sources row; the export labels each source's files from it" },
  },
  {
    id: "norms-geographies", from: ["norms", "geo_code", "r"], to: ["geographies", "geo_code", "l"],
    data: { icon: MapPin, label: "Every geo_code in norms is named in geographies: the geographies refresh builds the table from norms, and the audit checks it" },
  },
  {
    id: "geographies-parent", from: ["geographies", "parent_code", "r"], to: ["geographies", "geo_code", "r"],
    data: { icon: GitFork, label: "Each geography's parent: a state's is the US, a county's its state, a town's and a block group's their county", offset: 28 },
  },
  {
    id: "response-order-norms", from: ["response_order", "construct", "l"], to: ["norms", "construct", "r"],
    data: { icon: ListOrdered, label: "The export lists each cell's response options by ordinal, joined to norms on source, construct and response_option" },
  },
]

// ---------------------------------------------------------------------------------------------
// The drawing's grid: norms in the middle, what it names on either side, each key line level where it can be.

export const HEAD_H = 40 // a table's name
export const ROW_H = 24 // one column
export const FOOT_H = 8
export const rowY = (i: number) => HEAD_H + i * ROW_H + ROW_H / 2
export const tableH = (t: Table) => HEAD_H + t.columns.length * ROW_H + FOOT_H

const GAP = 120 // between columns: room for a chip
const W = { side: 250, norms: 280 }
const X_LEFT = 0
const X_NORMS = X_LEFT + W.side + GAP
const X_RIGHT = X_NORMS + W.norms + GAP

const table = (id: string) => TABLES.find((t) => t.id === id)!
const at = (id: string, column: string) => table(id).columns.findIndex((c) => c.name === column)
/** The top that puts a table's column level with a row of norms. */
const level = (id: string, column: string, normsColumn: string) => rowY(at("norms", normsColumn)) - rowY(at(id, column))

const Y_SOURCES = level("sources", "source", "source")
const Y_CONCORDANCE = Y_SOURCES + tableH(table("sources")) + 48
const Y_GEOGRAPHIES = 0
const Y_ORDER = level("response_order", "construct", "construct")
const Y_MIGRATIONS = Y_ORDER + tableH(table("response_order")) + 64

const PLACE: Record<string, [number, number, number]> = {
  sources: [X_LEFT, Y_SOURCES, W.side],
  concordance: [X_LEFT, Y_CONCORDANCE, W.side],
  norms: [X_NORMS, 0, W.norms],
  geographies: [X_RIGHT, Y_GEOGRAPHIES, W.side],
  response_order: [X_RIGHT, Y_ORDER, W.side],
  schema_migrations: [X_RIGHT, Y_MIGRATIONS, W.side],
}

export type TableData = Table & { w: number }

export const FLOW = "#94a3b8"

export function build(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = TABLES.map((t) => {
    const [x, y, w] = PLACE[t.id]
    return { id: t.id, type: "table", position: { x, y }, data: { ...t, w } satisfies TableData, selectable: false }
  })
  const edges: Edge[] = KEYS.map((k) => ({
    id: k.id,
    source: k.from[0],
    sourceHandle: `${k.from[2]}-${k.from[1]}`,
    target: k.to[0],
    targetHandle: `${k.to[2]}-${k.to[1]}`,
    type: "key",
    data: k.data,
    markerEnd: { type: MarkerType.ArrowClosed, color: FLOW, width: 16, height: 16 },
  }))
  return { nodes, edges }
}
