const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app/internal/publisher/runtimes/python.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Function to fix indentation in a Python template string
function fixPythonIndentation(template) {
    const lines = template.split('\n');
    const fixedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Handle empty lines - remove trailing whitespace but keep them empty
        if (line.trim() === '') {
            fixedLines.push('');
            continue;
        }
        
        // Get leading whitespace
        const match = line.match(/^(\s*)/);
        const leading = match ? match[1] : '';
        const rest = line.substring(leading.length);
        
        // Count spaces (ignore tabs and CR)
        const spaceCount = leading.replace(/[^\s]/g, '').replace(/\r/g, '').length;
        
        // Determine expected indentation level based on Python syntax
        // This is a simplified approach - we'll normalize to 4-space increments
        let newIndent = '';
        
        // If the line starts with a keyword that reduces indent (else, elif, except, finally)
        const dedentKeywords = ['else:', 'elif ', 'except:', 'except ', 'finally:', 'try:'];
        const isDedent = dedentKeywords.some(kw => rest.trim().startsWith(kw));
        
        // If previous line ended with ':', this line should be indented
        // But we can't easily track that here, so we'll use a simpler approach:
        // Just normalize all indentation to multiples of 4
        
        // Calculate the indent level (number of 4-space units)
        const indentLevel = Math.round(spaceCount / 4);
        newIndent = ' '.repeat(indentLevel * 4);
        
        fixedLines.push(newIndent + rest);
    }
    
    return fixedLines.join('\n');
}

// Find and fix all template strings for .py files
// Pattern: 'filename.py': `template content`,
// We need to be careful with nested backticks

// Let's use a more robust approach: find all 'xxx.py': `...` patterns
const templateRegex = /('[\w_]+\.py'\s*:\s*)`([\s\S]*?)`\s*,/g;

let result = '';
let lastIndex = 0;
let match;

while ((match = templateRegex.exec(content)) !== null) {
    const prefix = match[1];  // 'filename.py': 
    const template = match[2]; // template content
    
    // Add content before this match
    result += content.substring(lastIndex, match.index);
    
    // Fix the template
    const fixedTemplate = fixPythonIndentation(template);
    
    // Add the fixed version
    result += prefix + '`' + fixedTemplate + '`\n';
    
    lastIndex = match.index + match[0].length;
}

// Add remaining content
result += content.substring(lastIndex);

// Write back
fs.writeFileSync(filePath, result, 'utf-8');
console.log('Fixed Python template indentation');