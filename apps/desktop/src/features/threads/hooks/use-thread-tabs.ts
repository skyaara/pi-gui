import { useCallback, useEffect, useState } from "react";
import type { DesktopAppState, WorkspaceSessionTarget } from "../../../../contracts/desktop-state";

export const threadTabKey = (target: WorkspaceSessionTarget) =>
  `${target.workspaceId}:${target.sessionId}`;

// Open tabs belong to this window. Sessions and drafts remain owned by the desktop runtime.
export function useThreadTabs(snapshot: DesktopAppState | null) {
  const [targets, setTargets] = useState<WorkspaceSessionTarget[]>([]);
  const open = useCallback((target: WorkspaceSessionTarget) => {
    setTargets((current) =>
      current.some((tab) => threadTabKey(tab) === threadTabKey(target))
        ? current
        : [...current, target],
    );
  }, []);
  const selectedWorkspaceId = snapshot?.selectedWorkspaceId;
  const selectedSessionId = snapshot?.selectedSessionId;
  const activeView = snapshot?.activeView;
  useEffect(() => {
    if (activeView === "threads" && selectedWorkspaceId && selectedSessionId) {
      open({ workspaceId: selectedWorkspaceId, sessionId: selectedSessionId });
    }
  }, [activeView, selectedWorkspaceId, selectedSessionId, open]);

  const workspaces = snapshot?.workspaces;
  useEffect(() => {
    if (!workspaces) return;
    setTargets((current) => {
      const next = current.filter((target) =>
        workspaces.some(
          (workspace) =>
            workspace.id === target.workspaceId &&
            workspace.sessions.some(
              (session) => session.id === target.sessionId && !session.archivedAt,
            ),
        ),
      );
      return next.length === current.length ? current : next;
    });
  }, [workspaces]);

  const tabs = targets.flatMap((target) => {
    const workspace = workspaces?.find((item) => item.id === target.workspaceId);
    const session = workspace?.sessions.find(
      (item) => item.id === target.sessionId && !item.archivedAt,
    );
    return workspace && session
      ? [
          {
            ...target,
            title: session.title,
            workspaceName: workspace.name,
            running: session.status === "running",
            unseen: session.hasUnseenUpdate,
          },
        ]
      : [];
  });
  const close = (target: WorkspaceSessionTarget) => {
    const index = tabs.findIndex((tab) => threadTabKey(tab) === threadTabKey(target));
    const remaining = tabs.filter((tab) => threadTabKey(tab) !== threadTabKey(target));
    setTargets((current) => current.filter((tab) => threadTabKey(tab) !== threadTabKey(target)));
    return remaining[Math.max(0, index - 1)];
  };
  return { tabs, open, close };
}
