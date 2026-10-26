"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { currentUser, forbidDemo } from "@/lib/auth"
import { getTest, saveTest } from "@/lib/tests/store"
import { parseEntry, parseSingle } from "@/lib/tests/text"
import { PLACEBO, problems, STATUSES, type Status, type TestRecord } from "@/lib/tests/types"

export type SaveState = { errors: string[] }

async function guard(): Promise<string | null> {
  const user = await currentUser()
  if (!user?.admin) return "Admins only."
  try {
    forbidDemo(user)
  } catch (err) {
    return (err as Error).message
  }
  return null
}

/** Create or edit a test from the setup form. On success it goes to the test's page. */
export async function saveTestAction(_prev: SaveState, form: FormData): Promise<SaveState> {
  const denied = await guard()
  if (denied) return { errors: [denied] }
  const create = form.get("mode") === "create"
  const s = (k: string) => String(form.get(k) ?? "").trim()

  const entry = parseEntry(s("entry"))
  const ballot = parseSingle(s("ballot"), "Ballot")
  const comprehension = parseSingle(s("comprehension"), "Comprehension")
  const vendor = s("vendor")
  const urls = { completeUrl: s("completeUrl"), screenoutUrl: s("screenoutUrl"), quotaFullUrl: s("quotaFullUrl") }
  const hasPanel = Boolean(vendor || urls.completeUrl || urls.screenoutUrl || urls.quotaFullUrl)
  const status = s("status") as Status
  const record: TestRecord = {
    id: create ? s("id").toLowerCase() : s("id"),
    title: s("title"),
    entry: entry.entry,
    explanationTitle: s("explanationTitle"),
    explanation: s("explanation"),
    ballot: { prompt: ballot.prompt, choices: ballot.choices },
    comprehension: { prompt: comprehension.prompt, choices: comprehension.choices, correct: comprehension.correct ?? "" },
    arms: [PLACEBO, ...form.getAll("arm").map(String).filter((a) => a && a !== PLACEBO)],
    placeboSrc: s("placeboSrc"),
    targetPerArm: Number(s("targetPerArm")),
    status: STATUSES.includes(status) ? status : "draft",
    panel: hasPanel ? { vendor, ...urls } : null,
  }
  const errors = [...entry.errors, ...ballot.errors, ...comprehension.errors, ...problems(record, null)]
  if (!record.explanationTitle) errors.push("The explanation needs a title.")
  if (!create && !(await getTest(record.id))) errors.push(`No test has the id ${record.id}.`)
  if (errors.length) return { errors }
  try {
    await saveTest(record, { create })
  } catch (err) {
    const name = (err as Error).name
    return { errors: [name === "ConditionalCheckFailedException" ? `A test with the id ${record.id} already exists.` : `The tests table could not be written (${name}).`] }
  }
  revalidatePath("/message-tests")
  redirect(`/message-tests/${record.id}`)
}

/** Move a test between draft, fielding and closed from its page. */
export async function setStatusAction(id: string, status: Status): Promise<SaveState> {
  const denied = await guard()
  if (denied) return { errors: [denied] }
  if (!STATUSES.includes(status)) return { errors: ["Unknown status."] }
  const test = await getTest(id)
  if (!test) return { errors: [`No test has the id ${id}.`] }
  try {
    await saveTest({ ...test, status }, { create: false })
  } catch (err) {
    return { errors: [`The tests table could not be written (${(err as Error).name}).`] }
  }
  revalidatePath("/message-tests")
  revalidatePath(`/message-tests/${id}`)
  return { errors: [] }
}
