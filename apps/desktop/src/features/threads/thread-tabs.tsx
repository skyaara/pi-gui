import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { WorkspaceSessionTarget } from "../../../contracts/desktop-state";
import { ChevronRightIcon, CloseIcon, PlusIcon, SplitWindowIcon } from "../../ui/icons";
import { threadTabKey } from "./hooks/use-thread-tabs";

interface ThreadTab extends WorkspaceSessionTarget {
  title: string;
  workspaceName: string;
  running: boolean;
  unseen: boolean;
}

export function ThreadTabs({
  tabs,
  selectedKey,
  onSelect,
  onClose,
  onNewThread,
  onSplitWindow,
  actions,
  title,
  onMaximize,
  draftOpen = false,
  draftSelected = false,
  onSelectDraft,
  onCloseDraft,
}: {
  tabs: readonly ThreadTab[];
  selectedKey: string;
  onSelect(target: WorkspaceSessionTarget): void;
  onClose(target: WorkspaceSessionTarget): void;
  onNewThread(): void;
  onSplitWindow?(): void;
  actions?: ReactNode;
  title?: string;
  onMaximize(): void;
  draftOpen?: boolean;
  draftSelected?: boolean;
  onSelectDraft?(): void;
  onCloseDraft?(): void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [edges, setEdges] = useState({ start: true, end: true });
  const measure = () => {
    const element = strip.current;
    if (!element) return;
    setOverflow(element.scrollWidth > element.clientWidth + 1);
    setEdges({
      start: element.scrollLeft <= 1,
      end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 1,
    });
  };
  useEffect(() => {
    const element = strip.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      element.querySelector('[aria-selected="true"]')?.parentElement?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
      measure();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    strip.current?.querySelector('[aria-selected="true"]')?.parentElement?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
    measure();
  }, [selectedKey, tabs.length, overflow, draftOpen, draftSelected]);

  const scroll = (direction: number) =>
    strip.current?.scrollBy({
      left: direction * strip.current.clientWidth * 0.7,
      behavior: "smooth",
    });
  return (
    <div
      className="thread-tabs"
      onDoubleClick={(event) => {
        if (!(event.target instanceof Element) || event.target.closest("button")) return;
        onMaximize();
      }}
    >
      {title && <h1 className="chat-header__title sr-only">{title}</h1>}
      {overflow && (
        <button
          className="thread-tabs__arrow thread-tabs__arrow--left"
          aria-label="Scroll tabs left"
          disabled={edges.start}
          onClick={() => scroll(-1)}
        >
          <ChevronRightIcon />
        </button>
      )}
      <div
        className="thread-tabs__strip"
        role="tablist"
        aria-label="Open threads"
        ref={strip}
        style={{ maxWidth: (tabs.length + (draftOpen ? 1 : 0)) * 240 }}
        onScroll={measure}
        onWheel={(event) => {
          if (overflow && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
            event.currentTarget.scrollLeft += event.deltaY;
          }
        }}
      >
        {tabs.map((tab, index) => {
          const key = threadTabKey(tab);
          const selected = key === selectedKey;
          return (
            <div
              key={key}
              className={`thread-tabs__item${selected ? " thread-tabs__item--selected" : ""}`}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                  onClose(tab);
                }
              }}
            >
              <button
                role="tab"
                className="thread-tabs__tab"
                aria-selected={selected}
                tabIndex={selected || (!selectedKey && index === 0) ? 0 : -1}
                title={`${tab.title} · ${tab.workspaceName}`}
                onClick={() => onSelect(tab)}
                onKeyDown={(event) => {
                  if (event.key === "Delete") {
                    event.preventDefault();
                    onClose(tab);
                    return;
                  }
                  const tabCount = tabs.length + (draftOpen ? 1 : 0);
                  const next =
                    event.key === "ArrowRight"
                      ? (index + 1) % tabCount
                      : event.key === "ArrowLeft"
                        ? (index + tabCount - 1) % tabCount
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? tabCount - 1
                            : -1;
                  if (next < 0) return;
                  event.preventDefault();
                  strip.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
                  if (next === tabs.length) onSelectDraft?.();
                  else onSelect(tabs[next]!);
                }}
              >
                {(tab.running || tab.unseen) && (
                  <span
                    className={`thread-tabs__dot${tab.running ? " thread-tabs__dot--running" : ""}`}
                    aria-label={tab.running ? "Running" : "Unread"}
                  />
                )}
                <span className="thread-tabs__label">{tab.title}</span>
              </button>
              <button
                className="thread-tabs__close"
                aria-label={`Close tab ${tab.title}`}
                onClick={() => onClose(tab)}
              >
                <CloseIcon />
              </button>
            </div>
          );
        })}
        {draftOpen && (
          <div
            className={`thread-tabs__item${draftSelected ? " thread-tabs__item--selected" : ""}`}
          >
            <button
              role="tab"
              aria-selected={draftSelected}
              className="thread-tabs__tab"
              tabIndex={draftSelected || tabs.length === 0 ? 0 : -1}
              onClick={onSelectDraft}
              onKeyDown={(event) => {
                if (event.key === "Delete") {
                  event.preventDefault();
                  onCloseDraft?.();
                  return;
                }
                const next =
                  event.key === "ArrowLeft"
                    ? tabs.length - 1
                    : event.key === "ArrowRight" || event.key === "Home"
                      ? 0
                      : -1;
                if (next < 0 || !tabs[next]) return;
                event.preventDefault();
                strip.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
                onSelect(tabs[next]!);
              }}
            >
              <span className="thread-tabs__label">New thread</span>
            </button>
            <button
              className="thread-tabs__close"
              aria-label="Close new thread tab"
              onClick={onCloseDraft}
            >
              <CloseIcon />
            </button>
          </div>
        )}
      </div>
      {overflow && (
        <button
          className="thread-tabs__arrow"
          aria-label="Scroll tabs right"
          disabled={edges.end}
          onClick={() => scroll(1)}
        >
          <ChevronRightIcon />
        </button>
      )}
      <button
        className="thread-tabs__new"
        aria-label="New thread tab"
        title="New thread"
        onClick={onNewThread}
      >
        <PlusIcon />
      </button>
      {onSplitWindow && (
        <button
          className="thread-tabs__split"
          aria-label="Split into two windows"
          title="Split into two windows"
          onClick={onSplitWindow}
        >
          <SplitWindowIcon />
        </button>
      )}
      <div className="thread-tabs__actions">{actions}</div>
    </div>
  );
}
