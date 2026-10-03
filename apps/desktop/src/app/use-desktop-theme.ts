import { useEffect, useMemo, useState } from "react";
import type { ThemePresetId } from "../../contracts/desktop-state";
import type { ExtensionViewTheme } from "../features/extensions/extension-view-panel";
import { applyTheme, getActiveTheme, useActiveTheme } from "../ui/active-theme";

export function useDesktopTheme(
  themePresetId: ThemePresetId | undefined,
  enableTransparency: boolean | undefined,
): ExtensionViewTheme {
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    const piApi = window.piApp;
    if (!piApi) return;

    void piApi
      .getResolvedTheme()
      .then((theme) => {
        setResolvedTheme(theme);
      })
      .catch((error: unknown) => {
        console.error("[renderer] getResolvedTheme failed", error);
        // Keep the variant painted at startup so preset changes still apply.
        setResolvedTheme((current) => current ?? getActiveTheme().variant);
      });

    const unsub = piApi.onThemeChanged((theme) => {
      setResolvedTheme(theme);
    });

    return unsub;
  }, []);

  useEffect(() => {
    if (!resolvedTheme || !themePresetId) return;
    applyTheme(themePresetId, resolvedTheme);
  }, [resolvedTheme, themePresetId]);

  useEffect(() => {
    document.documentElement.classList.toggle("enable-transparency", enableTransparency ?? false);
  }, [enableTransparency]);

  const activeTheme = useActiveTheme();
  return useMemo<ExtensionViewTheme>(
    () => ({
      mode: activeTheme.variant,
      background: activeTheme.tokens["--main"] ?? "",
      foreground: activeTheme.tokens["--text"] ?? "",
      accent: activeTheme.tokens["--accent"] ?? "",
    }),
    [activeTheme],
  );
}
