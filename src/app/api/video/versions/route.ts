import { NextResponse } from "next/server"

import { currentUser, forbidDemo } from "@/lib/auth"
import { get, list, save, type VersionSource } from "@/lib/video-versions"

// The signed-in person's saved videos (lib/video-versions.ts). GET lists them newest first, or
// ?id=v-<template>-<n> returns one; POST { templateId, props, title?, chatId?, parent?, key? } saves the
// template's next version after its schema passes. Chat saves each pax-video block it draws; the
// Studio's Versions folder reads the list. A demo account reads and never writes.

export const runtime = "nodejs"

export async function GET(req: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 })
  const id = new URL(req.url).searchParams.get("id")
  if (id) {
    const v = await get(user.email, id)
    return v ? NextResponse.json(v) : NextResponse.json({ error: `No version ${id}.` }, { status: 404 })
  }
  return NextResponse.json({ versions: await list(user.email) })
}

const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined)

export async function POST(req: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 })
  try {
    forbidDemo(user)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "The body is not JSON." }, { status: 400 })
  }
  const templateId = text(body.templateId, 80)
  if (!templateId) return NextResponse.json({ error: "templateId is missing." }, { status: 400 })
  const source: VersionSource = body.source === "studio" ? "studio" : "chat"
  const r = await save(user.email, templateId, body.props, {
    source,
    title: text(body.title, 120),
    chatId: text(body.chatId, 120),
    parent: text(body.parent, 120),
    key: text(body.key, 200),
  })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 })
  return NextResponse.json(r.version, { status: r.existing ? 200 : 201 })
}
