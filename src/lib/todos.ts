import "server-only"

import { get, put, putOnce, query, remove } from "@/lib/ledger"

// The admins' to-do list on the Delivery Board's admin page (Brendan, 2026-11-02), kept in the ledger table like
// the notes, a row rewritten in place:
//
//   pk          sk          item
//   TODO#admin  <id>        text, done, createdAt, updatedAt, by
//   TODO#admin  SEEDED      the seed's marker: written once with the first item, so a removed seed stays removed
//
// The list is the admins' one shared list. It starts with "Fundraising".

export type Todo = { id: string; text: string; done: boolean; createdAt: string; updatedAt: string; by: string }
type Row = Todo & { pk: string; sk: string }

const PK = "TODO#admin"
const SEED = { id: "seed-fundraising", text: "Fundraising" }
export const MAX_TEXT = 200

const todoOf = (r: Row): Todo => ({ id: r.id, text: r.text, done: !!r.done, createdAt: r.createdAt, updatedAt: r.updatedAt, by: r.by })

/** The list, oldest first; the first read ever writes the seed. Empty when the table can't be read. */
export async function listTodos(): Promise<Todo[]> {
  try {
    if (!(await get(PK, "SEEDED")) && (await putOnce({ pk: PK, sk: "SEEDED", at: new Date().toISOString() }))) {
      const at = new Date().toISOString()
      await put({ pk: PK, sk: SEED.id, id: SEED.id, text: SEED.text, done: false, createdAt: at, updatedAt: at, by: "seed" })
    }
    const rows = await query<Row>(PK)
    return rows.filter((r) => r.sk !== "SEEDED").map(todoOf).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  } catch (err) {
    console.warn(`to-dos unreachable (${(err as Error).name})`)
    return []
  }
}

export async function addTodo(text: string, by: string): Promise<Todo> {
  const at = new Date().toISOString()
  const id = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  const row: Row = { pk: PK, sk: id, id, text: text.trim().slice(0, MAX_TEXT), done: false, createdAt: at, updatedAt: at, by }
  await put(row)
  return todoOf(row)
}

/** Done or not; false when the row is gone. */
export async function setTodoDone(id: string, done: boolean, by: string): Promise<boolean> {
  const row = await get<Row>(PK, id)
  if (!row || id === "SEEDED") return false
  await put({ ...row, done, updatedAt: new Date().toISOString(), by })
  return true
}

export async function removeTodo(id: string) {
  if (id === "SEEDED") return
  await remove(PK, id)
}
