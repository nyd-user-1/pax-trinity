import { shot } from "./media"
import { doc, type Doc } from "./types"

export const ADMIN: Doc[] = [
  {
    slug: "dev-tools",
    title: "Dev Tools: comments, sonar and the inspector",
    category: "admin",
    summary: "Point at anything on a page and comment on it, and see what each part of a page is built from.",
    tags: ["Staff", "Dev Tools"],
    admins: true,
    body: `Dev Tools is where staff talk about the app itself. Open [Tools](${doc("tools")}) > **Dev Tools**.

${shot("tools-devtools", "Dev Tools")}

## Dev Comments

Comments on the app, and direct messages. **Everyone** is the shared thread; each comment made with sonar lands here, with a link back to the element it's about.

## Sonar

Point at any element on any page and comment on it.

1. In Dev Tools, choose **Sonar**. The crosshair button appears in the header, and stays for this tab.
2. Hover the page. Sonar outlines and names the element under the pointer.
3. Click to lock it, write your comment, and press Enter. Paste a screenshot if it helps.
4. Press the crosshair again, or Esc, to stop.

While you're pointing: ↑ ↓ walk up and down the page's tree, ⌘↑ ⌘↓ step through siblings, and ⌥ points precisely.

Every open comment marks its element with its author's photo until it's resolved. Click a photo to read the comment.

## Inspector

The inspector shows what each part of a page is built from.

- **Layers** colour the page by where each part comes from: the design system, shared components, the page itself, or unresolved.
- **Tree** lists the page's elements; ⌥↑ ⌥↓ walk it.
- **Comments** keeps your own notes against elements, in this browser.`,
  },
  {
    slug: "dashboard",
    title: "Dashboard",
    category: "admin",
    summary: "The Delivery Board: the account's headline facts, the week's work, and the checks under them.",
    tags: ["Staff"],
    admins: true,
    body: `[Dashboard](/dashboard) is the Delivery Board: the account's four headline facts, the week's worklogs, and the apps, workflows and checks under them.

${shot("dashboard", "The Delivery Board")}

It runs on sample data for now.`,
  },
]
