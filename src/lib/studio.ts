// Remotion Studio's address inside PAX, for /studio and the right panel's Studio view. The Studio is a
// static bundle served at /studio-app (src/app/studio-app); it names a composition by query string,
// /studio-app?/v-lift-card-2, not by path.

/** A Remotion composition id: a template (lift-card), a graphic (graphic-checklist), or a saved version (v-lift-card-2). */
export const isCompositionId = (id: unknown): id is string => typeof id === "string" && /^[a-zA-Z0-9-]{1,120}$/.test(id)

export const studioSrc = (id?: string | null) => (id && isCompositionId(id) ? `/studio-app?/${id}` : "/studio-app")

/** Fired on window whenever a video version is saved ({ detail: { id } }), so an open Studio reloads onto it. */
export const VERSIONS_CHANGED = "video-versions:changed"

/** Opens the right panel on the Studio (the shell and the panel listen). */
export const STUDIO_OPEN = "studio:open"

// What the panel should open on when it next mounts or hears STUDIO_OPEN, as Housekeeping's openHousekeeping.
let pending: { id: string | null } | null = null
export const takeStudio = () => {
  const was = pending
  pending = null
  return was
}

/** Opens the right panel's Studio on a composition: a chat video's saved version, or its template. */
export function openStudio(id: string | null) {
  pending = { id: id && isCompositionId(id) ? id : null }
  window.dispatchEvent(new Event(STUDIO_OPEN))
}
