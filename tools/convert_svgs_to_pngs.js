// Convert SVG icons in static/tab to PNG using sharp
const fs = require('fs');
const path = require('path');
async function main() {
  const sharp = require('sharp');
  const dir = path.join(__dirname, '..', 'static', 'tab');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg'));
  for (const f of files) {
    const svgPath = path.join(dir, f);
    const base = path.basename(f, '.svg');
    const outPath = path.join(dir, base + '.png');
    try {
      // Render at 96x96 for good resolution
      await sharp(svgPath).png().resize(96, 96).toFile(outPath);
      console.log('Converted', svgPath, '->', outPath);
    } catch (e) {
      console.error('Failed to convert', svgPath, e);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
