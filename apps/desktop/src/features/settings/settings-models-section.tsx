import { useState, type ReactNode } from "react";
import type {
  RuntimeModelRecord,
  RuntimeSettingsSnapshot,
  RuntimeSnapshot,
} from "@pi-gui/session-driver/runtime-types";
import {
  buildModelOptions,
  buildThinkingOptions,
  resolveThinkingLevel,
} from "../conversation/composer-commands";
import { ModelSelector } from "../conversation/model-selector";
import { effectiveModelDiscovery } from "@pi-gui/session-driver/runtime-types";
import { SearchIcon } from "../../ui/icons";
import { SettingsSelect, SettingsSwitch } from "./settings-controls";
import { filterModels, SettingsGroup, SettingsRow, THINKING_LEVELS } from "./settings-utils";

interface SettingsModelsSectionProps {
  readonly runtime?: RuntimeSnapshot;
  readonly onSetDefaultModel: (provider: string, modelId: string) => void;
  readonly onSetThinkingLevel: (
    thinkingLevel: RuntimeSettingsSnapshot["defaultThinkingLevel"],
  ) => void;
  readonly onSetScopedModelPatterns: (patterns: readonly string[]) => void;
  readonly onOpenProviders: () => void;
}

function modelPattern(model: RuntimeModelRecord): string {
  return `${model.providerId}/${model.modelId}`;
}

