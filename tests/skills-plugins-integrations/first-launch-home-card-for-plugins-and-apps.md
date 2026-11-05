### Remove the first-launch Plugins and Apps announcement

#### Feature/Change Name
The home/new-thread route no longer displays the Plugins and Apps announcement card or loads its dismissal preference.

#### Prerequisites/Setup
1. Dev server running at `http://127.0.0.1:4173`.
2. Open browser developer tools with the Network panel recording.
3. Use a fresh profile or a profile with the Codex global-state preference `first-launch-plugins-card-dismissed` unset or `false`.

#### Steps
1. Open `http://127.0.0.1:4173/#/` and inspect the new-chat area.
2. Reload and inspect the new-chat area again.
3. Repeat in light and dark themes.
4. Inspect network requests for `/codex-api/preferences/first-launch-plugins-card`.
5. Confirm the server no longer handles GET/PUT requests to that path (normal unknown-route handling applies).
6. If a disposable profile has an existing dismissal key, exercise thread pinning and confirm the key remains unchanged in `.codex-global-state.json`.
7. Open Skills & Apps from the sidebar and select Plugins.

#### Expected Results
- No `Plugins are here` announcement, integration pills, or announcement action buttons appear, including after reload.
- No GET or PUT request is made for the removed card preference.
- The obsolete preference route has no handler; unrelated global-state writes preserve existing dismissal data.
- The existing Plugins directory remains accessible from the sidebar.

#### Rollback/Cleanup
- Restore the previous theme and any global-state preference changed during setup.
- No preference changes are needed to keep the announcement hidden.

---
