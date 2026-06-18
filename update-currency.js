const fs = require('fs');
const path = require('path');

const files = [
  'nids-app/app/reports/inventory/page.tsx',
  'nids-app/app/reports/invoice/page.tsx',
  'nids-app/app/reports/payments/page.tsx',
  'nids-app/app/reports/purchase-order/page.tsx',
  'nids-app/app/reports/quotation/page.tsx'
];

files.forEach(file => {
  const filePath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(filePath)) {
    console.error('File not found: ' + filePath);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');

  // Add import if not exists
  if (!content.includes('SITE_CONFIG')) {
    // find a good place to insert, e.g., after last import
    const lastImportIndex = content.lastIndexOf('import ');
    const endOfLastImport = content.indexOf('\n', lastImportIndex);
    if (endOfLastImport !== -1) {
      content = content.slice(0, endOfLastImport) + '\nimport { SITE_CONFIG } from "@/lib/site-content"' + content.slice(endOfLastImport);
    }
  }

  // Replace Rp with {SITE_CONFIG.currencySymbol}
  // There are patterns like: Rp {
  // We should be careful to only replace text within UI rendering
  content = content.replace(/Rp\s+(?=\{)/g, '{SITE_CONFIG.currencySymbol} ');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated ' + file);
});
