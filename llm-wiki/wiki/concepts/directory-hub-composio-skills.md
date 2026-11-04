# Directory Hub and Skills Search

This page documents the current Directory Hub behavior under `#/skills`, with Plugins, Apps, the native Skills tab, and registry-backed Skills search.

## Route Model

- `#/skills` opens the Directory Hub with the `Skills` tab selected by default.
- The active tab is URL-addressable with `?tab=plugins`, `?tab=apps`, or `?tab=skills`.
- The Directory route name remains `Skills`; the inner surface title remains `Skills & Apps`.
- The first-launch Plugins card explicitly opens `?tab=plugins`.

## Skills Tab

The Skills tab is ordered for local use:

1. Find skills registry search.
2. MCP section.
3. Installed skills section.

Important behavior:

- MCPs appear immediately before installed skills.
- Normal tab navigation only lists MCPs; the top-level `Refresh` button is the explicit MCP reload path.
- Installed skill cards are local-first: no repeated `local`, `Installed`, or `Disabled` labels on the card grid.
- Installed card descriptions are parsed from local `SKILL.md` files.
- Installed entries are built concurrently so description reads do not add one round trip per skill.

Local Skills management does not require GitHub authentication. Manual Skills synchronization and Firebase authentication are removed; existing Skills, AGENTS and credential files remain untouched. See the [local Skills source](../../raw/features/local-skills-without-github-sync.md).

## Skills Registry Search

The Find skills panel is backed by the published skills CLI:

- Search runs `npx skills find`.
- Install runs `npx skills add <source> --yes --global`.
- Install success is only valid when a local installed `SKILL.md` path is returned and validates.
- If install does not produce a local path or the post-refresh installed list does not include the skill, the UI treats it as failure.

Search result identity is intentionally hybrid:

- Cards keep registry owner/source details.
- Installed matches get local path/enabled state.
- Opening an installed result switches to the local installed skill detail and actions.
- Search result cards hide the local folder browse icon; local browse remains available in installed skill details.

## Integration boundary

The application-specific Composio integration, CLI automation and automatic developer-specific Skill attachment are removed. Old Composio tab URLs fall back to Skills. Existing external credentials and user Skills remain untouched. See the [implementation source](../../raw/features/directory-composio-removal.md).

## Testing Lessons

Use assertions, not screenshots alone.

Recommended checks:

- `#/skills` defaults to Skills.
- `?tab=` routes to the selected tab.
- Normal Skills navigation does not call MCP reload.
- The refresh button only says `Refreshing...` during explicit manual refresh.
- Installed search results open local detail actions.
- Failed installs do not create installed UI state.
- Light and dark screenshots should include both the Skills page and long installed-skill modal content.


## Related Pages

- [Entity: codex-web-local](../entities/codex-web-local.md)
- [Concept: Skills route UI](./skills-route-ui.md)
- [Overview](../overview.md)
- [Source: Directory Hub Composio and Skills Search](../../raw/features/directory-hub-composio-skills-search.md)
