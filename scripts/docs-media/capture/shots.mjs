// Docs screenshots: every page and the key states, PAX Light, 1440x900 at 2x, JPEG.
import { chromium } from "../../../node_modules/playwright-core/index.mjs"

const OUT = new URL("./shots/", import.meta.url).pathname
const BASE = "http://localhost:3000"
const only = process.argv[2]?.split(",")

const browser = await chromium.launch({ channel: "chrome" })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
await ctx.addInitScript(() => (localStorage.setItem("pax:theme", "pax-light"), localStorage.setItem("pax:theme-panel", "on")))
// The admins' inspector dock stays out of the pictures.
await ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = "[data-devinspector]{display:none!important}"; document.head.appendChild(st) }))
const page = await ctx.newPage()
const errors = []
page.on("pageerror", (e) => errors.push(e.message))

const settle = (ms = 900) => page.waitForTimeout(ms)
// until: "load" where a page's videos keep the network busy (Clips), so it never goes idle.
async function go(path, wait, until = "networkidle") {
  await page.goto(BASE + path, { waitUntil: until, timeout: 240000 }).catch(() => {})
  const dismiss = page.locator('button[aria-label="Dismiss"]').first()
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click().catch(() => {})
  if (wait) await page.waitForSelector(wait, { timeout: 120000 }).catch(() => {})
  await settle()
}
const tools = async () => (await page.click('button[aria-label="Open Tools"]'), settle(600))
const row = async (name) => (await page.getByRole("button", { name: new RegExp("^" + name) }).first().click(), settle(700))
const lift = async () => go("/lift?source=PAX_TEST", "tbody tr")
const cell = async (n = 0) => (await page.locator("tbody button:not([aria-label])").nth(n).click(), settle(2500))
// The panel at half the page (Brendan, 2026-11-02: "you could have gone half screen on lift analysis"). The analysis
// docks in the shell's aside, whose button reads Widen the panel; a take panel's reads Half the page.
const half = async () => (await page.getByRole("button", { name: /^(Half the page|Widen the panel)$/ }).first().click(), settle(1200))

