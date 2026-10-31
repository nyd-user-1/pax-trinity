"use client"

import * as React from "react"

import { AuthForm, type AuthStep } from "@/components/auth/auth-form"
import TextType from "@/components/text-type"

/** The sign-up heading and form: the heading types Welcome to PAX, and Check your email once the
 *  code is sent. Keyed on its text, so each new heading types from the start.
 *  Before the flow begins, the reader picks Staff or Partner (Brendan, 2026-10-24); the choice is
 *  kept for the flow (the partner branch carries the partner sign-up and its YouTube connect). */
export function SignUpPanel() {
  const [step, setStep] = React.useState<AuthStep>("form")
  const [role, setRole] = React.useState<"staff" | "partner" | null>(null)
  const heading = step === "code" ? "Check your email" : "Welcome to PAX"
  const pick = (r: "staff" | "partner") => {
    setRole(r)
    try {
      sessionStorage.setItem("signup-role", r)
    } catch {}
  }
  return (
    <>
      <div className="mb-8 text-center">
        <TextType key={heading} as="h1" text={heading} loop={false} typingSpeed={70} className="font-display m-0 text-4xl font-normal text-pax2-blue" />
      </div>
      {role === null ? (
        <div className="flex flex-col gap-3">
          <button type="button" onClick={() => pick("staff")} className="rounded-2xl border border-slate-500 bg-pax2-surface px-6 py-5 text-left shadow-e1 transition-shadow hover:shadow-e2">
            <span className="font-display block text-lg text-pax2-blue">Staff</span>
            <span className="mt-1 block text-sm text-slate-500">I work on PAX.</span>
          </button>
          <button type="button" onClick={() => pick("partner")} className="rounded-2xl border border-slate-500 bg-pax2-surface px-6 py-5 text-left shadow-e1 transition-shadow hover:shadow-e2">
            <span className="font-display block text-lg text-pax2-blue">Partner</span>
            <span className="mt-1 block text-sm text-slate-500">I make videos — my sign-up connects my channel.</span>
          </button>
        </div>
      ) : (
        <AuthForm mode="signup" onStep={setStep} />
      )}
    </>
  )
}
