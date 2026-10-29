// Mail's design, ported from pax2's sent mail (Brendan, 2026-10-29): the "Welcome to pax" card
// (Resend, 2026-10-15) with the PAX mark of the Alpha Launch invitation (2026-10-19). A pale page,
// the mark, a white card with the subject as its navy heading, slate paragraphs, a navy pill for a
// link that stands alone on its line (pax2's layout() buttons), lists in the card's pale details
// panel, and the site's address beneath. Tables and inline styles, so every mail client draws it.
// The input is the composer's markdown, the subset it writes; relative links resolve against `base`.

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const NAVY = "#1e3a8a"
const INK = "#0f172a"
const SLATE = "#475569"
const PAGE = "#f5f7fb"
const MARK = "https://pax.nysgpt.com/brand/pax-mark.png"

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

export function designedHtml(markdown: string, base: string, subject?: string) {
  const href = (h: string) => (h.startsWith("/") ? base + h : h)
  const inline = (s: string) =>
    escape(s)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, h: string) => `<a href="${href(h)}" style="color:${NAVY};font-weight:600;text-decoration:underline">${text}</a>`)
      .replace(/\*\*([^*]+)\*\*/g, `<strong style="color:${INK};font-weight:600">$1</strong>`)
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
      .replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/g, "<u>$1</u>")
  const p = (inner: string, extra = "") => `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.6;color:${SLATE};${extra}">${inner}</p>`
  const blocks = markdown.trim().split(/\n{2,}/)
  const out = blocks.map((block, i) => {
    const lines = block.split("\n")
    const button = block.trim().match(/^\[([^\]]+)\]\(([^)\s]+)\)\.?$/)
    if (button)
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr><td bgcolor="${NAVY}" style="border-radius:999px;background:${NAVY}"><a href="${escape(href(button[2]))}" style="display:inline-block;padding:13px 30px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${escape(button[1])}</a></td></tr></table>`
    const listed = lines.every((l) => /^\s*[-*] /.test(l)) ? "ul" : lines.every((l) => /^\s*\d+\. /.test(l)) ? "ol" : null
    if (listed) {
      const rows = lines.map((l, k) => {
        const text = inline(l.replace(/^\s*(?:[-*]|\d+\.) /, ""))
        return `<tr><td style="padding:${k ? "10px" : "0"} 0 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${INK}">${listed === "ol" ? `${k + 1}. ` : ""}${text}</td></tr>`
      })
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px"><tr><td bgcolor="${PAGE}" style="background:${PAGE};border-radius:10px;padding:18px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join("")}</table></td></tr></table>`
    }
    if (lines.every((l) => /^> ?/.test(l)))
      return `<blockquote style="margin:0 0 16px;border-left:2px solid #cbd5e1;padding-left:12px;font-family:${FONT};font-size:15px;line-height:1.6;color:${SLATE}">${lines.map((l) => inline(l.replace(/^> ?/, ""))).join("<br>")}</blockquote>`
    // The sign-off: a last line of one or two words, the sender's name.
    if (i === blocks.length - 1 && i > 0 && /^[A-Z][\w.'-]*( [A-Z][\w.'-]*)?$/.test(block.trim())) return p(escape(block.trim()), `margin:8px 0 0;color:${INK};font-weight:500`)
    return p(lines.map(inline).join("<br>"))
  })
  // The inbox's preview line: the first paragraph past the greeting, as plain text.
  const preview = blocks.find((b) => !/^Hi\b/.test(b) && !/^\[/.test(b))?.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_]|<\/?u>/g, "").slice(0, 160) ?? ""
  const host = base.replace(/^https?:\/\//, "")
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background-color:${PAGE}">
<div style="display:none;max-height:0;overflow:hidden">${escape(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAGE}" style="background-color:${PAGE}">
<tr><td align="center" style="padding:40px 16px 56px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px">
<tr><td style="padding:0 8px 20px"><img src="${MARK}" width="64" alt="PAX" style="display:block;border:0;width:64px;height:auto"></td></tr>
<tr><td style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:36px 40px">
${subject ? `<h1 style="margin:0 0 18px;font-family:${FONT};font-size:23px;line-height:1.3;font-weight:600;letter-spacing:-0.01em;color:${NAVY}">${escape(subject)}</h1>\n` : ""}${out.join("\n")}
</td></tr>
<tr><td style="padding:20px 8px 0;font-family:${FONT};font-size:12px;color:#94a3b8"><a href="${escape(base)}" style="color:#94a3b8;text-decoration:none">${escape(host)}</a></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}
