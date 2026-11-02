"use server"

import { revalidatePath } from "next/cache"

import { currentUser, forbidDemo } from "@/lib/auth"
import { addTodo, MAX_TEXT, removeTodo, setTodoDone } from "@/lib/todos"

// The admins' to-do list's writes (lib/todos.ts): admins only, a demo account refused, the board read again after.

type Result = { error?: string }

async function admin(): Promise<string | Result> {
  const user = await currentUser()
  if (!user?.admin) return { error: "Admins only." }
  try {
    forbidDemo(user)
  } catch (err) {
    return { error: (err as Error).message }
  }
  return user.email.toLowerCase()
}

async function write(fn: (by: string) => Promise<unknown>): Promise<Result> {
  const by = await admin()
  if (typeof by !== "string") return by
  try {
    await fn(by)
  } catch (err) {
    return { error: `The list could not be saved (${(err as Error).name}).` }
  }
  revalidatePath("/dashboard")
  return {}
}

export async function addTodoAction(text: string): Promise<Result> {
  const t = String(text ?? "").trim()
  if (!t) return { error: "Write the to-do first." }
  if (t.length > MAX_TEXT) return { error: `${MAX_TEXT} characters at most.` }
  return write((by) => addTodo(t, by))
}

export async function toggleTodoAction(id: string, done: boolean): Promise<Result> {
  return write(async (by) => {
    if (!(await setTodoDone(String(id), !!done, by))) throw Object.assign(new Error("gone"), { name: "Gone" })
  })
}

export async function removeTodoAction(id: string): Promise<Result> {
  return write(() => removeTodo(String(id)))
}
