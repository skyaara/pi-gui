import {
  commandShortcutLabel,
  type KeyboardShortcutOverrides,
} from "../../../contracts/keyboard-shortcuts";
import { SidebarToggleIcon } from "../../ui/icons";

interface SidebarToggleButtonProps {
  readonly collapsed: boolean;
  readonly platform: NodeJS.Platform;
  readonly keyboardShortcuts: KeyboardShortcutOverrides;
  readonly onToggle: () => void;
}

export function SidebarToggleButton({
  collapsed,
  platform,
  keyboardShortcuts,
  onToggle,
}: SidebarToggleButtonProps) {
  const shortcut = commandShortcutLabel("toggle-sidebar", platform, keyboardShortcuts);
  return (
    <div className="shortcut-tooltip-wrap sidebar-toggle">
      <button
        aria-label="Toggle sidebar"
        aria-pressed={!collapsed}
        className="icon-button sidebar-toggle__button"
        data-testid="sidebar-toggle"
        title={collapsed ? "Show sidebar" : "Hide sidebar"}
        type="button"
        onClick={onToggle}
      >
        <SidebarToggleIcon />
      </button>
      <span className="shortcut-tooltip sidebar-toggle__tooltip" role="tooltip">
        <span>{collapsed ? "Show sidebar" : "Hide sidebar"}</span>
        {shortcut ? <kbd>{shortcut}</kbd> : null}
      </span>
    </div>
  );
}
