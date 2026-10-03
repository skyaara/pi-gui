import { WorkspacePicker } from "./workspace-picker";
import {
  useEffect,
  useRef,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type RefObject,
  type ReactNode,
} from "react";
import type { RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import type { ExtensionFlagValues } from "@pi-gui/session-driver";
import type {
  ComposerAttachment,
  NewThreadEnvironment,
  WorkspaceRecord,
} from "../../../contracts/desktop-state";
import type { MentionOption } from "../conversation/hooks/use-mention-menu";
import { ArrowUpIcon, WorktreeIcon, PlusIcon } from "../../ui/icons";
import { Button } from "../../ui/button";
import {
  MODEL_OPTIONS_EMPTY_TITLE,
  type ComposerSlashCommand,
  type ComposerSlashCommandSection,
  type ComposerSlashOption,
  type ComposerSlashOptionEmptyState,
} from "../conversation/composer-commands";
import { ComposerWorkspace } from "../conversation/composer-workspace";
import { ComposerSurface } from "../conversation/composer-surface";
import { ModelOnboardingNoticeBanner } from "../settings/model-onboarding-notice";
import type {
  ModelOnboardingState,
  ModelOnboardingSettingsSection,
} from "../settings/model-onboarding";
import { ModelSelector } from "../conversation/model-selector";
import { ExtensionFlagsSelector } from "./extension-flags-selector";

interface NewThreadViewProps {
  readonly workspaces: readonly WorkspaceRecord[];
  readonly selectedWorkspaceId: string;
  readonly runtime?: RuntimeSnapshot;
  readonly environment: NewThreadEnvironment;
  readonly prompt: string;
  readonly attachments: readonly ComposerAttachment[];
  readonly lastError?: string;
  readonly provider: string | undefined;
  readonly modelId: string | undefined;
  readonly thinkingLevel: string | undefined;
  readonly modelOnboarding: ModelOnboardingState;
  readonly composerRef: RefObject<HTMLTextAreaElement | null>;
  readonly activeSlashCommand?: ComposerSlashCommand;
  readonly activeSlashCommandMeta?: string;
  readonly slashSections: readonly ComposerSlashCommandSection[];
  readonly slashOptions: readonly ComposerSlashOption[];
  readonly selectedSlashCommand?: ComposerSlashCommand;
  readonly selectedSlashOption?: ComposerSlashOption;
  readonly showSlashMenu: boolean;
  readonly showSlashOptionMenu: boolean;
  readonly slashOptionEmptyState?: ComposerSlashOptionEmptyState;
  readonly showMentionMenu: boolean;
  readonly mentionOptions: readonly MentionOption[];
  readonly selectedMentionIndex: number;
  readonly onChangePrompt: (prompt: string) => void;
  readonly onSelectEnvironment: (environment: NewThreadEnvironment) => void;
  readonly onSelectWorkspace: (workspaceId: string) => void;
  readonly onSelectStandalone: () => void;
  readonly onSetModel: (provider: string, modelId: string) => void;
  readonly onSetThinking: (level: string) => void;
  readonly fastMode?: boolean;
  readonly onSetFastMode?: (enabled: boolean) => void;
  readonly extensionFlags: ExtensionFlagValues;
  readonly onSetExtensionFlag: (name: string, value: boolean | string) => void;
  readonly onOpenModelSettings: (section: ModelOnboardingSettingsSection) => void;
  readonly onComposerKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  readonly onComposerPaste: (event: ClipboardEvent<HTMLDivElement>) => void;
  readonly onComposerDrop: (event: DragEvent<HTMLDivElement>) => void;
  readonly onClearSlashCommand: () => void;
  readonly onSelectSlashCommand: (command: ComposerSlashCommand) => void;
  readonly onSelectSlashOption: (option: ComposerSlashOption) => void;
  readonly onSelectMention: (option: MentionOption) => void;
  readonly onEnableMentionExtension: (
    option: Extract<MentionOption, { kind: "extension" }>,
  ) => void;
  readonly onAddAttachments: (files: File[]) => void;
  readonly onRemoveAttachment: (attachmentId: string) => void;
  readonly onSubmit: () => void;
}

export function NewThreadView({
  workspaces,
  selectedWorkspaceId,
  runtime,
  environment,
  prompt,
  attachments,
  lastError,
  provider,
  modelId,
  thinkingLevel,
  modelOnboarding,
  composerRef,
  activeSlashCommand,
  activeSlashCommandMeta,
  slashSections,
  slashOptions,
  selectedSlashCommand,
  selectedSlashOption,
  showSlashMenu,
  showSlashOptionMenu,
  slashOptionEmptyState,
  showMentionMenu,
  mentionOptions,
  selectedMentionIndex,
  onChangePrompt,
  onSelectEnvironment,
  onSelectWorkspace,
  onSelectStandalone,
  onSetModel,
  onSetThinking,
  fastMode = false,
  onSetFastMode,
  extensionFlags,
  onSetExtensionFlag,
  onOpenModelSettings,
  onComposerKeyDown,
  onComposerPaste,
  onComposerDrop,
  onClearSlashCommand,
  onSelectSlashCommand,
  onSelectSlashOption,
  onSelectMention,
  onEnableMentionExtension,
  onAddAttachments,
  onRemoveAttachment,
  onSubmit,
}: NewThreadViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const workspace = workspaces.find((entry) => entry.id === selectedWorkspaceId);

  useEffect(() => {
    composerRef.current?.focus();
  }, [composerRef]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) {
      return;
    }

    composer.style.height = "0px";
    composer.style.height = `${Math.min(composer.scrollHeight, 260)}px`;
  }, [composerRef, prompt]);

  if (!workspace) {
    return (
      <section className="canvas canvas--empty">
        <div className="empty-panel">
          <h1>Open a folder to begin</h1>
          <p>
            Select a repository from the sidebar first, then start a local or worktree-backed
            thread.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="canvas canvas--new-thread">
      <div className="new-thread">
        <div className="new-thread__hero">
          <h1 className="new-thread__title">
            {workspace.isStandalone ? "What should we work on?" : "What should we build?"}
          </h1>
          {workspace.isStandalone ? (
            <p className="new-thread__storage">Files saved in {workspace.path}</p>
          ) : null}
        </div>

        <div className="new-thread__composer composer">
          <div className="conversation conversation--composer">
            <ComposerSurface
              lastError={lastError}
              activeSlashCommand={activeSlashCommand}
              activeSlashCommandMeta={activeSlashCommandMeta}
              topNotice={
                <ModelOnboardingNoticeBanner
                  notice={modelOnboarding.notice}
                  onOpenSettings={onOpenModelSettings}
                />
              }
              queuedMessages={[]}
              composerDraft={prompt}
              setComposerDraft={onChangePrompt}
              composerRef={composerRef}
              attachments={attachments}
              slashSections={slashSections}
              slashOptions={slashOptions}
              selectedSlashCommand={selectedSlashCommand}
              selectedSlashOption={selectedSlashOption}
              showSlashMenu={showSlashMenu}
              showSlashOptionMenu={showSlashOptionMenu}
              slashOptionEmptyState={slashOptionEmptyState}
              onClearSlashCommand={onClearSlashCommand}
              onComposerKeyDown={onComposerKeyDown}
              onComposerPaste={onComposerPaste}
              onComposerDrop={onComposerDrop}
              onEditQueuedMessage={() => undefined}
              onCancelQueuedEdit={() => undefined}
              onRemoveQueuedMessage={() => undefined}
              onSteerQueuedMessage={() => undefined}
              onRemoveAttachment={onRemoveAttachment}
              onSelectSlashCommand={onSelectSlashCommand}
              onSelectSlashOption={onSelectSlashOption}
              showMentionMenu={showMentionMenu}
              mentionOptions={mentionOptions}
              selectedMentionIndex={selectedMentionIndex}
              onSelectMention={onSelectMention}
              onEnableMentionExtension={onEnableMentionExtension}
              textareaLabel="New thread prompt"
              textareaTestId="new-thread-composer"
              textareaClassName="new-thread__textarea"
              textareaPlaceholder="Ask anything, @mention files, or / for commands and skills"
              footer={
                <NewThreadComposerFooter
                  workspaceContext={
                    <ComposerWorkspace
                      workspace={workspace}
                      controls={
                        !workspace.isStandalone ? (
                          <label className="new-thread__checkout">
                            <WorktreeIcon />
                            <select
                              aria-label="Workspace mode"
                              value={environment}
                              onChange={(event) =>
                                onSelectEnvironment(
                                  event.target.value === "worktree" ? "worktree" : "local",
                                )
                              }
                            >
                              <option value="local">Current checkout</option>
                              <option value="worktree">New worktree</option>
                            </select>
                          </label>
                        ) : (
                          <span>No project</span>
                        )
                      }
                    >
                      <WorkspacePicker
                        workspace={workspace}
                        workspaces={workspaces}
                        onSelect={onSelectWorkspace}
                        onSelectStandalone={onSelectStandalone}
                      />
                    </ComposerWorkspace>
                  }
                  runtime={runtime}
                  provider={provider}
                  modelId={modelId}
                  thinkingLevel={thinkingLevel}
                  modelOnboarding={modelOnboarding}
                  hasContent={Boolean(prompt.trim() || attachments.length > 0)}
                  fileInputRef={fileInputRef}
                  onSetModel={onSetModel}
                  onSetThinking={onSetThinking}
                  fastMode={fastMode}
                  onSetFastMode={onSetFastMode}
                  extensionFlags={extensionFlags}
                  onSetExtensionFlag={onSetExtensionFlag}
                  onAddAttachments={onAddAttachments}
                  onSubmit={onSubmit}
                />
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
}

interface NewThreadComposerFooterProps {
  readonly workspaceContext: ReactNode;
  readonly runtime?: RuntimeSnapshot;
  readonly provider: string | undefined;
  readonly modelId: string | undefined;
  readonly thinkingLevel: string | undefined;
  readonly modelOnboarding: ModelOnboardingState;
  readonly hasContent: boolean;
  readonly fileInputRef: RefObject<HTMLInputElement | null>;
  readonly onSetModel: (provider: string, modelId: string) => void;
  readonly onSetThinking: (level: string) => void;
  readonly fastMode?: boolean;
  readonly onSetFastMode?: (enabled: boolean) => void;
  readonly extensionFlags: ExtensionFlagValues;
  readonly onSetExtensionFlag: (name: string, value: boolean | string) => void;
  readonly onAddAttachments: (files: File[]) => void;
  readonly onSubmit: () => void;
}

function NewThreadComposerFooter({
  workspaceContext,
  runtime,
  provider,
  modelId,
  thinkingLevel,
  modelOnboarding,
  hasContent,
  fileInputRef,
  onSetModel,
  onSetThinking,
  fastMode = false,
  onSetFastMode,
  extensionFlags,
  onSetExtensionFlag,
  onAddAttachments,
  onSubmit,
}: NewThreadComposerFooterProps) {
  return (
    <>
      <div className="composer__footer">
        <div className="composer__footer-row">
          <div className="composer__hint new-thread__hint">
            {workspaceContext}
            <ModelSelector
              runtime={runtime}
              provider={provider}
              modelId={modelId}
              thinkingLevel={thinkingLevel}
              dropdownPlacement="below"
              selectionHint={
                !runtime?.settings.defaultModelId
                  ? "Your first choice becomes the default for new threads."
                  : undefined
              }
              showEmptyModelControl
              unselectedModelLabel={modelOnboarding.unselectedModelLabel}
              emptyModelLabel={MODEL_OPTIONS_EMPTY_TITLE}
              emptyModelTitle={modelOnboarding.emptyModelTitle}
              onSetModel={onSetModel}
              onSetThinking={onSetThinking}
              fastMode={fastMode}
              onSetFastMode={onSetFastMode}
            />
            <ExtensionFlagsSelector
              runtime={runtime}
              values={extensionFlags}
              onSetFlag={onSetExtensionFlag}
            />
          </div>

          <div className="composer__actions">
            <input
              ref={fileInputRef}
              hidden
              type="file"
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length > 0) {
                  onAddAttachments(files);
                }
                event.currentTarget.value = "";
              }}
            />
            <Button
              aria-label="Attach files"
              className="composer__attach"
              size="icon"
              variant="ghost"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <PlusIcon />
            </Button>
            <Button
              aria-label="Start thread"
              size="icon"
              type="button"
              disabled={!hasContent || modelOnboarding.requiresModelSelection}
              onClick={onSubmit}
            >
              <ArrowUpIcon />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
