### Completed plan cards expose implement action

#### Feature/Change Name
Completed plan cards show an `Implement plan` button that turns plan mode off and sends an implementation prompt built from the plan content.

#### Prerequisites/Setup
1. Dev server running at `http://127.0.0.1:4173`
2. An existing thread contains a completed persisted plan card
3. The thread composer is available for follow-up messages

#### Steps
1. Open a thread containing a completed plan card
2. Verify the plan card shows `Implement plan` at the bottom
3. Click `Implement plan`
4. Confirm the composer thread switches back to default mode
5. Inspect the next `turn/start` request or the resulting assistant behavior

#### Expected Results
- Completed plan cards render the `Implement plan` action even when the plan body is structured as headings/lists instead of checkbox steps
- Clicking the button sends a simple implementation follow-up message instead of copying the whole plan body into chat
- The next turn runs in default mode rather than plan mode

#### Rollback/Cleanup
- Archive or delete any test thread created only for this check

---

### Copy completed plan cards

#### Feature/Change Name
Copy the contents of an individual completed plan card as Markdown.

#### Prerequisites/Setup
1. Run the app and open a thread with multiple completed plan cards, including a Markdown plan and a structured plan with pending, in-progress, and completed steps. Include a completed card without a turn ID if available.
2. Have an updating plan card and an empty plan card available, and allow clipboard access. Use browser developer tools to simulate clipboard failures for the fallback check.

#### Steps
1. In light theme, copy each completed card and paste into a text editor. Repeat in dark theme.
2. Confirm the clicked button says `Copied`, then returns to `Copy` after about 1.8 seconds. Copy a different card before the timer expires.
3. Check the updating and empty cards. Use the existing response copy button and the `Implement plan` action on a suitable card.
4. Make `navigator.clipboard.writeText` fail and copy a plan; paste the result. Then also make the selection-based copy fail and try again.
5. Copy a plan and navigate away before the success timer expires.

#### Expected Results
- Each paste contains only the selected card's content, without the `Plan` title or button label. Structured steps use `- [ ]`, `- [~]`, and `- [x]`; Markdown-only content is preserved. A turn ID is not required.
- Only the most recently copied card shows `Copied`, for about 1.8 seconds. Both themes remain readable.
- Updating and empty cards have no copy button. Response copy and `Implement plan` continue to work independently.
- Clipboard API failure falls back to selection-based copy. When both methods fail, no success message appears. Navigating away causes no timer errors.

#### Rollback/Cleanup
- Restore any overridden clipboard functions and permissions, clear pasted test content, and archive or delete test threads if needed.

---
