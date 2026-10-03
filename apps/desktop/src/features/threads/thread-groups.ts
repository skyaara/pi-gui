import type {
  DesktopAppState,
  SessionRecord,
  ThreadGrouping,
  WorkspaceRecord,
} from "../../../contracts/desktop-state";
import { compareByRecency } from "../../../contracts/thread-recency";

export interface ThreadEnvironmentMeta {
  readonly kind: "local" | "worktree";
  readonly label: string;
  readonly branchName?: string;
  readonly detached?: boolean;
}

export interface ThreadListEntry {
  readonly children?: readonly ThreadListEntry[];
  readonly folderId: string;
  readonly workspaceId: string;
  readonly session: SessionRecord;
  readonly environment: ThreadEnvironmentMeta;
  readonly contextLabel: string;
}

export interface WorkspaceThreadGroup {
  readonly workspace: WorkspaceRecord;
  readonly threads: readonly ThreadListEntry[];
}

export const THREAD_HISTORY_PREVIEW_LIMIT = 5;

export function threadHistoryPreview<T>(
  threads: readonly T[],
  expanded: boolean,
): { readonly visible: readonly T[]; readonly overflow: boolean } {
  const overflow = threads.length > THREAD_HISTORY_PREVIEW_LIMIT;
  return {
    visible: overflow && !expanded ? threads.slice(0, THREAD_HISTORY_PREVIEW_LIMIT) : threads,
    overflow,
  };
}

export interface RecencyThreadSection {
  readonly bucket: "recent";
  readonly label: string;
  readonly threads: readonly ThreadListEntry[];
}

export interface ThreadSidebarModel {
  readonly folders: readonly WorkspaceRecord[];
  readonly workspaceGroups: readonly WorkspaceThreadGroup[];
  readonly pinnedThreads: readonly ThreadListEntry[];
  readonly recencySections: readonly RecencyThreadSection[];
  readonly archivedThreads: readonly ThreadListEntry[];
  readonly recencyOrder: readonly ThreadListEntry[];
}

export function buildThreadSidebarModel(state: DesktopAppState): ThreadSidebarModel {
  const allEntries = collectThreadEntries(state);
  const entries = nestChildThreads(allEntries, state);
  const pinnedThreads = entries
    .filter((entry) => !entry.session.archivedAt && Boolean(entry.session.pinnedAt))
    .sort((left, right) => comparePinnedThreads(left, right, state.pinnedSessionOrder));
  const historyThreads = entries
    .filter((entry) => !entry.session.archivedAt && !entry.session.pinnedAt)
    .sort((left, right) => compareByRecency(left.session, right.session));
  const archivedThreads = entries
    .filter((entry) => Boolean(entry.session.archivedAt))
    .sort((left, right) => compareByRecency(left.session, right.session));
  const recencyOrder = allEntries
    .filter((entry) => !entry.session.archivedAt)
    .sort((left, right) => compareByRecency(left.session, right.session));

  const folders = listFolders(state);
  return {
    folders,
    workspaceGroups: folders.map((workspace) => ({
      workspace,
      threads: historyThreads.filter((entry) => entry.folderId === workspace.id),
    })),
    pinnedThreads,
    recencySections:
      historyThreads.length > 0
        ? [{ bucket: "recent", label: "Recents", threads: historyThreads }]
        : [],
    archivedThreads,
    recencyOrder,
  };
}

function nestChildThreads(entries: ThreadListEntry[], state: DesktopAppState): ThreadListEntry[] {
  const byKey = new Map(entries.map((entry) => [sessionThreadKey(entry), entry]));
  const parents = new Map<string, string>();
  for (const child of state.orchestrationChildren) {
    const childKey = `${child.childWorkspaceId}:${child.childSessionId}`;
    const parentKey = `${child.parentWorkspaceId}:${child.parentSessionId}`;
    const entry = byKey.get(childKey);
    const parent = byKey.get(parentKey);
    if (
      !entry ||
      !parent ||
      entry.session.archivedAt ||
      entry.session.pinnedAt ||
      parent.session.archivedAt
    )
      continue;
    let ancestor: string | undefined = parentKey;
    while (ancestor && ancestor !== childKey) ancestor = parents.get(ancestor);
    if (!ancestor) parents.set(childKey, parentKey);
  }
  const children = new Map<string, ThreadListEntry[]>();
  for (const entry of entries) {
    const parent = parents.get(sessionThreadKey(entry));
    if (parent) children.set(parent, [...(children.get(parent) ?? []), entry]);
  }
  const nest = (entry: ThreadListEntry): ThreadListEntry => ({
    ...entry,
    children: children
      .get(sessionThreadKey(entry))
      ?.sort((a, b) => compareByRecency(a.session, b.session))
      .map(nest),
  });
  return entries.filter((entry) => !parents.has(sessionThreadKey(entry))).map(nest);
}

function listFolders(state: DesktopAppState): readonly WorkspaceRecord[] {
  const workspacesById = new Map(
    state.workspaces.map((workspace) => [workspace.id, workspace] as const),
  );
  const rootWorkspaces = state.workspaces.filter((workspace) => workspace.kind === "primary");
  const orphanWorktrees = state.workspaces.filter(
    (workspace) =>
      workspace.kind === "worktree" && !workspacesById.has(workspace.rootWorkspaceId ?? ""),
  );
  const order = state.workspaceOrder;
  const sortedRoots = [...rootWorkspaces].sort((a, b) => {
    const ai = order.indexOf(a.id);
    const bi = order.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return -1;
    if (bi === -1) return 1;
    return ai - bi;
  });
  return [...sortedRoots, ...orphanWorktrees];
}

