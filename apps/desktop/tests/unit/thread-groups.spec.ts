import { expect, test } from "@playwright/test";
import {
  createEmptyDesktopAppState,
  type DesktopAppState,
  type SessionRecord,
  type WorkspaceRecord,
  type WorktreeRecord,
} from "../../contracts/desktop-state";
import {
  buildThreadSidebarModel,
  recencyHistoryExpansionKey,
  sessionThreadKey,
  threadHistoryPreview,
  visibleThreadShortcutOrder,
  workspaceHistoryExpansionKey,
} from "../../src/features/threads/thread-groups";

function isoDaysAgo(days: number, hour = 12): string {
  return new Date(2026, 8, 21 - days, hour, 0, 0).toISOString();
}

function session(
  id: string,
  title: string,
  extra: Partial<SessionRecord> & { readonly updatedAt: string },
): SessionRecord {
  return {
    id,
    title,
    preview: "",
    status: "idle",
    hasUnseenUpdate: false,
    ...extra,
  };
}

function workspace(
  id: string,
  name: string,
  sessions: readonly SessionRecord[],
  extra: Partial<WorkspaceRecord> = {},
): WorkspaceRecord {
  return {
    id,
    name,
    path: `/tmp/${name}`,
    lastOpenedAt: "2026-01-01T00:00:00.000Z",
    kind: "primary",
    sessions,
    ...extra,
  };
}

function state(
  workspaces: readonly WorkspaceRecord[],
  extra: Partial<DesktopAppState> = {},
): DesktopAppState {
  return {
    ...createEmptyDesktopAppState(),
    workspaces,
    workspaceOrder: workspaces.filter((entry) => entry.kind === "primary").map((entry) => entry.id),
    ...extra,
  };
}

test("combines all ages and projects into one Recents list", () => {
  const model = buildThreadSidebarModel(
    state([
      workspace("alpha", "Alpha", [
        session("today", "Today thread", { updatedAt: isoDaysAgo(0) }),
        session("older", "Older thread", { updatedAt: isoDaysAgo(40) }),
      ]),
      workspace("beta", "Beta", [session("week", "Week thread", { updatedAt: isoDaysAgo(2) })]),
    ]),
  );

  expect(model.folders.map((folder) => folder.name)).toEqual(["Alpha", "Beta"]);
  expect(model.recencySections.map((section) => section.label)).toEqual(["Recents"]);
  expect(model.recencySections[0]?.threads.map((thread) => thread.session.title)).toEqual([
    "Today thread",
    "Week thread",
    "Older thread",
  ]);
  expect(model.recencySections[0]?.threads[1]?.contextLabel).toBe("Beta");
  expect(model.recencyOrder.map((thread) => thread.session.title)).toEqual([
    "Today thread",
    "Week thread",
    "Older thread",
  ]);
});

test("keeps pins out of Recents even when the pin is the latest send", () => {
  const pinned = session("pin", "Pinned recent", {
    updatedAt: isoDaysAgo(8),
    lastInteractedAt: isoDaysAgo(0, 16),
    pinnedAt: isoDaysAgo(1),
  });
  const today = session("today", "Unpinned today", {
    updatedAt: isoDaysAgo(0, 10),
    lastInteractedAt: isoDaysAgo(0, 10),
  });
  const model = buildThreadSidebarModel(state([workspace("alpha", "Alpha", [pinned, today])]));

  expect(model.pinnedThreads.map((thread) => thread.session.title)).toEqual(["Pinned recent"]);
  expect(model.recencySections.map((section) => section.bucket)).toEqual(["recent"]);
  expect(model.recencySections[0]?.threads.map((thread) => thread.session.title)).toEqual([
    "Unpinned today",
  ]);
  expect(model.recencyOrder.map((thread) => thread.session.title)).toEqual([
    "Pinned recent",
    "Unpinned today",
  ]);
  expect(sessionThreadKey(model.recencyOrder[0]!)).toBe("alpha:pin");
});

