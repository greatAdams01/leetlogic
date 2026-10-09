import sharp from "sharp";
import { readdir, stat, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const source = fileURLToPath(new URL("../public/figma/", import.meta.url));
const destination = fileURLToPath(new URL("../public/optimized/", import.meta.url));
const avatars = new Set([
  "102eb",
  "e4105",
  "77822",
  "3a3b3",
  "b385c",
  "774fb",
  "1035b",
  "0b87e",
  "0950b",
  "56ad2",
]);
// Preserve fine text in the map and registration document.
const detailed = new Set(["e0fe4", "f85cc"]);
await mkdir(destination, { recursive: true });
const report = [];
for (const file of (await readdir(source)).filter((file) => file.endsWith(".png")).sort()) {
  const id = path.basename(file, ".png");
  const input = path.join(source, file);
  const metadata = await sharp(input).metadata();
  const width = avatars.has(id) ? 72 : Math.min(metadata.width, 1600);
  const variants =
    avatars.has(id) || detailed.has(id)
      ? [width]
      : [...new Set([480, 800, width].filter((w) => w <= width))].sort((a, b) => a - b);
  const outputs = [];
  for (const variant of variants) {
    const filename = variant === width ? `${id}.webp` : `${id}-${variant}.webp`;
    const info = await sharp(input)
      .rotate()
      .resize({ width: variant, withoutEnlargement: true })
      .webp({ quality: detailed.has(id) ? 90 : 80, effort: 6 })
      .toFile(path.join(destination, filename));
    outputs.push({
      src: `/optimized/${filename}`,
      width: info.width,
      height: info.height,
      bytes: info.size,
    });
  }
  report.push({ original: `/figma/${file}`, originalBytes: (await stat(input)).size, outputs });
}
console.log(JSON.stringify(report));
