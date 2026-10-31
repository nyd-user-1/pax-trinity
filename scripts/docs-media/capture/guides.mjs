// Docs guide capture: walks each guide, photographing every step and recording the box of the element the step
// points at (CSS px in the 1440x900 viewport), for the Remotion guide composition. Writes guides/<id>/NN.jpg and
// guides/<id>.json.
import { mkdirSync, writeFileSync } from "node:fs"
import { chromium } from "../../../node_modules/playwright-core/index.mjs"

const ROOT = new URL("./guides/", import.meta.url).pathname
const BASE = "http://localhost:3000"
const only = process.argv[2]?.split(",")

const browser = await chromium.launch({ channel: "chrome" })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
await ctx.addInitScript(() => (localStorage.setItem("pax:theme", "pax-light"), localStorage.setItem("pax:theme-panel", "on")))
// The admins' inspector dock stays out of the pictures.
await ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = "[data-devinspector]{display:none!important}"; document.head.appendChild(st) }))
const page = await ctx.newPage()
const pause = (ms) => page.waitForTimeout(ms)

async function go(path, wait) {
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 240000 }).catch(() => {})
  const dismiss = page.locator('button[aria-label="Dismiss"]').first()
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click().catch(() => {})
  if (wait) await page.waitForSelector(wait, { timeout: 120000 }).catch(() => {})
  await pause(900)
}
const boxOf = async (loc) => {
  const b = await loc.boundingBox()
  return b ? [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)] : null
}

/** A guide: steps of { caption, target (a locator, or null for the whole screen), click?, after? (runs after the shot) }. */
function guide(id, title, subtitle, build) {
  return { id, title, subtitle, build }
}

