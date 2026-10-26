import "@xyflow/react/dist/style.css"

import { notFound, redirect } from "next/navigation"

import { currentUser } from "@/lib/auth"

import { SchemaCanvas } from "./schema-canvas"

export const dynamic = "force-dynamic"
export const metadata = { title: "Schema" }

// The audience store on /erd's canvas: its tables, their columns, and the keys between them.

export default async function SchemaPage() {
  const gatekeeper = await currentUser()
  if (!gatekeeper) redirect("/signin?next=/schema")
  if (!gatekeeper.admin) notFound()
  return <SchemaCanvas />
}
