// Renders the SVG home-screen icon to the PNG sizes iOS + Android
// home screens want. iOS 27's icon renderer reads SVG manifest icons
// as "stylable" content and applies the new liquid-glass treatment —
// strips the cream tile and makes the dots look like translucent
// water droplets. PNG is a flat raster and side-steps that path.
//
// Run when the source SVG changes:
//   node scripts/generate-icons.mjs

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "../public/icon-512.svg");
const PUBLIC = resolve(__dirname, "../public");

const SIZES = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  // 180×180 is the apple-touch-icon size every iOS version honors;
  // newer iPads upscale fine from this without artifacts.
  { name: "apple-touch-icon.png", size: 180 },
];

const svg = await readFile(SRC);
for (const { name, size } of SIZES) {
  const out = resolve(PUBLIC, name);
  await sharp(svg).resize(size, size).png({ compressionLevel: 9 }).toFile(out);
  console.log(`wrote ${out}`);
}
