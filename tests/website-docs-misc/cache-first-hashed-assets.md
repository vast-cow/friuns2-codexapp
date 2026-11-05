# Browser access and retirement of offline caching

## Prerequisites / setup

Build with `pnpm run build` and serve the production UI on localhost or trusted HTTPS.
Use desktop Chrome plus mobile Chrome and Safari (real devices for final release checks).
For upgrade coverage, first serve the previous release on the same origin, register its
`/sw.js`, reload until controlled, and populate its shell and asset caches.

## Actions and expected results

1. Deploy the new build on that origin. Open online and trigger an update check for the existing registration in DevTools. The retirement worker activates, deletes `codexweb-shell-*` and `codexweb-assets-*`, takes control without forcing a reload, and unregisters. Unrelated origin caches remain.
2. Reload and reopen the tab. There is no Service Worker registration/controller, manifest reference, installation metadata, or app-managed Cache Storage. Favicon and Apple touch icon still load.
3. On a clean browser profile, open the HTTPS URL at desktop, 375x812, and 768x1024 sizes, in light and dark themes. Navigate using the sidebar and hash routes, then refresh. The UI remains usable with no registration or manifest request.
4. Sign in using the normal app authentication, load a thread, send a message and observe streaming, attach/open a file, and navigate between threads. Existing behavior must remain unchanged.
5. Reload online and inspect HTTP caching/validators. Ordinary browser caching remains available; no worker intercepts API, WebSocket, file, HTML, or asset requests. Go offline and navigate to a unique uncached URL: no application offline fallback is supplied. Browser HTTP cache/back-forward behavior is browser-managed and is not an offline guarantee.
6. Repeat the upgrade with an old tab open. Its controller becomes the pass-through retirement worker; the next navigation is uncontrolled. No automatic reload interrupts unsaved work. An offline device cannot retire its worker until it reconnects and obtains the update.

## Automated checks and performance

Run `pnpm run test:unit` and `pnpm run build`. The retirement-worker regression verifies selective cache deletion, activation, unregistration, and absence of fetch interception. The startup regression verifies no registration or fetch wrapper.

Keep `public/sw.js` deployed at its existing URL for returning installations; removing it can strand old workers. Reverse proxies must revalidate HTML and this script rather than pinning old responses. Standard server responses retain their HTTP cache validators.

New visits incur no registration, precache, cache lookup, or background revalidation requests. Existing installations perform one bounded pass over legacy cache names during retirement. Warm assets may need HTTP revalidation or download where the old worker served directly from Cache Storage. Hashed filenames and ordinary HTTP validators continue to govern freshness. No API, auth, routing, file, or WebSocket code changes are needed.

## Rollback / cleanup

Restore online mode and remove only test caches/profiles. To roll back, deploy the prior release; it will register its worker again on load. Do not delete unrelated origin storage.
