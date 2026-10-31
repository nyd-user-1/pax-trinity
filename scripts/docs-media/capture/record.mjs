// Screen recordings for the docs: real sessions recorded by Playwright, with a timestamp at each beat, for the
// Remotion edit (scripts/docs-media Recording) to cut, speed and caption.
import { mkdirSync, renameSync, writeFileSync } from "node:fs"
import { chromium } from "../../../node_modules/playwright-core/index.mjs"

const DIR = new URL("./rec/", import.meta.url).pathname
mkdirSync(DIR, { recursive: true })
const which = process.argv[2]

const browser = await chromium.launch({ channel: "chrome" })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: DIR, size: { width: 1440, height: 900 } } })
await ctx.addInitScript(() => (localStorage.setItem("pax:theme", "pax-light"), document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = "[data-devinspector]{display:none!important}"; document.head.appendChild(st) })))
const page = await ctx.newPage()
const t0 = Date.now()
const beats = []
const beat = (name) => (beats.push({ name, t: (Date.now() - t0) / 1000 }), console.log(name, ((Date.now() - t0) / 1000).toFixed(1)))
const pause = (ms) => page.waitForTimeout(ms)
async function go(path) {
  await page.goto("http://localhost:3000" + path, { waitUntil: "networkidle", timeout: 240000 }).catch(() => {})
  await page.locator('button[aria-label="Dismiss"]').first().click({ timeout: 5000 }).catch(() => {})
  await pause(600)
}

if (which === "chat") {
  await go("/chat")
  await pause(1500)
  beat("open")
  const box = page.locator("textarea").last()
  await box.click()
  await box.pressSequentially("Make lift cards for the three strongest Support results in the latest wave.", { delay: 28 })
  beat("typed")
  await pause(600)
  await page.keyboard.press("Enter")
  beat("sent")
  const studio = page.getByRole("button", { name: "Open in Studio" })
  await page.waitForFunction(() => [...document.querySelectorAll("button")].filter((b) => b.textContent?.includes("Open in Studio")).length >= 1, null, { timeout: 300000 })
  beat("first-video")
  await page.waitForFunction(() => [...document.querySelectorAll("button")].filter((b) => b.textContent?.includes("Open in Studio")).length >= 3, null, { timeout: 300000 }).catch(() => {})
  await pause(4000)
  beat("three-videos")
  // Look over the three.
  for (let i = 0; i < 6; i++) (await page.mouse.wheel(0, -260), await pause(500))
  await pause(1500)
  for (let i = 0; i < 8; i++) (await page.mouse.wheel(0, 300), await pause(450))
  beat("looked")
  const before = await studio.count()
  await box.click()
  await box.pressSequentially("Make the second one's caption shorter.", { delay: 30 })
  await page.keyboard.press("Enter")
  beat("revise-sent")
  await page.waitForFunction((n) => [...document.querySelectorAll("button")].filter((b) => b.textContent?.includes("Open in Studio")).length > n, before, { timeout: 300000 }).catch(() => {})
  await pause(4000)
  beat("revised")
  await studio.last().click()
  beat("open-studio")
  await pause(22000)
  beat("studio-open")
} else if (which === "studio") {
  await go("/studio")
  await pause(9000)
  beat("open")
  const f = page.frameLocator("iframe").first()
  for (const id of ["lift-card", "lift-leaderboard", "metric-trend", "survey-split", "yes-on-3-card"]) {
    await f.getByText(id, { exact: true }).first().click({ timeout: 15000 }).catch((e) => console.log("no", id, e.message.split("\n")[0]))
    beat("pick:" + id)
    await pause(1500)
    await page.keyboard.press("Space").catch(() => {})
    await pause(5500)
    await page.keyboard.press("Space").catch(() => {})
    beat("played:" + id)
  }
  await f.getByText(/^v-/).first().click({ timeout: 15000 }).catch((e) => console.log("no version", e.message.split("\n")[0]))
  beat("version")
  await pause(1500)
  await page.keyboard.press("Space").catch(() => {})
  await pause(6000)
  beat("end")
}

const path = await page.video().path()
await ctx.close()
await browser.close()
renameSync(path, `${DIR}${which}.webm`)
writeFileSync(`${DIR}${which}.json`, JSON.stringify(beats, null, 1))
console.log("saved", `${DIR}${which}.webm`)
