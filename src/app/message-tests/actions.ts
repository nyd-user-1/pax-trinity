"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { PUBLISHED } from "@/components/clips/catalog"
import { currentUser, forbidDemo } from "@/lib/auth"
import { armRecordings } from "@/lib/clips/recorded"
import { testHref } from "@/lib/survey-links"
import { completeTest } from "@/lib/results/complete"
import { approveAndOpen, begin, lifecycleOf, move } from "@/lib/lifecycle/store"
import type { LifeState } from "@/lib/lifecycle/rules"
import { getTest, saveTest } from "@/lib/tests/store"
import { parseEntry, parseSingle } from "@/lib/tests/text"
import { PLACEBO, problems, type TestRecord } from "@/lib/tests/types"

export type SaveState = { errors: string[] }

// An arm must be a published clip with a video file (the survey's <video> can't play a YouTube-only clip), or a recording kept in Clips.
const CLIP_IDS = new Set(PUBLISHED.filter((c) => c.src).map((c) => c.id))
const UNPLAYABLE = new Set(PUBLISHED.filter((c) => !c.src).map((c) => c.id))

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
  // The stored status is the lifecycle's to set (lib/lifecycle): a new test starts as a draft, an edit keeps it.
  const prior = create ? null : await getTest(s("id"))
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
    status: prior?.status ?? "draft",
    panel: hasPanel ? { vendor, ...urls } : null,
  }
  // The recordings kept in Clips are arms too, read at save time.
  const kept = (await armRecordings(await currentUser()).catch(() => [])).map((c) => c.id)
  const errors = [...entry.errors, ...ballot.errors, ...comprehension.errors, ...problems(record, new Set([...CLIP_IDS, ...kept]), UNPLAYABLE)]
  if (!record.explanationTitle) errors.push("The explanation needs a title.")
  if (!create && !prior) errors.push(`No test has the id ${record.id}.`)
  if (errors.length) return { errors }
  try {
    await saveTest(record, { create })
  } catch (err) {
    const name = (err as Error).name
    return { errors: [name === "ConditionalCheckFailedException" ? `A test with the id ${record.id} already exists.` : `The tests table could not be written (${name}).`] }
  }
  // A new test begins its lifecycle as a Draft.
  if (create) await begin("test", record.id, (await currentUser())?.email ?? "admin").catch((e: Error) => console.error("lifecycle: not begun", e.message))
  revalidatePath("/survey")
  redirect(testHref(record.id))
}

/** A test's report: its result computed from its answers; a real one (not simulated) makes it Reported. */
async function fileReport(id: string): Promise<string | null> {
  try {
    const kept = await completeTest(id)
    if (!kept) return "The result could not be computed."
    if (kept.resultSet?.simulated) return null
    const r = await move("test", id, "Reported", "system", "its result was filed")
    return r.ok ? null : r.error
  } catch (err) {
    console.error("completeTest failed on close", (err as Error).message)
    return "The result could not be computed just now."
  }
}

/**
 * One step of a test's lifecycle from its page (lib/lifecycle, Brendan 2026-11-02): Approve (the super admin's),
 * Open (once Approved; the super admin's one click from a draft records both), Close (which files the
 * report), or Report (filing it again after a close whose result could not be computed).
 */
export async function moveTestAction(id: string, to: LifeState | "Approve and open"): Promise<SaveState> {
  const denied = await guard()
  if (denied) return { errors: [denied] }
  const user = (await currentUser())!
  if (!(await getTest(id))) return { errors: [`No test has the id ${id}.`] }
  const actor = { email: user.email, admin: user.admin, superAdmin: user.superAdmin }
  try {
    if (to === "Reported") {
      if ((await lifecycleOf("test", id)).state !== "Closed") return { errors: ["Only a closed test is reported."] }
      const failed = await fileReport(id)
      if (failed) return { errors: [failed] }
    } else {
      const r = to === "Approve and open" ? await approveAndOpen("test", id, actor) : await move("test", id, to, actor)
      if (!r.ok) return { errors: [r.error] }
      // A test closed here writes its own results (the completion hook, src/lib/results/complete.ts).
      if (r.state === "Closed") {
        const failed = await fileReport(id)
        if (failed) return { errors: [`Closed. ${failed}`] }
      }
    }
  } catch (err) {
    return { errors: [`The test could not be moved (${(err as Error).name}).`] }
  }
  revalidatePath("/survey")
  return { errors: [] }
}
