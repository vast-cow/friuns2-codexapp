### Feature: Composer without built-in dictation

#### Prerequisites
- Start the app and open an existing or new thread.
- Have a small text file and image available.

#### Steps
1. In light and dark themes, confirm the composer has no microphone, recording timer, waveform, or dictation errors.
2. Open Settings and confirm dictation toggle, auto-send, and language controls are absent.
3. Type a message and submit with Enter; type another and use Send.
4. Attach a text file, then an image, and submit each without typed text.
5. Change model/reasoning settings and verify normal submission remains available.
6. Use operating-system voice input, if available, to enter text into the textarea and submit normally.

#### Expected Results
- Text, file, and image submission work normally; model and reasoning controls remain available.
- The application does not request microphone permission or send transcription requests.
- Connector authentication and attachment uploads retain their existing behavior.

#### Rollback/Cleanup
- Remove test attachments/messages and archive test threads if desired.
