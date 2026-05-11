const fs = require('fs');
let content = fs.readFileSync('src/components/Reports.tsx', 'utf8');
const p1 = content.indexOf('onClick={() => {\n                    const html = `');
const p2 = content.indexOf('                  className="w-full bg-slate-900', p1);
if (p1 !== -1 && p2 !== -1) {
  content = content.substring(0, p1) + 'onClick={handlePrintValuation}\n' + content.substring(p2);
  fs.writeFileSync('src/components/Reports.tsx', content);
  console.log('Fixed inline print');
}
