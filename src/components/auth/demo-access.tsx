"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { resetTestAccount } from "@/app/test-account-actions"
import { DEMO_ACCOUNTS, DEMO_SIGNIN_EVENT } from "@/lib/demo"

// The quiet corner of the sign-in and sign-up screens: a line that reads like boilerplate and
// opens the three demo logins. A row's click fills both fields and signs in (from /signup, by way of
// /signin). Below them, Reset wipes the sign-up test account (app/test-account-actions.ts) so its
// sign-up can be run again.

export function DemoAccess() {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [reset, setReset] = React.useState<"idle" | "armed" | "busy" | "done" | string>("idle")
  const runReset = async () => {
    if (reset !== "armed") return setReset("armed")
    setReset("busy")
    try {
      await resetTestAccount()
      setReset("done")
    } catch (e) {
      setReset((e as Error).message || "The reset failed.")
    }
  }
  const resetNote = reset === "done" ? "Reset. Sign up with it again." : !["idle", "armed", "busy"].includes(reset) ? reset : null
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])
  return (
    <div ref={ref} className="fixed bottom-4 right-5 z-40">
      {open && (
        <div className="absolute bottom-8 right-0 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-e3">
          <p className="text-sm font-semibold text-slate-900">Demo access</p>
          <div className="mt-3 flex flex-col divide-y divide-slate-100">
            {DEMO_ACCOUNTS.map((a) => (
              <div key={a.email} className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    if (pathname === "/signin") window.dispatchEvent(new CustomEvent(DEMO_SIGNIN_EVENT, { detail: a }))
                    else router.push(`/signin?demo=${encodeURIComponent(a.role.toLowerCase())}`)
                  }}
                  className="group -mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900">{a.role}</span>
                    <span className="block truncate text-xs text-slate-500">{a.line}</span>
                    <span className="tabular mt-1 block font-mono text-[11px] text-slate-600">{a.email}</span>
                    <span className="tabular block font-mono text-[11px] text-slate-600">{a.password}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-pax2-blue px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity group-hover:opacity-90">Use</span>
                </button>
              </div>
            ))}
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">Sign-up test account</p>
              {resetNote && <p className={reset === "done" ? "text-xs text-slate-500" : "text-xs text-pax2-red"}>{resetNote}</p>}
            </div>
            <button
              type="button"
              onClick={runReset}
              disabled={reset === "busy"}
              className="shrink-0 rounded-full border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:border-pax2-red hover:text-pax2-red disabled:opacity-50"
            >
              {reset === "busy" ? "Resetting…" : reset === "armed" ? "Confirm reset" : "Reset"}
            </button>
          </div>
        </div>
      )}
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="text-xs text-slate-400 transition-colors hover:text-slate-600 hover:underline">
        Terms and conditions
      </button>
    </div>
  )
}
