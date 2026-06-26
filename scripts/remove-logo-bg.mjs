// Knocks out the near-white background of public/becs-logo.png, writing a
// transparent PNG in place. Run after dropping the original logo in:
//   node scripts/remove-logo-bg.mjs
import sharp from "sharp";
import path from "path";
import { renameSync, existsSync } from "fs";

const root = process.cwd();
const file = path.join(root, "public", "becs-logo.png");
if (!existsSync(file)) {
  console.error("Missing public/becs-logo.png — drop the logo there first.");
  process.exit(1);
}

const { data, info } = await sharp(file)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const ch = info.channels;
const THRESHOLD = 238; // pixels brighter than this on all channels become transparent
for (let i = 0; i < data.length; i += ch) {
  if (data[i] > THRESHOLD && data[i + 1] > THRESHOLD && data[i + 2] > THRESHOLD) {
    data[i + 3] = 0;
  }
}

const tmp = file + ".tmp.png";
await sharp(data, { raw: { width: info.width, height: info.height, channels: ch } })
  .png()
  .toFile(tmp);
renameSync(tmp, file);
console.log("Background removed -> public/becs-logo.png is now transparent.");
