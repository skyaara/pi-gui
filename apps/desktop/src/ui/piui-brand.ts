/** Shared wordmark geometry. Pi mark and colors match the Pi CLI's pi-logo.ts. */
export const PIUI_WORDMARK_VIEWBOX = "0 0 144 80";
export const PIUI_AGENT_MARK = [
  { fill: "#e48a7a", path: "M8 18H47V44H34V31H8Z" },
  { fill: "#4f8eb3", path: "M8 31H21V44H34V57H21V70H8Z" },
  { fill: "#eab65d", path: "M47 44H60V70H47Z" },
] as const;
export const PIUI_UI_PATH =
  "M72 31H83V55Q83 61 89 61Q96 61 96 53V31H107V70H97V65Q93 71 85 71Q72 71 72 56Z " +
  "M119 31H130V70H119Z M130.5 19.5A6 6 0 1 1 118.5 19.5A6 6 0 1 1 130.5 19.5Z";
