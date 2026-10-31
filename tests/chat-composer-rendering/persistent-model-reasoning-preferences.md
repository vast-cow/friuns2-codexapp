### Persistent last-used model and per-model reasoning effort

#### Prerequisites/Setup

- Use a disposable browser profile with localStorage enabled and two models A/B offering multiple reasoning levels. Note each model's capability default.
- For provider isolation, configure two providers with an identical model ID and reasoning capabilities.
- Back up `codex-web-local.selected-model-by-context.v1` and `codex-web-local.reasoning-by-provider-model.v1` before editing browser storage.

#### Actions and Expected Results

1. On Home, select A and `high`; select B and `medium`. Switch repeatedly between A and B. The effort dropdown immediately restores the value saved for each model.
2. Reload the page and restart the app server. Home displays B/`medium`; switching to A restores `high`.
3. Select A/`high` in an existing thread. Open Home and select B/`medium`, then revisit the existing thread. Its model remains A and its effort is `high`; Home retains B/`medium`, including after reload.
4. While a different thread remains selected in the sidebar, change Home's model and effort. Home's options/value match the model shown in Home, and the first message sent uses those settings.
5. Select an identical model ID under each provider with different efforts. Switch providers and reload. Each provider restores its own model and effort without adopting the other provider's preference.
6. Remove the reasoning preference key, then reload and switch models. Each model uses its capability default. Repeat with malformed JSON and unsupported saved effort values. The UI remains usable and resolves a supported default; metadata refresh does not overwrite stored values.
7. Temporarily remove a saved model from the available catalog. Refresh model metadata: a usable fallback appears, but saved model/effort preferences stay intact. Restore the catalog and refresh: the saved model/effort return.
8. Navigate unrelated threads, refresh model metadata, and trigger an unsupported-model automatic retry. Provider defaults and saved per-model efforts remain unchanged unless explicitly selected in the UI.
9. Repeat dropdown checks in light and dark themes. Existing custom menus remain readable and the selected effort matches the displayed model.

#### Rollback/Cleanup

- Delete disposable threads and restore the original provider/model/appearance.
- Restore the backed-up storage entries, or remove only the two keys above in the disposable profile.
- Automated and manual tests were not run for this change, as requested. Typecheck/build could not run because `node` is unavailable.

#### Performance audit

- Code-path review: initialization reads one additional localStorage entry. Explicit effort changes serialize the provider/model map and existing model-selection map; model changes use the existing model-selection write. Storage work scales with the number of saved selections, not message history.
- Reasoning resolution uses existing catalog lookup and capability validation; reactive reads perform no storage writes. Automatic catalog refreshes and navigation do not persist reasoning preferences or replace saved model defaults.
- No new requests, polling, network fanout, message payloads, or module dependencies were added. Automatic display fallbacks are pruned alongside removed thread contexts; catalog changes invalidate computed reasoning values.
- Live timings, browser rendering, and bundle sizes were not measured; tests were skipped and this environment has no `node` executable.
