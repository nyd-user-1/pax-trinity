import Link from "next/link"
import { MessagesSquare } from "lucide-react"

import { ProjectCard, ProjectGrid } from "@/components/project-card"
import { type Conversation } from "@/lib/consensus/data"
import { fmtNumber } from "@/lib/format"

// The Surveys tab — the conversations, as a directory.
//
// Polis lists these by printing every conversation's entire description into
// a wall of monospace. A conversation is a thing with a shape — how many
// people, how many statements, how many groups it found — so it gets a card
// with that shape on it, the way committees and bills do here.
export function SurveysPanel({ all, admin }: { all: Conversation[]; admin: boolean }) {
  return (
    <div data-not-typeset="true" className="my-8 flex flex-col gap-8">
      <ProjectGrid>
        {all.map((c) => (
          <ProjectCard
            key={c.slug}
            href={`/consensus?tab=results&c=${c.slug}`}
            title={c.title}
            media={<MessagesSquare className="size-7 text-muted-foreground" aria-hidden />}
            meta={`${fmtNumber(c.stats.voters)} participants · ${fmtNumber(c.stats.statements)} statements · ${c.stats.groups} groups`}
          />
        ))}
      </ProjectGrid>

      <p className="text-sm text-muted-foreground">
        The conversations are the Computational Democracy Project&apos;s own published data, so every one of them has already clustered.{" "}
        <Link href="/consensus?tab=questions">Questions</Link> is where a conversation is voted on
        {admin ? (
          <>
            {" "}
            and <Link href="/consensus?tab=admin">Admin</Link> is where one is built.
          </>
        ) : (
          "."
        )}
      </p>
    </div>
  )
}
