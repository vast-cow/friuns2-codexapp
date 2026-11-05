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

### Feature: Legacy direct-file endpoint retirement

#### Prerequisites
- Run production and development servers separately with a temporary project containing a text file, a subdirectory, and an image.

#### Steps
1. Select the project using the folder picker and navigate into its subdirectory.
2. Open a conversation file link; browse the directory, open the text file, choose Edit file, change its contents, save, and reopen it.
3. Render a local image in conversation markdown and attach both an image and a text file; send the message and reopen the thread.
4. Request `/codex-local-file?path=<absolute-text-file-path>` with GET and HEAD against each server.

#### Expected Results
- Folder selection, conversation navigation, editing, image rendering, and attachment previews/content work through their existing supported endpoints.
- The retired URL never serves the requested local file (the ordinary SPA fallback may respond).

#### Rollback/Cleanup
- Restore the edited fixture and remove temporary files and test messages.
