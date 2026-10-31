### Copy individual user messages

#### Prerequisites/Setup
Open a thread with multiple user messages, including an editable message, a message without a turn ID, multiline Markdown with a code block, and a message with file and image attachments. Allow clipboard access.

#### Steps
1. In light and dark themes, copy each message and paste into a plain-text editor. Check desktop and touch/mobile layouts.
2. Check that `Copied` appears only on the clicked message and returns to `Copy` after about 1.8 seconds. Copy another message before the timer expires.
3. Use `Edit message` on an eligible message, then separately copy an assistant response.
4. Block the Clipboard API and copy a message to exercise the selection fallback. Then make the fallback fail too and retry.
5. Focus the toolbar with the keyboard and navigate away after a successful copy.

#### Expected Results
- Every user message has a visible or discoverable Copy action, including messages that cannot be edited. Keyboard focus and touch expose the toolbar in both themes.
- The pasted text contains only the selected message's original text, including whitespace, Markdown and code blocks. File and image paths follow the existing `Files:` and `Images:` formatting.
- Successful copies show temporary feedback; failed copies do not. Edit and assistant copy continue to work independently, and navigating away causes no timer errors.

#### Rollback/Cleanup
Restore clipboard permissions and any overridden browser functions; discard pasted content and delete any test thread created for this check.
