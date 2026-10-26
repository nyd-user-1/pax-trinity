"use client"

import dynamic from "next/dynamic"

// The bank reads browser-side: the slice's rows fetch into this tab and stay.
const BankSurface = dynamic(() => import("./bank-surface").then((m) => m.BankSurface), { ssr: false })

export function BankClient() {
  return <BankSurface />
}