const SHOTS = {
  "home": async () => go("/"),
  "sidebar": async () => (await go("/america-thinks"), await page.click('button[aria-label="Toggle sidebar"]'), settle(700)),
  "america-thinks": async () => go("/america-thinks"),
  "america-thinks-question": async () => (await go("/america-thinks"), await page.locator("[data-shell-main] [role=button], [data-shell-main] li button").first().click().catch(() => {}), settle(2500)),
  "lift": lift,
  "lift-rail": async () => (await lift(), await page.getByRole("button", { name: "Show sidebar" }).first().click(), await settle(500), await page.getByRole("button", { name: "Treatments", exact: true }).click(), settle(600)),
  "lift-menu": async () => (await lift(), await page.click('[data-shell-main] button[aria-label="More"]'), settle(500)),
  "lift-search": async () => (await lift(), await page.mouse.click(760, 140), await page.keyboard.type("Allen"), settle(800)),
  "lift-heatmap": async () => go("/lift?source=PAX_TEST&view=heatmap", "tbody tr"),
  "lift-analysis": async () => (await lift(), await cell(0), half()),
  "lift-explainer": async () => (await lift(), await cell(0), await half(), await page.getByRole("button", { name: "Explainer" }).click(), settle(600)),
  "lift-archive": async () => go("/lift?source=LIFT_ARCHIVE", "tbody tr"),
  "tools": async () => (await go("/lift?source=PAX_TEST", "tbody tr"), tools()),
  "tools-lift-cards": async () => (await lift(), await tools(), row("Lift Analysis")),
  "tools-blocks": async () => (await go("/data-dictionary"), await tools(), row("Blocks")),
  "tools-theme": async () => (await go("/models"), await tools(), row("Theme")),
  "tools-devtools": async () => (await go("/models"), await tools(), row("Dev Tools")),
  "second-panel": async () => (await go("/lift?source=PAX_TEST&pane=%2Famerica-thinks", "tbody tr"), settle(3000)),
  "survey": async () => go("/survey"),
  "survey-questions": async () => go("/survey?s=questions&c=open-primaries"),
  "survey-results": async () => {
    await go("/survey?s=questions&c=open-primaries")
    while ((await page.locator("div:not(.opacity-0) > section button", { hasText: /^Agree$/ }).count()) > 0) {
      await page.locator("div:not(.opacity-0) > section button", { hasText: /^(Agree|Disagree|Pass)$/ }).nth(Math.floor(Math.random() * 3)).click()
      await page.waitForTimeout(620)
    }
    await settle(1500)
    await page.evaluate(() => localStorage.setItem("consensus:rule", "trinity"))
    await page.getByText("Where consensus emerged").scrollIntoViewIfNeeded()
    await settle(400)
  },
  "survey-results-walkthrough": async () => (await page.getByRole("button", { name: "Walkthrough" }).click(), await settle(500), await page.getByText("Every group agrees on").scrollIntoViewIfNeeded(), settle(400)),
  "survey-results-surface": async () => go("/survey?s=results&c=open-primaries"),
  "survey-tests": async () => go("/survey?s=tests"),
  "chat": async () => go("/chat"),
  "clips": async () => go("/clips"),
  "studio": async () => (await go("/studio"), settle(6000)),
  "inbox": async () => go("/agentic-inbox"),
  "reports": async () => go("/reports"),
  "data-dictionary": async () => go("/data-dictionary"),
  "block-menu": async () => (await go("/data-dictionary"), await page.locator('button[aria-label="Block options"]').first().click(), settle(500)),
  "models": async () => go("/models"),
  "settings": async () => go("/settings"),
  "dashboard": async () => go("/dashboard"),
  "page-switcher": async () => (await go("/lift?source=PAX_TEST", "tbody tr"), await page.locator("[data-shell-main] [data-chrome] button").nth(1).click(), settle(600)),
  "signin": async () => go("/signin"),
  "signup": async () => go("/signup"),
  "test": async () => go("/test/open-primaries-1"),
  "survey-topline": async () => go("/s/open-primaries"),
  // The + beside the box, Skills at the top of its menu.
  "chat-plus": async () => (await go("/chat"), await page.locator("button:has(svg.lucide-plus)").last().click(), settle(600)),
  // No camera in headless Chrome: the record flow's own screen for that is the picture.
  "chat-record": async () => (await go("/chat?record=1"), settle(2500)),
  "inbox-templates": async () => (await go("/agentic-inbox"), await page.getByText("Templates", { exact: true }).first().click(), settle(800)),
  "inbox-new-test": async () => (await SHOTS["inbox-templates"](), await page.locator("li").filter({ has: page.getByText("New test", { exact: true }) }).first().click(), settle(800)),
  "tools-studio": async () => (await go("/chat"), await tools(), await row("Studio"), settle(6000)),
  "clip": async () => (await go("/clips", "[data-tile]", "load"), await page.locator("[data-tile]").first().click(), settle(2500)),
  "constructs": async () => go("/constructs"),
  // A drawn note: Shift and a drag across a blank part of the page.
  "note": async () => {
    await go("/america-thinks")
    await page.keyboard.down("Shift")
    await page.mouse.move(880, 300)
    await page.mouse.down()
    await page.mouse.move(1320, 620, { steps: 12 })
    await page.mouse.up()
    await page.keyboard.up("Shift")
    await settle(900)
  },
}

for (const [name, run] of Object.entries(SHOTS)) {
  if (only && !only.includes(name)) continue
  const t = Date.now()
  try {
    await run()
    // Chrome's own error page (the server dropped the connection mid-compile) is no picture: keep the last good one.
    if (page.url().startsWith("chrome-error:")) {
      console.log("ERR", name, "no page: the server dropped the connection")
      continue
    }
    const check = await page.evaluate(() => ({ text: (document.querySelector("[data-shell-main]") ?? document.body).innerText.length, overlay: !!document.querySelector("nextjs-portal")?.shadowRoot?.querySelector("[data-nextjs-dialog], [data-nextjs-error-overlay-nav]") }))
    if (check.overlay || check.text < 80) console.log("WARN", name, JSON.stringify(check))
    await page.screenshot({ path: `${OUT}${name}.jpg`, type: "jpeg", quality: 78 })
    console.log("ok ", name, `${((Date.now() - t) / 1000).toFixed(1)}s`)
  } catch (e) {
    console.log("ERR", name, e.message.split("\n")[0])
  }
}
console.log("page errors:", errors.length ? [...new Set(errors)].slice(0, 5) : "none")
await browser.close()
