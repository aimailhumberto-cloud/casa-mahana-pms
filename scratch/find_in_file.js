const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
const query = process.argv[3];

if (!filePath || !query) {
  console.log('Usage: node find_in_file.js <file_path> <query_string>');
  process.exit(1);
}

const absolutePath = path.resolve(filePath);
if (!fs.existsSync(absolutePath)) {
  console.error('File does not exist:', absolutePath);
  process.exit(1);
}

console.log(`Searching for "${query}" in ${absolutePath}:`);
const content = fs.readFileSync(absolutePath, 'utf8');
const lines = content.split('\n');
let matches = 0;
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes(query.toLowerCase())) {
    console.log(`${idx + 1}: ${line.trim()}`);
    matches++;
  }
});
console.log(`Found ${matches} matches.`);
