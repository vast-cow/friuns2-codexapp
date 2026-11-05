# User message toolbar alignment

## Setup

Start the current checkout with `pnpm run dev --host 127.0.0.1 --port 4173`.
Install Playwright Chromium if needed with `pnpm exec playwright install chromium`.

## Automated regression

Run `node scripts/test-user-toolbar-layout.cjs`. This mounts the real conversation
component with deterministic history, without sending messages to a provider.
It checks short and wrapped messages, a short bubble with a wider file attachment
and timestamp, and attachment-only messages at 1280x900, 375x812, and 768x1024
in light and dark themes. Toolbar right edges must match the bubble (or the
attachment for attachment-only messages), with space below the content and no
overflow. Assistant toolbars must retain start alignment. Checks repeat after
scrolling and prepending older history; edit emits rollback and copy shows success.
Screenshots are written under `output/playwright/user-toolbar-*.png`.

## Manual integration

1. Open a completed conversation with short, long, and attached user messages.
2. Hover each message or focus its buttons. Confirm Edit message and Copy sit
   below it, aligned with its right edge, without overlapping content.
3. Scroll, load earlier messages, resize between desktop and mobile widths, and
   reopen the thread. Confirm alignment and spacing remain stable.
4. Repeat in light and dark themes. Confirm assistant toolbar placement is unchanged.
5. Copy a message and verify clipboard content. Edit a disposable turn and verify
   the existing rollback/composer flow still works.

## Cleanup

The automated fixture is browser-local and creates no threads or files beyond
screenshots. Close it afterward. Remove disposable manual threads if created.
