import { useEffect, useRef, useState } from "react";
import {
  CUSTOMIZABLE_SHORTCUTS,
  effectiveShortcut,
  shortcutBinding,
  shortcutLabel,
  validateKeyboardShortcuts,
  type KeyboardShortcutOverrides,
  type ShortcutDefinition,
} from "../../../contracts/keyboard-shortcuts";
import type { PiDesktopApi } from "../../../contracts/ipc";
import { trapDialogFocus } from "../../ui/dialog-focus";
import { SettingsGroup, SettingsRow } from "./settings-utils";

/**
 * "Mod" is Cmd on macOS and Ctrl elsewhere; "Ctrl" is Control on every platform.
 * "TabMod" is Control on macOS and Alt elsewhere, the side panel tab modifier.
 */
type KeyModifier = "Ctrl" | "Alt" | "Shift" | "Mod";
type Modifier = KeyModifier | "TabMod";

interface Shortcut {
  readonly title: string;
  readonly modifiers: readonly Modifier[];
  readonly key: string;
}

const STANDARD_SHORTCUTS: readonly Shortcut[] = [
  { title: "New window", modifiers: ["Mod", "Shift"], key: "N" },
  { title: "Cycle through threads", modifiers: ["Ctrl"], key: "Tab" },
  { title: "Find in thread", modifiers: ["Mod"], key: "F" },
  { title: "Send message, or queue it during a run", modifiers: [], key: "Enter" },
  { title: "Steer the running agent", modifiers: ["Mod"], key: "Enter" },
  { title: "New line", modifiers: ["Shift"], key: "Enter" },
  { title: "New terminal tab", modifiers: ["Mod"], key: "T" },
  { title: "Switch to side panel tab", modifiers: ["TabMod"], key: "1–9" },
  { title: "Close workbench tab", modifiers: ["Mod"], key: "W" },
];

// Apple's modifier order is ⌃⌥⇧⌘, matching the menu bar and the command palette hints.
const MAC_MODIFIERS: readonly (readonly [KeyModifier, string])[] = [
  ["Ctrl", "⌃"],
  ["Alt", "⌥"],
  ["Shift", "⇧"],
  ["Mod", "⌘"],
];

function shortcutKeys(platform: NodeJS.Platform, shortcut: Shortcut): readonly string[] {
  const held = shortcut.modifiers.map((modifier): KeyModifier =>
    modifier === "TabMod" ? (platform === "darwin" ? "Ctrl" : "Alt") : modifier,
  );
  if (platform === "darwin") {
    const modifiers = MAC_MODIFIERS.filter(([modifier]) => held.includes(modifier)).map(
      ([, symbol]) => symbol,
    );
    return [...modifiers, shortcut.key === "Enter" ? "↩" : shortcut.key];
  }
  const modifiers = (["Ctrl", "Alt", "Shift"] as const).filter(
    (modifier) => held.includes(modifier) || (modifier === "Ctrl" && held.includes("Mod")),
  );
  return [...modifiers, shortcut.key];
}

export function SettingsShortcutsSection({
  platform,
  overrides,
  onSave,
  onSetRecording,
}: {
  readonly platform: NodeJS.Platform;
  readonly overrides: KeyboardShortcutOverrides;
  readonly onSave: (bindings: KeyboardShortcutOverrides) => Promise<void>;
  readonly onSetRecording: PiDesktopApi["setShortcutRecording"];
}) {
  const [editing, setEditing] = useState<ShortcutDefinition>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const save = async (bindings: KeyboardShortcutOverrides) => {
    validateKeyboardShortcuts(bindings);
    await onSave(bindings);
  };
  const update = (bindings: KeyboardShortcutOverrides) => {
    setPending(true);
    setError(undefined);
    void save(bindings)
      .finally(() => setPending(false))
      .catch((failure: unknown) => {
        setError(failure instanceof Error ? failure.message : "Couldn't save shortcuts.");
      });
  };
  const close = () => {
    setEditing(undefined);
    returnFocus.current?.focus();
  };
  return (
    <>
      <div className="shortcut-settings__intro">
        <button
          className="button button--ghost"
          type="button"
          disabled={pending || Object.keys(overrides).length === 0}
          onClick={() => update({})}
        >
          Reset all shortcuts
        </button>
      </div>
      {error ? (
        <p role="alert" className="error-banner">
          {error}
        </p>
      ) : null}
      <SettingsGroup>
        {CUSTOMIZABLE_SHORTCUTS.map((entry) => (
          <SettingsRow key={entry.id} title={entry.title}>
            <div className="shortcut-settings__actions">
              <kbd className="shortcut-settings__binding">
                {shortcutLabel(effectiveShortcut(entry.id, overrides), platform)}
              </kbd>
              <button
                className="button"
                type="button"
                aria-label={`Change ${entry.title} shortcut`}
                disabled={pending}
                onClick={(event) => {
                  returnFocus.current = event.currentTarget;
                  setEditing(entry);
                }}
              >
                Change
              </button>
              {Object.hasOwn(overrides, entry.id) ? (
                <button
                  className="button"
                  type="button"
                  aria-label={`Reset ${entry.title} shortcut`}
                  disabled={pending}
                  onClick={() => {
                    const next = { ...overrides };
                    delete next[entry.id];
                    update(next);
                  }}
                >
                  Reset
                </button>
              ) : null}
            </div>
          </SettingsRow>
        ))}
      </SettingsGroup>
      <SettingsGroup>
        {STANDARD_SHORTCUTS.map((shortcut) => (
          <SettingsRow key={shortcut.title} title={shortcut.title}>
            <span className="settings-keys">
              {shortcutKeys(platform, shortcut).map((key) => (
                <kbd key={key}>{key}</kbd>
              ))}
            </span>
          </SettingsRow>
        ))}
      </SettingsGroup>
      {editing ? (
        <ShortcutRecorder
          definition={editing}
          platform={platform}
          overrides={overrides}
          onSave={save}
          onSetRecording={onSetRecording}
          onClose={close}
        />
      ) : null}
    </>
  );
}

