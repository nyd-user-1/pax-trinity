import Link from "next/link"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

// A doc's markdown, rendered on the server so the article ships no script. Its own dress rather than the
// chat's (components/chat/markdown.tsx), which reads the chat root's color variables.

const components: Components = {
  p: ({ children }) => <p className="mb-4 text-[15px] leading-relaxed text-slate-700 last:mb-0">{children}</p>,
  h2: ({ children }) => <h2 className="mt-9 mb-3 text-[17px] font-semibold text-slate-900 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-6 mb-2 text-[15px] font-semibold text-slate-900">{children}</h3>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  ul: ({ children }) => <ul className="mb-4 list-disc space-y-1.5 pl-5 marker:text-slate-300">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 list-decimal space-y-2 pl-5 marker:text-slate-400">{children}</ol>,
  li: ({ children }) => <li className="pl-1 text-[15px] leading-relaxed text-slate-700">{children}</li>,
  a: ({ href, children }) =>
    href?.startsWith("/") ? (
      <Link href={href} className="font-medium text-pax2-light-blue hover:underline">
        {children}
      </Link>
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-pax2-light-blue hover:underline">
        {children}
      </a>
    ),
  code: ({ children }) => <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-800">{children}</code>,
  table: ({ children }) => (
    <div className="mb-5 overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-slate-200 bg-slate-50">{children}</thead>,
  th: ({ children }) => <th className="px-4 py-2.5 text-[13px] font-semibold text-slate-600">{children}</th>,
  tr: ({ children }) => <tr className="border-b border-slate-100 last:border-0">{children}</tr>,
  td: ({ children }) => <td className="px-4 py-2.5 text-slate-700">{children}</td>,
}

export function DocMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  )
}
