# CUBE MAKER

Editor de armas para **AssaultCube** que roda no navegador. Abre os modelos MD3 do jogo, repinta a skin com materiais de época (Segunda Guerra), modifica a malha, cria animações por quadros-chave e exporta um pacote pronto para o jogo.

**Site:** https://cubemaker.kayquedeleon.app

## O que faz

- **Visualizador 3D** de modelos MD3 (hudguns), com as partes `weapon` e `hands`, a tag `tag_muzzle` e a "Visão FPS" (câmera no olho do jogador, como no jogo).
- **Editor de skin**
  - 15 materiais procedurais: aço oxidado, parkerizado, nogueira, faia, baquelite, feldgrau, dunkelgelb, latão, couro e outros. Eles preservam o relevo e os detalhes da textura original.
  - Presets MP40, Thompson, Kar98k e M1 Garand.
  - Desgaste automático nas bordas, envelhecimento e sujeira.
  - Pincel, borracha e conta-gotas, tanto em cima do modelo 3D quanto na vista UV.
- **Malha**: selecione ilhas ou peças, agrupe e mova, gire, escale ou oculte. Ajusta também a posição da boca do cano.
- **Animação**: quadros-chave por grupo com interpolação suave, presets de ferrolho e gatilho no tiro, e alteração do número de quadros. Os intervalos vêm das linhas `md3anim` do `md3.cfg`.
- **Exportação**: `tris_high.md3` (o gravador devolve o original byte a byte quando nada muda), a skin `.jpg`/`.png`, o `md3.cfg` e um `.zip` com a estrutura `packages/models/weapons/<arma>/` e os créditos.
- **Instalar no jogo**: um botão grava a arma direto na pasta home do AssaultCube (Chrome ou Edge).
  - Antes de gravar, guarda os originais em `cubemaker_backup/originais/` e a versão anterior em `cubemaker_backup/<data_hora>/`.
  - Registra tudo em `cubemaker_backup/historico.json`.
  - **Restaurar original** devolve a arma de fábrica.
- **Projeto** `.cubemaker`: salva e reabre todo o trabalho.
- Desfazer/refazer, atalhos de teclado, arrastar e soltar pastas.

## Instalar uma arma no jogo

**Direto:** clique em **Instalar no jogo**. Na primeira vez, conecte a pasta `Documentos\My Games\AssaultCube\v1.3`.

**Manual:**

1. Clique em **Exportar .zip**.
2. Extraia o zip na pasta home do AssaultCube: `Documentos\My Games\AssaultCube\v1.3\`. Os arquivos da home substituem os originais sem mexer na instalação.
3. Abra o jogo.

## Desenvolvimento

```bash
npm install
npm run build      # gera dist/index.html (arquivo único, funciona offline)
npm test           # ida e volta do MD3 de exemplo (precisa ser idêntico)
npx wrangler deploy
```

Código-fonte em `src/`:

| Arquivo | Conteúdo |
|---|---|
| `md3.js` | leitura e escrita de MD3, ilhas UV e parser do `md3.cfg` |
| `materials.js` | materiais e ruído procedural |
| `main.js` | app: 3D (three.js), skin, grupos, animação e exportação |
| `index.html`, `style.css` | interface |

O `dist/` vai versionado para o Cloudflare servir sem passo de build (`wrangler.jsonc`).

## Créditos e licença dos modelos

O exemplo em `assets/demo/` (submachine gun e mãos) é de **makkE (Markus Bekel)** para o AssaultCube, sob **CC BY-NC-SA 2.5** (veja `assets/demo/LICENSE-makkE.txt`). Armas derivadas desses modelos devem manter o crédito, ser não comerciais e usar a mesma licença. O CUBE MAKER inclui esse aviso automaticamente no zip exportado.

## Próximos passos

- Modelos de mundo/terceira pessoa (MD2, `world/tris.md2`) para a arma nova aparecer também na mão dos outros jogadores
- Modelagem de peças novas (primitivas: cilindro para cano, caixa para carregador) e UV automático
- Camadas de pintura e decalques (inscrições, números de série)
