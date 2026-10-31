import { mergeAttributes, Node } from "@tiptap/core"

// A note card's chat is one text (Brendan, 2026-10-31): the reader writes, Shift Enter sends what they wrote since
// PAX last answered, and the answer is written into the same text, a block set off by a lavender rule. In markdown a
// reply is its own markdown between <div data-pax> and </div>, so the saved chat reads as text and turnsOf reads the
// conversation back out of it.

/** The serializer's state, what of prosemirror-markdown's a reply uses. */
type MdState = { write(content: string): void; closeBlock(node: unknown): void; renderContent(node: unknown): void }

export const PaxReply = Node.create({
  name: "paxReply",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    // The reply PAX is writing now; the saved text doesn't carry it.
    return { live: { default: false, parseHTML: () => false, renderHTML: (attrs) => (attrs.live ? { "data-live": "" } : {}) } }
  },
  parseHTML() {
    return [{ tag: "div[data-pax]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-pax": "" }), 0]
  },
  addStorage() {
    return {
      markdown: {
        // A blank line after the opening tag and before the closing one, so markdown-it reads the reply's own
        // markdown between them.
        serialize(state: MdState, node: unknown) {
          state.write("<div data-pax>")
          state.closeBlock(node)
          state.renderContent(node)
          state.write("</div>")
          state.closeBlock(node)
        },
        parse: {},
      },
    }
  },
})

export type Turn = { role: "user" | "assistant"; content: string }

/** The conversation in a chat's markdown: PAX's replies, and the reader's words between them. Turns of one voice
 *  that meet (a reply deleted) join, and the conversation starts with the reader, as the model wants. */
export function turnsOf(md: string): Turn[] {
  const turns: Turn[] = []
  const push = (role: Turn["role"], text: string) => {
    const content = text.trim()
    if (!content) return
    const last = turns[turns.length - 1]
    if (last?.role === role) last.content += `\n\n${content}`
    else if (turns.length || role === "user") turns.push({ role, content })
  }
  let at = 0
  for (const m of md.matchAll(/<div data-pax>([\s\S]*?)<\/div>/g)) {
    push("user", md.slice(at, m.index))
    push("assistant", m[1])
    at = (m.index ?? 0) + m[0].length
  }
  push("user", md.slice(at))
  return turns
}
