import type { PiDesktopCommand } from "../../../contracts/ipc";
import type { ComponentType, ReactNode } from "react";
import { BUILTIN_TOOL_KINDS, type BuiltinToolKind } from "../../../contracts/workbench";
import { DiffIcon, FileIcon, TerminalIcon } from "../../ui/icons";

interface BuiltinToolDefinition {
  readonly label: string;
  /** Shown in the tool chooser. */
  readonly description: string;
  readonly Icon: ComponentType;
  /** Command that toggles the tool, when it has one. */
  readonly shortcutCommand?: PiDesktopCommand;
}

/** Presentation for every built-in tool; a missing kind fails the build. */
export const BUILTIN_TOOLS = {
  files: { label: "Files", description: "Browse files in this checkout", Icon: FileIcon },
  changes: {
    label: "Review",
    description: "Review uncommitted, branch or turn changes",
    Icon: DiffIcon,
    shortcutCommand: "toggle-review",
  },
  terminal: {
    label: "Terminal",
    description: "Run commands in this task's checkout",
    Icon: TerminalIcon,
    shortcutCommand: "toggle-terminal",
  },
} as const satisfies Record<BuiltinToolKind, BuiltinToolDefinition>;

/** Chooser order follows the contract's kind list. */
export const BUILTIN_TOOL_ENTRIES = BUILTIN_TOOL_KINDS.map(
  (kind): BuiltinToolDefinition & { readonly kind: BuiltinToolKind } => ({
    kind,
    ...BUILTIN_TOOLS[kind],
  }),
);

/** The composition root supplies one panel per built-in tool; rendered only while selected. */
type BuiltinToolPanels = Record<BuiltinToolKind, () => ReactNode>;

/** Requires a panel for every built-in kind, so a new tool cannot silently render nothing. */
export function renderBuiltinToolPanel(
  kind: BuiltinToolKind,
  panels: BuiltinToolPanels,
): ReactNode {
  return panels[kind]();
}
