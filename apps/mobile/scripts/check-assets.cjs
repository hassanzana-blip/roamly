// Decode the shipped files: PNG headers alone did not catch the RGB/RGBA corruption.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Jimp = require("jimp-compact");

async function check(file, colorType, background, foreground) {
  const bytes = fs.readFileSync(path.resolve(__dirname, "..", "assets", file));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(bytes[24], 8, `${file}: expected 8-bit pixels`);
  assert.equal(bytes[25], colorType, `${file}: incorrect PNG color type`);
  const image = await Jimp.read(bytes);
  assert.equal(image.bitmap.width, 1024);
  assert.equal(image.bitmap.height, 1024);
  for (const [x, y] of [[0, 0], [1023, 0], [0, 1023], [1023, 1023], [512, 800]]) {
    assert.equal(image.getPixelColor(x, y), background, `${file}: corrupt background at ${x},${y}`);
  }
  for (const [x, y] of [[300, 400], [700, 400], [512, 450]]) {
    assert.equal(image.getPixelColor(x, y), foreground, `${file}: corrupt SkyMark at ${x},${y}`);
  }
  if (colorType === 2) {
    for (let i = 3; i < image.bitmap.data.length; i += 4) {
      assert.equal(image.bitmap.data[i], 255, `${file}: app icon must be opaque`);
    }
  }
  console.log(`${file}: 1024px, decoded pixels and color type verified (${bytes.length} bytes)`);
}

(async () => {
  await check("icon.png", 2, 0x1164e8ff, 0xffffffff);
  await check("splash-icon.png", 6, 0x1164e800, 0x1164e8ff);
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
