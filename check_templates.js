const fs = require('fs');
const content = fs.readFileSync('app/internal/publisher/runtimes/python.ts', 'utf-8');

const templateRegex = /'(\w+\.py)'\s*:\s*`([\s\S]*?)`\s*,/g;
let match;
let count = 0;
while ((match = templateRegex.exec(content)) !== null) {
    count++;
    const filename = match[1];
    const template = match[2];
    const lines = template.split('\n');
    console.log(filename + ': ' + lines.length + ' lines');
}
console.log('Total templates: ' + count);