// Builds the `www/` directory Capacitor bundles into the native Android
// app. The web repo's entry point (index.html) is the unrelated
// PR-practice counter app, so the native app instead uses trading.html
// as its single screen — copied to www/index.html along with the JS
// modules it depends on and the app icons. Nothing here changes the
// GitHub Pages site itself; this only assembles a separate copy for the
// native wrapper.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const wwwDir = path.join(root, 'www');

fs.rmSync(wwwDir, { recursive: true, force: true });
fs.mkdirSync(wwwDir, { recursive: true });

fs.copyFileSync(path.join(root, 'trading.html'), path.join(wwwDir, 'index.html'));

for (const file of ['signals.js', 'portfolio.js', 'options.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png']) {
  fs.copyFileSync(path.join(root, file), path.join(wwwDir, file));
}

console.log(`Built www/ from trading.html (${fs.readdirSync(wwwDir).length} files).`);
