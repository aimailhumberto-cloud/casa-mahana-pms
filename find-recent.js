const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === '.git' || file === 'node_modules' || file === '.agents') continue;
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);
    if (stat.isDirectory()) {
      getFiles(filepath, files);
    } else {
      files.push({ path: filepath, mtime: stat.mtime });
    }
  }
  return files;
}

const allFiles = getFiles('.');
allFiles.sort((a, b) => b.mtime - a.mtime);

console.log(JSON.stringify(allFiles.slice(0, 10), null, 2));
