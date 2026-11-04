# Project ZIP management removal

The app no longer exports or imports project ZIP archives. Project/thread export actions, home ZIP import picker, progress/share/download UI, gateway functions, GET/HEAD `/codex-api/project-zip`, POST `/codex-api/project-import`, archive codec/walker, and session-import writers are removed.

Existing project folders, `.codex-project` files, previous ZIP archives, Codex sessions, SQLite databases and global state are not migrated or deleted. Project opening/discovery and workspace-root mutations remain. The read-only `listImportedThreadsFromStateDb` and `mergeImportedThreadsIntoThreadListResult` helpers remain active in normal `thread/list`, preserving previously imported/historical rows and metadata. Session title, attachment/Skills input recovery, archive recovery, thread resume, streaming and queues remain shared infrastructure.

ZIP encoding was implemented locally without an exclusive npm dependency. The unused `unzip` tool and `/imports` directory are removed from the optional reusable Docker test image; SQLite remains for historical listing. Browser profiling trace ZIPs and the separate Codex.app patch backup/restore script remain independent tools.
