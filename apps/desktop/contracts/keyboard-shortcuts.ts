import type { DesktopShortcutInput, PiDesktopCommand } from "./ipc";

export interface ShortcutDefinition {
  readonly id: PiDesktopCommand;
  readonly title: string;
  readonly group: string;
  /** The platform modifier (Command / Control) is implicit. */
  readonly binding: string;
}

export const CUSTOMIZABLE_SHORTCUTS: readonly ShortcutDefinition[] = [
  { id: "open-command-palette", title: "Command palette", group: "App", binding: "K" },
  { id: "open-file-palette", title: "Go to file", group: "App", binding: "P" },
  { id: "open-settings", title: "Open settings", group: "App", binding: "Comma" },
  { id: "toggle-sidebar", title: "Toggle sidebar", group: "App", binding: "B" },
  { id: "toggle-side-panel", title: "Toggle side panel", group: "App", binding: "Alt+B" },
  { id: "open-new-thread", title: "New thread", group: "Threads", binding: "N" },
  { id: "rename-thread", title: "Rename thread", group: "Threads", binding: "Shift+R" },
  { id: "archive-thread", title: "Archive thread", group: "Threads", binding: "Shift+A" },
  { id: "toggle-terminal", title: "Toggle terminal", group: "Workbench", binding: "J" },
  { id: "toggle-review", title: "Toggle review", group: "Workbench", binding: "R" },
  ...Array.from({ length: 9 }, (_, index): ShortcutDefinition => ({
    id: `select-recent-thread-${index + 1}` as PiDesktopCommand,
    title: `Switch to recent thread ${index + 1}`,
    group: "Recent threads",
    binding: String(index + 1),
  })),
];

export type KeyboardShortcutOverrides = Readonly<Partial<Record<PiDesktopCommand, string>>>;

const KEY_PATTERN =
  /^(?:[A-Z0-9]|F(?:[1-9]|1[0-2])|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Minus|Equal|Backquote|Space)$/;
const RESERVED = new Set([
  "A",
  "C",
  "X",
  "V",
  "Z",
  "Shift+Z",
  "Y",
  "Q",
  "W",
  "T",
  "F",
  "O",
  "Shift+N",
  "Shift+O",
  "H",
  "M",
  "Alt+I",
  "Shift+I",
  "Alt+J",
  "Space",
  "Alt+Space",
]);

export function shortcutBinding(input: DesktopShortcutInput): string | undefined {
  if (!input.modifier) return undefined;
  let key = input.code?.replace(/^Key/, "").replace(/^Digit/, "");
  if (!key || !KEY_PATTERN.test(key)) {
    key = input.key === "," ? "Comma" : input.key.toUpperCase();
  }
  if (!KEY_PATTERN.test(key)) return undefined;
  return `${input.alt ? "Alt+" : ""}${input.shift ? "Shift+" : ""}${key}`;
}

export function effectiveShortcut(
  id: PiDesktopCommand,
  overrides: KeyboardShortcutOverrides = {},
): string {
  return overrides[id] ?? CUSTOMIZABLE_SHORTCUTS.find((entry) => entry.id === id)?.binding ?? "";
}

export function shortcutLabel(binding: string, platform: NodeJS.Platform): string {
  if (!binding) return "Unassigned";
  const keys: Record<string, string> = {
    Comma: ",",
    Period: ".",
    Slash: "/",
    Semicolon: ";",
    Quote: "'",
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Minus: "−",
    Equal: "=",
    Backquote: "`",
    Space: "Space",
  };
  const parts = binding.split("+");
  const key = parts.at(-1) ?? "";
  return platform === "darwin"
    ? `${parts.includes("Alt") ? "⌥" : ""}${parts.includes("Shift") ? "⇧" : ""}⌘${keys[key] ?? key}`
    : `Ctrl+${parts.includes("Alt") ? "Alt+" : ""}${parts.includes("Shift") ? "Shift+" : ""}${keys[key] ?? key}`;
}

export function validateKeyboardShortcuts(value: unknown): KeyboardShortcutOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid keyboard shortcuts.");
  const result: Partial<Record<PiDesktopCommand, string>> = {};
  for (const [id, binding] of Object.entries(value)) {
    const definition = CUSTOMIZABLE_SHORTCUTS.find((entry) => entry.id === id);
    if (!definition || typeof binding !== "string") throw new Error("Unknown keyboard shortcut.");
    const key = binding.split("+").at(-1) ?? "";
    if (binding && (!KEY_PATTERN.test(key) || !/^(?:Alt\+)?(?:Shift\+)?[^+]+$/.test(binding)))
      throw new Error(
        "Use Command or Control with a letter, number, function key, or punctuation key.",
      );
    if (RESERVED.has(binding))
      throw new Error(
        "That shortcut is reserved for editing, window controls, or another app action.",
      );
    result[definition.id] = binding;
  }
  const assigned = new Map<string, string>();
  for (const definition of CUSTOMIZABLE_SHORTCUTS) {
    const binding = effectiveShortcut(definition.id, result);
    if (!binding) continue;
    const existing = assigned.get(binding);
    if (existing)
      throw new Error(`Already assigned to ${existing}. Change or disable that shortcut first.`);
    assigned.set(binding, definition.title);
  }
  return result;
}

export function overriddenShortcutCommand(
  input: DesktopShortcutInput,
  overrides: KeyboardShortcutOverrides,
): PiDesktopCommand | undefined {
  const binding = shortcutBinding(input);
  if (!binding) return undefined;
  return CUSTOMIZABLE_SHORTCUTS.find((entry) => overrides[entry.id] === binding)?.id;
}

export function commandShortcutLabel(
  id: PiDesktopCommand,
  platform: NodeJS.Platform,
  overrides: KeyboardShortcutOverrides = {},
): string | undefined {
  const binding = effectiveShortcut(id, overrides);
  return binding ? shortcutLabel(binding, platform) : undefined;
}

export function shortcutAccelerator(binding: string): string | undefined {
  if (!binding) return undefined;
  const keys: Record<string, string> = {
    Comma: ",",
    Period: ".",
    Slash: "/",
    Semicolon: ";",
    Quote: "'",
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Minus: "-",
    Equal: "=",
    Backquote: "`",
  };
  const parts = binding.split("+");
  const key = parts.pop() ?? "";
  return ["CommandOrControl", ...parts, keys[key] ?? key].join("+");
}

export function commandShortcutAriaLabel(
  id: PiDesktopCommand,
  platform: NodeJS.Platform,
  overrides: KeyboardShortcutOverrides = {},
): string | undefined {
  return shortcutAccelerator(effectiveShortcut(id, overrides))?.replace(
    "CommandOrControl",
    platform === "darwin" ? "Meta" : "Control",
  );
}
