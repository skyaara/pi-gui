import {
  commandShortcutLabel,
  type KeyboardShortcutOverrides,
} from "../../contracts/keyboard-shortcuts";
import type { ReactNode } from "react";
import { type PiDesktopApi } from "../../contracts/ipc";
import type { ToolRef } from "../../contracts/workbench";
import { BUILTIN_TOOL_ENTRIES } from "../features/workbench/builtin-tools";
import { SidePanelIcon } from "../ui/icons";

interface ThreadTabActionsProps {
  readonly keyboardShortcuts?: KeyboardShortcutOverrides;
  readonly children?: ReactNode;
  readonly api: PiDesktopApi;
  readonly tools?: {
    readonly activeTool: ToolRef | undefined;
    readonly openTool: (tool: ToolRef) => void;
  };
  readonly panelAvailable: boolean;
  readonly panelVisible: boolean;
  readonly onTogglePanel: () => void;
}

export function ThreadTabActions({
  keyboardShortcuts,
  children,
  api,
  tools,
  panelAvailable,
  panelVisible,
  onTogglePanel,
}: ThreadTabActionsProps) {
  return (
    <div className="thread-tab-actions" aria-label="Thread controls">
      {children}
      {tools ? (
        <WorkspacePanelButtons
          activeToolKind={panelVisible ? tools.activeTool?.kind : undefined}
          onOpenTool={tools.openTool}
          onTogglePanel={onTogglePanel}
        />
      ) : null}
      {panelAvailable && !panelVisible ? (
        <div className="shortcut-tooltip-wrap thread-tab-actions__tooltip-wrap">
          <button
            type="button"
            aria-label="Toggle side panel"
            aria-pressed={panelVisible}
            aria-controls="task-workbench"
            data-testid="toggle-side-panel"
            className={`icon-button thread-tab-actions__icon${panelVisible ? " icon-button--active" : ""}`}
            disabled={!panelAvailable}
            onClick={onTogglePanel}
          >
            <SidePanelIcon />
          </button>
          <span className="shortcut-tooltip thread-tab-actions__tooltip" role="tooltip">
            <span>{panelVisible ? "Hide side panel" : "Show side panel"}</span>
            <kbd>{commandShortcutLabel("toggle-side-panel", api.platform, keyboardShortcuts)}</kbd>
          </span>
        </div>
      ) : null}
    </div>
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
    <div className="thread-tab-actions__tools" aria-label="Workspace panels">
      {BUILTIN_TOOL_ENTRIES.map(({ kind, label, Icon }) => {
        const active = activeToolKind === kind;
        return (
          <button
            key={kind}
            type="button"
            className="thread-tab-actions__tool"
            aria-label={`${active ? "Hide" : "Show"} ${label}`}
            aria-pressed={active}
            title={label}
            onClick={() => (active ? onTogglePanel() : onOpenTool({ kind }))}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}
