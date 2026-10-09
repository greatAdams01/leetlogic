import sharp from "sharp";
import { copyFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const logo = resolve(root, "public/figma/cbff0.svg");
const output = (path) => resolve(root, path);
await copyFile(logo, output("app/icon.svg"));

// ICO entries contain PNG images, preserving transparency at each native size.
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((size) => sharp(logo, { density: 600 }).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((image, index) => {
  const entry = 6 + index * 16;
  header[entry] = sizes[index];
  header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await writeFile(output("app/favicon.ico"), Buffer.concat([header, ...images]));
await sharp(logo, { density: 600 }).resize(140, 140).extend({ top: 20, bottom: 20, left: 20, right: 20, background: "white" }).flatten({ background: "white" }).png().toFile(output("app/apple-icon.png"));
await sharp(logo, { density: 600 }).resize(512, 512).png().toFile(output("public/brand-logo.png"));

const symbol = await sharp(logo, { density: 600 }).resize(100, 100).png().toBuffer();
const wordmark = await sharp(output("public/figma/40847.svg"), { density: 600 }).resize(380).png().toBuffer();
const text = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#f4f7ef"/>
  <rect y="610" width="1200" height="20" fill="#81b441"/>
  <g fill="#1f6f50" font-family="sans-serif" font-weight="700" font-size="70">
    <text x="80" y="330">Sell local.</text><text x="80" y="415">Reach global.</text>
  </g>
  <text x="80" y="505" fill="#34463c" font-family="sans-serif" font-size="28">Connecting Nigerian farmers and buyers.</text>
</svg>`);
await sharp(text).composite([{ input: symbol, left: 80, top: 80 }, { input: wordmark, left: 205, top: 94 }]).jpeg({ quality: 88, mozjpeg: true }).toFile(output("public/social-preview.jpg"));
console.log("Generated favicon, SVG icon, Apple touch icon, organization logo, and social preview.");
