// Mail's design, ported from pax2's sent mail (Brendan, 2026-10-29): the "Welcome to pax" card
// (Resend, 2026-10-15) with the PAX mark of the Alpha Launch invitation (2026-10-19). A pale page,
// the mark, a white card headed in navy by the message's bold first line (else its subject), slate paragraphs, a navy pill for a
// link that stands alone on its line (pax2's layout() buttons), "**Label:** value" lines and lists
// in the card's pale details panel, an image (a result video's poster, linking to the video) at a phone thumbnail's width, and
// the site's address beneath. Tables and inline styles, so every mail client draws it.
// The input is the composer's markdown, the subset it writes; relative links resolve against `base`.

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const NAVY = "#1e3a8a"
const INK = "#0f172a"
const SLATE = "#475569"
const PAGE = "#f5f7fb"
const MARK = "https://pax.nysgpt.com/brand/pax-mark.png"
const IMAGE_WIDTH = 240

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

export function designedHtml(markdown: string, base: string, subject?: string) {
  const href = (h: string) => (h.startsWith("/") ? base + h : h)
  const img = (alt: string, src: string) =>
    `<img src="${href(src)}" alt="${alt}" width="${IMAGE_WIDTH}" style="display:block;border:0;width:${IMAGE_WIDTH}px;max-width:100%;height:auto;border-radius:12px">`
  const inline = (s: string) =>
    escape(s)
      // Images first, a linked one whole, so the link rule below never sees their brackets.
      .replace(/\[!\[([^\]]*)\]\(([^)\s]+)\)\]\(([^)\s]+)\)/g, (_, alt, src, h: string) => `<a href="${href(h)}" style="display:inline-block">${img(alt, src)}</a>`)
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => img(alt, src))
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, h: string) => `<a href="${href(h)}" style="color:${NAVY};font-weight:600;text-decoration:underline">${text}</a>`)
      .replace(/\*\*([^*]+)\*\*/g, `<strong style="color:${INK};font-weight:600">$1</strong>`)
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
      .replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/g, "<u>$1</u>")
  const p = (inner: string, extra = "") => `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.6;color:${SLATE};${extra}">${inner}</p>`
  let blocks = markdown.trim().split(/\n{2,}/)
  // A bold first line is the message's own title (the composer's cards open this way); it heads the card in place of the subject.
  const title = blocks[0]?.trim().match(/^\*\*([^*]+)\*\*$/)?.[1]
  if (title) blocks = blocks.slice(1)
  const heading = title ?? subject
  // "**Label:** value" lines in a row are the Welcome card's details panel: the label small and grey, the value beneath it.
  const LABEL = /^\*\*([^*]+):\*\*\s*(.*)$/
  const out: string[] = []
  for (let i = 0; i < blocks.length; i++) {
    if (!LABEL.test(blocks[i].trim())) {
      out.push(render(blocks[i], i))
      continue
    }
    const rows: string[] = []
    for (; i < blocks.length && LABEL.test(blocks[i].trim()); i++) {
      const [, label, value] = blocks[i].trim().match(LABEL)!
      rows.push(`<tr><td style="padding:${rows.length ? "14px" : "0"} 0 2px;font-family:${FONT};font-size:12px;color:#64748b">${escape(label)}</td></tr><tr><td style="font-family:${FONT};font-size:15px;line-height:1.5;color:${INK}">${inline(value)}</td></tr>`)
    }
    i--
    out.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px"><tr><td bgcolor="${PAGE}" style="background:${PAGE};border-radius:10px;padding:18px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join("")}</table></td></tr></table>`)
  }
  function render(block: string, i: number) {
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
  }
  // The inbox's preview line: the first paragraph past the greeting, as plain text.
  const preview = blocks.find((b) => !/^Hi\b/.test(b) && !/^\[/.test(b) && !LABEL.test(b.trim()))?.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_]|<\/?u>/g, "").slice(0, 160) ?? ""
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
${heading ? `<h1 style="margin:0 0 18px;font-family:${FONT};font-size:23px;line-height:1.3;font-weight:600;letter-spacing:-0.01em;color:${NAVY}">${escape(heading)}</h1>\n` : ""}${out.join("\n")}
</td></tr>
<tr><td style="padding:20px 8px 0;font-family:${FONT};font-size:12px;color:#94a3b8"><a href="${escape(base)}" style="color:#94a3b8;text-decoration:none">${escape(host)}</a></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

/**
 * A person's mail, as plain email (Brendan, 2026-11-02): their markdown as simple HTML, a paragraph per
 * block with its line breaks, links, bold and italics, and a list where every line is an item. No frame:
 * no mark, no card, no footer, no styling. The designed frame above is the agents' templated mail alone.
 */
export function plainHtml(markdown: string, base: string) {
  const href = (h: string) => (h.startsWith("/") ? base + h : h)
  const inline = (s: string) =>
    escape(s)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, h: string) => `<a href="${href(h)}">${text}</a>`)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
      .replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/g, "<u>$1</u>")
  return markdown
    .trim()
    .split(/\n{2,}/)
    .filter((b) => b.trim())
    .map((block) => {
      const lines = block.split("\n")
      const listed = lines.every((l) => /^\s*[-*] /.test(l)) ? "ul" : lines.every((l) => /^\s*\d+\. /.test(l)) ? "ol" : null
      if (listed) return `<${listed}>${lines.map((l) => `<li>${inline(l.replace(/^\s*(?:[-*]|\d+\.) /, ""))}</li>`).join("")}</${listed}>`
      return `<p>${lines.map(inline).join("<br>")}</p>`
    })
    .join("\n")
}
