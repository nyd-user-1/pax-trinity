import * as React from "react"
import Link from "next/link"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { Lightbulb } from "lucide-react"

import { headingId } from "@/lib/docs"

// A doc's markdown, rendered on the server so the article ships no script, in the help center's dress (Notion's,
// Brendan 2026-10-31): roomy type, headings with anchors for the contents, every picture a framed figure with its
// caption, a .mp4 drawn as a player with its poster, and a quote as a callout.

const text = (children: React.ReactNode): string =>
  React.Children.toArray(children)
    .map((c) => (typeof c === "string" || typeof c === "number" ? String(c) : React.isValidElement<{ children?: React.ReactNode }>(c) ? text(c.props.children) : ""))
    .join("")

function Figure({ src, alt }: { src: string; alt: string }) {
  const isVideo = /\.mp4$/i.test(src)
  return (
    <figure className="my-8">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-pax2-surface shadow-e2">
        {isVideo ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={src} poster={src.replace(/\.mp4$/i, ".jpg")} controls playsInline preload="none" className="block aspect-[16/10] w-full bg-slate-100" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} loading="lazy" className="block w-full" />
        )}
      </div>
      {alt && <figcaption className="mt-2.5 text-center text-[13px] text-slate-500">{alt}</figcaption>}
    </figure>
  )
}

const components: Components = {
  // A paragraph holding only a picture is the figure itself: a figure can't sit inside a paragraph.
  p: ({ node, children }) => {
    const only = node?.children.length === 1 ? node.children[0] : null
    if (only && only.type === "element" && only.tagName === "img") return <>{children}</>
    return <p className="mb-5 text-[16px] leading-[1.7] text-slate-700 last:mb-0">{children}</p>
  },
  img: ({ src, alt }) => (typeof src === "string" ? <Figure src={src} alt={alt ?? ""} /> : null),
  h2: ({ children }) => (
    <h2 id={headingId(text(children))} className="mt-14 mb-4 scroll-mt-8 text-[28px] leading-tight font-bold tracking-tight text-slate-900 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => <h3 className="mt-8 mb-3 text-[20px] font-semibold tracking-tight text-slate-900">{children}</h3>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  ul: ({ children }) => <ul className="mb-5 list-disc space-y-2 pl-6 marker:text-slate-400">{children}</ul>,
  ol: ({ children }) => <ol className="mb-5 list-decimal space-y-2.5 pl-6 marker:font-medium marker:text-slate-500">{children}</ol>,
  li: ({ children }) => <li className="pl-1.5 text-[16px] leading-[1.7] text-slate-700">{children}</li>,
  a: ({ href, children }) =>
    href?.startsWith("/") ? (
      <Link href={href} className="font-medium text-pax2-light-blue underline-offset-2 hover:underline">
        {children}
      </Link>
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-pax2-light-blue underline-offset-2 hover:underline">
        {children}
      </a>
    ),
  code: ({ children }) => <code className="rounded-md border border-slate-200 bg-pax2-mist px-1.5 py-0.5 font-mono text-[13px] text-slate-800">{children}</code>,
  blockquote: ({ children }) => (
    <aside className="my-7 flex gap-3.5 rounded-xl bg-pax2-lavender/60 px-5 py-4 [&_p]:mb-0 [&_p]:text-[15px]">
      <Lightbulb aria-hidden className="mt-1 size-[18px] shrink-0 text-pax2-blue" />
      <div className="min-w-0">{children}</div>
    </aside>
  ),
  hr: () => <hr className="my-10 border-slate-200" />,
  table: ({ children }) => (
    <div className="mb-6 overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-left text-[15px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-slate-200 bg-pax2-mist">{children}</thead>,
  th: ({ children }) => <th className="px-4 py-3 text-[13px] font-semibold text-slate-600">{children}</th>,
  tr: ({ children }) => <tr className="border-b border-slate-200 last:border-0">{children}</tr>,
  td: ({ children }) => <td className="px-4 py-3 align-top leading-relaxed text-slate-700">{children}</td>,
}

export function DocMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  )
}
