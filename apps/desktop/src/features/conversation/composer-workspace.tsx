import type { ReactNode } from "react";
import type { WorkspaceRecord } from "../../../contracts/desktop-state";
import { FolderIcon, WorktreeIcon } from "../../ui/icons";

export function ComposerWorkspace({
  workspace,
  children,
  controls,
}: {
  workspace: WorkspaceRecord;
  children?: ReactNode;
  controls?: ReactNode;
}) {
  return (
    <div
      className="composer__workspace-row"
      data-testid="composer-workspace"
      title={workspace.path}
    >
      {children ?? (
        <span className="composer__workspace-label">
          <FolderIcon />
          <span>{workspace.name}</span>
        </span>
      )}
      {controls ??
        (workspace.branchName && (
          <span className="composer__workspace-branch">
            <WorktreeIcon />
            <span>{workspace.branchName}</span>
          </span>
        ))}
    </div>
  );
}
