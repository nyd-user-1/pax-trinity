# No lead-in paragraphs under titles

Never add an explainer paragraph under a page's h1 or a section heading — no "what this page is", no pitch for the content below, no summary of what the reader is about to see. The title and the content carry it. Brendan has deleted every one of these; do not write another, anywhere in this app.

# No "→" arrows

Never put the → character in the UI — not in link text, not after "See more", not anywhere. Brendan deletes every one. A link is styled like a link; that is enough.

# Test in code, not in a browser

Never drive a browser (Playwright, headless Chrome, screenshots, screen recordings) to check what code can check. A default value, a width, a class, a prop, a route's status, a redirect, a data rule: read the code, reason it through, run a unit-level check or curl it, then report it done. A browser run is warranted only when the question is truly visual, a design consideration that reading the code or measuring can't settle, and then say so before starting it. Changing the Studio panel's default from a third of the width to a half is not that (Brendan, 2026-10-31).

# No browser dropdowns

Never use the browser's own select or dropdown (a native <select>). Every menu is the app's own: the DropdownMenu
in @govblock/ui/components/ny4/dropdown-menu (radio items for a choice), the KebabMenu, or a ViewToggle for two or
three options (Brendan, 2026-10-31: a house rule).
