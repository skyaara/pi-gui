import { nativeTheme, type BrowserWindow, type WebContents } from "electron";
import { desktopIpc } from "../../contracts/ipc";
import type { ThemeMode } from "../../contracts/desktop-state";

export class ThemeManager {
  private mode: ThemeMode = "system";
  private readonly windows = new Set<BrowserWindow>();
  private readonly panes = new Set<WebContents>();

  constructor() {
    nativeTheme.on("updated", () => {
      this.broadcast();
    });
  }

  trackWindow(win: BrowserWindow) {
    if (win.isDestroyed() || this.windows.has(win)) {
      return;
    }
    this.windows.add(win);
    win.once("closed", () => {
      this.windows.delete(win);
    });
  }

  trackPane(contents: WebContents): void {
    this.panes.add(contents);
    contents.once("destroyed", () => this.panes.delete(contents));
  }

  getMode(): ThemeMode {
    return this.mode;
  }

  getResolvedTheme(): "light" | "dark" {
    if (this.mode === "system") {
      return nativeTheme.shouldUseDarkColors ? "dark" : "light";
    }
    return this.mode;
  }

  setMode(mode: ThemeMode) {
    this.mode = mode;
    if (mode === "system") {
      nativeTheme.themeSource = "system";
    } else {
      nativeTheme.themeSource = mode;
    }
    this.broadcast();
  }

  private broadcast() {
    for (const window of this.windows) {
      if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
        window.webContents.send(desktopIpc.themeChanged, this.getResolvedTheme());
      }
    }
    for (const contents of this.panes) {
      if (!contents.isDestroyed()) contents.send(desktopIpc.themeChanged, this.getResolvedTheme());
    }
  }
}
