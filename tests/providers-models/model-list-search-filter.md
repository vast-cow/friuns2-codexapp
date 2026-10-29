### Model List Search / Filter

#### Feature/Change Name
Search/filter input in the model selection dropdown.

#### Prerequisites/Setup
1. Dev server running (`pnpm run dev`)
2. Any provider configured with available models

#### Steps
1. Open any thread or new-thread view
2. Click the model selector button in the composer bar
3. Observe the search input at the top of the dropdown
4. Type a partial model name (e.g., "pickle")
5. Observe filtered results

#### Expected Results
- A text input with placeholder "Search models..." appears at the top of the dropdown
- Typing filters the model list to only matching models (case-insensitive, matches label or value)
- Clearing the search shows all models again
- Pressing Escape clears the search text first, then closes the dropdown on second press
- "No results" shown when no models match the query

#### Rollback/Cleanup
- No permanent changes needed

---

### Model-specific reasoning effort choices

#### Prerequisites/Setup
- Configure models with different `model/list` reasoning capabilities, including
  one without capability metadata and two providers sharing a model ID.

#### Steps
1. In both new and existing threads, open Thinking and switch between models.
2. Select an effort unsupported by the next model, then switch to that model.
3. Switch providers, including a thread whose provider differs from the active config.
4. Send a direct turn and a queued turn in Default and Plan modes.
5. Repeat with an empty/failed model catalog and in light and dark themes.

#### Expected Results
- Choices follow the model's supported order; incompatible choices use its
  supported default, then its first supported effort.
- Missing capabilities show a disabled Model default selector and omit explicit
  effort (collaboration mode uses null).
- Provider switches never reuse another provider's capabilities; stale discovery
  responses do not overwrite current choices. Discovery failure retains the model.
- Direct and queued requests use only confirmed capabilities for their provider.
- The existing themed dropdown remains readable in both themes.

#### Rollback/Cleanup
- Restore the original provider/model configuration and remove any test threads.
