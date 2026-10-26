import type { Metadata } from "next"

import { BankClient } from "./bank-client"

export const metadata: Metadata = { title: "Audience · Normative Database", description: "The reference instrument: what America thinks, in what wording, measured by whom." }

export default function AudiencePage() {
  return <BankClient />
}