/** Model defaults and the searchable allowlist share Pi discovery and capabilities. */
export function SettingsModelsSection({
  runtime,
  onSetDefaultModel,
  onSetThinkingLevel,
  onSetScopedModelPatterns,
  onOpenProviders,
}: SettingsModelsSectionProps) {
  const [query, setQuery] = useState("");
  const [showUnconnected, setShowUnconnected] = useState(false);

  const models = runtime?.models ?? [];
  const availableModels = models.filter((model) => model.available);
  const unconnectedModels = models.filter((model) => !model.available);

  const enabledOptions = buildModelOptions(runtime);
  const activePatterns = enabledOptions.map((model) => `${model.providerId}/${model.modelId}`);
  const activeSet = new Set(activePatterns);
  const enabledModels = enabledOptions.flatMap((option) => {
    const model = availableModels.find(
      (entry) => entry.providerId === option.providerId && entry.modelId === option.modelId,
    );
    return model ? [model] : [];
  });
  const discoveredDefault = effectiveModelDiscovery(runtime)?.defaultModel;
  const defaultProvider = discoveredDefault?.providerId ?? runtime?.settings.defaultProvider;
  const defaultModelId = discoveredDefault?.modelId ?? runtime?.settings.defaultModelId;
  const defaultValue =
    defaultProvider && defaultModelId ? `${defaultProvider}:${defaultModelId}` : undefined;
  const selectedModel = enabledModels.find(
    (model) => model.providerId === defaultProvider && model.modelId === defaultModelId,
  );
  const defaultIsEnabled = Boolean(selectedModel);
  const thinkingOptions = buildThinkingOptions(selectedModel);
  const thinkingLevel = resolveThinkingLevel(
    selectedModel,
    discoveredDefault?.thinkingLevel ?? runtime?.settings.defaultThinkingLevel,
  );

  const searching = query.trim().length > 0;
  const visibleAvailable = filterModels(availableModels, query);
  const visibleUnconnected = filterModels(unconnectedModels, query);

  const setThinkingLevel = (value: string) => {
    const level = THINKING_LEVELS.find((entry) => entry === value);
    if (level) onSetThinkingLevel(level);
  };

  const setEnabled = (pattern: string, enabled: boolean) => {
    const next = enabled
      ? [...activePatterns, pattern]
      : activePatterns.filter((entry) => entry !== pattern);
    if (next.length > 0) onSetScopedModelPatterns(next);
  };

  return (
    <>
      <SettingsGroup>
        <SettingsRow title="Default model" description="Used for new threads.">
          <ModelSelector
            modelControlLabel="Default model"
            runtime={runtime}
            provider={defaultIsEnabled ? defaultProvider : undefined}
            modelId={defaultIsEnabled ? defaultModelId : undefined}
            thinkingLevel={thinkingLevel}
            showThinkingControl={false}
            showEmptyModelControl
            dropdownPlacement="below"
            onSetModel={onSetDefaultModel}
            onSetThinking={setThinkingLevel}
          />
        </SettingsRow>
        {thinkingOptions.length > 0 ? (
          <SettingsRow title="Thinking level">
            <SettingsSelect
              label="Thinking level"
              options={thinkingOptions}
              value={thinkingLevel}
              onChange={setThinkingLevel}
            />
          </SettingsRow>
        ) : null}
        <SettingsRow title="Fast mode">
          <span>{selectedModel?.supportsFastMode ? "Available" : "Unavailable"}</span>
        </SettingsRow>
        {defaultValue && !defaultIsEnabled ? (
          <div className="settings-row">
            <span className="settings-warning">
              Your default model ({defaultProvider}/{defaultModelId}) is turned off or its provider
              is not connected. Choose a new default.
            </span>
          </div>
        ) : null}
      </SettingsGroup>

      <section className="settings-section">
        <div className="settings-section__header">
          <h3 className="settings-section__title">
            Enabled models{" "}
            <span className="resource-list__count">
              {enabledModels.length} of {availableModels.length}
            </span>
          </h3>
          <label className="resource-search">
            <SearchIcon />
            <input
              aria-label="Search models"
              placeholder="Search models"
              spellCheck={false}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </label>
        </div>
        <p className="settings-section__description">
          Only enabled models appear in model pickers.
        </p>
        <div className="settings-group" data-testid="settings-model-list">
          {visibleAvailable.length === 0 ? (
            <div className="settings-row">
              <span className="settings-row__description">
                {availableModels.length === 0
                  ? "No connected models available yet. Connect a provider to add models."
                  : `No connected models match “${query.trim()}”.`}
              </span>
            </div>
          ) : (
            visibleAvailable.map((model) => {
              const pattern = modelPattern(model);
              const enabled = activeSet.has(pattern);
              return (
                <ModelRow
                  isDefault={
                    model.providerId === defaultProvider && model.modelId === defaultModelId
                  }
                  key={pattern}
                  model={model}
                >
                  <SettingsSwitch
                    checked={enabled}
                    disabled={enabled && activePatterns.length <= 1}
                    label={`Enable ${pattern}`}
                    onChange={(next) => setEnabled(pattern, next)}
                  />
                </ModelRow>
              );
            })
          )}
        </div>
      </section>

      {unconnectedModels.length > 0 && (!searching || visibleUnconnected.length > 0) ? (
        <section className="settings-section">
          <div className="settings-section__header">
            <h3 className="settings-section__title">
              Not connected{" "}
              <span className="resource-list__count">{visibleUnconnected.length}</span>
            </h3>
            <button className="button button--secondary" type="button" onClick={onOpenProviders}>
              Connect a provider
            </button>
          </div>
          <p className="settings-section__description">
            Models from providers you have not signed in to.
          </p>
          {searching || showUnconnected ? (
            <div className="settings-group" data-testid="settings-unconnected-model-list">
              {visibleUnconnected.map((model) => (
                <ModelRow isDefault={false} key={modelPattern(model)} model={model} />
              ))}
            </div>
          ) : (
            <button
              className="resource-list__more"
              type="button"
              onClick={() => setShowUnconnected(true)}
            >
              Show {unconnectedModels.length} models
            </button>
          )}
        </section>
      ) : null}
    </>
  );
}

function ModelRow({
  model,
  isDefault,
  children,
}: {
  readonly model: RuntimeModelRecord;
  readonly isDefault: boolean;
  readonly children?: ReactNode;
}) {
  return (
    <div className="settings-row model-row">
      <div className="settings-row__label">
        <div className="settings-row__title">
          {model.label}
          {isDefault ? <span className="model-row__badge">Default</span> : null}
        </div>
        <div className="settings-row__description">
          {model.providerName} · {modelPattern(model)}
          {model.reasoning ? <span className="model-row__tag">Thinking</span> : null}
          <span className="model-row__tag">
            {model.supportsFastMode ? "Fast available" : "Fast unavailable"}
          </span>
          {model.supportsImages ? <span className="model-row__tag">Images</span> : null}
        </div>
      </div>
      {children ? <div className="settings-row__control">{children}</div> : null}
    </div>
  );
}
