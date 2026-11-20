// CUBE MAKER → CubeForge: empacota o modelo (arquivos do jogo + LEIA-ME + licença + print) e publica no
// arsenal do site pela conta OFICIAL do CubeForge (kayquedeleonai@gmail.com). A conta autoriza o CUBE MAKER
// em "Minha conta" no site; o site guarda só o hash da chave e recusa qualquer outra conta.
export const CF = 'https://cubeforge.kayquedeleon.app';
export const BRAND = 'CUBEFORGE Model by Kayque Deleon';

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

const ERR = {
  no_key: 'Conecte a conta oficial do CubeForge primeiro.',
  bad_key: 'A autorização expirou ou foi desligada (trocar a senha no site desconecta). Conecte de novo.',
  not_official: 'Só a conta oficial do CubeForge (kayquedeleonai@gmail.com) pode publicar pelo CUBE MAKER.',
  bad_origin: 'O site recusou o pedido (origem não autorizada).',
  too_many: 'Limite de publicações do dia atingido. Tente amanhã.',
  file_too_big: 'O pacote passa de 25 MB.', file_type: 'O site recusou o arquivo (tipo inválido).',
  image_too_big: 'O print passa de 2 MB.', image_type: 'O print precisa ser PNG, JPG ou WebP.',
  too_long: 'Nome ou descrição longos demais (nome até 80, descrição até 2000 caracteres).',
  empty: 'Preencha o nome.', bad_category: 'Seção inválida.',
};
async function call(key, method, path, body) {
  let r;
  try { r = await fetch(`${CF}/api/${path}`, { method, headers: { Authorization: `Bearer ${key}` }, body }); }
  catch (e) { throw new Error('Sem conexão com o CubeForge. Confira a internet e tente de novo.'); }
  let d = null; try { d = await r.json(); } catch (e) { }
  if (!r.ok) { const c = d && d.error; const e = new Error(ERR[c] || `CubeForge respondeu ${r.status}${c ? ' (' + c + ')' : ''}`); e.code = c; throw e; }
  return d;
}
export const cfWhoami = key => call(key, 'GET', 'cubemaker/whoami');

// Abre a página "Minha conta" do CubeForge numa janela; ao autorizar, ela devolve a chave por postMessage
export function cfConnect() {
  return new Promise((resolve, reject) => {
    const w = window.open(`${CF}/conta?cubemaker=1`, 'cubeforge_auth', 'width=560,height=760');
    if (!w) return reject(new Error('O navegador bloqueou a janela. Libere pop-ups para o CUBE MAKER ou cole a chave manualmente.'));
    const done = (fn, v) => { window.removeEventListener('message', on); clearInterval(t); fn(v); };
    const on = e => {
      if (e.origin !== CF || !e.data || e.data.type !== 'cubeforge-key' || typeof e.data.key !== 'string') return;
      done(resolve, e.data);
    };
    window.addEventListener('message', on);
    const t = setInterval(() => { if (w.closed) setTimeout(() => done(reject, new Error('Janela fechada sem autorizar.')), 400); }, 600);
  });
}

// Publica (ou atualiza, se já houver um item com o mesmo nome na mesma seção)
export async function cfPublishPost({ key, category, title, description, file, fileName, image, imageName }) {
  const fd = new FormData();
  fd.append('category', category); fd.append('title', title); fd.append('description', description);
  fd.append('file', file, fileName);
  if (image) fd.append('image', image, imageName);
  const r = await call(key, 'POST', 'cubemaker/publish', fd);
  return { ...r, link: CF + r.url };
}
