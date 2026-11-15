# CUBE MAKER

Editor de armas para **AssaultCube** que roda no navegador. Abre os modelos MD3 do jogo, repinta a skin com materiais de época (Segunda Guerra), modifica a malha, cria animações por quadros-chave e exporta um pacote pronto para o jogo.

**Site:** https://cubemaker.kayquedeleon.app

## O que faz

O trabalho segue um **pipeline em 5 etapas**:

1. **Arma**
   - **Arsenal da 1ª e 2ª Guerra**: 39 modelos prontos, com textura e grupos de animação, que entram no lugar da arma do AC.
     - Granadas: Stielhandgranate 24/17, Mk 2, F1, Mills Nº 36, Eihandgranate 39, Kugelhandgranate, RGD-33
     - Facas e baionetas: M3, Mk I, Kampfmesser 42, S84/98, Fairbairn-Sykes
     - Pistolas: Luger, 1911, P38, C96, Webley, Nagant
     - SMGs: MP40, Thompson, PPSh-41, Sten, MP18
     - Fuzis de assalto: StG 44, BAR, FG 42
     - Fuzis de ferrolho: Kar98k, Gewehr 98, Mosin, Springfield, Enfield Nº 4
     - Carabinas: M1 Carbine, Garand, G43, SVT-40, SMLE
     - Escopetas: Winchester 1897, Ithaca 37
   - As 8 armas originais do AC vêm embutidas (faca, pistola, carabina, escopeta, SMG, fuzil de assalto, sniper, granada). Também abre uma pasta, arquivos soltos ou um projeto.
2. **Modelagem**
   - **Auto-rig**: as 8 armas originais já abrem com os grupos prontos (ferrolho, carregador, gatilho, mão, telha do pump, pino, luneta, cano). O Kar98k e a carabina ganham uma alavanca de ferrolho nova.
   - Receitas da Segunda Guerra (MP40, Thompson, StG 44, Kar98k, M1 Carbine, Winchester 1897, Luger, 1911, M3, Stielhandgranate).
   - Grupos de peças com mover, girar, escalar e ocultar.
   - Hierarquia: um grupo "segue" outro, por exemplo a mão segue o carregador.
   - Peças novas (cilindro, caixa, carregador, estojo, projétil, pino) exportadas no MD3 com textura própria.
3. **Textura**
   - Banco de texturas com miniaturas: metais, madeiras, pinturas, camuflagens (Splinter, Erbsenmuster, inverno, DAK), quadriculado, recartilhado e ferrugem. Aceita texturas importadas.
   - Presets de época.
   - **Camadas procedurais** estilo Substance: sujeira nas cavidades, arranhões, ferrugem, poeira por cima, pólvora no cano e sangue.
   - **Decalques**: texto ou símbolos; pintado, gravado ou carimbo; com desgaste e espelhamento automático.
   - Pincel.
4. **Animação**
   - **Banco de animações** por tipo de arma, mais as animações salvas por você. Com o auto-rig, funciona com um clique. Faca, granada e escopeta mantêm a animação original e recebem as novas por cima.
   - **Geradores**: recuo com mola, ferrolho, ferrolho manual, pump, gatilho, recarga completa, estojo ejetado, traçante, granada (pino + arremesso), golpe de faca e respiração.
   - Quadros-chave com curvas (suave, impacto, mola, passa-e-volta, degrau), escala 0 para sumir e trilha "arma inteira".
   - Montador de clipes que reescreve o `md3anim`.
   - **Modo Jogo**: estande de tiro com clarão, traçante, estojos, impactos, som sintetizado, recarga (R) e granada (G).
5. **Exportar**
   - **Instalar no jogo** com backup automático e restauração.
   - Zip, md3, skin, cfg e projeto `.cubemaker`.

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
| `main.js` | app: 3D (three.js), pipeline, skin, camadas, decalques, grupos, motor de animação, exportação e instalação |
| `presets.js` | arsenal: modelos procedurais WWI/WWII, atlas UV e encaixe no slot |
| `game.js` | Modo Jogo (estande de tiro, efeitos e som) |
| `index.html`, `style.css` | interface |

O `dist/` vai versionado para o Cloudflare servir sem passo de build (`wrangler.jsonc`). Os modelos originais ficam em `assets/weapons/` e são copiados para `dist/weapons/`. As miniaturas são geradas por `scripts/thumbs.py`.

## Créditos e licença dos modelos

Os modelos em `assets/weapons/` são de **makkE (Markus Bekel)** para o AssaultCube, sob **CC BY-NC-SA 2.5** (veja `assets/weapons/LICENSE-makkE.txt`). Armas derivadas desses modelos devem manter o crédito, ser não comerciais e usar a mesma licença. O CUBE MAKER inclui esse aviso automaticamente no zip exportado.

## Próximos passos

- Modelos de mundo/terceira pessoa (MD2, `world/tris.md2`) para a arma nova aparecer também na mão dos outros jogadores
- Camadas de pintura empilháveis com máscaras
