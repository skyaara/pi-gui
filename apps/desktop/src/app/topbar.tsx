import {
  commandShortcutLabel,
  type KeyboardShortcutOverrides,
} from "../../contracts/keyboard-shortcuts";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import type { AppView, WorkspaceRecord, WorktreeRecord } from "../../contracts/desktop-state";
import { type PiDesktopApi } from "../../contracts/ipc";
import type { ToolRef } from "../../contracts/workbench";
import { BUILTIN_TOOL_ENTRIES } from "../features/workbench/builtin-tools";
import { SidePanelIcon } from "../ui/icons";

interface TopbarProps {
  readonly keyboardShortcuts?: KeyboardShortcutOverrides;
  readonly activeView: AppView;
  readonly sessionTitle?: string;
  readonly children?: ReactNode;
  readonly rootWorkspace: WorkspaceRecord | undefined;
  readonly selectedWorkspace: WorkspaceRecord | undefined;
  readonly selectedWorktree: WorktreeRecord | undefined;
  readonly api: PiDesktopApi;
  readonly tools?: {
    readonly activeTool: ToolRef | undefined;
    readonly openTool: (tool: ToolRef) => void;
  };
  readonly panelAvailable: boolean;
  readonly panelVisible: boolean;
  readonly onTogglePanel: () => void;
}

export function Topbar({
  keyboardShortcuts,
  activeView,
  sessionTitle,
  children,
  rootWorkspace,
  selectedWorkspace,
  selectedWorktree,
  api,
  tools,
  panelAvailable,
  panelVisible,
  onTogglePanel,
}: TopbarProps) {
  const handleDoubleClick = (event: ReactMouseEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.closest(".topbar__actions")) return;
    void api.toggleWindowMaximize().catch((error: unknown) => {
      console.error("[renderer] toggleWindowMaximize failed", error);
    });
  };
  const pageTitle =
    activeView === "skills"
      ? "Skills"
      : activeView === "extensions"
        ? "Extensions"
        : activeView === "scheduled"
          ? "Scheduled tasks"
          : undefined;
  const checkoutLabel =
    selectedWorkspace?.kind === "worktree"
      ? (selectedWorktree?.name ?? selectedWorkspace.branchName ?? selectedWorkspace.name)
      : selectedWorkspace?.branchName;

  return (
    <header className="topbar" data-testid="topbar" onDoubleClick={handleDoubleClick}>
      <div className="topbar__title">
        <span
          className="topbar__workspace"
          title={checkoutLabel ? `${rootWorkspace?.name ?? ""} · ${checkoutLabel}` : undefined}
        >
          {pageTitle ?? rootWorkspace?.name ?? "Get started"}
        </span>
        {sessionTitle ? (
          <>
            <span className="topbar__separator">/</span>
            <h1 className="chat-header__title" title={sessionTitle}>
              {sessionTitle}
            </h1>
          </>
        ) : activeView === "threads" && checkoutLabel ? (
          <>
            <span className="topbar__separator">/</span>
            <span className="topbar__session">{checkoutLabel}</span>
          </>
        ) : activeView === "new-thread" && rootWorkspace ? (
          <>
            <span className="topbar__separator">/</span>
            <span className="topbar__session">New thread</span>
          </>
        ) : null}
      </div>
      <div className="topbar__actions">
        {children}
        {tools ? (
          <WorkspacePanelButtons
            activeToolKind={panelVisible ? tools.activeTool?.kind : undefined}
            onOpenTool={tools.openTool}
            onTogglePanel={onTogglePanel}
          />
        ) : null}
        {panelAvailable && !panelVisible ? (
          <div className="shortcut-tooltip-wrap topbar__tooltip-wrap">
            <button
              type="button"
              aria-label="Toggle side panel"
              aria-pressed={panelVisible}
              aria-controls="task-workbench"
              data-testid="toggle-side-panel"
              className={`icon-button topbar__icon${panelVisible ? " icon-button--active" : ""}`}
              disabled={!panelAvailable}
              onClick={onTogglePanel}
            >
              <SidePanelIcon />
            </button>
            <span className="shortcut-tooltip topbar__tooltip" role="tooltip">
              <span>{panelVisible ? "Hide side panel" : "Show side panel"}</span>
              <kbd>
                {commandShortcutLabel("toggle-side-panel", api.platform, keyboardShortcuts)}
              </kbd>
            </span>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function WorkspacePanelButtons({
  activeToolKind,
  onOpenTool,
  onTogglePanel,
}: {
  readonly activeToolKind?: ToolRef["kind"];
  readonly onOpenTool: (tool: ToolRef) => void;
  readonly onTogglePanel: () => void;
}) {
  return (
    <div className="topbar__tools" aria-label="Workspace panels">
      {BUILTIN_TOOL_ENTRIES.map(({ kind, label, Icon }) => {
        const active = activeToolKind === kind;
        return (
          <button
            key={kind}
            type="button"
            className="topbar__tool"
            aria-label={`${active ? "Hide" : "Show"} ${label}`}
            aria-pressed={active}
            title={label}
            onClick={() => (active ? onTogglePanel() : onOpenTool({ kind }))}
          >
            <Icon />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
