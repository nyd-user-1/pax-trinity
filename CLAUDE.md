# pax-trinity

Follow AGENTS.md: no lead-in paragraphs under titles, no "→" in the UI, and this:

## Test in code, not in a browser

Never drive a browser (Playwright, headless Chrome, screenshots, screen recordings) to check what code can check. A default value, a width, a class, a prop, a route's status, a redirect, a data rule: read the code, reason it through, run a unit-level check or curl it, then report it done. A browser run is warranted only when the question is truly visual, a design consideration that reading the code or measuring can't settle, and then say so before starting it. Changing the Studio panel's default from a third of the width to a half is not that (Brendan, 2026-10-31).
