import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CheckIcon, ChevronDownIcon, ModelIcon, SearchIcon } from "../../ui/icons";
import type { RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import {
  buildModelOptions,
  MODEL_OPTIONS_EMPTY_TITLE,
  buildThinkingOptions,
  resolveThinkingLevel,
  searchModelOptions,
  type ComposerModelOption,
} from "./composer-commands";

import { ProviderIcon } from "../../ui/provider-icon";

interface ModelSelectorProps {
  readonly runtime: RuntimeSnapshot | undefined;
  readonly provider: string | undefined;
  readonly modelId: string | undefined;
  readonly thinkingLevel: string | undefined;
  readonly disabled?: boolean;
  readonly dropdownPlacement?: "above" | "below";
  readonly showEmptyModelControl?: boolean;
  readonly unselectedModelLabel?: string;
  readonly emptyModelLabel?: string;
  readonly emptyModelTitle?: string;
  readonly selectionHint?: string;
  readonly onSetModel: (provider: string, modelId: string) => void;
  readonly onSetThinking: (level: string) => void;
  readonly fastMode?: boolean;
  readonly onSetFastMode?: (enabled: boolean) => void;
}

type OpenDropdown = "none" | "model" | "thinking";

export function ModelSelector({
  runtime,
  provider,
  modelId,
  thinkingLevel,
  disabled,
  dropdownPlacement = "above",
  showEmptyModelControl = false,
  unselectedModelLabel = "Choose model",
  emptyModelLabel = "Choose model",
  emptyModelTitle = MODEL_OPTIONS_EMPTY_TITLE,
  selectionHint,
  onSetModel,
  onSetThinking,
  fastMode = false,
  onSetFastMode,
}: ModelSelectorProps) {
  const [open, setOpen] = useState<OpenDropdown>("none");
  const [modelFilter, setModelFilter] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string | undefined>();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const modelOptions = useMemo(
    () => buildModelOptions(runtime, { providerId: provider, modelId }),
    [runtime, provider, modelId],
  );
  const filteredModels = useMemo(
    () => searchModelOptions(modelOptions, modelFilter, runtime),
    [modelOptions, modelFilter, runtime],
  );

  const providers = useMemo(
    () => [...new Set(modelOptions.map((option) => option.providerId))],
    [modelOptions],
  );
  const groupedModels = useMemo(
    () =>
      groupByProvider(
        filteredModels.filter(
          (option) => !selectedProvider || option.providerId === selectedProvider,
        ),
      ),
    [filteredModels, selectedProvider],
  );
  const activeModel = runtime?.models.find(
    (model) => model.providerId === provider && model.modelId === modelId,
  );
  const thinkingOptions = buildThinkingOptions(activeModel);
  const effectiveThinkingLevel = resolveThinkingLevel(activeModel, thinkingLevel);
  const providerLabel = (id: string) =>
    runtime?.providers.find((entry) => entry.id === id)?.name ?? id;
  const hasAvailableModelOptions = modelOptions.length > 0;
  const hasModelControl = Boolean(provider && modelId) || hasAvailableModelOptions;
  const shouldRenderModelControl = hasModelControl || showEmptyModelControl;
  const modelBadgeLabel =
    provider && modelId
      ? (activeModel?.label ?? modelId)
      : hasAvailableModelOptions
        ? unselectedModelLabel
        : emptyModelLabel;
  const noMatchingModels =
    hasAvailableModelOptions && modelFilter.trim().length > 0 && groupedModels.length === 0;

  useEffect(() => {
    if (open === "none") {
      setModelFilter("");
      setSelectedProvider(undefined);
      return undefined;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen("none");
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen("none");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (open === "none") return;
    const position = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 14;
      const above = rect.top - 14;
      const placeBelow =
        dropdownPlacement === "below"
          ? below >= 220 || below > above
          : above < 220 && below > above;
      const width = Math.min(open === "model" ? 380 : 300, window.innerWidth - 24);
      setDropdownStyle({
        position: "fixed",
        width,
        minWidth: 0,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top: placeBelow ? rect.bottom + 6 : undefined,
        bottom: placeBelow ? "auto" : window.innerHeight - rect.top + 6,
        maxHeight: Math.max(80, Math.min(380, placeBelow ? below : above)),
        margin: 0,
        zIndex: 200,
      });
    };
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open, dropdownPlacement]);

  if (!shouldRenderModelControl && !effectiveThinkingLevel) {
    return null;
  }

  return (
    <span
      className="model-selector"
      ref={containerRef}
      onKeyDown={(event) => {
        if (open === "none") return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setOpen("none");
          triggerRef.current?.focus();
          return;
        }
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        const items = Array.from(
          containerRef.current?.querySelectorAll<HTMLButtonElement>(".model-selector__item") ?? [],
        );
        if (!items.length) return;
        event.preventDefault();
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        items[
          index < 0
            ? event.key === "ArrowDown"
              ? 0
              : items.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length
        ]?.focus();
      }}
    >
      {shouldRenderModelControl ? (
        <span className="model-selector__anchor">
          <button
            className="model-selector__badge"
            type="button"
            disabled={disabled}
            aria-label={provider && modelId ? `${provider}:${modelId}` : modelBadgeLabel}
            aria-expanded={open === "model"}
            aria-haspopup="dialog"
            title={provider && modelId ? `${provider}:${modelId}` : undefined}
            onClick={(event) => {
              triggerRef.current = event.currentTarget;
              setOpen(open === "model" ? "none" : "model");
            }}
          >
            <ProviderIcon provider={provider} />
            <span className="model-selector__current-label">{modelBadgeLabel}</span>
            <ChevronDownIcon />
          </button>
          {open === "model" ? (
            <div
              className={`model-selector__dropdown ${dropdownPlacement === "below" ? "model-selector__dropdown--below" : ""}`}
              role="dialog"
              aria-label="Choose model"
              style={dropdownStyle}
              onWheel={(event) => event.stopPropagation()}
            >
              <div className="model-selector__layout">
                <nav className="model-selector__providers" aria-label="Model providers">
                  <button
                    type="button"
                    className="model-selector__provider"
                    aria-label="All providers"
                    aria-pressed={!selectedProvider}
                    title="All providers"
                    onClick={() => {
                      setSelectedProvider(undefined);
                      searchRef.current?.focus();
                    }}
                  >
                    <ModelIcon />
                  </button>
                  {providers.map((providerId) => (
                    <button
                      key={providerId}
                      type="button"
                      className="model-selector__provider"
                      aria-label={providerLabel(providerId)}
                      aria-pressed={selectedProvider === providerId}
                      title={providerLabel(providerId)}
                      onClick={() => {
                        setSelectedProvider(providerId);
                        searchRef.current?.focus();
                      }}
                    >
                      <ProviderIcon provider={providerId} />
                    </button>
                  ))}
                </nav>
                <div className="model-selector__content">
                  <div className="model-selector__filter">
                    <SearchIcon />
                    <input
                      ref={searchRef}
                      className="model-selector__filter-input"
                      aria-label="Search models"
                      placeholder="Search models..."
                      value={modelFilter}
                      onChange={(event) => setModelFilter(event.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="model-selector__results">
                    {groupedModels.map((group, index) => (
                      <div key={`${group.provider}:${index}`}>
                        <div className="model-selector__group-title">
                          {providerLabel(group.provider)}
                        </div>
                        {group.items.map((option) => {
                          const isActive =
                            option.providerId === provider && option.modelId === modelId;
                          const model = runtime?.models.find(
                            (entry) =>
                              entry.providerId === option.providerId &&
                              entry.modelId === option.modelId,
                          );
                          return (
                            <button
                              className={`model-selector__item${isActive ? " model-selector__item--active" : ""}`}
                              key={`${option.providerId}:${option.modelId}`}
                              type="button"
                              aria-pressed={isActive}
                              onClick={() => {
                                if (!isActive) onSetModel(option.providerId, option.modelId);
                                setOpen("none");
                                triggerRef.current?.focus();
                              }}
                            >
                              <span className="model-selector__item-copy">
                                <span className="model-selector__item-label">
                                  {model?.label ?? option.modelId}
                                </span>
                                <span className="model-selector__item-meta">{option.modelId}</span>
                              </span>
                              {isActive ? <CheckIcon /> : null}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                    {groupedModels.length === 0 ? (
                      <div className="model-selector__empty">
                        {noMatchingModels
                          ? "No matching models. Try a different search or provider."
                          : emptyModelTitle}
                      </div>
                    ) : null}
                  </div>
                  <div className="model-selector__help">
                    {selectionHint ?? "↑ ↓ navigate · Enter select · Esc close"}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </span>
      ) : null}
      {effectiveThinkingLevel ? (
        <span className="model-selector__anchor">
          <button
            className="model-selector__badge"
            type="button"
            disabled={disabled}
            aria-expanded={open === "thinking"}
            onClick={(event) => {
              triggerRef.current = event.currentTarget;
              setOpen(open === "thinking" ? "none" : "thinking");
            }}
          >
            {effectiveThinkingLevel}
            <ChevronDownIcon />
          </button>
          {open === "thinking" ? (
            <div
              className={`model-selector__dropdown ${dropdownPlacement === "below" ? "model-selector__dropdown--below" : ""}`}
              role="dialog"
              aria-label="Thinking level"
              style={dropdownStyle}
              onWheel={(event) => event.stopPropagation()}
            >
              <div className="model-selector__group-title">Thinking Level</div>
              {thinkingOptions.map((option) => {
                const isActive = option.value === effectiveThinkingLevel;
                return (
                  <button
                    className={`model-selector__item${isActive ? " model-selector__item--active" : ""}`}
                    key={option.value}
                    type="button"
                    onClick={() => {
                      if (!isActive) {
                        onSetThinking(option.value);
                      }
                      setOpen("none");
                      triggerRef.current?.focus();
                    }}
                  >
                    <span className="model-selector__item-label">{option.label}</span>
                    {isActive ? <CheckIcon /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </span>
      ) : null}
      {activeModel?.supportsFastMode && onSetFastMode ? (
        <button
          type="button"
          role="switch"
          aria-label="Fast mode"
          aria-checked={fastMode}
          className={`model-selector__badge${fastMode ? " model-selector__badge--fast" : ""}`}
          disabled={disabled}
          onClick={() => onSetFastMode(!fastMode)}
        >
          Fast {fastMode ? <CheckIcon /> : null}
        </button>
      ) : null}
    </span>
  );
}

interface ModelGroup {
  readonly provider: string;
  readonly items: readonly ComposerModelOption[];
}

function groupByProvider(options: readonly ComposerModelOption[]): readonly ModelGroup[] {
  const groups: { provider: string; items: ComposerModelOption[] }[] = [];
  for (const option of options) {
    const existing = groups.at(-1);
    if (existing?.provider === option.providerId) {
      existing.items.push(option);
    } else {
      groups.push({ provider: option.providerId, items: [option] });
    }
  }
  return groups;
}
