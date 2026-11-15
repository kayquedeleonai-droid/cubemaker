// Gera dist/index.html (arquivo único, funciona offline e no Cloudflare)
import { build } from 'esbuild';
import fs from 'fs';

const demoDir = process.env.DEMO_DIR || 'assets/demo';
const out = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none' });
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync('src/style.css', 'utf8');
let demo = '';
if (fs.existsSync(`${demoDir}/tris_high.md3`)) {
  const b64 = f => fs.readFileSync(`${demoDir}/${f}`).toString('base64');
  const D = {
    md3: b64('tris_high.md3'),
    skinWeapon: 'data:image/jpeg;base64,' + b64('skin_weapon.jpg'),
    skinHands: 'data:image/jpeg;base64,' + b64('skin_hands.jpg'),
    cfg: fs.readFileSync(`${demoDir}/md3.cfg`, 'utf8')
  };
  demo = `<script>window.CM_DEMO=${JSON.stringify(D)};</script>`;
}
const html = fs.readFileSync('src/index.html', 'utf8')
  .replace('/*CSS*/', () => css).replace('<!--DEMO-->', () => demo).replace('/*JS*/', () => js);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB');
