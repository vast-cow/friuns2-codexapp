# Cache First for Vite hashed assets

## Setup

Build and serve a production build on localhost or HTTPS. Use a browser with Service Worker support. Ensure the current worker controls the page; reload after activation if needed. In DevTools, leave Service Worker “Bypass for network” off.

## Actions and expected results

1. Clear this app's Cache Storage, reload online, and inspect `codexweb-assets-v1`. Successful `/assets/<name>-<8-character-hash>.js` and `.css` requests populate the cache.
2. Reload and inspect server request logs: cached hashed files produce no network requests. Switch offline and request the same files: cached responses remain available.
3. Rebuild with a code/style change, deploy, and reload online. The new hashed filename downloads and enters the cache. The old filename never substitutes for the new one.
4. Reload online after an HTML change: navigation fetches fresh HTML. Offline navigation falls back to the shell. Non-hashed scripts/styles still attempt the network first.
5. Exercise an API call and local image/browse/edit endpoint. Neither shell nor asset cache contains these responses.
6. With an older worker installed, deploy this worker and allow activation. Old shell caches are removed; the current shell and asset caches remain. Recent assets survive subsequent worker activation.
7. Load more than 256 distinct hashed assets (automated coverage below). The asset cache retains the newest 256 insertions, while the shell cache remains intact. An evicted asset downloads again online. This bounds retention across deployments without deleting an entire build during normal reloads; offline availability of evicted assets is not guaranteed.

## Automated regression and performance checks

Run `node --test scripts/sw.test.cjs`. The isolated worker harness covers cold/warm JS and CSS, changed hashes, offline fallback, navigation, exclusions, unsuccessful/redirected responses, concurrent trimming, and lifecycle cleanup. It asserts one network call across cold + warm requests, then a second call for a new hash.

Code-path audit: warm hashed requests perform one cache lookup, no network request, no cache enumeration, and no response-body buffering in JavaScript. Successful misses queue one cache write and enumeration; serialized trimming bounds retained entries to 256. Simultaneous misses for the same URL can still fetch independently, as before. Changed filenames invalidate naturally. HTML and API routing retain their prior strategy. Browser timings and transferred bytes were not measured by the harness.

## Cleanup / rollback

Restore online mode. Unregister the worker and clear this app's caches to reset testing. When rolling back, deploy the previous worker and reload after activation; its existing activation cleanup removes the separate asset cache.