function ShortcutRecorder({
  definition,
  platform,
  overrides,
  onSave,
  onSetRecording,
  onClose,
}: {
  readonly definition: ShortcutDefinition;
  readonly platform: NodeJS.Platform;
  readonly overrides: KeyboardShortcutOverrides;
  readonly onSave: (bindings: KeyboardShortcutOverrides) => Promise<void>;
  readonly onSetRecording: PiDesktopApi["setShortcutRecording"];
  readonly onClose: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [binding, setBinding] = useState<string>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const capture = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    void onSetRecording(true)
      .then(() => {
        if (active) {
          setReady(true);
          capture.current?.focus();
        }
      })
      .catch(() => {
        if (active) setError("Couldn't start shortcut recording. Close this dialog and try again.");
      });
    return () => {
      active = false;
      void onSetRecording(false).catch(console.error);
    };
  }, [onSetRecording]);
  const persist = (value: string) => {
    setSaving(true);
    setError(undefined);
    void onSave({ ...overrides, [definition.id]: value })
      .then(onClose)
      .finally(() => setSaving(false))
      .catch((failure: unknown) =>
        setError(failure instanceof Error ? failure.message : "Couldn't save shortcut."),
      );
  };
  return (
    <div className="tree-modal-backdrop">
      <div
        className="tree-modal tree-modal--compact shortcut-recorder"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-recorder-title"
        data-shortcut-recorder
        ref={dialog}
        onKeyDownCapture={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            if (!saving) onClose();
            return;
          }
          if (event.key === "Tab" && !event.metaKey && !event.ctrlKey && !event.altKey) {
            trapDialogFocus(event, dialog.current);
            return;
          }
          if (event.target !== capture.current) return;
          event.preventDefault();
          event.stopPropagation();
          if (
            !ready ||
            saving ||
            event.repeat ||
            event.nativeEvent.isComposing ||
            ["Meta", "Control", "Shift", "Alt"].includes(event.key)
          )
            return;
          const modifier =
            platform === "darwin"
              ? event.metaKey && !event.ctrlKey
              : event.ctrlKey && !event.metaKey;
          const next = shortcutBinding({
            modifier,
            shift: event.shiftKey,
            alt: event.altKey,
            key: event.key,
            code: event.code,
          });
          setBinding(undefined);
          if (!next) {
            setError(
              `Hold ${platform === "darwin" ? "Command" : "Control"} and press a letter, number, function key, or punctuation key.`,
            );
            return;
          }
          try {
            validateKeyboardShortcuts({ ...overrides, [definition.id]: next });
            setBinding(next);
            setError(undefined);
          } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Invalid shortcut.");
          }
        }}
      >
        <h2 id="shortcut-recorder-title">{definition.title}</h2>
        <p>Press your new shortcut. Escape cancels.</p>
        <input
          ref={capture}
          autoFocus
          readOnly
          aria-label="Record shortcut"
          value={
            binding
              ? shortcutLabel(binding, platform)
              : ready
                ? "Press a key combination"
                : "Preparing…"
          }
        />
        {error ? (
          <p role="alert" className="error-banner">
            {error}
          </p>
        ) : null}
        <div className="shortcut-recorder__actions">
          <button
            type="button"
            className="button button--ghost"
            disabled={!ready || saving}
            onClick={() => persist("")}
          >
            Remove binding
          </button>
          <button
            type="button"
            className="button button--ghost"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button button--primary"
            disabled={!ready || saving || binding === undefined}
            onClick={() => {
              if (binding !== undefined) persist(binding);
            }}
          >
            {saving ? "Saving…" : "Save shortcut"}
          </button>
        </div>
      </div>
    </div>
  );
}
