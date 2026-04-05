const fs = require('fs');
const path = require('path');

const srcDirs = [
  path.join(__dirname, 'client/src/pages'),
  path.join(__dirname, 'client/src/components')
];

let changedFiles = 0;

const replacements = [
  // Backgrounds
  { from: /backgroundColor:\s*['"]#ffffff['"]/gi, to: "backgroundColor: '#131316'" },
  { from: /backgroundColor:\s*['"]#fff['"]/gi, to: "backgroundColor: '#131316'" },
  { from: /background:\s*['"]#ffffff['"]/gi, to: "background: '#131316'" },
  { from: /background:\s*['"]#fff['"]/gi, to: "background: '#131316'" },
  { from: /backgroundColor:\s*['"]#f5f5f5['"]/gi, to: "backgroundColor: '#1A1A1F'" },
  { from: /background:\s*['"]#f5f5f5['"]/gi, to: "background: '#1A1A1F'" },
  { from: /backgroundColor:\s*['"]#fafafa['"]/gi, to: "backgroundColor: '#16161B'" },
  { from: /background:\s*['"]#fafafa['"]/gi, to: "background: '#16161B'" },
  { from: /backgroundColor:\s*['"]#000000['"]/gi, to: "backgroundColor: '#D4A853'" },
  { from: /backgroundColor:\s*['"]#000['"]/gi, to: "backgroundColor: '#D4A853'" },
  { from: /background:\s*['"]#000['"]/gi, to: "background: '#D4A853'" },

  // Text Colors
  { from: /color:\s*['"]#0a0a0a['"]/gi, to: "color: '#EDEAE4'" },
  { from: /color:\s*['"]#000000['"]/gi, to: "color: '#EDEAE4'" },
  { from: /color:\s*['"]#000['"]/gi, to: "color: '#EDEAE4'" },
  { from: /color:\s*['"]#737373['"]/gi, to: "color: '#8A8680'" },
  { from: /color:\s*['"]#525252['"]/gi, to: "color: '#B0ADA8'" },
  { from: /color:\s*['"]#a3a3a3['"]/gi, to: "color: '#6A6763'" },

  // Borders
  { from: /border:\s*['"]1px solid #e5e5e5['"]/gi, to: "border: '1px solid #252530'" },
  { from: /borderBottom:\s*['"]1px solid #e5e5e5['"]/gi, to: "borderBottom: '1px solid #252530'" },
  { from: /borderTop:\s*['"]1px solid #e5e5e5['"]/gi, to: "borderTop: '1px solid #252530'" },
  { from: /borderRight:\s*['"]1px solid #e5e5e5['"]/gi, to: "borderRight: '1px solid #252530'" },
  { from: /borderLeft:\s*['"]1px solid #e5e5e5['"]/gi, to: "borderLeft: '1px solid #252530'" },
  { from: /borderColor:\s*['"]#e5e5e5['"]/gi, to: "borderColor: '#252530'" },
  { from: /border:\s*['"]1px solid #d4d4d4['"]/gi, to: "border: '1px solid #353540'" },

  // Icon strokes that are hardcoded `#0a0a0a` or `#000`
  { from: /color=['"]#0a0a0a['"]/gi, to: "color='#EDEAE4'" },
  { from: /color=['"]#000['"]/gi, to: "color='#EDEAE4'" },
  { from: /color=['"]#737373['"]/gi, to: "color='#8A8680'" },
  { from: /color=['"]#525252['"]/gi, to: "color='#B0ADA8'" },
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (stat.isFile() && fullPath.endsWith('.jsx')) {
      // Skip Layout.jsx and Dashboard.jsx
      if (fullPath.includes('Layout.jsx') || fullPath.includes('Dashboard.jsx')) continue;
      
      let content = fs.readFileSync(fullPath, 'utf8');
      let original = content;
      
      for (const rule of replacements) {
        content = content.replace(rule.from, rule.to);
      }
      
      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        changedFiles++;
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

srcDirs.forEach(dir => processDirectory(dir));
console.log(`Complete! Updated ${changedFiles} files.`);
