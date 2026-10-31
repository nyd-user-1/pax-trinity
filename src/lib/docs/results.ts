import { shot, video } from "./media"
import { doc, type Doc } from "./types"

export const RESULTS: Doc[] = [
  {
    slug: "lift",
    title: "Lift: see what moved people",
    category: "results",
    summary: "Every tested video's effect, side by side, so you can tell a strong result from an ordinary one before you scale it.",
    tags: ["Lift", "Results"],
    body: `A lift means little until you know what ads usually do. [Lift](/lift) sets every result on file side by side, so a strong result stands out from an ordinary one at a glance.

${shot("lift", "Lift's table, with each video's lift on Support, Comprehension and Emotional Response")}

## Read the table

Each row is a video, and each column one measure: **Support**, **Comprehension** and **Emotional Response** for the tests, favorability and vote choice for the Archive.

- The small number at the left of a cell is the placebo group's level.
- The bar runs from that level by the lift, in percentage points. Its tip points the way people moved, and the number past the tip is the lift.
- A lift drawn in grey didn't clear its test: the test couldn't tell it apart from no effect.
- Emotional Response shows the share of people naming each feeling. No test has asked it yet, so it's marked **Sample**.

> Click any lift to open its [Lift Analysis](${doc("lift-analysis")}). It explains the number in plain words.

## Breakdowns

Below Everyone, each video's lift is broken down by age, education, gender, party and more. Each breakdown is a band across the table: hover it to see its arrow, and click it to fold its rows away. Click again to bring them back.

## Sort and size the columns

- Click a column's name to sort by it. Click again to reverse.
- Drag the control at the right of a column's name to make it wider or narrower.
- Hover a column's name to see its info circle, which says exactly what the measure is.

## The toolbar

The toolbar above the table is the same on every page like this one.

- **⋮** holds the rest: **View** (Table or Heatmap), **Sort by**, **Filter**, **Share** (copies a link to exactly what you're looking at), **Download** (a CSV of the table) and **Refresh**.
- **The sidebar button** opens [Lift's sidebar](${doc("lift-sidebar")}): its search, folders, favorites, and what the table shows.
- **Click the empty space** to search treatments by name.
- **‹ ›** step the open Lift Analysis to the row before or after it.

${shot("lift-menu", "The toolbar's menu: View, Sort by, Filter, Share, Download and Refresh")}

## Heatmap

Choose **View > Heatmap** in the ⋮ menu to see every segment at once, each cell coloured by how far it sits from the benchmark. **Benchmark** in the same menu sets what the colours measure from: the median of all tests, or zero. The key on the toolbar reads the colours.

${shot("lift-heatmap", "The heatmap view")}

## The two folders

- **Tests**: the message-test waves run here.
- **Archive**: 1,583 effects of 618 ads from campaigns' own randomized persuasion experiments (Hewitt, Broockman, Coppock et al., APSR 2024). See [The Archive](${doc("archive")}).`,
  },
  {
    slug: "lift-analysis",
    title: "Lift Analysis",
    category: "results",
    summary: "Open any lift to see the result, where it ranks against every other, and what it all means in plain sentences.",
    tags: ["Lift", "Results"],
    body: `A single number never tells the whole story. Lift Analysis opens beside the table when you click a lift, and shows what the number is, how sure it is, and how it compares.

${video("guide-lift-analysis", "Open a lift and read its analysis")}

## Open it

1. In [Lift](/lift), click any lift in the table.
2. Lift Analysis opens in the right panel. The row you picked is highlighted.
3. Use **‹ ›** in the toolbar to step to the row before or after, on the same measure. The panel follows.

You can also open it from anywhere: [Tools](${doc("tools")}) > **Lift Analysis** holds a card for every video the tests measured.

## Analytics

The first tab is the numbers, in three sections.

### Result

The line at the top runs from 0 to 100: the arrow starts at the control group's level and moves by the lift. Below it, the treatment group beside the control group:

- **Mean**: each group's level on the measure.
- **Sample size**: how many people were in each group.
- **Impact**: the lift, in points, and four bars for its strength. More bars lit means less chance it's noise.
- **Confidence interval**: the margin, a 90% interval. A margin that crosses zero means the test couldn't tell the effect from none.

${shot("lift-analysis", "Lift Analysis: Result and Benchmarks")}

### Benchmarks

Each benchmark places the lift among others on the same measure and segment: **All tests**, the folder's own when it differs, and **This test**. The curve shows how those lifts spread, with this one marked. The bars on the right say which fifth it falls in, from the bottom 0 to 20% up to the top 80 to 100%.

Click a benchmark to open its details: the impact, the benchmark's median, and the set it's drawn from.

### Compare Rank

Every video in the same test, ranked by impact on this measure. **Difference** is each one's lift less this one's.

## Explainer

The second tab says everything Analytics shows, in sentences. Each section has a headline that sums it up, and its source sits at the foot: where and when it was fielded, the producer and length, and the wave's pairings.

${shot("lift-explainer", "The Explainer tab")}

> An Archive ad has **Traits** in place of Explainer: its coded profile, from where and when it ran to every trait it carries.

## Go back

The arrow before **Lift Analysis** in the panel's header climbs to Tools' Lift Analysis cards, so you can open another.`,
  },
  {
    slug: "lift-sidebar",
    title: "Filter, star and flag in Lift",
    category: "results",
    summary: "Choose exactly which videos, measures and segments the table shows, and keep your favorites one click away.",
    tags: ["Lift"],
    body: `Lift's sidebar decides what the table shows. Open it from the sidebar button in the toolbar.

${video("guide-lift-filters", "Filter Lift and keep favorites")}

## Search

The box at the top of the sidebar searches treatments by name. So does the toolbar: click its empty space and type.

## Folders

**Tests** and **Archive** switch the table between the two folders.

## Favorites and Important

Hover any row to see its flag and its star.

- Click the star to make it a favorite, or the flag to mark it important. Both stay once set, in this browser.
- **Favorites** and **Important** in the sidebar show only those rows, with their counts. Click again to see everything.

## Treatments, Metrics and Segments

Each opens into a checklist. Everything starts checked; uncheck a row to take it out of the table.

${shot("lift-rail", "Lift's sidebar, with Treatments open")}

- **Treatments**: every video, with its picture. **Show all** and **Hide all** sit at the bottom.
- **Metrics**: the primary and secondary measures and Emotional Response. In the Archive, the traits you can add as columns too.
- **Segments**: Everyone, then each breakdown and its groups. **Everyone only** hides every breakdown at once; checking a breakdown checks all its groups, and a dash means some are hidden.

## Filter

The rest lives in the toolbar's **⋮ > Filter**:

- **Waves**: which fieldings the table reads.
- **Each metric**: All, **Measured**, or **Clears its test** to keep only results that cleared it.
- **Archive columns**: hide any value of a trait.
- **Group by test** (Archive): band the ads by the test they ran in.`,
  },
  {
    slug: "archive",
    title: "The Archive",
    category: "results",
    summary: "618 real campaign ads and what they did, to read your own results against.",
    tags: ["Lift", "Research"],
    body: `The Archive holds 1,583 effects of 618 ads from campaigns' own randomized persuasion experiments (Hewitt, Broockman, Coppock et al., APSR 2024). The ads are anonymized, and each is described by its coded traits.

${shot("lift-archive", "The Archive in Lift")}

## Open it

In [Lift](/lift), open the sidebar and choose **Archive**.

## What's different

- The measures are **favorability** and **vote choice**.
- **View** in the ⋮ menu has three views: **Traits** (the ads as rows), **Heatmap**, and **Attributes**, which pools every ad that has a trait against those that don't.
- Metrics in the sidebar can add trait columns: the office, the state, when it was tested, and the coded traits.
- **⋮ > Filter > Group by test** bands the ads by the test they ran in.
- An ad's Lift Analysis shows its **Traits** in place of Explainer.

> The Archive's lifts are the benchmark pool's widest set. A Tests result in the top fifth of All tests beat most real campaign ads.`,
  },
  {
    slug: "resonance",
    title: "Resonance",
    category: "results",
    summary: "One 0 to 100 score for how a video's lift compares with every lift on file.",
    tags: ["Lift", "Results"],
    body: `Resonance is a 0 to 100 score for a video: the percentile of its primary-outcome lift among every lift on file for that outcome, ties counted half.

- **50** means it moved its outcome as much as the middle lift on file.
- **90** means it beat nine in ten.

It needs at least five lifts in the pool before it shows, and reads at the head of a tested clip's panel in [Clips](/clips). Reports don't show it yet.`,
  },
  {
    slug: "reports",
    title: "Reports",
    category: "results",
    summary: "A finished study's readout: every video's lift, every subgroup, and what the result can and cannot establish.",
    tags: ["Results"],
    body: `A test is only worth what you can read and defend from it. [Reports](/reports) turns a finished study into its readout.

${shot("reports", "Reports")}

## Find a report

Reports gives a card for each report. A study of several waves, such as Massachusetts Message Testing, has a card for its executive summary and one for each wave. The methodology has its own.

## Read a wave

- **Executive summary**: each video's lift in ballot support against that wave's placebo.
- **The video cards**: lift in ballot choice and in comprehension, with **Watch video**.
- **Subgroups**: the lift for each group.

The up and down arrows on a block move it within its run; the order is kept for that page in your browser.

## Detectable and inconclusive

A lift is **detectable** when it meets the study's stated threshold against the placebo, 90% for the Massachusetts waves. **Inconclusive** means the test didn't detect an effect at that threshold. It isn't proof the effect is zero. A small subgroup is marked as a small sample.

## Report 2

[Report 2](/reports-2) opens the same studies section by section, with a contents rail that tracks the page: Summary, The videos, Outcomes, Subgroups, Pairings, How the test worked, and What it can and cannot establish. Each section sets every wave side by side, and the page prints as a document.

> Massachusetts Wave 3 was fielded to a small test panel to prove the fielding end to end. Its results are simulated, and its report says so.`,
  },
]
