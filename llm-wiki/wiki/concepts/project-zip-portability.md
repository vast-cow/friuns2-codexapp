# Project ZIP Portability

Project ZIP import/export is removed from the application. There is no project/thread export action, archive download/share dialog, home import picker, or archive route/codec. Existing project files, prior ZIP archives and user configuration are untouched.

Project discovery/opening, workspace-root management, historical conversation listing and resumption remain active. The read-only SQLite session-list supplementation is preserved because it is called by ordinary `thread/list`, including for previously imported chats. Session metadata/attachment recovery, archive recovery, streaming and queues remain independent infrastructure.

Source: [current removal boundary](../../raw/features/project-zip-removal.md). The [earlier implementation source](../../raw/features/project-zip-portability.md) is retained as historical material.
