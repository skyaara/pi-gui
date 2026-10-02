import { expect, test } from "@playwright/test";
import { getDesktopCommandFromShortcut } from "../../contracts/ipc";
import {
  shortcutAccelerator,
  shortcutLabel,
  validateKeyboardShortcuts,
} from "../../contracts/keyboard-shortcuts";

const chord = (key: string, shift = false, alt = false) => ({ modifier: true, key, shift, alt });

test("custom bindings replace defaults, remove aliases, and can be disabled", () => {
  const overrides = validateKeyboardShortcuts({
    "toggle-sidebar": "Shift+Y",
    "open-new-thread": "",
  });
  expect(getDesktopCommandFromShortcut(chord("y", true), overrides)).toBe("toggle-sidebar");
  expect(getDesktopCommandFromShortcut(chord("b"), overrides)).toBeUndefined();
  expect(getDesktopCommandFromShortcut(chord("n"), overrides)).toBeUndefined();
  expect(getDesktopCommandFromShortcut(chord("o", true), overrides)).toBeUndefined();
  expect(getDesktopCommandFromShortcut(chord("k"), overrides)).toBe("open-command-palette");
  expect(
    getDesktopCommandFromShortcut({ ...chord("y", true), modifier: false }, overrides),
  ).toBeUndefined();
  expect(getDesktopCommandFromShortcut(chord("b"), {})).toBe("toggle-sidebar");
});

test("conflicts and reserved keys are rejected before preferences change", () => {
  expect(() => validateKeyboardShortcuts({ "toggle-sidebar": "K" })).toThrow("Command palette");
  expect(() => validateKeyboardShortcuts({ "toggle-sidebar": "C" })).toThrow("reserved");
  expect(() => validateKeyboardShortcuts({ "toggle-sidebar": "Shift+Shift+B" })).toThrow();
  expect(() => validateKeyboardShortcuts({ unknown: "Y" })).toThrow();
  expect(() => validateKeyboardShortcuts([])).toThrow();
  expect(() => validateKeyboardShortcuts({ "toggle-sidebar": 42 })).toThrow();
  expect(validateKeyboardShortcuts({ "toggle-sidebar": "K", "open-command-palette": "" })).toEqual({
    "toggle-sidebar": "K",
    "open-command-palette": "",
  });
});

test("physical keys work with alternate layouts and labels match native accelerators", () => {
  expect(
    getDesktopCommandFromShortcut(
      { modifier: true, alt: true, shift: true, key: "≈", code: "KeyY" },
      { "toggle-sidebar": "Alt+Shift+Y" },
    ),
  ).toBe("toggle-sidebar");
  expect(shortcutLabel("Alt+Shift+Y", "darwin")).toBe("⌥⇧⌘Y");
  expect(shortcutLabel("Alt+Shift+Y", "win32")).toBe("Ctrl+Alt+Shift+Y");
  expect(shortcutAccelerator("Shift+Comma")).toBe("CommandOrControl+Shift+,");
  expect(shortcutAccelerator("")).toBeUndefined();
});
