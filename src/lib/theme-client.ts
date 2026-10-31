"use client"

import * as React from "react"

import { CUSTOM_KEY, THEME_EVENT, THEME_KEY, themeOf, themeVars, type Custom, type Theme, type ThemeName } from "@/lib/theme"

// The theme in the browser (lib/theme.ts holds the values): putting one on <html>, reading its colours
// for things drawn on a canvas, and telling them to redraw when it changes.

export function savedThemeName(): ThemeName {
  try {
    const n = localStorage.getItem(THEME_KEY)
    return themeOf(n === "pax" ? "pax-light" : n).name
  } catch {
    return themeOf(null).name
  }
}

export function savedCustom(name: ThemeName): Custom {
  try {
    return (JSON.parse(localStorage.getItem(`${CUSTOM_KEY}:${name}`) ?? "{}") as Custom) ?? {}
  } catch {
    return {}
  }
}

/** Puts a theme and its edits on <html>, keeps them in this browser, and tells the page. */
export function applyTheme(theme: Theme, custom: Custom) {
  const root = document.documentElement
  root.setAttribute("data-theme", theme.name)
  root.classList.toggle("dark", theme.dark)
  root.style.colorScheme = theme.dark ? "dark" : "light"
  for (const [k, v] of Object.entries(themeVars(theme, custom))) root.style.setProperty(k, v)
  try {
    localStorage.setItem(THEME_KEY, theme.name)
    localStorage.setItem(`${CUSTOM_KEY}:${theme.name}`, JSON.stringify(custom))
  } catch {}
  window.dispatchEvent(new Event(THEME_EVENT))
}

/** A --t-* value as it stands now (a hex), for a canvas that cannot read CSS variables. */
export function themeToken(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

export const isDarkTheme = () => typeof document !== "undefined" && document.documentElement.classList.contains("dark")

/** A number that changes whenever the theme does: a dependency for anything drawn with its colours. */
export function useThemeVersion(): number {
  const [v, setV] = React.useState(0)
  React.useEffect(() => {
    const bump = () => setV((n) => n + 1)
    window.addEventListener(THEME_EVENT, bump)
    return () => window.removeEventListener(THEME_EVENT, bump)
  }, [])
  return v
}

// The charts were drawn in the light palette's literal colours. retheme() walks a chart's option and puts
// the current theme's colour in place of each one it knows, by the role it plays: ink, rules, grounds,
// brand. The blue ramp of a chart's series runs light end up on a dark theme so its darkest steps show.
const LIGHT_RAMP = ["#0f1b49", "#1a2b64", "#1e3a8a", "#1e45bd", "#2057e0", "#2e71f0", "#448cf7", "#60a5fa"]
const DARK_RAMP = ["#1e45bd", "#2057e0", "#2e71f0", "#448cf7", "#60a5fa", "#7db7fb", "#9ccafc", "#bfdcfd"]

function roleMap(): Record<string, string> {
  const t = (k: string, f: string) => themeToken(`--t-${k}`, f)
  const ink = t("ink", "#0f172a")
  const ink2 = t("ink-2", "#475569")
  const map: Record<string, string> = {
    "#0f172a": ink,
    "#1e293b": ink,
    "#16181d": ink,
    "#334155": ink2,
    "#475569": ink2,
    "#64748b": t("ink-3", "#64748b"),
    "#94a3b8": t("ink-4", "#94a3b8"),
    "#cbd5e1": t("rule-strong", "#cbd5e1"),
    "#e2e8f0": t("rule", "#e2e8f0"),
    "#f1f5f9": t("tint", "#f1f5f9"),
    "#f8fafc": t("tint", "#f8fafc"),
    "#f5f7fb": t("tint", "#f5f7fb"),
    "#fff": t("surface", "#ffffff"),
    "#ffffff": t("surface", "#ffffff"),
    "#1e3a8a": t("accent", "#1e3a8a"),
    "#2563eb": t("accent-2", "#2563eb"),
    "#dbeafe": t("wash", "#dbeafe"),
    "#dc2626": t("negative", "#dc2626"),
    "#16a34a": t("positive", "#16a34a"),
  }
  if (isDarkTheme()) LIGHT_RAMP.forEach((c, i) => (map[c] = DARK_RAMP[i]))
  return map
}

export function retheme<T>(option: T): T {
  if (typeof document === "undefined") return option
  const map = roleMap()
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return map[v.toLowerCase()] ?? v
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
      const out: Record<string, unknown> = {}
      for (const [k, x] of Object.entries(v)) out[k] = walk(x)
      return out
    }
    return v
  }
  return walk(option) as T
}
