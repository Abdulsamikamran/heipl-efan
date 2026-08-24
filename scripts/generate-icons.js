const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const iconsDir = path.join(publicDir, 'icons');
const source = path.join(publicDir, 'favicon.png');

fs.mkdirSync(iconsDir, { recursive: true });

if (!fs.existsSync(source)) {
  console.error('public/favicon.png is missing');
  process.exit(1);
}

fs.copyFileSync(source, path.join(publicDir, 'logo.png'));
fs.copyFileSync(source, path.join(iconsDir, 'icon-192.png'));
fs.copyFileSync(source, path.join(iconsDir, 'icon-512.png'));
fs.copyFileSync(source, path.join(publicDir, 'apple-touch-icon.png'));

console.log('Copied favicon.png to logo and PWA icons');
