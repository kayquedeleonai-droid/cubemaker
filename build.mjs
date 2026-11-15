// Gera dist/: index.html (arquivo único) + weapons/ (modelos originais do AC servidos ao lado)
import { build } from 'esbuild';
import fs from 'fs';

const out = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none' });
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync('src/style.css', 'utf8');
const html = fs.readFileSync('src/index.html', 'utf8').replace('/*CSS*/', () => css).replace('/*JS*/', () => js);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
fs.cpSync('assets/weapons', 'dist/weapons', { recursive: true });
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB · weapons/ copiado');
