"use client"

import * as React from "react"

import { useShellPanel } from "@/components/shell"
import type { Item } from "@/lib/delivery/types"

import { ItemPanel, type Board } from "./parts"

const KEY = "dashboard:item"

/** The open item, in the shell's right panel: handed again whenever the board's data changes (a write
 *  revalidates the page), taken back when the item goes, and closing the panel lets go of it. */
export function useItemPanel(items: Item[], board: Board, partnerName: (id: string) => string) {
  const [openId, setOpenId] = React.useState<string | null>(null)
  const { openAside, asideKey } = useShellPanel()
  const shown = asideKey === KEY
  const shownRef = React.useRef(shown)
  shownRef.current = shown
  const it = openId ? (items.find((x) => x.id === openId) ?? null) : null
  React.useEffect(() => {
    if (it) openAside({ key: KEY, title: it.title, body: <ItemPanel key={it.id} it={it} partnerName={partnerName(it.partner)} board={board} /> })
    else if (shownRef.current) openAside(null)
    // openAside is the shell's; the body is handed again on what it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [it, board])
  React.useEffect(() => {
    if (!shown) setOpenId(null)
  }, [shown])
  return { openId, open: setOpenId }
}
