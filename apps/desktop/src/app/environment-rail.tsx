import type { SessionRecord, WorkspaceRecord } from "../../contracts/desktop-state";
import type { ToolRef } from "../../contracts/workbench";
import { DiffIcon, FileIcon, TerminalIcon, WorktreeIcon } from "../ui/icons";

export function EnvironmentRail({
  workspace,
  session,
  onOpenTool,
}: {
  readonly workspace: WorkspaceRecord;
  readonly session: SessionRecord;
  readonly onOpenTool: (tool: ToolRef) => void;
}) {
  const branch = workspace.branchName;
  return (
    <aside className="environment-rail" aria-label="Environment">
      <h2>Environment</h2>
      <div className="environment-rail__row">
        <span className="environment-rail__computer" aria-hidden="true" />
        <span>{workspace.kind === "worktree" ? "Worktree" : "Local"}</span>
      </div>
      <button
        className="environment-rail__row environment-rail__action"
        type="button"
        onClick={() => onOpenTool({ kind: "changes" })}
      >
        <DiffIcon />
        <span>Changes</span>
        <span className="environment-rail__chevron" aria-hidden="true">
          ›
        </span>
      </button>
      <div className="environment-rail__row" title={branch ?? workspace.path}>
        <WorktreeIcon />
        <span className="environment-rail__truncate">{branch ?? workspace.name}</span>
      </div>
      <div className="environment-rail__divider" />
      <div className="environment-rail__caption">Workspace</div>
      <button
        className="environment-rail__row environment-rail__action"
        type="button"
        onClick={() => onOpenTool({ kind: "files" })}
      >
        <FileIcon />
        <span>Files</span>
        <span className="environment-rail__chevron" aria-hidden="true">
          ›
        </span>
      </button>
      <button
        className="environment-rail__row environment-rail__action"
        type="button"
        onClick={() => onOpenTool({ kind: "terminal" })}
      >
        <TerminalIcon />
        <span>Terminal</span>
        <span className="environment-rail__chevron" aria-hidden="true">
          ›
        </span>
      </button>
      <div className="environment-rail__status">
        <span
          className={`environment-rail__status-dot environment-rail__status-dot--${session.status}`}
        />
        <span>
          {session.status === "running"
            ? "Pi running"
            : session.status === "failed"
              ? "Run failed"
              : "Ready"}
        </span>
      </div>
    </aside>
  );
}
