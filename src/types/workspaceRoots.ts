/** Project identity is a canonical local path or, for ordering, a remote ID. */
export type WorkspaceRootsOperation =
  | { type: 'rename'; path: string; label: string }
  | { type: 'reorder'; order: string[] }
  | { type: 'delete'; path: string }
