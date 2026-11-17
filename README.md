# CUBE MAKER

Editor de armas para **AssaultCube** que roda no navegador. Abre os modelos MD3 do jogo, repinta a skin com materiais de época (Segunda Guerra), modifica a malha, cria animações por quadros-chave e exporta um pacote pronto para o jogo.

**Site:** https://cubemaker.kayquedeleon.app

## O que faz

O trabalho segue um **pipeline em 5 etapas**, para armas e para personagens.

**Personagens (uniformes):**
- Abra a pasta `packages/models/playermodels` do seu AC.
- 13 uniformes prontos: Wehrmacht, Fallschirmjäger, Afrika Korps, Frente Leste, US Army, USMC, britânicos, Exército Vermelho (verão e inverno), Alemanha 1916, Poilu, Tommy e Doughboy.
- Cada peça (túnica, mangas, calça, perneiras, botas, capacete) pode ser editada com tecidos e couros.
- Insígnias rápidas: nome, número, divisas, estrela e braçadeira.
- Instalação como skin de time (CLA/RVSF) ou por apelido (`custom/<apelido>_cla.jpg`), com backup.
- O modelo de jogador é de Darren Pattenden / makkE e só pode ser usado para fins pessoais. Por isso ele **não** fica no repositório nem no site: o app lê o boneco do seu jogo.

**Armas:**

0. **Forja: criar arma do zero.**
   - Seis famílias: pistola, submetralhadora, fuzil de assalto, ferrolho, semiautomático e escopeta.
   - Controles para época (1ª/2ª Guerra ou moderna), cano, corpo, coronha, carregador, empunhadura, punho frontal, mira (ferro, luneta, ponto vermelho), boca (freio, supressor, compensador), camisa perfurada, bipé, baioneta, lado da alavanca, metal e madeira.
   - A arma é refeita na hora, já com textura, grupos e animação de fábrica.

0d. **Importar modelo** (.obj, .glb ou .gltf embutido, do Blender, Sketchfab…): vira arma de qualquer slot ou mapmodel. Cada peça vira grupo animável (nomes como magazine/bolt/trigger viram Carregador/Ferrolho/Gatilho) e ganha material pelo nome/cor; dá para girar, inverter a frente, ajustar tamanho e posição.
0e. **Cena (diorama)**: arraste mapmodels num chão com sombra, gire (Q/E), duplique (D), salve, e exporte as linhas `mapmodel` do mapa + uma planta vista de cima com as posições em cubos do AC.
0f. **Estúdio de som** (etapa Animação → Som): tiro e recarga sintetizados por arma (força, estalo, eco, mecânica, tom, distância), recarga sincronizada com a animação, exportados em Ogg Vorbis e instalados com backup (nome lido de `config/sounds.cfg`). O Modo Jogo usa esses sons.
0g. **Texturas**: desgaste só nas quinas salientes de verdade (curvatura calculada da malha) e opção de textura 2K.
0h. **Animações próprias**: MG 42 abre a tampa e troca a fita, Lewis tira e gira o prato, Chauchat solta o carregador em meia-lua.

0c. **Itens do jogo (pickups)**: caixote de munição de madeira, pentes de pistola, granadas, bolsa de enfermeiro, capacete, colete antiestilhaço e par de 1911 para o akimbo. Substituem só a aparência dos itens do AC (o efeito continua igual) e vão para `packages/models/pickups/<item>/` em MD2 e MD3, com backup.

