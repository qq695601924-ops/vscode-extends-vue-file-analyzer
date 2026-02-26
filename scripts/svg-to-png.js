const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const src = path.join(__dirname, '../resources/icon.svg');
const dest = path.join(__dirname, '../resources/icon.png');
const size = 256;

sharp(fs.readFileSync(src))
  .resize(size, size)
  .png()
  .toFile(dest)
  .then(() => console.log('Written', dest))
  .catch(err => { console.error(err); process.exit(1); });
