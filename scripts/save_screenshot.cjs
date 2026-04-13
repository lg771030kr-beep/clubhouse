// Usage: node save_screenshot.cjs <filename> <base64-jpeg-data>
// Converts JPEG base64 to PNG and saves it
const fs = require('fs');
const path = require('path');

const SAVE_DIR = path.join(__dirname, '..', 'docs', 'screenshots');

const filename = process.argv[2];
const b64 = process.argv[3];

if (!filename || !b64) {
  console.error('Usage: node save_screenshot.cjs <filename> <base64>');
  process.exit(1);
}

const buf = Buffer.from(b64, 'base64');
const filepath = path.join(SAVE_DIR, filename);
fs.writeFileSync(filepath, buf);
console.log(`Saved ${filepath} (${buf.length} bytes)`);
