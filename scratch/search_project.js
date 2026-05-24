const fs = require('fs');
const path = require('path');

function searchDir(dir, query) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== '.gemini' && file !== 'dist' && file !== 'build') {
        searchDir(fullPath, query);
      }
    } else if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.toLowerCase().includes(query.toLowerCase())) {
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.toLowerCase().includes(query.toLowerCase())) {
            console.log(`${fullPath}:${idx + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

console.log('Searching for "Estancia"...');
searchDir(path.join(__dirname, '..'), 'Estancia');
