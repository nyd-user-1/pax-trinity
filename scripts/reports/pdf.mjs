#!/usr/bin/env node
// Prints a /reports study page to a PDF through the Chrome installed on this machine.
//
//   node scripts/reports/pdf.mjs --study <slug> [--base http://localhost:3000] [--out <path>] [--scale 0.8]
//
//   --study <slug>   required: the study's slug, as /reports/<slug> serves it
//                    (massachusetts-message-testing)
//   --base <url>     the running app; defaults to http://localhost:3000
//   --out <path>     where the PDF goes; defaults to ./<slug>.pdf
//   --scale <n>      the page's print scale (0.1–2); defaults to 0.8, which lays the readout out
//                    at about 880 CSS px across a Letter page
//
// The page prints itself: /reports/[study] carries its own print dress (src/app/reports/report.css),
// so this script only opens it, waits for the fonts, and asks Chrome for Letter pages with the PAX
// wordmark in the header and "study · page n of N" in the footer. Links stay live in the PDF.
//
// Local tooling only. playwright-core is a devDependency that never downloads a browser; this
// script drives the installed Google Chrome (channel "chrome") and is not part of `next build`.
//
// The exemplar: node scripts/reports/pdf.mjs --study massachusetts-message-testing \
//                 --out docs/reports/ma-test-waves-1-2-trinity.pdf

import fs from "node:fs"
import path from "node:path"
import { chromium } from "playwright-core"

const argv = process.argv.slice(2)
const flag = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}

const study = flag("study")
if (!study) {
  console.error("usage: node scripts/reports/pdf.mjs --study <slug> [--base http://localhost:3000] [--out <path>] [--scale 0.8]")
  process.exit(2)
}
const base = (flag("base") ?? "http://localhost:3000").replace(/\/$/, "")
const out = path.resolve(flag("out") ?? `${study}.pdf`)
const scale = Number(flag("scale") ?? 0.8)
if (!(scale >= 0.1 && scale <= 2)) {
  console.error(`--scale must be between 0.1 and 2 (got ${flag("scale")})`)
  process.exit(2)
}

// The PAX mark's own face (src/components/load-curtain.css), so the header wears the real wordmark.
const curtain = fs.readFileSync(path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../src/components/load-curtain.css"), "utf8")
const face = curtain.match(/@font-face\s*{[^}]*}/)?.[0] ?? ""

const escape = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])
const ink = "#16181d"
const muted = "rgba(22,24,29,0.55)"
const frame = "width:100%;padding:0 0.6in;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;-webkit-print-color-adjust:exact;"

// Chrome draws header templates before a web font can load, so the mark goes in as a picture of
// itself: rendered once in its own face, captured at 4x on a transparent ground.
async function wordmark(browser) {
  const page = await browser.newPage({ deviceScaleFactor: 4 })
  try {
    await page.setContent(
      `<style>${face} body{margin:0}</style><span id="m" style="display:inline-block;padding:1px 2px;font-family:'PAX Curtain',monospace;font-weight:700;font-size:26px;line-height:1;color:#1e3a8a;">P<span style="color:#dc2626;">A</span>X</span>`
    )
    await page.evaluate(() => document.fonts.ready)
    const png = await (await page.$("#m")).screenshot({ omitBackground: true })
    return `data:image/png;base64,${png.toString("base64")}`
  } finally {
    await page.close()
  }
}

const header = (mark) => `
  <div style="${frame}font-size:7px;color:${muted};">
    <img src="${mark}" alt="PAX" style="height:11px;width:auto;" />
  </div>`

const footer = (title) => `
  <div style="${frame}font-size:7.5px;color:${muted};">
    <span></span>
    <span>${escape(title)} · page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>`

const browser = await chromium.launch({ channel: "chrome", headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } })
  const url = `${base}/reports/${encodeURIComponent(study)}`
  const res = await page.goto(url, { waitUntil: "networkidle", timeout: 180_000 })
  if (!res || !res.ok()) throw new Error(`${url} answered ${res ? res.status() : "nothing"}`)
  const doc = await page.$("[data-report]")
  if (!doc) throw new Error(`${url} has no report on it (is "${study}" a study slug?)`)
  const title = (await doc.getAttribute("data-report")) ?? study
  await page.emulateMedia({ media: "print" })
  await page.evaluate(() => document.fonts.ready)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  await page.pdf({
    path: out,
    format: "Letter",
    printBackground: true,
    scale,
    displayHeaderFooter: true,
    headerTemplate: header(await wordmark(browser)),
    footerTemplate: footer(title),
    margin: { top: "0.7in", bottom: "0.65in", left: "0.6in", right: "0.6in" },
  })
  console.log(`wrote ${path.relative(process.cwd(), out)} (${title}, scale ${scale})`)
} finally {
  await browser.close()
}