const GUIDES = [
  guide("lift-analysis", "Read a result in Lift", "Open a lift, read its analysis, and step through the table", async (step) => {
    await go("/lift?source=PAX_TEST", "tbody tr")
    await step("Every row is a video, every cell its lift on one measure. Click a lift.", page.locator("tbody button:not([aria-label])").first(), { click: true, wait: 2500 })
    await step("Lift Analysis opens beside the table: the result against its control group.", page.locator("section").filter({ has: page.getByText("Lift Analysis", { exact: true }) }).last())
    await step("Benchmarks place the lift among every other result on the same measure.", page.getByText("Benchmarks", { exact: true }).locator(".."))
    await step("Explainer says the same thing in plain sentences.", page.getByRole("button", { name: "Explainer" }), { click: true, wait: 700 })
    await step("Each section gets a headline and a short read.", page.getByRole("heading", { name: "Result", exact: true }).locator("..").locator(".."))
    await step("The arrows step the analysis to the next row in the table.", page.locator('[data-shell-main] button[aria-label="Next"]'), { click: true, wait: 1500 })
    await step("The panel follows the row you're on.", null)
  }),
  guide("lift-filters", "Filter Lift and keep favorites", "Hide what you don't need, star what you do", async (step) => {
    await go("/lift?source=PAX_TEST", "tbody tr")
    await step("Open the sidebar from the toolbar.", page.getByRole("button", { name: "Show sidebar" }).first(), { click: true, wait: 700 })
    await step("Treatments, Metrics and Segments each open into a checklist.", page.getByRole("button", { name: "Treatments", exact: true }), { click: true, wait: 600 })
    await step("Uncheck a treatment to take it out of the table.", page.locator('[role="menuitemcheckbox"]').first(), { click: true, wait: 700 })
    await page.locator('[role="menuitemcheckbox"]').first().click()
    await page.locator("tbody tr").first().hover()
    await step("Hover a row to star it, or flag it as important.", page.locator('tbody tr button[aria-label="Favorite"]').first(), { click: true, wait: 500 })
    await step("Favorites shows only the rows you starred.", page.getByRole("button", { name: /^Favorites/ }).first(), { click: true, wait: 900 })
    await step("Click Favorites again to see everything.", null)
    await page.getByRole("button", { name: /^Favorites/ }).first().click()
    await page.locator('tbody tr button[aria-label="Unfavorite"]').first().click().catch(() => {})
  }),
  guide("survey", "Answer a survey", "Agree, disagree or pass, then see where people agree", async (step) => {
    await go("/survey?s=questions&c=open-primaries")
    const card = page.locator("div:not(.opacity-0) > section").first()
    await step("Each card is one statement. Pick Agree, Disagree or Pass.", card.getByRole("button", { name: "Agree", exact: true }), { click: true, wait: 1300 })
    await step("The card leaves and the rest move up a place.", page.locator("div:not(.opacity-0) > section").first())
    while ((await page.locator("div:not(.opacity-0) > section button", { hasText: /^Agree$/ }).count()) > 0) {
      await page.locator("div:not(.opacity-0) > section button", { hasText: /^(Agree|Disagree|Pass)$/ }).nth(Math.floor(Math.random() * 3)).click()
      await pause(620)
    }
    await pause(1500)
    await page.evaluate(() => localStorage.setItem("consensus:rule", "trinity"))
    await page.getByText("Where consensus emerged").scrollIntoViewIfNeeded()
    await pause(500)
    await step("When you finish, you see where consensus emerged.", page.getByText("Where consensus emerged").locator(".."))
    await step("Switch rules to compare two definitions of consensus.", page.getByRole("button", { name: "Walkthrough" }), { click: true, wait: 700 })
    await step("The walkthrough rule needs every group to agree, 7 in 10 or more.", page.getByText("Every group agrees on"))
  }),
  guide("tools", "Get around with Tools", "One panel for Blocks, Chat, Lift Analysis, Theme and more", async (step) => {
    await go("/lift?source=PAX_TEST", "tbody tr")
    await step("Tools opens from the button at the top right.", page.locator('button[aria-label="Open Tools"]'), { click: true, wait: 700 })
    await step("Every tool sits in one list.", page.getByRole("button", { name: /^Blocks/ }).locator("..").locator(".."))
    await step("Lift Analysis holds a card for every video tested.", page.getByRole("button", { name: /^Lift Analysis/ }).first(), { click: true, wait: 1500 })
    await step("Click a card to open its analysis.", page.locator('[aria-label^="Open the analysis of"]').nth(2), { click: true, wait: 2500 })
    await step("Back climbs to the cards again.", page.locator('.shadow-header button[aria-label="Back"]').last(), { click: true, wait: 900 })
    await step("Everything stays one click away.", null)
  }),
  guide("second-panel", "Open a second panel", "Keep two pages side by side", async (step) => {
    await go("/america-thinks")
    await step("Open the sidebar.", page.locator('button[aria-label="Toggle sidebar"]'), { click: true, wait: 700 })
    const lift = page.locator('nav a[href="/lift"]').first()
    await lift.hover()
    await pause(400)
    await step("Hover a page and press its arrow.", page.locator('button[aria-label="Open Lift in panel 2"]').first(), { click: true, wait: 4000 })
    await step("The page opens beside the one you're on, at half width.", page.locator("iframe").first())
  }),
  guide("blocks", "Save a block", "Keep any block one click away", async (step) => {
    await go("/data-dictionary")
    await step("Every block has a menu at its top right.", page.locator('button[aria-label="Block options"]').first(), { click: true, wait: 600 })
    await step("Favorite it, add it to Blocks, or ask PAX about it.", page.getByRole("menu").first())
    await page.getByRole("menuitem", { name: /Add to Blocks|Remove from Blocks/ }).first().click().catch(() => page.keyboard.press("Escape"))
    await pause(500)
    await page.click('button[aria-label="Open Tools"]')
    await pause(600)
    await step("Blocks in Tools keeps what you saved.", page.getByRole("button", { name: /^Blocks/ }).first(), { click: true, wait: 1200 })
    await step("Click a tile to jump back to it.", page.locator("[data-shelf]").first())
  }),
]

for (const g of GUIDES) {
  if (only && !only.includes(g.id)) continue
  const dir = `${ROOT}${g.id}/`
  mkdirSync(dir, { recursive: true })
  const steps = []
  const step = async (caption, target, opt = {}) => {
    const n = String(steps.length + 1).padStart(2, "0")
    let focus = null
    if (target) {
      await target.scrollIntoViewIfNeeded().catch(() => {})
      focus = await boxOf(target).catch(() => null)
    }
    await page.screenshot({ path: `${dir}${n}.jpg`, type: "jpeg", quality: 80 })
    steps.push({ img: `guides/${g.id}/${n}.jpg`, caption, focus, click: !!opt.click })
    if (opt.click && target) await target.click().catch((e) => console.log("  click failed:", caption.slice(0, 40), e.message.split("\n")[0]))
    if (opt.wait) await pause(opt.wait)
  }
  try {
    await g.build(step)
    writeFileSync(`${ROOT}${g.id}.json`, JSON.stringify({ title: g.title, subtitle: g.subtitle, steps }, null, 1))
    console.log("ok ", g.id, steps.length, "steps;", steps.filter((s) => s.focus === null).length, "without focus")
  } catch (e) {
    console.log("ERR", g.id, e.message.split("\n")[0])
  }
}
await browser.close()
