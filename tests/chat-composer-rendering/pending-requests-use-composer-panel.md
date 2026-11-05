### Feature: Pending requests use the composer panel

#### Prerequisites
- Start the app from this repository (`pnpm run dev`).
- Open a thread with a runtime capable of issuing approval, tool user-input, and MCP elicitation requests.

#### Steps
1. In both light and dark themes, trigger command, file-change, and permissions approvals in turn.
2. Confirm exactly one active request panel appears above the composer, with no legacy request card in the timeline.
3. Accept an approval, then trigger another and decline or cancel it. Verify the runtime receives each response and the resolved request disappears.
4. Trigger a tool user-input request. Submit an option and a free-text answer; verify the runtime receives the answers.
5. Trigger MCP form and URL elicitation requests. Check required-field validation, submit form values, and exercise decline/cancel.
6. With an empty conversation and a pending request, verify the empty-state prompt stays hidden. With history scrolled upward, verify jump-to-latest remains available.

#### Expected Results
- The composer panel handles approvals, user input, and MCP elicitation without duplicate controls.
- Responses resolve the intended request and allow the turn to continue.
- Request changes preserve conversation scrolling and empty-state behavior.

#### Rollback/Cleanup
- Resolve or cancel remaining requests and restore the original theme.
