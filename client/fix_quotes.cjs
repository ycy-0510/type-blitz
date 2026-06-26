const fs = require('fs');
let content = fs.readFileSync('src/quotes.ts', 'utf8');

let fixed = content.split('\n').map(line => {
    let m = line.match(/^(\s*"[^"]+"\s*:\s*)"(.*)"(,)?\s*$/);
    if (m) {
        let prefix = m[1]; 
        let inner = m[2];  
        let suffix = m[3] || '';
        
        // Escape any double quotes inside the string content
        let escapedInner = inner.replace(/"/g, '\\"');
        
        return `${prefix}"${escapedInner}"${suffix}`;
    }
    return line;
}).join('\n');

fs.writeFileSync('src/quotes.ts', fixed);
console.log('Fixed quotes.ts');
