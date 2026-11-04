# Local Skills integration boundary

Source evidence: `src/server/skillsRoutes.ts`, `src/components/content/SkillsHub.vue`, `src/components/content/DirectoryHub.vue`, and `package.json`.

Only local Skills hub listing, registry search/metadata enrichment, local readme, explicit CLI installation and removal remain. Enable/disable uses normal Codex `skills/config/write`. Registry search metadata may use public GitHub raw-content/avatar URLs without GitHub authentication.

All manual GitHub Skills repository setup/synchronization and its login, device authorization, Firebase popup auth, status/logout, pull/push/startup-sync routes and UI are removed. Firebase and its build allowances are removed because no other active consumer exists. Legacy `skills-sync.json`, GitHub credentials, Skills repositories/files, and AGENTS files are left untouched. Local uninstall no longer rewrites legacy sync metadata. Independent project GitHub cloning, Codex skills integration and Apps/Plugins remain.
