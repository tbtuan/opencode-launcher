const fs = require('fs');
const path = require('path');

const distIndex = path.join(__dirname, 'dist', 'index.html');

if (!fs.existsSync(distIndex)) {
  process.exit(1);
}

const distTime = fs.statSync(distIndex).mtimeMs;

function newerThanDist(file) {
  const fullPath = path.join(__dirname, file);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).mtimeMs > distTime;
}

if (newerThanDist('index.html') || newerThanDist('vite.config.js') || newerThanDist('package.json')) {
  process.exit(1);
}

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p);
    } else if (entry.isFile()) {
      if (fs.statSync(p).mtimeMs > distTime) {
        process.exit(1);
      }
    }
  }
}

walk(path.join(__dirname, 'src'));

process.exit(0);
