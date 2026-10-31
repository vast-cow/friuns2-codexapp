### Fix: Dark theme Settings controls and Telegram panel

#### Prerequisites
- Run the app from this repository and open Settings.
- Note the current appearance and Telegram settings so they can be restored.

#### Steps
1. Set Appearance to Dark. Inspect the UI language, Provider, and Dictation language controls; open each menu and search for a dictation language. Check selected, hovered, keyboard-focused, and disabled states when available.
2. Expand Telegram. Inspect all labels, inputs, placeholders, help and status text, the notification checkbox, and both action buttons. Tab through the controls and hover the buttons; check disabled and validation error states when available.
3. Repeat at desktop and mobile widths, checking for clipping or overflow.
4. Switch Appearance to Light and repeat the checks. Set Appearance to System and switch the operating system between light and dark preferences.

#### Expected Results
- In Dark appearance, dropdown triggers and Telegram buttons have dark backgrounds, light text, visible borders and focus indicators; menus, search, disabled states, and checkbox remain readable.
- The Telegram panel, fields, help text, and error messages use legible dark surfaces and text. No affected control has an unintended light surface.
- Light appearance retains its existing colors, System follows the system preference, and the layout remains usable at both widths. Settings and Telegram actions retain their existing behavior.

#### Rollback/Cleanup
- Restore the original appearance and any changed settings. Do not save test Telegram credentials or send a test notification unless intended.
