// The app's themes (Brendan, 2026-10-30): to start, Light and Dark. A theme is a class on <html>
// (`.dark` for Dark, none for Light), the classes src/ui/styles/globals.css already styles. Kept in
// this browser; THEME_SCRIPT runs in the root layout's <head> so a dark page never paints white first.
// The palette and its panel are components/theme/theme-palette.tsx.

export type ThemeName = "light" | "dark"

export const THEMES: { value: ThemeName; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
]

export const THEME_KEY = "pax:theme"
/** The account menu's Theme switch: whether the palette shows. */
export const PANEL_KEY = "pax:theme-panel"

export const THEME_SCRIPT = `try{if(localStorage.getItem("${THEME_KEY}")==="dark"){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark"}}catch(e){}`
