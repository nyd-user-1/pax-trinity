// Where /consensus leaves a question card for the Inbox to open as a New test:
// one draft in this browser's localStorage, read and cleared when /agentic-inbox loads.
export const PENDING_DRAFT = "pax:inbox:pending-draft"

export type PendingDraft = { to: string[]; subject: string; body: string }

export function leaveDraft(draft: PendingDraft) {
  window.localStorage.setItem(PENDING_DRAFT, JSON.stringify(draft))
}