function collectThreadEntries(state: DesktopAppState): ThreadListEntry[] {
  const workspacesById = new Map(
    state.workspaces.map((workspace) => [workspace.id, workspace] as const),
  );
  const folders = listFolders(state);
  return folders.flatMap((folder) => {
    if (folder.kind !== "primary") {
      return folder.sessions.map((session) => ({
        folderId: folder.id,
        workspaceId: folder.id,
        session,
        environment: {
          kind: "worktree" as const,
          label: folder.name,
          branchName: folder.branchName,
          detached: !folder.branchName,
        },
        contextLabel: folder.name,
      }));
    }

    const linkedWorkspaces = (state.worktreesByWorkspace[folder.id] ?? [])
      .map((worktree) => ({
        worktree,
        workspace: worktree.linkedWorkspaceId
          ? workspacesById.get(worktree.linkedWorkspaceId)
          : undefined,
      }))
      .filter(
        (
          entry,
        ): entry is {
          worktree: NonNullable<(typeof state.worktreesByWorkspace)[string][number]>;
          workspace: WorkspaceRecord;
        } => Boolean(entry.workspace),
      );

    const standaloneWorkspaces = state.workspaces.filter(
      (workspace) => workspace.kind === "standalone" && workspace.rootWorkspaceId === folder.id,
    );
    return [
      ...standaloneWorkspaces.flatMap((workspace) =>
        workspace.sessions.map((session) => ({
          folderId: folder.id,
          workspaceId: workspace.id,
          session,
          environment: { kind: "local" as const, label: "Local" },
          contextLabel: "No project",
        })),
      ),
      ...folder.sessions.map((session) => ({
        folderId: folder.id,
        workspaceId: folder.id,
        session,
        environment: {
          kind: "local" as const,
          label: "Local",
        },
        contextLabel: folder.name,
      })),
      ...linkedWorkspaces.flatMap(({ workspace, worktree }) =>
        workspace.sessions.map((session) => ({
          folderId: folder.id,
          workspaceId: workspace.id,
          session,
          environment: {
            kind: "worktree" as const,
            label: worktree.name,
            branchName: worktree.branchName,
            detached: !worktree.branchName,
          },
          contextLabel: `${folder.name} / ${worktree.name}`,
        })),
      ),
    ];
  });
}

export function sessionThreadKey(thread: ThreadListEntry): string {
  return `${thread.workspaceId}:${thread.session.id}`;
}

const EMPTY_EXPANDED_HISTORY: ReadonlySet<string> = new Set();

export function workspaceHistoryExpansionKey(workspaceId: string): string {
  return `workspace:${workspaceId}`;
}

export function recencyHistoryExpansionKey(bucket: "recent"): string {
  return `bucket:${bucket}`;
}

export interface VisibleThreadShortcutOptions {
  readonly grouping: ThreadGrouping;
  readonly model: ThreadSidebarModel;
  readonly expandedHistory?: ReadonlySet<string>;
  readonly archivedOpen?: boolean;
  /** Folder groups folded shut in the sidebar; their rows are not on screen. */
  readonly collapsedWorkspaceIds?: readonly string[];
}

export function visibleThreadShortcutOrder(
  options: VisibleThreadShortcutOptions,
): readonly ThreadListEntry[] {
  const expandedHistory = options.expandedHistory ?? EMPTY_EXPANDED_HISTORY;
  const collapsedWorkspaceIds = new Set(options.collapsedWorkspaceIds ?? []);
  const unpinned =
    options.grouping === "workspace"
      ? [
          ...options.model.workspaceGroups
            .filter(
              (group) =>
                !group.workspace.isStandalone && !collapsedWorkspaceIds.has(group.workspace.id),
            )
            .flatMap(
              (group) =>
                threadHistoryPreview(
                  group.threads,
                  expandedHistory.has(workspaceHistoryExpansionKey(group.workspace.id)),
                ).visible,
            ),
          ...options.model.recencySections.flatMap(
            (section) =>
              threadHistoryPreview(
                section.threads.filter((thread) =>
                  options.model.workspaceGroups.some(
                    (group) =>
                      group.workspace.isStandalone && group.workspace.id === thread.folderId,
                  ),
                ),
                expandedHistory.has(recencyHistoryExpansionKey(section.bucket)),
              ).visible,
          ),
        ]
      : options.model.recencySections.flatMap(
          (section) =>
            threadHistoryPreview(
              section.threads,
              expandedHistory.has(recencyHistoryExpansionKey(section.bucket)),
            ).visible,
        );
  const flatten = (entry: ThreadListEntry): ThreadListEntry[] => [
    entry,
    ...(entry.children ?? []).flatMap(flatten),
  ];
  return [
    ...options.model.pinnedThreads,
    ...unpinned,
    ...(options.archivedOpen ? options.model.archivedThreads : []),
  ].flatMap(flatten);
}

export function comparePinnedThreads(
  left: ThreadListEntry,
  right: ThreadListEntry,
  pinnedSessionOrder: readonly string[] = [],
): number {
  const order = new Map(pinnedSessionOrder.map((key, index) => [key, index] as const));
  const leftIndex = order.get(sessionThreadKey(left));
  const rightIndex = order.get(sessionThreadKey(right));
  if (leftIndex !== undefined || rightIndex !== undefined) {
    if (leftIndex === undefined) return 1;
    if (rightIndex === undefined) return -1;
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
  }
  const leftPinnedAt = left.session.pinnedAt ?? "";
  const rightPinnedAt = right.session.pinnedAt ?? "";
  if (leftPinnedAt !== rightPinnedAt) {
    return rightPinnedAt.localeCompare(leftPinnedAt);
  }
  return compareByRecency(left.session, right.session);
}
