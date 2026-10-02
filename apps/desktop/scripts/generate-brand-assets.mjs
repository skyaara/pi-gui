import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createJiti } from "jiti";
import sharp from "sharp";

const desktop = fileURLToPath(new URL("../", import.meta.url));
const { PIUI_WORDMARK_VIEWBOX, PIUI_AGENT_MARK, PIUI_UI_PATH } = await createJiti(
  import.meta.url,
).import("../src/ui/piui-brand.ts");
const resources = path.join(desktop, "resources");
const paths =
  PIUI_AGENT_MARK.map(({ fill, path }) => `<path fill="${fill}" d="${path}"/>`).join("") +
  `<path d="${PIUI_UI_PATH}"/>`;
const wordmark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${PIUI_WORDMARK_VIEWBOX}" fill="#e7e9ee"><title>piui</title>${paths}</svg>\n`;
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><title>piui</title><rect x="64" y="64" width="896" height="896" rx="210" fill="#1b202b"/><g transform="translate(109 232) scale(5.6)" fill="#f3f4f7">${paths}</g></svg>\n`;
await writeFile(path.join(resources, "logo.svg"), wordmark);
await writeFile(path.join(resources, "icon.svg"), icon);
await sharp(Buffer.from(wordmark)).resize(576, 320).png().toFile(path.join(resources, "logo.png"));
await sharp(Buffer.from(icon)).png().toFile(path.join(resources, "icon.png"));
if (process.platform === "darwin") {
  const iconset = path.join(desktop, "build", "piui.iconset");
  await mkdir(iconset, { recursive: true });
  for (const size of [16, 32, 128, 256, 512]) {
    for (const scale of [1, 2]) {
      await sharp(Buffer.from(icon))
        .resize(size * scale)
        .png()
        .toFile(path.join(iconset, `icon_${size}x${size}${scale === 2 ? "@2x" : ""}.png`));
    }
  }
  execFileSync("iconutil", ["-c", "icns", iconset, "-o", path.join(resources, "icon.icns")]);
}