test("puts a newer unpinned send ahead of an older pin in recencyOrder", () => {
  const pinned = session("pin", "Older pin", {
    updatedAt: isoDaysAgo(8),
    lastInteractedAt: isoDaysAgo(2),
    pinnedAt: isoDaysAgo(1),
  });
  const sent = session("send", "Newer send", {
    updatedAt: isoDaysAgo(0, 16),
    lastInteractedAt: isoDaysAgo(0, 16),
  });
  const model = buildThreadSidebarModel(state([workspace("alpha", "Alpha", [pinned, sent])]));

  expect(model.pinnedThreads.map((thread) => thread.session.title)).toEqual(["Older pin"]);
  expect(model.recencySections[0]?.threads.map((thread) => thread.session.title)).toEqual([
    "Newer send",
  ]);
  expect(model.recencyOrder.map((thread) => thread.session.title)).toEqual([
    "Newer send",
    "Older pin",
  ]);
});

test("excludes archived threads from recencyOrder and Recents", () => {
  const model = buildThreadSidebarModel(
    state([
      workspace("alpha", "Alpha", [
        session("live", "Live", { updatedAt: isoDaysAgo(0) }),
        session("archived", "Archived", {
          updatedAt: isoDaysAgo(0, 18),
          archivedAt: isoDaysAgo(0, 18),
        }),
      ]),
    ]),
  );

  expect(model.archivedThreads.map((thread) => thread.session.title)).toEqual(["Archived"]);
  expect(model.recencyOrder.map((thread) => thread.session.title)).toEqual(["Live"]);
  expect(model.recencySections[0]?.threads.map((thread) => thread.session.title)).toEqual(["Live"]);
});

test("does not let a newer lastViewedAt steal recency from lastInteractedAt", () => {
  const staleOpen = session("stale", "Stale open", {
    updatedAt: isoDaysAgo(3),
    lastInteractedAt: isoDaysAgo(3),
    lastViewedAt: isoDaysAgo(0, 18),
  });
  const recentSend = session("send", "Recent send", {
    updatedAt: isoDaysAgo(0, 8),
    lastInteractedAt: isoDaysAgo(0, 8),
    lastViewedAt: isoDaysAgo(10),
  });
  const model = buildThreadSidebarModel(
    state([workspace("alpha", "Alpha", [staleOpen, recentSend])]),
  );

  expect(model.recencyOrder.map((thread) => thread.session.title)).toEqual([
    "Recent send",
    "Stale open",
  ]);
  expect(model.recencySections.map((section) => section.bucket)).toEqual(["recent"]);
});

test("labels worktree sessions with folder context", () => {
  const root = workspace("root", "Repo", [
    session("local", "Local thread", { updatedAt: isoDaysAgo(0) }),
  ]);
  const worktreeWorkspace = workspace(
    "wt",
    "feature",
    [session("wt-thread", "Worktree thread", { updatedAt: isoDaysAgo(0, 11) })],
    { kind: "worktree", rootWorkspaceId: "root", branchName: "feature" },
  );
  const worktree: WorktreeRecord = {
    id: "wt-record",
    rootWorkspaceId: "root",
    linkedWorkspaceId: "wt",
    name: "feature",
    path: "/tmp/feature",
    status: "ready",
    branchName: "feature",
    updatedAt: isoDaysAgo(0),
  };
  const model = buildThreadSidebarModel(
    state([root, worktreeWorkspace], { worktreesByWorkspace: { root: [worktree] } }),
  );

  const worktreeEntry = model.recencyOrder.find((thread) => thread.session.id === "wt-thread");
  expect(worktreeEntry?.contextLabel).toBe("Repo / feature");
  expect(worktreeEntry?.environment.kind).toBe("worktree");
  expect(worktreeEntry?.folderId).toBe("root");
  expect(
    model.workspaceGroups
      .find((group) => group.workspace.id === "root")
      ?.threads.map((thread) => thread.session.title),
  ).toEqual(["Local thread", "Worktree thread"]);
});

test("sorts a workspace folder by last user message, not catalog updatedAt", () => {
  const opened = session("opened", "Opened recently", {
    updatedAt: isoDaysAgo(0, 18),
    lastInteractedAt: isoDaysAgo(3),
  });
  const sent = session("sent", "Sent earlier today", {
    updatedAt: isoDaysAgo(4),
    lastInteractedAt: isoDaysAgo(0, 9),
  });
  const model = buildThreadSidebarModel(state([workspace("alpha", "Alpha", [opened, sent])]));

  expect(model.workspaceGroups[0]?.threads.map((thread) => thread.session.title)).toEqual([
    "Sent earlier today",
    "Opened recently",
  ]);
});

