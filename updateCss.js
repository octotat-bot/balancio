const fs = require('fs');
const cssPath = 'client/src/index.css';

let content = fs.readFileSync(cssPath, 'utf8');

content = content.replace(/background-color:\s*#ffffff;/g, "background-color: #0C0C0F;");
content = content.replace(/color:\s*#0a0a0a;/g, "color: #EDEAE4;");

fs.writeFileSync(cssPath, content, 'utf8');
console.log('Updated index.css');
