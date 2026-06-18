const fs = require('fs');
const path = require('path');

const replacements = [
  { from: /sales_orders/g, to: 'sales_orders' },
  { from: /sales_order/g, to: 'sales_order' },
  { from: /Sales Order/g, to: 'Sales Order' },
  { from: /so_number/g, to: 'so_number' },
  { from: /so_date/g, to: 'so_date' },
  { from: /so_id/g, to: 'so_id' },
  { from: /SO Number/g, to: 'SO Number' },
  { from: /SO Date/g, to: 'SO Date' },
];

function processDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    // Ignore node_modules, .next, .git
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.git'].includes(entry.name)) continue;
      processDirectory(fullPath);
    } else {
      // Process only text files (.ts, .tsx, .js, .cjs, .sql, .md)
      const ext = path.extname(entry.name);
      if (!['.ts', '.tsx', '.js', '.cjs', '.sql', '.md', '.json'].includes(ext)) continue;

      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;

      for (const { from, to } of replacements) {
        if (from.test(content)) {
          content = content.replace(from, to);
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

console.log('Starting bulk rename...');
processDirectory(path.resolve(__dirname));
console.log('Finished bulk rename.');
