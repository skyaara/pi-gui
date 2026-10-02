import { useEffect, useState } from "react";
import type { RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import type { ModelSettingsScopeMode } from "../../../contracts/desktop-state";
import { SettingsSegmented, SettingsSwitch } from "./settings-controls";
import { SettingsGroup, SettingsRow } from "./settings-utils";

interface SettingsGeneralSectionProps {
  readonly runtime?: RuntimeSnapshot;
  readonly modelSettingsScopeMode: ModelSettingsScopeMode;
  readonly integratedTerminalShell: string;
  readonly onSetModelSettingsScopeMode: (mode: ModelSettingsScopeMode) => void;
  readonly onSetIntegratedTerminalShell: (shellPath: string) => void;
  readonly onToggleSkillCommands: (enabled: boolean) => void;
}

export function SettingsGeneralSection({
  runtime,
  modelSettingsScopeMode,
  integratedTerminalShell,
  onSetModelSettingsScopeMode,
  onSetIntegratedTerminalShell,
  onToggleSkillCommands,
}: SettingsGeneralSectionProps) {
  const [terminalShellDraft, setTerminalShellDraft] = useState(integratedTerminalShell);

  useEffect(() => {
    setTerminalShellDraft(integratedTerminalShell);
  }, [integratedTerminalShell]);

  const commitTerminalShellDraft = () => {
    if (terminalShellDraft !== integratedTerminalShell) {
      onSetIntegratedTerminalShell(terminalShellDraft);
    }
  };

  return (
    <SettingsGroup>
      <SettingsRow title="Model settings scope">
        <SettingsSegmented
          label="Model settings scope"
          options={[
            { value: "app-global", label: "App global" },
            { value: "per-repo", label: "Per repo" },
          ]}
          value={modelSettingsScopeMode}
          onChange={onSetModelSettingsScopeMode}
        />
      </SettingsRow>
      <SettingsRow title="Skill slash commands">
        <SettingsSwitch
          checked={runtime?.settings.enableSkillCommands ?? true}
          label="Enable skill slash commands"
          onChange={onToggleSkillCommands}
        />
      </SettingsRow>

      <SettingsRow title="Terminal shell" description="Leave blank to use your login shell.">
        <input
          aria-label="Shell of integrated terminal"
          className="settings-text-input"
          placeholder="/bin/zsh"
          spellCheck={false}
          type="text"
          value={terminalShellDraft}
          onBlur={commitTerminalShellDraft}
          onChange={(event) => setTerminalShellDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
        />
      </SettingsRow>
    </SettingsGroup>
  );
}
