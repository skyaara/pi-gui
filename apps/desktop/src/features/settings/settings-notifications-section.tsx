import type { DesktopNotificationPermissionStatus } from "../../../contracts/ipc";
import type { NotificationPreferences } from "../../../contracts/desktop-state";
import { SettingsSwitch } from "./settings-controls";
import { SettingsGroup, SettingsRow } from "./settings-utils";

interface SettingsNotificationsSectionProps {
  readonly notificationPreferences: NotificationPreferences;
  readonly notificationPermissionStatus: DesktopNotificationPermissionStatus;
  readonly notificationPermissionPending: boolean;
  readonly onSetNotificationPreferences: (preferences: Partial<NotificationPreferences>) => void;
  readonly onRequestNotificationPermission: () => void;
  readonly onOpenSystemNotificationSettings: () => void;
}

export function SettingsNotificationsSection({
  notificationPreferences,
  notificationPermissionStatus,
  notificationPermissionPending,
  onSetNotificationPreferences,
  onRequestNotificationPermission,
  onOpenSystemNotificationSettings,
}: SettingsNotificationsSectionProps) {
  const statusLabel = labelForPermissionStatus(notificationPermissionStatus);
  const statusDescription = descriptionForPermissionStatus(notificationPermissionStatus);
  const showAskMacOs = notificationPermissionStatus === "default";
  const showOpenSystemSettings = notificationPermissionStatus === "denied";
  return (
    <SettingsGroup>
      <SettingsRow title="macOS notification access" description={statusDescription}>
        <div className="settings-row__actions">
          <span className="settings-row__value">{statusLabel}</span>
          {showAskMacOs ? (
            <button
              className="button button--secondary"
              disabled={notificationPermissionPending}
              type="button"
              onClick={onRequestNotificationPermission}
            >
              Ask macOS
            </button>
          ) : null}
          {showOpenSystemSettings ? (
            <button
              className="button button--secondary"
              disabled={notificationPermissionPending}
              type="button"
              onClick={onOpenSystemNotificationSettings}
            >
              Open System Settings
            </button>
          ) : null}
        </div>
      </SettingsRow>
      <SettingsRow title="Background completion">
        <SettingsSwitch
          checked={notificationPreferences.backgroundCompletion}
          label="Background completion"
          onChange={(checked) => onSetNotificationPreferences({ backgroundCompletion: checked })}
        />
      </SettingsRow>
      <SettingsRow title="Background failures">
        <SettingsSwitch
          checked={notificationPreferences.backgroundFailure}
          label="Background failures"
          onChange={(checked) => onSetNotificationPreferences({ backgroundFailure: checked })}
        />
      </SettingsRow>
      <SettingsRow title="Needs input or approval">
        <SettingsSwitch
          checked={notificationPreferences.attentionNeeded}
          label="Needs input or approval"
          onChange={(checked) => onSetNotificationPreferences({ attentionNeeded: checked })}
        />
      </SettingsRow>
    </SettingsGroup>
  );
}

function labelForPermissionStatus(status: DesktopNotificationPermissionStatus): string {
  switch (status) {
    case "granted":
      return "Enabled";
    case "denied":
      return "Turned off";
    case "default":
      return "Not enabled yet";
    case "unsupported":
      return "Unavailable";
    default:
      return "Checking…";
  }
}

function descriptionForPermissionStatus(
  status: DesktopNotificationPermissionStatus,
): string | undefined {
  switch (status) {
    case "granted":
      return undefined;
    case "denied":
      return "Enable piui notifications in System Settings.";
    case "default":
      return "Allow notifications for background threads.";
    case "unsupported":
      return "Desktop notifications are unavailable on this system.";
    default:
      return undefined;
  }
}
