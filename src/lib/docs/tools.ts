import { GUIDES, shot, video } from "./media"
import { doc, type Doc } from "./types"

export const TOOLS: Doc[] = [
  {
    slug: "tools",
    title: "The Tools panel",
    category: "tools",
    summary: "One panel at the right of every page: Blocks, Chat, Lift Analysis, Studio, Theme and more.",
    tags: ["Tools", "Navigation"],
    body: `Tools keeps everything you reach for beside the page you're on, so you never lose your place.

${video("guide-tools", "Get around with Tools")}

## Open it

Click **Tools** at the top right of any page. Click it again, or the panel's ×, to close it.

${shot("tools", "The Tools panel")}

## What's inside

| Tool | What it's for |
|---|---|
| **Blocks** | The shorts and blocks you've saved. See [Blocks](${doc("blocks")}). |
| **Chat** | Ask me about the page you're on. See [Ask PAX in Chat](${doc("chat")}). |
| **Dev Tools** | Staff: comments, the inspector and sonar. See [Dev Tools](${doc("dev-tools")}). |
| **Edits** | The team's thread on the clip playing in [Clips](${doc("clips")}). |
| **Lift Analysis** | A card for every deliverable the tests measured. Click one to open its [analysis](${doc("lift-analysis")}). |
| **Record** | Write a script, record it, or upload a video. |
| **Reports** | Every tested clip's readout. |
| **Studio** | Staff: the video templates and their versions. See [Studio](${doc("studio")}). |
| **Theme** | Six themes, and every colour in them. See [Themes](${doc("themes")}). |
| **Slack**, **Discord** | Staff: the connected workspaces. |

## Move around inside it

Each tool opens a level down. The arrow before the panel's title climbs back up, one level at a time, all the way to the list.

${shot("tools-lift-cards", "Lift Analysis in Tools: a card for every deliverable")}

## Make it wider

The button beside the × widens the panel to half the screen, and narrows it again.`,
  },
  {
    slug: "blocks",
    title: "Blocks: save anything",
    category: "tools",
    summary: "Every block has a menu. Favorite it, save it, ask about it, or take it off the page.",
    tags: ["Tools", "Blocks"],
    body: `A block is any card with a title on a page: a table in the data dictionary, a model's card, a chart. Every block has the same menu, at its top right.

${video("guide-blocks", "Save a block")}

## The block menu

${shot("block-menu", "A block's menu")}

- **Pin to top** moves it to the top of the page.
- **Favorite** adds it to your favorites in the sidebar.
- **Add to Blocks** saves it to the Blocks shelf in [Tools](${doc("tools")}).
- **Ask PAX** opens Chat with the block as context.
- **Refresh** reloads its data.
- **Collapse**, **Half View** and **Full View** size it.
- **Download**, where a block has rows, saves them as CSV or JSON.
- **Delete** takes it off the page and onto the Blocks shelf, where opening it puts it back.

> Click a block's title to copy a link straight to it.

## The Blocks shelf

${shot("tools-blocks", "The Blocks shelf in Tools")}

Tools > **Blocks** lays out everything you've saved as tiles, beside the page's own blocks.

- Click a tile to jump back to it, on whatever page it lives.
- Drag a tile to reorder the shelf, or onto the chat to ask about it.
- A deleted block's tile is dimmed; open it to put it back.`,
  },
  {
    slug: "second-panel",
    title: "Two pages side by side",
    category: "tools",
    summary: "Open any page in a second panel, so you can compare without losing your place.",
    tags: ["Navigation", "Tools"],
    body: `Comparing a result with what voters already think shouldn't mean flipping back and forth. Open the second page beside the first.

${video("guide-second-panel", "Open a second panel")}

## Open a page beside this one

- In the sidebar, hover a page and click its arrow.
- In a page's own sidebar (Lift, Survey, America Thinks), hover a row and click its arrow.
- Or open a row's **⋮** and choose **Open in panel**.

The second panel opens at half the width. Drag the line between the two to resize them.

${shot("second-panel", "Lift with America Thinks in the second panel")}

## Close it

The × at the panel's corner closes it. Your address keeps the second panel, so a reload brings it back.`,
  },
  {
    slug: "video-guides",
    title: "Video guides",
    category: "guides",
    summary: "Short videos that show each thing being done, start to finish.",
    tags: ["Guides"],
    body: GUIDES.map((g) => `## ${g.title}\n\n${g.summary} Read more in [the article](${doc(g.article)}).\n\n${video(g.name, g.title)}`).join("\n\n"),
  },
]