0b. **Mapmodels da 1ª e 2ª Guerra** (cenário para os seus mapas)
   - 50 modelos em 7 categorias: fortificações (sacos de areia, arame farpado em sanfona, cavalo de frisa, ouriço tcheco, dentes de dragão, parede de trincheira, estrado, casamata, torre de vigia), veículos e tanques (Jeep Willys, Kübelwagen, BMW R75 com sidecar, Opel Blitz, Sherman, Tiger I, T-34/85, Panzer IV destruído), aviões (Spitfire, Bf 109, P-51D, Zero, Stuka, Fokker Dr.I, Sopwith Camel e um caça abatido), artilharia (Flak 88, PaK 40, canhão de 75 de 1897, morteiro, MG 42 no tripé, Vickers, holofote), objetos (caixotes, latas, tambores, galão, rádio, capacetes no chão, túmulo de campanha, cruz, maca, mesa com mapa, lampião, máscara de gás, estojos de artilharia, bicicleta), cenário (muro em ruínas, postes, feno, carroça, barraca, cerca, árvore estilhaçada, toco, placa, bandeira) e soldados caídos (5 poses × 13 uniformes, e corpo coberto).
   - Variações (pintura, uniforme, pose), hélices/holofotes/bandeira animados (`md3anim "mapmodel"`), texturas com oclusão de ambiente e soldado de 1,80 m na tela como referência de escala (≈ 50 unidades MD3 por metro, calibrado com os mapmodels do próprio AC).
   - Instala em `packages/models/mapmodels/cubemaker/<modelo>/` (nada do jogo é substituído) e pode acrescentar a linha `mapmodel …` ao `.cfg` do mapa, com backup.

1. **Arma**
   - **Arsenal da 1ª e 2ª Guerra**: 49 modelos prontos, com textura e grupos de animação, que entram no lugar da arma do AC. A maioria foi refeita em alta fidelidade e todas recebem **acabamento**: cantos arredondados nos perfis (madeira bem mais arredondada), blocos chanfrados, cilindros com bisel e sombreamento suave nas curvas (chanfros, parafusos, guarda-mato vazado, miras com túnel, lunetas com torres, coronhas com pistol grip) e entraram MG 42, Lewis, Chauchat, M3 "Grease Gun", PPS-43, Beretta 38, Arisaka Tipo 99, Lebel 1886, Tokarev TT-33 e Browning Hi-Power.
   - Cada modelo já abre com a **animação de fábrica** dele:
     - granadas: pino, tampa ou cordão sendo tirado e a alavanca voando no arremesso
     - armas de fogo: impacto/recuo com mola, cápsula ejetada e traçante, mais o mecanismo de cada uma (articulação da Luger, cão e tambor do revólver, slide, ferrolho, ferrolho manual, pump)
     - recarga de cada tipo: carregador caindo (para o lado na Sten, MP18 e FG 42), tambor girando, pente de lâminas por cima (Kar98k, Mosin, Garand) ou cartuchos um a um (escopetas)
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
   - **Modo Jogo**, com duas opções de mapa:
     - **Arena CQB:** salas, corredores e caixotes. Você anda com WASD (Shift corre) e enfrenta 6 soldados-bot que patrulham, viram para você e atiram no modo Combate (ou só patrulham no Treino). Eles levam dano (tiro na cabeça vale 2,5×), caem e renascem. O HUD mostra vida, abates e mortes.
     - **Estande de tiro:** alvos.
     - Nos dois: clarão, traçante, estojos, impactos, som sintetizado, recarga (R) e granada (G).
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
| `md3.js` também lê | MD2 (modelo de jogador, só leitura) |
| `presets.js` | arsenal: modelos procedurais WWI/WWII, atlas UV e encaixe no slot |
| `game.js` | Modo Jogo (efeitos, som, movimento, combate) |
| `arena.js` | arena CQB e soldados-bot |
| `index.html`, `style.css` | interface |

O `dist/` vai versionado para o Cloudflare servir sem passo de build (`wrangler.jsonc`). Os modelos originais ficam em `assets/weapons/` e são copiados para `dist/weapons/`. As miniaturas são geradas por `scripts/thumbs.py`.

## Créditos e licença dos modelos

Os modelos em `assets/weapons/` são de **makkE (Markus Bekel)** para o AssaultCube, sob **CC BY-NC-SA 2.5** (veja `assets/weapons/LICENSE-makkE.txt`). Armas derivadas desses modelos devem manter o crédito, ser não comerciais e usar a mesma licença. O CUBE MAKER inclui esse aviso automaticamente no zip exportado.

## Próximos passos

- Modelos de mundo/terceira pessoa (MD2, `world/tris.md2`) para a arma nova aparecer também na mão dos outros jogadores
- Camadas de pintura empilháveis com máscaras
