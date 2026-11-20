// CUBE MAKER → CubeForge: empacota o modelo (arquivos do jogo + LEIA-ME + licença + print) e publica no
// repositório do site num único commit (API Git do GitHub). O Cloudflare publica o site sozinho a cada commit.
const API = 'https://api.github.com';
export const BRAND = 'CUBEFORGE Model by Kayque Deleon';

const b64 = async blob => { const u = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const b64text = t => btoa(unescape(encodeURIComponent(t)));
export const slugify = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'modelo';
export const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

// textos do pacote
export function packTexts(meta) {
  const year = new Date().getFullYear(), hands = meta.kind === 'arma';
  const lic = hands
    ? `${BRAND}\n© ${year} Kayque Deleon — CubeForge (https://cubeforge.kayquedeleon.app)\n\nO modelo da arma, a textura, as animações e os sons deste pacote foram criados por Kayque Deleon no CUBE MAKER.\nAs mãos em primeira pessoa usam a malha original do AssaultCube, de Markus "makkE" Bekel, sob a licença\nCreative Commons BY-NC-SA 2.5. Por isso este pacote inteiro é distribuído sob a mesma licença:\n\n  Creative Commons Atribuição-NãoComercial-CompartilhaIgual 2.5 (CC BY-NC-SA 2.5)\n  https://creativecommons.org/licenses/by-nc-sa/2.5/\n\nVocê pode usar e modificar, sem fins comerciais, mantendo o crédito "${BRAND}" (e makkE pelas mãos)\ne distribuindo versões modificadas sob a mesma licença.\n`
    : `${BRAND}\n© ${year} Kayque Deleon — CubeForge (https://cubeforge.kayquedeleon.app). Todos os direitos reservados.\n\nModelo, textura${meta.anim ? ', animação' : ''} e arquivos de configuração criados por Kayque Deleon no CUBE MAKER (obra original).\n\nPERMITIDO: usar nos seus mapas e servidores de AssaultCube, inclusive mapas publicados, mantendo este\narquivo e o crédito "${BRAND}" no .cfg do mapa ou na descrição.\nNÃO PERMITIDO: vender, revender ou incluir em pacotes pagos; publicar o modelo como se fosse seu;\nredistribuir fora de um mapa sem o crédito.\n\nPara outros usos, fale com o autor pelo CubeForge.\n`;
  const how = meta.howto;
  const pt = `${meta.nome}\n${'='.repeat(meta.nome.length)}\n${BRAND}\n\n${meta.descricao}\n\nCOMO INSTALAR\n${how.pt}\n\nCRÉDITOS E DIREITOS\n${hands ? `Arma: ${BRAND}. Mãos: makkE (AssaultCube), CC BY-NC-SA 2.5. Veja LICENCA.txt.` : `${BRAND} — © ${new Date().getFullYear()} Kayque Deleon. Veja LICENCA.txt.`}\n\nMais modelos: https://cubeforge.kayquedeleon.app/arsenal.html\n`;
  const en = `${meta.nome}\n${'='.repeat(meta.nome.length)}\n${BRAND}\n\n${meta.descricao_en || meta.descricao}\n\nHOW TO INSTALL\n${how.en}\n\nCREDITS & COPYRIGHT\n${hands ? `Weapon: ${BRAND}. Hands: makkE (AssaultCube), CC BY-NC-SA 2.5. See LICENCA.txt.` : `${BRAND} — © ${new Date().getFullYear()} Kayque Deleon. See LICENCA.txt (Portuguese): free to use in AssaultCube maps and servers with credit; no resale.`}\n\nMore models: https://cubeforge.kayquedeleon.app/en/arsenal.html\n`;
  return { lic, pt, en };
}

async function gh(token, method, path, body) {
  const r = await fetch(API + path, { method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) { let m = ''; try { m = (await r.json()).message; } catch (e) { } throw new Error(`GitHub ${r.status}: ${m || r.statusText}${r.status === 401 ? ' (token inválido ou vencido)' : r.status === 403 || r.status === 404 ? ' (o token precisa de acesso "Contents: Read and write" a este repositório)' : ''}`); }
  return r.status === 204 ? null : r.json();
}
// files: [{ path, blob }] ; entry: item do arsenal ; cat: chave da seção
export async function publishToRepo({ token, repo, branch = 'main', files, entry, cat, onStep = () => { } }) {
  onStep('Lendo o repositório…');
  const ref = await gh(token, 'GET', `/repos/${repo}/git/ref/heads/${branch}`), head = ref.object.sha;
  const commit = await gh(token, 'GET', `/repos/${repo}/git/commits/${head}`);
  // arsenal.json atual
  const cur = await gh(token, 'GET', `/repos/${repo}/contents/public/data/arsenal.json?ref=${branch}`);
  const data = JSON.parse(decodeURIComponent(escape(atob(cur.content.replace(/\n/g, '')))));
  data[cat] = data[cat] || [];
  const i = data[cat].findIndex(x => x.arquivo === entry.arquivo);
  if (i >= 0) data[cat][i] = { ...data[cat][i], ...entry }; else data[cat].unshift(entry);
  const tree = [];
  for (const f of files) { onStep('Enviando ' + f.path.split('/').pop() + '…'); const blob = await gh(token, 'POST', `/repos/${repo}/git/blobs`, { content: await b64(f.blob), encoding: 'base64' }); tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha }); }
  const js = await gh(token, 'POST', `/repos/${repo}/git/blobs`, { content: b64text(JSON.stringify(data, null, 2) + '\n'), encoding: 'base64' });
  tree.push({ path: 'public/data/arsenal.json', mode: '100644', type: 'blob', sha: js.sha });
  onStep('Criando o commit…');
  const t = await gh(token, 'POST', `/repos/${repo}/git/trees`, { base_tree: commit.tree.sha, tree });
  const c = await gh(token, 'POST', `/repos/${repo}/git/commits`, { message: `Arsenal: ${i >= 0 ? 'atualiza' : 'adiciona'} ${entry.nome} (${BRAND})\n\nPublicado pelo CUBE MAKER.`, tree: t.sha, parents: [head] });
  await gh(token, 'PATCH', `/repos/${repo}/git/refs/heads/${branch}`, { sha: c.sha });
  return { commit: c.sha, updated: i >= 0, html: c.html_url };
}
