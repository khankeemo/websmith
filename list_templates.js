const fs = require('fs');
const content = fs.readFileSync('app/internal/publisher/runtimes/python.ts', 'utf-8');

const templateRegex = /'(\w+\.py)': \`([\s\S]*?)\`,/g;
let match;
while ((match = templateRegex.exec(content)) !== null) {
  console.log('=== ' + match[1] + ' (length: ' + match[2].length + ') ===');
}