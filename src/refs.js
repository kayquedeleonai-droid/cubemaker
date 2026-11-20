// Ficha técnica das armas do arsenal: ano de adoção, calibre e artigo da Wikipédia (en) quando o título é conhecido.
// [ano, calibre, artigo]  — artigo null: a ficha usa só links de busca.
export const REFS = {
  stielhandgranate24: [1924, 'carga de 165 g de TNT, espoleta de atrito (4,5 s)', 'Model_24_grenade'],
  stielhandgranate17: [1917, 'carga de TNT, espoleta de atrito', null],
  mk2: [1918, 'carga de TNT/EC em corpo de ferro fundido', 'Mk_2_grenade'],
  f1: [1941, 'carga de 60 g de TNT, corpo de ferro fundido', 'F1_grenade'],
  mills36: [1918, 'carga de baratol, corpo de ferro fundido', 'Mills_bomb'],
  eihandgranate39: [1939, 'carga de 112 g de TNT, espoleta de atrito', null],
  kugelhandgranate: [1915, 'esfera de ferro fundido com espoleta de atrito', null],
  rgd33: [1933, 'carga de TNT com luva de fragmentação', 'RGD-33_grenade'],
  m3trench: [1943, 'lâmina de 17 cm', 'M3_fighting_knife'],
  mk1trench: [1918, 'lâmina de 17 cm com soqueira de bronze', null],
  kampfmesser42: [1942, 'faca de combate', null],
  baioneta98: [1934, 'baioneta S84/98 III do Kar98k', null],
  fairbairn: [1941, 'lâmina dupla de 17 cm', 'Fairbairn–Sykes_fighting_knife'],
  luger: [1908, '9×19 mm Parabellum', 'Luger_pistol'],
  colt1911: [1911, '.45 ACP', 'M1911_pistol'],
  p38: [1938, '9×19 mm Parabellum', 'Walther_P38'],
  c96: [1896, '7,63×25 mm Mauser', 'Mauser_C96'],
  webley: [1915, '.455 Webley', 'Webley_Revolver'],
  nagant: [1895, '7,62×38 mmR', 'Nagant_M1895'],
  tt33: [1933, '7,62×25 mm Tokarev', 'TT_pistol'],
  hipower: [1935, '9×19 mm Parabellum', 'Browning_Hi-Power'],
  mp40: [1940, '9×19 mm Parabellum', 'MP_40'],
  thompson: [1938, '.45 ACP', 'Thompson_submachine_gun'],
  ppsh41: [1941, '7,62×25 mm Tokarev', 'PPSh-41'],
  sten: [1941, '9×19 mm Parabellum', 'Sten'],
  mp18: [1918, '9×19 mm Parabellum', 'MP_18'],
  m3grease: [1942, '.45 ACP', 'M3_submachine_gun'],
  pps43: [1943, '7,62×25 mm Tokarev', 'PPS_submachine_gun'],
  beretta38: [1938, '9×19 mm', 'Beretta_Model_38'],
  stg44: [1944, '7,92×33 mm Kurz', 'StG_44'],
  bar1918: [1918, '.30-06 Springfield', 'M1918_Browning_Automatic_Rifle'],
  fg42: [1942, '7,92×57 mm Mauser', 'FG_42'],
  mg42: [1942, '7,92×57 mm Mauser', 'MG_42'],
  lewis: [1914, '.303 British', 'Lewis_gun'],
  chauchat: [1915, '8×50 mmR Lebel', 'Chauchat'],
  kar98k: [1935, '7,92×57 mm Mauser (luneta ZF39)', 'Karabiner_98k'],
  gewehr98: [1898, '7,92×57 mm Mauser', 'Gewehr_98'],
  mosin: [1930, '7,62×54 mmR (luneta PU)', 'Mosin–Nagant'],
  springfield: [1942, '.30-06 Springfield (M1903A4)', 'M1903_Springfield'],
  enfield4: [1942, '.303 British (No. 4 Mk I (T))', 'Lee–Enfield'],
  arisaka99: [1939, '7,7×58 mm Arisaka', 'Type_99_rifle'],
  lebel: [1886, '8×50 mmR Lebel', 'Lebel_Model_1886_rifle'],
  m1carbine: [1942, '.30 Carbine', 'M1_carbine'],
  garand: [1936, '.30-06 Springfield', 'M1_Garand'],
  g43: [1943, '7,92×57 mm Mauser', 'Gewehr_43'],
  svt40: [1940, '7,62×54 mmR', 'SVT-40'],
  smle: [1907, '.303 British', 'Lee–Enfield'],
  win1897: [1897, 'calibre 12', 'Winchester_Model_1897'],
  ithaca37: [1937, 'calibre 12', 'Ithaca_37'],
};
const q = s => encodeURIComponent(s);
// links de referência (os de busca sempre abrem algo útil)
export function refLinks(name, id) {
  const r = REFS[id], clean = name.replace(/["“”]/g, '').replace(/\s+\+.*$/, '');
  const out = [];
  if (r && r[2]) out.push(['Wikipédia (artigo)', 'https://en.wikipedia.org/wiki/' + q(r[2]).replace(/%2F/g, '/')]);
  out.push(['Wikipédia (busca)', `https://en.wikipedia.org/wiki/Special:Search?go=Go&search=${q(clean)}`]);
  out.push(['Imperial War Museums — acervo', `https://www.iwm.org.uk/collections/search?query=${q(clean)}`]);
  out.push(['Fotos de referência (Google Imagens)', `https://www.google.com/search?tbm=isch&q=${q(clean + ' WW2 museum')}`]);
  out.push(['Vista lateral (Google Imagens)', `https://www.google.com/search?tbm=isch&q=${q(clean + ' side view')}`]);
  out.push(['Vídeos (desmontagem / tiro)', `https://www.youtube.com/results?search_query=${q(clean + ' forgotten weapons')}`]);
  return out;
}
