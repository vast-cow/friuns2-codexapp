### Sidebar thread inline delete confirmation and menu pin action

#### Feature/Change Name
Thread rows show an inline delete button that morphs to `Confirm`, while pin/unpin moves to the thread context menu.

#### Prerequisites/Setup
1. Dev server running (`pnpm run dev`)
2. Sidebar contains at least two disposable test threads
3. Light theme and dark theme are available from the appearance switcher

#### Steps
1. In light theme, hover a disposable thread row and verify the left-side action shows a delete icon instead of a pin icon
2. Click the delete icon once and verify it changes to a `Confirm` button without selecting the row
3. Click a different thread row and verify the pending `Confirm` state clears
4. Hover the disposable thread row again, click delete, then click `Confirm`
5. Verify the thread is removed from the sidebar immediately and, if it was pinned, removed from the `Pinned` section too
6. Open another thread row context menu and verify it contains `Pin thread` for an unpinned thread
7. Click `Pin thread`, reopen the same thread menu, and verify it now shows `Unpin thread`
8. Switch to dark theme and repeat steps 1 through 7 with another disposable thread

#### Expected Results
- The inline row action is delete, not pin
- Delete requires two clicks: delete icon, then `Confirm`
- Confirming archives/removes the correct thread immediately from the sidebar and clears any pinned state for that thread
- Pin/unpin is available from the thread context menu and updates the `Pinned` section immediately
- Delete icon, `Confirm` button, and context menu items are readable in both light theme and dark theme

#### Rollback/Cleanup
- Delete or unpin any disposable threads created only for this test

---

### Open sidebar threads in a new tab

#### Prerequisites/Setup
1. Run the app with at least two threads, including a pinned thread and a project thread.
2. Make light and dark themes available and allow user-initiated new tabs.

#### Steps
1. Select one thread, then right-click a different thread in the sidebar.
2. Click `Open in new tab` at the top of the context menu.
3. Verify the new tab opens the right-clicked thread and reload it to confirm the URL still identifies that thread.
4. Return to the original tab and verify its selected thread and URL are unchanged and the menu is closed.
5. Repeat for pinned, project, and regular chat rows, including the currently selected thread and the ellipsis menu.
6. Repeat in dark theme; verify the item text, background, and hover state remain readable in both themes.

#### Expected Results
- Each click opens one tab with the target thread using the existing thread route.
- The original tab does not navigate or reload its thread, and the menu closes.
- Existing menu actions remain available and menu placement accommodates the extra row near the viewport edge.

#### Rollback/Cleanup
- Close the tabs opened during this check and restore the original theme/pin state.
