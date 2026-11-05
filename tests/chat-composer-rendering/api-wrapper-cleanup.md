### Feature: API wrapper cleanup preserves active flows

#### Prerequisites
- Start the app with an authenticated runtime and a project containing an editable text file.
- Have enough thread history to load earlier messages.

#### Steps
1. Open a thread, load earlier messages, and switch to another thread.
2. Submit a message and observe streamed notifications and completion.
3. Open a local file through the integrated browser, edit it, and save.
4. Open Skills & Apps and verify supported capabilities remain available.
5. Request a review through the runtime's supported chat/RPC flow and verify the response arrives.

#### Expected Results
- Thread loading, capability detection, notifications, reviews, and file browsing/editing behave as before.
- Compatibility HTTP endpoints listed in `docs/api-wrapper-cleanup.md` remain registered.

#### Rollback/Cleanup
- Revert the test file edit and resolve any outstanding runtime request.
