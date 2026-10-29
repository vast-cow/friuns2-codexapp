# Projects, Sidebar, and New Chat

Home route, project picker, sidebar organization, new-chat setup, projectless folders, and project/worktree shell behavior.

Return to the [manual test index](../../tests.md).

## Test Sections

| Section |
| --- |
| [Feature: Project recency sort, pins, and mobile move mode](project-recency-sort-pins-and-mobile-move-mode.md) |
| [Feature: Projectless new chat folders](projectless-new-chat-folders.md) |
| [Feature: Unified create project and GitHub clone modal](unified-create-project-and-github-clone-modal.md) |
| [Feature: Project menu Export Project ZIP share](project-menu-save-project-zip.md) |
| [Feature: Empty project new thread action](empty-project-new-thread-action.md) |
| [Feature: Remove GitHub trending projects from the new-thread screen](remove-github-trending-projects-from-the-new-thread-screen.md) |
| [Feature: Runtime selector uses a toggle-style control](runtime-selector-uses-a-toggle-style-control.md) |
| [Feature: Revert new-project folder-browser flow to inline add flow](revert-new-project-folder-browser-flow-to-inline-add-flow.md) |
| [Feature: Frontend missing-entry 404 page auto-redirects to chat](frontend-missing-entry-404-page-auto-redirects-to-chat.md) |
| [Editable current folder path in the folder picker](editable-current-folder-path-in-the-folder-picker.md) |
| [Expandable Projects, Pinned, and Chats sidebar sections](expandable-projects-pinned-and-chats-sidebar-sections.md) |
| [Sidebar chats show more projectless chats](sidebar-chats-show-more-projectless-chats.md) |
| [Projectless new chat folder collisions](projectless-new-chat-folder-collisions.md) |
| [Sidebar sessions survive symlinked workspace roots](sidebar-sessions-survive-symlinked-workspace-roots.md) |
| [Sidebar scroll position survives collapse](sidebar-scroll-position-survives-collapse.md) |
| [Toolbar new thread keeps active project](toolbar-new-thread-keeps-active-project.md) |

## Compact Skills and Automations toolbar actions

- Setup: Open the app with the sidebar expanded.
- Actions: Click the Skills and Automations icons beside Search; repeat with keyboard navigation and on mobile. Check both light and dark themes.
- Expected: Each icon opens its matching route, exposes a translated label and tooltip, and marks the active route with `aria-current="page"` and active styling. Mobile navigation closes the sidebar. The previous full-width cards are absent; search and new-thread actions still work.
- Cleanup: Return to the home route and restore the original theme. No persistent data is changed.
