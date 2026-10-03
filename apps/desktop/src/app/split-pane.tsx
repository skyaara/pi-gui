import { useEffect, useRef, useState, type RefObject } from "react";
import type { PiDesktopApi } from "../../contracts/ipc";
import type { DesktopAppState } from "../../contracts/desktop-state";

export function useSplitPane(
  api: PiDesktopApi | undefined,
  secondaryPane: boolean,
  snapshot: DesktopAppState | null,
) {
  const sidebarCollapsed = snapshot?.sidebarCollapsed ?? false;
  const suspended = snapshot?.activeView === "settings";
  const [active, setActive] = useState(false);
  const [ratio, setRatio] = useState(0.5);
  const targetRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (secondaryPane || !api) return;
    return api.onSplitChanged(setActive);
  }, [api, secondaryPane]);

  useEffect(() => {
    if (!active || secondaryPane || !api) return;
    if (suspended) {
      void api.setSplitPaneBounds({ x: 0, width: 0 }).catch(console.error);
      return;
    }
    const target = targetRef.current;
    if (!target) return;
    const update = () => {
      const rect = target.getBoundingClientRect();
      void api
        .setSplitPaneBounds({ x: rect.x + 6, width: Math.max(1, rect.width - 6) })
        .catch(console.error);
    };
    const observer = new ResizeObserver(update);
    observer.observe(target);
    update();
    return () => observer.disconnect();
  }, [api, active, ratio, secondaryPane, sidebarCollapsed, suspended]);

  const columns = active
    ? sidebarCollapsed
      ? `minmax(0, ${ratio}fr) minmax(0, ${1 - ratio}fr)`
      : `auto minmax(0, ${ratio}fr) minmax(0, ${1 - ratio}fr)`
    : undefined;

  return { active, columns, shellRef, targetRef, setRatio };
}

export function SplitPaneTarget({
  shellRef,
  targetRef,
  setRatio,
}: {
  shellRef: RefObject<HTMLDivElement | null>;
  targetRef: RefObject<HTMLDivElement | null>;
  setRatio: (update: (value: number) => number) => void;
}) {
  return (
    <div className="split-pane-target" ref={targetRef} data-testid="split-pane-target">
      <div
        className="split-pane-divider"
        role="separator"
        aria-label="Resize split panes"
        aria-orientation="vertical"
        tabIndex={0}
        onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const shell = shellRef.current;
          const main = shell?.querySelector<HTMLElement>(".main");
          if (!shell || !main) return;
          const start = main.getBoundingClientRect().x;
          const available = shell.getBoundingClientRect().right - start;
          setRatio(() => Math.max(0.25, Math.min(0.75, (event.clientX - start) / available)));
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          setRatio((value) =>
            Math.max(0.25, Math.min(0.75, value + (event.key === "ArrowRight" ? 0.05 : -0.05))),
          );
        }}
      />
    </div>
  );
}
