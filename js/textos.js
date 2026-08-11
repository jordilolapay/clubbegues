// textos.js — tot el text en català que es veu a la web.
//
// Els fitxers de datos/ estan en castellà (són els que genera l'organització del torneig).
// Aquí es tradueix el que es mostra, sense tocar-los. Si un dia canvieu el nom d'un esport,
// canvieu-lo AQUÍ, no a datos/torneo.json.

/** Nom de cada esport a la web, per l'id de datos/torneo.json. */
export const NOMS_ESPORTS = {
  petanca: 'Petanca',
  'voleibol-playa': 'Voleibol platja',
  'voleibol-pista': 'Voleibol pista',
  tenis: 'Tennis',
  fronton: 'Frontó',
  padel: 'Pàdel',
  'ping-pong': 'Ping-pong',
  'futbol-sala': 'Futbol sala',
  'futbol-siete': 'Futbol 7',
  balonmano: 'Handbol',
  baloncesto: 'Bàsquet',
  waterpolo: 'Waterpolo',
  domino: 'Dòmino',
  ajedrez: 'Escacs',
  dardos: 'Dards',
  futbolin: 'Futbolí',
  billar: 'Billar',
  minigolf: 'Minigolf',
  ciclismo: 'Ciclisme',
  atletismo: 'Atletisme',
  natacion: 'Natació',
};

/** Nom de cada categoria de punts. */
export const NOMS_CATEGORIES = {
  equipo: { llarg: "Esports d'equip", curt: 'Equip' },
  resistencia: { llarg: 'Resistència', curt: 'Resistència' },
  individual: { llarg: 'Esports individuals', curt: 'Individual' },
};

/** Nom de cada grup afí (esports que s'assemblen). */
export const NOMS_GRUPS = {
  voleibol: 'Voleibol',
  futbol: 'Futbol',
  raqueta: 'Raqueta i pala',
  precision: 'Precisió',
  mesa: 'Taula i ment',
  'balonmano-waterpolo': 'Handbol i waterpolo',
};

/** Nom llarg i sigla de cada partit del quadre. */
export const NOMS_PARTITS = {
  previa1: { llarg: 'Prèvia 1', sigla: 'P1' },
  previa2: { llarg: 'Prèvia 2', sigla: 'P2' },
  qf1: { llarg: 'Quarts 1', sigla: 'QF1' },
  qf2: { llarg: 'Quarts 2', sigla: 'QF2' },
  qf3: { llarg: 'Quarts 3', sigla: 'QF3' },
  qf4: { llarg: 'Quarts 4', sigla: 'QF4' },
  sf1: { llarg: 'Semifinal 1', sigla: 'SF1' },
  sf2: { llarg: 'Semifinal 2', sigla: 'SF2' },
  final: { llarg: 'Final', sigla: 'Final' },
  tercerPuesto: { llarg: '3r i 4t lloc', sigla: '3r/4t' },
  consSf1: { llarg: 'Semifinal consolació 1', sigla: 'SC1' },
  consSf2: { llarg: 'Semifinal consolació 2', sigla: 'SC2' },
  consFinal: { llarg: 'Final consolació · 5è i 6è lloc', sigla: '5è/6è' },
  consTercero: { llarg: '7è i 8è lloc', sigla: '7è/8è' },
  puesto9: { llarg: '9è i 10è lloc', sigla: '9è/10è' },
};

/** Títol de cada columna del quadre. */
export const NOMS_RONDES = {
  previes: 'Prèvies',
  quarts: 'Quarts',
  semis: 'Semifinals',
  final: 'Final',
  consSemis: 'Semifinals',
  consFinal: 'Final consolació',
};

/**
 * Esports que van per ordre i no per eliminatòries: com se'n diu la taula i què hi ha
 * a la columna del marcador. Si un esport no surt aquí, es fa servir DEFECTE.
 */
export const TEXTOS_CLASSIFICACIO = {
  DEFECTE: {
    titol: "Ordre d'arribada",
    nota: "En aquest esport no hi ha eliminatòries: s'apunta directament l'ordre d'arribada.",
    marca: 'Marca',
  },
  minigolf: {
    titol: 'Classificació',
    nota: 'En aquest esport no hi ha eliminatòries: guanya qui fa menys cops en tot el circuit, ' +
      'i la resta d\'equips s\'ordenen de menys a més cops.',
    marca: 'Cops',
  },
};

export const textosClassificacio = (id) => TEXTOS_CLASSIFICACIO[id] ?? TEXTOS_CLASSIFICACIO.DEFECTE;

/** Nom de cada competició. */
export const NOMS_COMPETICIONS = {
  masculina: 'Masculí',
  femenina: 'Femení',
};

const ORDINALS = ['1r', '2n', '3r', '4t', '5è', '6è', '7è', '8è', '9è', '10è'];

export const ordinal = (posicio) => ORDINALS[posicio - 1] ?? `${posicio}è`;

export const nomEsport = (esport) => NOMS_ESPORTS[esport.id] ?? esport.nombre;

export const nomCategoria = (id, curt = false) =>
  NOMS_CATEGORIES[id]?.[curt ? 'curt' : 'llarg'] ?? id;

export const nomGrup = (id) => NOMS_GRUPS[id] ?? id;

/** Colors per als equips que no en tenen a torneo.json. */
export const PALETA = [
  '#C0392B', '#2E86C1', '#1E8449', '#B7950B', '#7D3C98',
  '#D35400', '#117A65', '#A93226', '#2874A6', '#6B5344',
];

export function colorEquip(equip, index) {
  return equip.color || PALETA[index % PALETA.length];
}