test("numbers shortcut slots pinned first, then visible rows", () => {
  const olderPin = session("pin", "Older pin", {
    updatedAt: isoDaysAgo(8),
    lastInteractedAt: isoDaysAgo(2),
    pinnedAt: isoDaysAgo(1),
  });
  const newerSend = session("send", "Newer send", {
    updatedAt: isoDaysAgo(0, 16),
    lastInteractedAt: isoDaysAgo(0, 16),
  });
  const hidden = Array.from({ length: 5 }, (_, index) =>
    session(`extra-${index}`, `Extra ${index}`, {
      updatedAt: isoDaysAgo(0, 10 - index),
      lastInteractedAt: isoDaysAgo(0, 10 - index),
    }),
  );
  const week = session("week", "Week thread", {
    updatedAt: isoDaysAgo(3),
    lastInteractedAt: isoDaysAgo(3),
  });
  const archived = session("archived", "Archived", {
    updatedAt: isoDaysAgo(0, 18),
    lastInteractedAt: isoDaysAgo(0, 18),
    archivedAt: isoDaysAgo(0, 18),
  });
  const model = buildThreadSidebarModel(
    state([workspace("alpha", "Alpha", [olderPin, newerSend, ...hidden, week, archived])], {
      pinnedSessionOrder: ["alpha:pin"],
    }),
  );

  expect(model.recencyOrder[0]?.session.title).toBe("Newer send");
  expect(
    visibleThreadShortcutOrder({ grouping: "time", model }).map((thread) => thread.session.title),
  ).toEqual(["Older pin", "Newer send", "Extra 0", "Extra 1", "Extra 2", "Extra 3"]);
  expect(
    visibleThreadShortcutOrder({
      grouping: "time",
      model,
      expandedHistory: new Set([recencyHistoryExpansionKey("recent")]),
    }).map((thread) => thread.session.title),
  ).toEqual([
    "Older pin",
    "Newer send",
    "Extra 0",
    "Extra 1",
    "Extra 2",
    "Extra 3",
    "Extra 4",
    "Week thread",
  ]);
  expect(
    visibleThreadShortcutOrder({ grouping: "time", model, archivedOpen: true }).at(-1)?.session
      .title,
  ).toBe("Archived");
});

test("numbers workspace rows after pins, skipping collapsed overflow", () => {
  const pin = session("pin", "Pinned", {
    updatedAt: isoDaysAgo(1),
    lastInteractedAt: isoDaysAgo(1),
    pinnedAt: isoDaysAgo(0),
  });
  const alphaThreads = Array.from({ length: 6 }, (_, index) =>
    session(`a-${index}`, `Alpha ${index}`, {
      updatedAt: isoDaysAgo(0, 12 - index),
      lastInteractedAt: isoDaysAgo(0, 12 - index),
    }),
  );
  const beta = session("b", "Beta thread", {
    updatedAt: isoDaysAgo(0, 8),
    lastInteractedAt: isoDaysAgo(0, 8),
  });
  const model = buildThreadSidebarModel(
    state(
      [workspace("alpha", "Alpha", [pin, ...alphaThreads]), workspace("beta", "Beta", [beta])],
      { pinnedSessionOrder: ["alpha:pin"] },
    ),
  );

  expect(
    visibleThreadShortcutOrder({ grouping: "workspace", model }).map(
      (thread) => thread.session.title,
    ),
  ).toEqual(["Pinned", "Alpha 0", "Alpha 1", "Alpha 2", "Alpha 3", "Alpha 4", "Beta thread"]);
  expect(
    visibleThreadShortcutOrder({
      grouping: "workspace",
      model,
      expandedHistory: new Set([workspaceHistoryExpansionKey("alpha")]),
    }).map((thread) => thread.session.title),
  ).toEqual([
    "Pinned",
    "Alpha 0",
    "Alpha 1",
    "Alpha 2",
    "Alpha 3",
    "Alpha 4",
    "Alpha 5",
    "Beta thread",
  ]);
});

