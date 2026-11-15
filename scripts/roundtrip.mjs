import fs from 'fs';
import {parseMD3,buildMD3,computeIslands} from '../src/md3.js';
const b=fs.readFileSync(process.argv[2]); const ab=b.buffer.slice(b.byteOffset,b.byteOffset+b.length);
const m=parseMD3(ab); m.surfaces.forEach(s=>{computeIslands(s);console.log(s.name,s.nv,s.ntri,'islands',s.nIsl,'pieces',new Set(s.piece).size)});
const out=buildMD3(m,{surfaces:m.surfaces.map(s=>({tris:s.tris,pos:s.pos,nrm:s.nrm,nraw:s.nraw})),tags:m.tags});
const m2=parseMD3(out); let md=0,nd=0;
m.surfaces.forEach((s,i)=>{for(let f=0;f<m.nf;f++)for(let k=0;k<s.pos[f].length;k++){md=Math.max(md,Math.abs(s.pos[f][k]-m2.surfaces[i].pos[f][k]));nd=Math.max(nd,Math.abs(s.nrm[f][k]-m2.surfaces[i].nrm[f][k]));}});
console.log('size',ab.byteLength,out.byteLength,'maxPosDiff',md,'maxNrmDiff',nd.toFixed(3));
fs.writeFileSync('/tmp/rt.md3',Buffer.from(out));
