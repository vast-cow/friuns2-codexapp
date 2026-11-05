### Feature: Composer cleanup preserves sidebar usage indicators

#### Prerequisites
- Start the app with `pnpm run dev` and an authenticated Codex runtime.
- Open an existing thread and expand sidebar settings.

#### Steps
1. In light and dark themes, inspect the sidebar Context row and quota indicators before and after a turn completes.
2. Hover the Context row to inspect its token usage tooltip. Verify available quota windows and reset information remain visible.
3. Select a model and reasoning effort, compose a message, and submit it. Verify the selected settings are used and the reply arrives.
4. Open the new-thread screen, select a model, and submit another message.

#### Expected Results
- Sidebar context values and quota indicators reflect available runtime usage data as before.
- Composer layout and controls remain unchanged on existing-thread and new-thread screens.
- Model selection, message drafts, and submission work normally.

#### Rollback/Cleanup
- Restore the original theme and model selection; archive any test thread if desired.
