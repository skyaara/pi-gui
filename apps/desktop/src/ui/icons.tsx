import {
  Archive,
  ArrowClockwise,
  ArrowUUpLeft,
  ArrowUp,
  ArrowsInSimple,
  ArrowsOutSimple,
  Bell,
  Brain,
  Browser,
  CaretDown,
  CaretRight,
  ChatCircle,
  Check,
  Clock,
  Copy,
  Cpu,
  DotsSixVertical,
  DotsThree,
  File,
  FileText,
  Folder,
  GearSix,
  GitBranch,
  GitDiff,
  GitFork,
  Keyboard,
  Lightning,
  MagnifyingGlass,
  Minus,
  PencilSimple,
  Plug,
  Plus,
  PlusCircle,
  PushPin,
  PuzzlePiece,
  SidebarSimple,
  SlidersHorizontal,
  Sparkle,
  Square,
  Sun,
  TerminalWindow,
  X,
  type Icon as PhosphorIcon,
  type IconWeight,
} from "@phosphor-icons/react";
import { PIUI_AGENT_MARK, PIUI_UI_PATH, PIUI_WORDMARK_VIEWBOX } from "./piui-brand";

function decorativeIcon(Glyph: PhosphorIcon, weight: IconWeight = "regular", mirrored = false) {
  return function Icon() {
    return <Glyph size={20} weight={weight} mirrored={mirrored} aria-hidden="true" />;
  };
}

export const LightningIcon = decorativeIcon(Lightning);
export const PlusIcon = decorativeIcon(Plus);
export const TerminalIcon = decorativeIcon(TerminalWindow);
export const BrowserPreviewIcon = decorativeIcon(Browser);
export const SidebarToggleIcon = decorativeIcon(SidebarSimple);
export const SidePanelIcon = decorativeIcon(SidebarSimple, "regular", true);
export const MaximizeIcon = decorativeIcon(ArrowsOutSimple);
export const MinimizeIcon = decorativeIcon(ArrowsInSimple);
export const CloseIcon = decorativeIcon(X);
export const ArrowUpIcon = decorativeIcon(ArrowUp);
export const StopSquareIcon = decorativeIcon(Square, "fill");
export const FolderIcon = decorativeIcon(Folder);
export const FileIcon = decorativeIcon(File);
export const ArchiveIcon = decorativeIcon(Archive);
export const RestoreIcon = decorativeIcon(ArrowUUpLeft);
export const ChevronDownIcon = decorativeIcon(CaretDown);
export const ChevronRightIcon = decorativeIcon(CaretRight);
export const CheckIcon = decorativeIcon(Check);
export const CustomizeSidebarIcon = decorativeIcon(SlidersHorizontal);
export const PencilIcon = decorativeIcon(PencilSimple);
export const CopyIcon = decorativeIcon(Copy);
export const SparkIcon = decorativeIcon(Sparkle);
export const SettingsIcon = decorativeIcon(GearSix);
export const ModelIcon = decorativeIcon(Cpu);
export const ReasoningIcon = decorativeIcon(Brain);
export const StatusIcon = decorativeIcon(PlusCircle);
export const SkillIcon = decorativeIcon(Sparkle);
export const ExtensionIcon = decorativeIcon(PuzzlePiece);
export const ClockIcon = decorativeIcon(Clock);
export const RefreshIcon = decorativeIcon(ArrowClockwise);
export const WorktreeIcon = decorativeIcon(GitBranch);
export const ForkIcon = decorativeIcon(GitFork);
export const GripIcon = decorativeIcon(DotsSixVertical);
export const DiffIcon = decorativeIcon(GitDiff);
export const FileDiffIcon = decorativeIcon(FileText);
export const ChatIcon = decorativeIcon(ChatCircle);
export const SearchIcon = decorativeIcon(MagnifyingGlass);
export const SunIcon = decorativeIcon(Sun);
export const BellIcon = decorativeIcon(Bell);
export const KeyboardIcon = decorativeIcon(Keyboard);
export const PlugIcon = decorativeIcon(Plug);
export const MoreIcon = decorativeIcon(DotsThree);
export const MinusIcon = decorativeIcon(Minus);

export function PinIcon({ filled = false }: { readonly filled?: boolean }) {
  return <PushPin size={20} weight={filled ? "fill" : "regular"} aria-hidden="true" />;
}

export function PiLogoMark() {
  return (
    <svg role="img" aria-label="piui" viewBox={PIUI_WORDMARK_VIEWBOX} fill="currentColor">
      {PIUI_AGENT_MARK.map(({ fill, path }) => (
        <path key={fill} fill={fill} d={path} />
      ))}
      <path d={PIUI_UI_PATH} />
    </svg>
  );
}

export function PiGlyphIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <path d="M5 5.25h10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      <path d="M8 5.25v9.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      <path
        d="M8 10.5c0-1.55 1.15-2.8 2.6-2.8 1.05 0 1.95.5 2.45 1.45"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}
