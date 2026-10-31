import { shot } from "./media"
import { doc, type Doc } from "./types"

export const RESEARCH: Doc[] = [
  {
    slug: "america-thinks",
    title: "America Thinks",
    category: "research",
    summary: "What voters already believe, from the country's best surveys, so you write to where opinion actually stands.",
    tags: ["Research", "Data"],
    body: `Every message rests on a guess about what voters already believe. [America Thinks](/america-thinks) replaces the guess with the record: the General Social Survey, ANES and CES beside public polls, official results, the census, turnout, voting-age and enrollment records.

${shot("america-thinks", "America Thinks")}

## Browse the questions

- Each row is one question, its headline after the dash. Questions you haven't opened read bold.
- Pick a topic under **Index** in the sidebar, or a single source under **Data**.
- Search from the box at the top of the sidebar, or click the toolbar's empty space.

## Read a question

Click a question to open it beside the list, then switch its view:

- **Data**: each answer's share, row by row.
- **Crosstab**: the answers broken down by group.
- **Trend**: how it moved across the years it was asked.
- **Topline**: the headline numbers.
- **Global**: its full dossier.

${shot("america-thinks-question", "A question open beside the list")}

## Keep track

Each row carries three marks:

- **The box** adds it as a column to compare.
- **The arrow** marks it Important.
- **The star** adds it to Favorites.

**Favorites** and **Important** in the sidebar list just those.

> A question's three dots add it to [Blocks](${doc("blocks")}) or open it in the [second panel](${doc("second-panel")}).`,
  },
  {
    slug: "constructs",
    title: "Constructs",
    category: "research",
    summary: "One idea measured across every survey that asked it, however each one worded it.",
    tags: ["Research", "Data"],
    body: `A construct is one idea measured across sources, such as confidence in Congress, gathered as one family of questions however each survey worded it, and anchored to the GSS Key Trends and the ANES Guide.

[Constructs](/constructs) lists them by subject, with every source each is asked in, its latest figures and its trend. Each links to its lead question's dossier in [America Thinks](${doc("america-thinks")}).

These are the benchmarks a new survey's or test's numbers read against.`,
  },
  {
    slug: "data-dictionary",
    title: "Data dictionary and glossary",
    category: "research",
    summary: "Every term the pages use, defined, and for staff, the tables and pipeline behind them.",
    tags: ["Research", "Data"],
    body: `[Data dictionary](/data-dictionary) is where every term is defined.

${shot("data-dictionary", "The data dictionary")}

- **Dictionary**: the question bank's constructs as terms.
- **Glossary**: every term used across the pages, with its definition and section, and a search.
- **Schema** (staff): the audience store's tables.
- **ERD** (staff): the whole pipeline's entity diagram.

> Every block here has a menu at its top right. **Ask PAX** opens Chat with the block as context, so you can ask about any term. See [Blocks](${doc("blocks")}).`,
  },
]