test("numbers workspace rows only for folders that are open", () => {
  const alpha = session("a", "Alpha thread", {
    updatedAt: isoDaysAgo(0, 12),
    lastInteractedAt: isoDaysAgo(0, 12),
  });
  const beta = session("b", "Beta thread", {
    updatedAt: isoDaysAgo(0, 8),
    lastInteractedAt: isoDaysAgo(0, 8),
  });
  const model = buildThreadSidebarModel(
    state([workspace("alpha", "Alpha", [alpha]), workspace("beta", "Beta", [beta])]),
  );

  expect(
    visibleThreadShortcutOrder({
      grouping: "workspace",
      model,
      collapsedWorkspaceIds: ["alpha"],
    }).map((thread) => thread.session.title),
  ).toEqual(["Beta thread"]);
  // Recents has no folders to fold, so every row stays numbered.
  expect(
    visibleThreadShortcutOrder({
      grouping: "time",
      model,
      collapsedWorkspaceIds: ["alpha"],
    }).map((thread) => thread.session.title),
  ).toEqual(["Alpha thread", "Beta thread"]);
});

test("numbers visible rows in order when nothing is pinned", () => {
  const model = buildThreadSidebarModel(
    state([
      workspace("alpha", "Alpha", [
        session("today", "Today thread", { updatedAt: isoDaysAgo(0) }),
        session("older", "Older thread", { updatedAt: isoDaysAgo(40) }),
      ]),
    ]),
  );

  expect(
    visibleThreadShortcutOrder({ grouping: "time", model }).map((thread) => thread.session.title),
  ).toEqual(["Today thread", "Older thread"]);
});

test("caps a history list at five until it is expanded", () => {
  const threads = ["1", "2", "3", "4", "5", "6"];
  expect(threadHistoryPreview(threads, false)).toEqual({
    visible: ["1", "2", "3", "4", "5"],
    overflow: true,
  });
  expect(threadHistoryPreview(threads, true).visible).toEqual(threads);
  expect(threadHistoryPreview(threads.slice(0, 5), false).overflow).toBe(false);
});

test("child threads nest once, retain keyboard order, and stay reachable when their parent is archived", () => {
  const updatedAt = isoDaysAgo(0);
  const relation = {
    id: "worker",
    parentWorkspaceId: "alpha",
    parentSessionId: "parent",
    childWorkspaceId: "alpha",
    childSessionId: "child",
    title: "Worker",
    goal: "Review",
    status: "running" as const,
    latestTranscript: "",
    transcript: [],
    evidence: [],
    createdAt: updatedAt,
    updatedAt,
  };
  const makeState = (
    parentExtra: Partial<SessionRecord> = {},
    childExtra: Partial<SessionRecord> = {},
  ) =>
    state(
      [
        workspace("alpha", "Alpha", [
          session("parent", "Parent", { updatedAt, ...parentExtra }),
          session("child", "Child", { updatedAt, ...childExtra }),
        ]),
      ],
      { orchestrationChildren: [relation] },
    );
  const model = buildThreadSidebarModel(makeState());
  expect(model.workspaceGroups[0]!.threads.map((entry) => entry.session.id)).toEqual(["parent"]);
  expect(model.workspaceGroups[0]!.threads[0]!.children?.map((entry) => entry.session.id)).toEqual([
    "child",
  ]);
  expect(
    visibleThreadShortcutOrder({ model, grouping: "workspace" }).map((entry) => entry.session.id),
  ).toEqual(["parent", "child"]);
  const archivedParent = buildThreadSidebarModel(makeState({ archivedAt: updatedAt }));
  expect(archivedParent.workspaceGroups[0]!.threads.map((entry) => entry.session.id)).toEqual([
    "child",
  ]);
  const pinnedChild = buildThreadSidebarModel(makeState({}, { pinnedAt: updatedAt }));
  expect(pinnedChild.pinnedThreads.map((entry) => entry.session.id)).toEqual(["child"]);
  expect(pinnedChild.workspaceGroups[0]!.threads[0]!.children).toBeUndefined();
  const cyclic = makeState();
  const cyclicModel = buildThreadSidebarModel({
    ...cyclic,
    orchestrationChildren: [
      relation,
      { ...relation, id: "reverse", parentSessionId: "child", childSessionId: "parent" },
    ],
  });
  expect(visibleThreadShortcutOrder({ model: cyclicModel, grouping: "workspace" })).toHaveLength(2);
});
