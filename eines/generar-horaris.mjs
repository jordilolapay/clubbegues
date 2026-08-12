// Transcriu la graella visual de la pestanya "Horaris" a la pestanya "Calendari",
// que és la que llegeix la web.
//
//     node eines/generar-horaris.mjs             → datos/plantilla-full/calendari.csv
//     node eines/generar-horaris.mjs --json      → datos/horarios.json (des de la pestanya Calendari)
//
// I tres coses que es fan sobre la pestanya Calendari tal com està ara, sense tornar a mirar
// la graella (o sigui, sense carregar-se els retocs que s'hi hagin fet a mà):
//
//     … --qui-juga        → hi refà la columna "Qui juga"
//     … --lliga-femenina  → hi reparteix la lliga femenina segons `rotacion` (§ LLIGA_FEMENINA)
//     … --buscar-rotacio  → no toca res: diu quina `rotacion` aniria millor amb aquest calendari
//
// Els tres accepten un fitxer CSV per la línia d'ordres, per provar-los sense internet.
//
// La graella d'"Horaris" està feta per mirar-la, no per llegir-la amb un programa: les hores
// són files, les instal·lacions són columnes, una casella pot ocupar cinc files (això vol dir
// que allò dura cinc hores) i el que diu si un partit és masculí o femení és el COLOR de la
// casella. Tot això es pot llegir del fitxer .xlsx que Google deixa descarregar, i és el que
// fa aquesta eina.
//
// El que no pot endevinar ho deixa marcat amb "⚠ REPASSAR" a la columna Nota: repassa
// aquestes files abans d'importar el CSV (apartat 5 del README).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { FULL } from '../js/config.js';
import { adrecaPestanya, dataDelFull, equipsDelFull, horarisDelFull, horesDelFull, llegirCSV } from '../js/full.js';
import { NOMS_ESPORTS, NOMS_PARTITS } from '../js/textos.js';

const ARREL = new URL('..', import.meta.url).pathname;
const json = (nom) => JSON.parse(readFileSync(`${ARREL}datos/${nom}`, 'utf8'));

/** El primer dia de la graella. Si un any es canvien les dates, canvia-ho aquí. */
const PRIMER_DIA = '2026-08-14';

/** Quin color de casella vol dir quina competició (§ la llegenda de dalt de la graella). */
const COLORS = {
  FF00B0F0: 'masculina',
  FFFFC000: 'femenina',
  FFFF0000: null, // vermell: hores ocupades per altres, no són actes del torneig
};

const DIES = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'];

/** Els noms de les instal·lacions, tal com han de sortir a la web. */
const LLOCS = new Map([
  ['CLUB DE BEGUES', 'Club de Begues'],
  ['POLIESPORTIU', 'Poliesportiu'],
  ['CAMPO DE FUTBOL', 'Camp de futbol'],
  ['ALTRES', 'Altres'],
]);

/* ---------------------------------------------------------------- ZIP i XML */

/** Un .xlsx és un ZIP. Aquí n'hi ha prou amb saber-ne treure els fitxers. */
function fitxersZip(buf) {
  let fi = buf.length - 22;
  while (fi >= 0 && buf.readUInt32LE(fi) !== 0x06054b50) fi--;
  if (fi < 0) throw new Error('El fitxer descarregat no és un .xlsx.');

  const fitxers = new Map();
  let offset = buf.readUInt32LE(fi + 16);
  for (let i = buf.readUInt16LE(fi + 10); i > 0; i--) {
    const metode = buf.readUInt16LE(offset + 10);
    const mida = buf.readUInt32LE(offset + 20);
    const llargNom = buf.readUInt16LE(offset + 28);
    const nom = buf.toString('utf8', offset + 46, offset + 46 + llargNom);
    const inici = buf.readUInt32LE(offset + 42);
    const cap = inici + 30 + buf.readUInt16LE(inici + 26) + buf.readUInt16LE(inici + 28);
    const dades = buf.subarray(cap, cap + mida);
    fitxers.set(nom, metode === 0 ? dades : inflateRawSync(dades));
    offset += 46 + llargNom + buf.readUInt16LE(offset + 30) + buf.readUInt16LE(offset + 32);
  }
  return fitxers;
}

const ENTITATS = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const desescapar = (text) =>
  text.replace(/&(#x?[0-9a-f]+|\w+);/gi, (tot, codi) => {
    if (codi[0] === '#') return String.fromCodePoint(Number(codi[1] === 'x' ? `0${codi.slice(1)}` : codi.slice(1)));
    return ENTITATS[codi] ?? tot;
  });

/** Tots els <t>…</t> d'un tros d'XML, enganxats. */
const textos = (xml) => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => desescapar(m[1])).join('');

const columna = (ref) => {
  let n = 0;
  for (const lletra of ref.replace(/\d+/g, '')) n = n * 26 + (lletra.charCodeAt(0) - 64);
  return n; // A=1, B=2…
};

/* ------------------------------------------------------- Llegir el .xlsx */

async function baixarGraella() {
  const id = FULL.id;
  if (!id) throw new Error("No hi ha cap full de càlcul configurat a js/config.js.");
  const adreca = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
  const resposta = await fetch(adreca);
  if (!resposta.ok) throw new Error(`No s'ha pogut baixar el full de càlcul (error ${resposta.status}).`);
  return Buffer.from(await resposta.arrayBuffer());
}

/**
 * Converteix la pestanya de la graella en caselles amb valor, color i quantes files ocupa.
 * @returns {{caselles: Map<string, {valor: string, color: string|null, finsFila: number}>, ultima: number}}
 */
function llegirGraella(buf, nomPestanya) {
  const fitxers = fitxersZip(buf);
  const llegir = (nom) => desescaparNo(fitxers.get(nom));
  const desescaparNo = (dades) => (dades ? dades.toString('utf8') : '');

  const workbook = llegir('xl/workbook.xml');
  const fulls = [...workbook.matchAll(/<sheet[^>]*name="([^"]*)"[^>]*r:id="([^"]*)"/g)]
    .map(([, nom, rid]) => ({ nom: desescapar(nom), rid }));
  const full = fulls.find((f) => f.nom === nomPestanya);
  if (!full) throw new Error(`El full de càlcul no té cap pestanya "${nomPestanya}" (té: ${fulls.map((f) => f.nom).join(', ')}).`);

  const rels = llegir('xl/_rels/workbook.xml.rels');
  const rel = new RegExp(`Id="${full.rid}"[^>]*Target="([^"]*)"`).exec(rels);
  const desti = `xl/${(rel?.[1] ?? 'worksheets/sheet1.xml').replace(/^\/?xl\//, '')}`;

  // Textos compartits: les cel·les de text guarden un número que apunta aquí.
  const compartits = [...llegir('xl/sharedStrings.xml').split('<si>').slice(1)].map(textos);

  // Estils: cada cel·la té un estil, cada estil un farciment i cada farciment un color.
  const estils = llegir('xl/styles.xml');
  const farciments = [...(/<fills[\s\S]*?<\/fills>/.exec(estils)?.[0] ?? '').split('<fill>').slice(1)]
    .map((f) => /<fgColor[^>]*rgb="([^"]*)"/.exec(f)?.[1] ?? null);
  const perEstil = [...(/<cellXfs[\s\S]*?<\/cellXfs>/.exec(estils)?.[0] ?? '').matchAll(/<xf[^>]*fillId="(\d+)"/g)]
    .map((m) => farciments[Number(m[1])] ?? null);

  const fulla = llegir(desti);
  const caselles = new Map();
  let ultima = 0;

  // Les cel·les buides s'escriuen <c r="A2" s="2"/> i les plenes <c r="B2" s="7"><v>…</v></c>:
  // calen els dos casos per separat, si no una cel·la buida s'empassa el valor de la següent.
  for (const [, buida, plena, cos] of fulla.matchAll(/<c ([^>]*?)\/>|<c ([^>]*?)>([\s\S]*?)<\/c>/g)) {
    const atributs = buida ?? plena;
    const ref = /r="([A-Z]+\d+)"/.exec(atributs)?.[1];
    if (!ref) continue;
    const tipus = /t="(\w+)"/.exec(atributs)?.[1];
    const brut = /<v>([\s\S]*?)<\/v>/.exec(cos ?? '')?.[1];
    const valor = tipus === 's' ? compartits[Number(brut)] ?? ''
      : tipus === 'inlineStr' ? textos(cos ?? '')
      : desescapar(brut ?? '');
    if (!valor.trim()) continue;

    const estil = /s="(\d+)"/.exec(atributs)?.[1];
    caselles.set(ref, {
      valor: valor.trim(),
      color: estil === undefined ? null : perEstil[Number(estil)] ?? null,
      finsFila: Number(ref.replace(/\D+/g, '')),
    });
    ultima = Math.max(ultima, Number(ref.replace(/\D+/g, '')));
  }

  // Cel·les combinades: una casella que ocupa de la fila 9 a la 13 vol dir que allò dura
  // de l'hora de la fila 9 a la de la 13.
  for (const [, inici, fi] of fulla.matchAll(/<mergeCell ref="([A-Z]+\d+):([A-Z]+\d+)"\/>/g)) {
    const casella = caselles.get(inici);
    if (casella) casella.finsFila = Number(fi.replace(/\D+/g, ''));
    if (casella) casella.finsColumna = columna(fi);
  }

  return { caselles, ultima };
}

/* ------------------------------------------- Entendre el que diu cada casella */

const net = (valor) =>
  String(valor ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[ªº]/g, (c) => (c === 'ª' ? 'A' : 'O')) // "1ª" i "3ª-4ª" s'escriuen així a la graella
    .toUpperCase().replace(/\s+/g, ' ').trim();

/** Paraules d'enllaç que no volen dir res: "PING PONG I VOLEY PLATJA". */
const ENLLACOS = new Set(['I', 'E', 'Y', 'DE', 'DEL', 'LA', 'EL', '+', '-']);

/**
 * Com s'escriuen els esports a la graella. El tercer valor vol dir que el nom no és
 * l'esport sencer sinó una part seva ("CROSS" és una prova d'atletisme): en aquests casos
 * val la pena que el que digui la graella quedi apuntat a la columna Nota.
 */
const ESPORTS_GRAELLA = [
  ['VOLEY PLATJA', 'voleibol-playa'], ['VOLEIBOL PLATJA', 'voleibol-playa'],
  ['FUTBOL SALA', 'futbol-sala'], ['FUTBOL 7', 'futbol-siete'],
  ['PING PONG', 'ping-pong'], ['BASQUET', 'baloncesto'], ['HANDBALL', 'balonmano'],
  ['WATERPOLO', 'waterpolo'], ['VOLEY', 'voleibol-pista'], ['FUTBOLIN', 'futbolin'],
  ['DARDS', 'dardos'], ['ESCACS', 'ajedrez'], ['MINIGOLF', 'minigolf'],
  ['NATACIO', 'natacion'], ['CICLISME', 'ciclismo'], ['ATLETISME', 'atletismo'],
  ['CROSS', 'atletismo', true], ['PETANCA', 'petanca'], ['DOMINO', 'domino'],
  ['TENIS', 'tenis'], ['FRONTON', 'fronton'], ['PADEL', 'padel'], ['BILLAR', 'billar'],
];

/** Les rondes del quadre masculí, amb els partits que hi ha a cadascuna. */
const RONDES = {
  previa: ['previa1', 'previa2'],
  previa1: ['previa1'],
  previa2: ['previa2'],
  quarts: ['qf1', 'qf2', 'qf3', 'qf4'],
  // La consolació va primer: primer es juguen els llocs baixos i s'acaba amb la final.
  semis: ['consSf1', 'consSf2', 'sf1', 'sf2'],
  tercers: ['consTercero', 'tercerPuesto'],
  finals: ['consFinal', 'final'],
  nove: ['puesto9'],
};

/** Com s'escriu cada ronda a la graella, de la més llarga a la més curta. */
const RONDES_GRAELLA = [
  [/^PREV\.? ?F\.?$/, 'nove'],
  [/^PREV\.? ?1$/, 'previa1'],
  [/^PREV\.? ?2$/, 'previa2'],
  [/^PREV(\.|IA|IES)?$/, 'previa'],
  [/^1A( RONDA)? I SEMIS$/, ['quarts', 'semis']],
  [/^1A( RONDA)?$/, 'quarts'],
  [/^SEMIS? I 9A ?- ?10A( LLOC)?$/, ['semis', 'nove']],
  [/^SEMIS?$/, 'semis'],
  [/^3A ?- ?4A( LLOC)? I FINALS?$/, ['tercers', 'finals']],
  [/^3A ?- ?4A( LLOC)?$/, 'tercers'],
  [/^FINALS? ?(3A ?- ?4A LLOC)?$/, 'finals'],
];

/**
 * Les dates límit de la lliga femenina no parlen de rondes sinó de quants partits s'han
 * d'haver jugat: a la meitat, la primera meitat; al final, tots.
 */
const LLIGA_GRAELLA = [
  [/^MEITAT LLIGA$/, [1, 2, 3, 4, 5]],
  [/^FINALITZACIO LLIGA$/, [6, 7, 8, 9, 10]],
];

/**
 * Parteix el text d'una casella: quins esports hi surten i quina ronda o quins
 * partits de lliga. Les caselles poden dur més d'una línia i barrejar dues coses:
 * "FUTBOLIN / DARDS 1-2 / PREV." vol dir futbolí i dards alhora.
 */
function entendre(text) {
  // Es parteix ABANS de netejar: el que separa les dues coses d'una casella és el salt
  // de línia, i netejar-la primer el convertiria en un espai qualsevol.
  const trossos = String(text ?? '').split(/[\n/,;+]+/).map(net).filter(Boolean);
  const esports = [];
  const rondes = [];
  const lliga = [];
  const sobrant = [];

  for (let tros of trossos) {
    if (ENLLACOS.has(tros)) continue;
    // El nom de l'esport tant pot anar davant de la ronda ("HANDBALL SEMIS") com darrere
    // ("PREV. 1 WATERPOLO"): es busca on sigui i el que queda ja és la ronda.
    let trobat = true;
    while (trobat) {
      trobat = false;
      const primera = /^(\S+)\s+/.exec(tros);
      if (primera && ENLLACOS.has(primera[1])) { tros = tros.slice(primera[0].length); trobat = true; continue; }
      for (const [nom, id, apartat] of ESPORTS_GRAELLA) {
        const patro = new RegExp(`(^| )${nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`);
        if (!patro.test(tros)) continue;
        if (!esports.includes(id)) esports.push(id);
        if (apartat) sobrant.push(nom);
        tros = tros.replace(patro, ' ').trim();
        trobat = true;
        break;
      }
    }
    if (!tros) continue;

    // Femení: els partits de la lliga van numerats de l'1 al 10, sols o per parelles.
    const rang = /^(\d+) ?- ?(\d+)$/.exec(tros) ?? /^(\d+)$/.exec(tros);
    if (rang) {
      const de = Number(rang[1]);
      const a = Number(rang[2] ?? rang[1]);
      for (let i = de; i <= a; i++) lliga.push(i);
      continue;
    }

    const ronda = RONDES_GRAELLA.find(([patro]) => patro.test(tros));
    if (ronda) { rondes.push(...[].concat(ronda[1])); continue; }

    const mitja = LLIGA_GRAELLA.find(([patro]) => patro.test(tros));
    if (mitja) { lliga.push(...mitja[1]); continue; }

    sobrant.push(tros);
  }

  return { esports, rondes, lliga, sobrant };
}

/** "18-19h" → {inici: '18:00', fi: '19:00'} */
function hores(text) {
  const trobat = /^(\d{1,2})\s*-\s*(\d{1,2})\s*h/.exec(String(text ?? '').trim());
  if (!trobat) return null;
  const h = (n) => `${String(Number(n) % 24).padStart(2, '0')}:00`;
  return { inici: h(trobat[1]), fi: h(trobat[2]) };
}

/* -------------------------------------------------------- Recórrer la graella */

function transcriure(caselles, ultima, avisos) {
  const inici = new Date(`${PRIMER_DIA}T00:00:00Z`);
  const cela = (col, fila) => caselles.get(`${String.fromCharCode(64 + col)}${fila}`);

  let dia = null;
  let llocs = new Map();
  const slots = [];

  for (let fila = 1; fila <= ultima; fila++) {
    const a = cela(1, fila);
    const b = cela(2, fila);

    // Capçalera de dia: "Dissabte 15".
    const capDia = b && /^(Dilluns|Dimarts|Dimecres|Dijous|Divendres|Dissabte|Diumenge)\s+(\d+)$/i.exec(b.valor);
    if (capDia) {
      const data = new Date(inici);
      data.setUTCDate(Number(capDia[2]) - Number(PRIMER_DIA.slice(8)) + inici.getUTCDate());
      const esperat = DIES[data.getUTCDay()];
      if (net(esperat) !== net(capDia[1])) {
        avisos.push(`La graella diu "${b.valor}" però el ${capDia[2]} és ${esperat.toLowerCase()}. Mira PRIMER_DIA a eines/generar-horaris.mjs.`);
      }
      dia = data;
      llocs = new Map();
      continue;
    }

    // Capçalera d'instal·lacions: cada nom val fins on arriba el següent.
    if (b && /club de begues/i.test(b.valor)) {
      llocs = new Map();
      for (let col = 2; col <= 8; col++) {
        const casella = cela(col, fila);
        if (casella) llocs.set(col, { nom: casella.valor, fins: casella.finsColumna ?? col });
      }
      continue;
    }

    // Fila de data límit: "LIMIT 1ª RONDA" a l'esquerra, els esports a la dreta.
    if (b && /^LIMIT/i.test(b.valor)) {
      const esports = entendre(cela(8, fila)?.valor ?? '');
      const quines = entendre(b.valor.replace(/^LIMIT\s*/i, ''));
      slots.push({
        dia, tipus: 'limit', lloc: '',
        competicio: b.color in COLORS ? COLORS[b.color] : null,
        esports: esports.esports,
        rondes: quines.rondes,
        lliga: quines.lliga,
        etiqueta: b.valor,
        sobrant: [...quines.sobrant, ...esports.sobrant],
      });
      continue;
    }

    // Fila d'hores: el que hi hagi a les columnes de les instal·lacions són slots.
    const franja = hores(a?.valor);
    if (!franja || !dia) continue;

    for (let col = 2; col <= 7; col++) {
      const casella = cela(col, fila);
      if (!casella) continue;
      if (casella.color === 'FFFF0000') continue; // hores ocupades per gent de fora

      const competicio = casella.color in COLORS ? COLORS[casella.color] : null;
      const finsFranja = hores(cela(1, casella.finsFila)?.valor) ?? franja;
      const lloc = [...llocs.entries()].filter(([c, l]) => col >= c && col <= l.fins).pop();

      slots.push({
        dia, tipus: 'partit', competicio,
        lloc: LLOCS.get(net(lloc?.[1].nom)) ?? lloc?.[1].nom ?? '',
        inici: franja.inici,
        fi: finsFranja.fi,
        ...entendre(casella.valor),
        etiqueta: casella.valor.replace(/\s*\n\s*/g, ' / '),
      });
    }
  }

  return slots;
}

/* ------------------------------------------- La rotació de la lliga femenina */

/**
 * Els cinc equips femenins juguen tots contra tots, o sigui que a cada jornada n'hi ha un que
 * descansa i els enfrontaments són sempre els mateixos deu. Si tots els esports juguessin les
 * jornades en el mateix ordre, un mateix dia sortirien els mateixos partits a tot arreu i qui
 * descansa no jugaria a res: per això cada esport comença per una jornada diferent.
 *
 * Quantes en desplaça cadascun ho diu `rotacion` a datos/femenino.json. El número de la graella
 * («1-2») vol dir el primer i el segon partit D'AQUELL ESPORT, i el desplaçament el converteix
 * en el partit de la lliga que li toca.
 */
const LLIGA_FEMENINA = (() => {
  const femeni = json('femenino.json');
  const partits = femeni.jornadas.flatMap((j) => j.partidos.map(([a, b]) => `${a}-${b}`));
  const perJornada = femeni.jornadas[0]?.partidos.length ?? 2;
  const rotacio = femeni.rotacion ?? {};

  return {
    partits,
    perJornada,
    rotacio,
    /** El partit que fa `numero` d'un esport: el 1r del bàsquet no és el 1r de la lliga. */
    partit(numero, esport, rotacio = this.rotacio) {
      const gir = (rotacio[esport] ?? 0) * perJornada;
      return partits[(numero - 1 + gir) % partits.length];
    },
  };
})();

/* --------------------------------- Repartir els partits entre els slots de cada ronda */

function assignarPartits(slots, avisos) {
  // Les dates límit no reparteixen res: afecten tots els partits de la ronda alhora.
  for (const slot of slots) {
    if (slot.tipus !== 'limit') continue;
    slot.partits = slot.rondes.flatMap((ronda) => RONDES[ronda].map((id) => ({ esport: null, id })));
  }

  // Per a cada esport, competició i ronda, tots els slots que hi ha, en ordre.
  const grups = new Map();
  for (const slot of slots) {
    if (slot.tipus !== 'partit') continue;
    for (const esport of slot.esports) {
      for (const ronda of slot.rondes) {
        const clau = `${esport}|${ronda}`;
        if (!grups.has(clau)) grups.set(clau, []);
        grups.get(clau).push(slot);
      }
    }
  }

  for (const [clau, seus] of grups) {
    const [esport, ronda] = clau.split('|');
    const partits = RONDES[ronda];
    // Es reparteixen per ordre: si hi ha més partits que slots, en van diversos al mateix.
    const per = Math.ceil(partits.length / seus.length);
    seus.forEach((slot, i) => {
      const toca = partits.slice(i * per, (i + 1) * per);
      slot.partits = [...(slot.partits ?? []), ...toca.map((id) => ({ esport, id }))];
      if (partits.length !== seus.length) slot.repassar = true;
    });
    if (seus.length > partits.length) {
      avisos.push(`${esport}: la ronda "${ronda}" té ${seus.length} caselles a la graella i només ${partits.length} partits.`);
    }
  }

  // Femení: els números de la graella són els partits que aquell esport porta jugats, i cada
  // esport comença per una jornada diferent (§ LLIGA_FEMENINA).
  for (const slot of slots) {
    for (const numero of slot.lliga ?? []) {
      if (numero < 1 || numero > LLIGA_FEMENINA.partits.length) {
        avisos.push(`"${slot.etiqueta}": el partit número ${numero} no existeix (la lliga en té ${LLIGA_FEMENINA.partits.length}).`);
        continue;
      }
      for (const esport of slot.tipus === 'limit' ? [null] : slot.esports) {
        slot.partits = [...(slot.partits ?? []), { esport, id: LLIGA_FEMENINA.partit(numero, esport) }];
      }
    }
  }
}

/* --------------------------------------------------------- Qui juga cada partit */

/** Compara noms sense distingir majúscules, accents ni signes: "Quarts 1" = "quarts1". */
const clau = (valor) =>
  String(valor ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Els noms dels equips: els del full de càlcul si es poden llegir, si no els de datos/. */
async function nomsEquips() {
  const noms = new Map();
  for (const equip of [...json('torneo.json').equipos, ...json('femenino.json').equipos]) {
    noms.set(equip.id, equip.nombre);
  }
  try {
    const resposta = await fetch(adrecaPestanya(FULL.id, FULL.pestanyes.equips), { cache: 'no-cache' });
    if (!resposta.ok) throw new Error(String(resposta.status));
    for (const [id, dades] of equipsDelFull(llegirCSV(await resposta.text()), [], FULL.pestanyes.equips)) {
      if (dades.nombre) noms.set(id, dades.nombre);
    }
  } catch {
    console.log("  ⚠ No s'ha pogut llegir la pestanya d'equips: la columna \"Qui juga\" fa servir els noms de datos/.");
  }
  return noms;
}

/**
 * Qui juga un partit, si es pot saber abans que comenci el torneig.
 *
 * Femení: sempre, perquè la lliga ja està sortejada i l'identificador del partit ja diu els dos
 * equips. Masculí: només les prèvies i els quarts, i als quarts 1 i 3 un dels dos encara és el
 * guanyador d'una prèvia. De semifinals en amunt tot depèn de resultats i no s'hi posa res.
 */
function quiJuga(idPartit, idEsport, noms, quadres) {
  const nom = (id) => noms.get(id) ?? id;
  const sigla = (id) => NOMS_PARTITS[id]?.sigla ?? id;

  const lliga = /^(F\d+)-(F\d+)$/.exec(idPartit);
  if (lliga) return `${nom(lliga[1])} - ${nom(lliga[2])}`;

  const quadre = quadres[idEsport];
  if (!quadre) return '';
  const parella = (dos) => (Array.isArray(dos) && dos.length === 2 ? `${nom(dos[0])} - ${nom(dos[1])}` : '');
  const surtDeLaPrevia = (previa, rival) => (rival ? `Guanyador ${sigla(previa)} - ${nom(rival)}` : '');

  switch (idPartit) {
    case 'previa1': return parella(quadre.previa1);
    case 'previa2': return parella(quadre.previa2);
    case 'qf1': return surtDeLaPrevia('previa1', quadre.qf1Rival);
    case 'qf2': return parella(quadre.qf2);
    case 'qf3': return surtDeLaPrevia('previa2', quadre.qf3Rival);
    case 'qf4': return parella(quadre.qf4);
    default: return '';
  }
}

/**
 * La cel·la "Qui juga" d'una fila. Si la franja té més d'un partit va un per línia, amb la
 * sigla al davant perquè es vegi quin és quin; els que encara no se saben no hi surten.
 */
function columnaQuiJuga(idsPartits, idEsport, noms, quadres) {
  const linies = idsPartits
    .map((id) => [id, quiJuga(id, idEsport, noms, quadres)])
    .filter(([, text]) => text);
  if (linies.length <= 1) return linies[0]?.[1] ?? '';
  return linies.map(([id, text]) => `${NOMS_PARTITS[id]?.sigla ?? id}: ${text}`).join('\n');
}

/* ------------------------------------------------------------------ Sortida */

const celaCSV = (v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
const csv = (files) => `${files.map((f) => f.map(celaCSV).join(',')).join('\n')}\n`;

const CAPCALERA = ['Data', 'Hora', 'Tipus', 'Lloc', 'Competició', 'Esport', 'Partit', 'Qui juga', 'Nota'];
const COLUMNA_NOTA = CAPCALERA.indexOf('Nota');

const dataCurta = (d) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
const nomEsport = (id) => NOMS_ESPORTS[id] ?? id;
const nomPartit = (id) => NOMS_PARTITS[id]?.llarg ?? id;
const nomCompeticio = (c) => ({ masculina: 'Masculí', femenina: 'Femení' }[c] ?? '');

function aFiles(slots, noms, quadres, avisos) {
  const torneig = json('torneo.json');
  const format = new Map(torneig.deportes.map((d) => [d.id, d.formato]));

  // Un esport de quadre que en un slot surt sense ronda («FUTBOLIN» tot sol) però que en té
  // en un altre vol dir que a la graella s'ha deixat implícit: cal que algú ho miri.
  const ambRonda = new Set();
  for (const slot of slots) {
    for (const esport of slot.esports ?? []) {
      if (slot.partits?.some((p) => p.esport === esport)) ambRonda.add(esport);
    }
  }

  const files = [CAPCALERA];

  for (const slot of slots) {
    const data = dataCurta(slot.dia);
    const competicio = nomCompeticio(slot.competicio);
    const notes = slot.sobrant?.length ? [slot.etiqueta] : [];

    if (slot.tipus === 'limit') {
      if (!slot.esports.length) avisos.push(`"${slot.etiqueta}": no s'ha entès a quins esports afecta.`);
      // Una data límit afecta sis esports alhora: cada un té un quadre diferent, o sigui que
      // dels partits masculins no se'n pot dir qui hi juga. Dels femenins sí: la lliga és igual
      // a tots els esports.
      const idsLimit = (slot.partits ?? []).map((p) => p.id);
      files.push([
        data, '', 'Límit', '', competicio,
        slot.esports.map(nomEsport).join(', '),
        idsLimit.map(nomPartit).join(', '),
        columnaQuiJuga(idsLimit, null, noms, quadres),
        [slot.etiqueta, ...(slot.sobrant?.length ? slot.sobrant : [])].join(' · '),
      ]);
      continue;
    }

    const hora = `${slot.inici}-${slot.fi}`;

    // Actes: el que no és cap esport (reunió, tardeo, sopar…).
    if (!slot.esports.length) {
      files.push([data, hora, 'Acte', slot.lloc, competicio, '', '', '', slot.etiqueta]);
      continue;
    }

    for (const esport of slot.esports) {
      const seus = (slot.partits ?? []).filter((p) => p.esport === esport);
      // Sense partits concrets vol dir que en aquella sessió es juga tot l'esport: els que
      // van per ordre d'arribada (natació, ciclisme…) i els que es despatxen d'una tirada.
      const implicit = !seus.length && format.get(esport) === 'cuadro' && ambRonda.has(esport);
      // Una casella amb dos esports i una ronda no diu de quin dels dos és la ronda.
      const barrejat = slot.esports.length > 1 && Boolean(seus.length);
      files.push([
        data, hora, '', slot.lloc, competicio, nomEsport(esport),
        seus.length ? seus.map((p) => nomPartit(p.id)).join(', ') : 'Tot',
        columnaQuiJuga(seus.map((p) => p.id), esport, noms, quadres),
        [(slot.repassar || implicit || barrejat) && '⚠ REPASSAR', ...notes].filter(Boolean).join(' · '),
      ]);
    }
  }

  return files;
}

/* ------------------------------------- Refer només la columna "Qui juga" */

/** Un fitxer passat per la línia d'ordres, si n'hi ha: serveix per provar-ho sense internet. */
const fitxerLocal = process.argv.slice(2).find((argument) => !argument.startsWith('--'));

/** La pestanya Calendari tal com està ara. */
async function baixarCalendari() {
  if (fitxerLocal) return llegirCSV(readFileSync(fitxerLocal, 'utf8'));
  const resposta = await fetch(adrecaPestanya(FULL.id, FULL.pestanyes.calendari), { cache: 'no-cache' });
  if (!resposta.ok) throw new Error(`No s'ha pogut llegir la pestanya "${FULL.pestanyes.calendari}" (error ${resposta.status}).`);
  return llegirCSV(await resposta.text());
}

/** Com es pot escriure cada esport i cada partit a les cel·les del calendari. */
function diccionaris() {
  const perEsport = new Map();
  for (const esport of json('torneo.json').deportes) {
    for (const alias of [esport.id, esport.nombre, NOMS_ESPORTS[esport.id]]) {
      if (alias) perEsport.set(clau(alias), esport.id);
    }
  }

  const perPartit = new Map();
  for (const [id, noms] of Object.entries(NOMS_PARTITS)) {
    for (const alias of [id, noms.llarg, noms.sigla]) perPartit.set(clau(alias), id);
  }
  for (const jornada of json('femenino.json').jornadas ?? []) {
    for (const [local, visitant] of jornada.partidos ?? []) {
      perPartit.set(clau(`${local}-${visitant}`), `${local}-${visitant}`);
      perPartit.set(clau(`${visitant}-${local}`), `${local}-${visitant}`); // per si algú l'apunta al revés
    }
  }

  return { perEsport, perPartit };
}

/**
 * Refà la columna "Qui juga" del que hi ha ARA a la pestanya Calendari, sense tocar la resta.
 * És el que cal quan el calendari ja s'ha repassat a mà i no es vol tornar a generar des de
 * la graella (que es carregaria els retocs).
 */
function ambQuiJuga(files, noms, quadres, avisos) {
  const [capcalera = [], ...cos] = files;
  const columna = (nom) => capcalera.findIndex((cela) => clau(cela) === clau(nom));
  for (const nom of ['Esport', 'Partit']) {
    if (columna(nom) < 0) throw new Error(`La pestanya "${FULL.pestanyes.calendari}" no té cap columna "${nom}".`);
  }

  // Si la columna ja hi és es refà al seu lloc; si no, se n'obre una just després de Partit.
  const existent = columna('Qui juga');
  const on = existent >= 0 ? existent : columna('Partit') + 1;
  const posar = (fila, valor) => {
    const nova = [...fila];
    while (nova.length < on) nova.push('');
    if (existent >= 0) nova[on] = valor;
    else nova.splice(on, 0, valor);
    return nova;
  };

  const { perEsport, perPartit } = diccionaris();
  const cela = (fila, nom) => (fila[columna(nom)] ?? '').trim();
  const trossos = (text) => text.split(/[,;]/).map((t) => t.trim()).filter(Boolean);

  const cosNou = cos.map((fila, i) => {
    const esports = trossos(cela(fila, 'Esport')).map((t) => perEsport.get(clau(t))).filter(Boolean);
    const partits = [];
    for (const tros of trossos(cela(fila, 'Partit'))) {
      const id = perPartit.get(clau(tros));
      if (id) partits.push(id);
      else if (!['tot', 'tots', 'tota', 'totes'].includes(clau(tros))) {
        avisos.push(`Calendari, fila ${i + 2}: "${tros}" no és cap partit, o sigui que no surt a "Qui juga".`);
      }
    }
    // Amb un sol esport se sap de quin quadre parlem; amb més d'un (les dates límit), no.
    return posar(fila, columnaQuiJuga(partits, esports.length === 1 ? esports[0] : null, noms, quadres));
  });

  return [posar(capcalera, 'Qui juga'), ...cosNou];
}

/* ------------------------------------- Repartir de nou la lliga femenina */

/**
 * Les franges del calendari on es juguen partits de la lliga femenina, en ordre. Cada una diu
 * de quin esport és i en quines posicions de la cel·la Partit hi ha partits de lliga (una
 * mateixa cel·la pot barrejar quadre masculí i lliga femenina: futbolí i dards ho fan).
 */
function franjesFemenines(files) {
  const [cap = [], ...cos] = files;
  const columna = (nom) => cap.findIndex((cela) => clau(cela) === clau(nom));
  const cela = (fila, nom) => (fila[columna(nom)] ?? '').trim();
  const { perEsport, perPartit } = diccionaris();
  const deLliga = new Set(LLIGA_FEMENINA.partits);

  // Les hores de matinada són de la nit del dia abans, com a tot arreu.
  const minuts = (text) => {
    if (!text) return null;
    const [h, m] = text.split(':').map(Number);
    return ((h < 6 ? h + 24 : h) * 60) + m;
  };

  const franges = [];
  cos.forEach((fila, i) => {
    if (!['', 'partit', 'partido'].includes(clau(cela(fila, 'Tipus')))) return; // límits i actes, no
    const esports = cela(fila, 'Esport').split(/[,;]/).map((t) => perEsport.get(clau(t.trim()))).filter(Boolean);
    if (esports.length !== 1) return; // amb dos esports a la mateixa cel·la no se sap de quin és cada partit

    const parts = cela(fila, 'Partit').split(',').map((t) => t.trim());
    const posicions = parts.map((t, n) => [n, perPartit.get(clau(t))]).filter(([, id]) => deLliga.has(id));
    if (!posicions.length) return;

    const { inici, fi } = horesDelFull(cela(fila, 'Hora'));
    franges.push({
      fila: i, esport: esports[0], data: dataDelFull(cela(fila, 'Data'), FULL.any) ?? '',
      ini: minuts(inici) ?? 0, fi: minuts(fi) ?? minuts(inici) ?? 0,
      parts, posicions: posicions.map(([n]) => n), partits: posicions.map(([, id]) => id),
    });
  });

  return { capcalera: cap, cos, columna, franges };
}

/**
 * Diu quins partits toquen a cada franja: cada esport juga els seus en el mateix ordre de
 * sempre, però començant per la jornada que li toca. Es pot passar tantes vegades com calgui,
 * que el resultat sempre és el mateix (el que mana és l'ordre, no el que hi ha escrit ara).
 */
function repartirLliga(franges, rotacio) {
  const perEsport = new Map();
  for (const franja of [...franges].sort((a, b) => a.data.localeCompare(b.data) || a.ini - b.ini)) {
    if (!perEsport.has(franja.esport)) perEsport.set(franja.esport, []);
    perEsport.get(franja.esport).push(franja);
  }

  const toca = new Map();
  for (const [esport, seves] of perEsport) {
    let numero = 0;
    for (const franja of seves) {
      toca.set(franja, franja.posicions.map(() => LLIGA_FEMENINA.partit(++numero, esport, rotacio)));
    }
  }
  return toca;
}

/** Escriu al calendari els partits que ha repartit repartirLliga(). */
function repartirLligaFemenina(files) {
  const { capcalera, cos, columna, franges } = franjesFemenines(files);
  const toca = repartirLliga(franges, LLIGA_FEMENINA.rotacio);

  let canviats = 0;
  const nou = cos.map((fila) => [...fila]);
  for (const franja of franges) {
    const parts = [...franja.parts];
    franja.posicions.forEach((posicio, n) => {
      const id = toca.get(franja)[n];
      if (parts[posicio] !== id) canviats++;
      parts[posicio] = id;
    });
    nou[franja.fila][columna('Partit')] = parts.join(', ');
  }

  return { files: [capcalera, ...nou], canviats };
}

/**
 * Repassa com queda la lliga femenina: partits repetits el mateix dia a dos esports, equips
 * que han de ser a dos llocs a la mateixa hora i equips que un dia no juguen res.
 */
function repassarLligaFemenina(franges, toca, noms) {
  const partitsDe = (franja) => toca.get(franja) ?? franja.partits;
  /** Una sessió d'una hora o dues, amb tothom a la pista alhora (no la nit de futbolí i dards). */
  const tancada = (franja) => franja.fi - franja.ini <= 150;
  const equips = [...new Set(LLIGA_FEMENINA.partits.flatMap((id) => id.split('-')))];
  const nom = (id) => noms?.get(id) ?? id;

  const perDia = new Map();
  for (const franja of franges) {
    if (!perDia.has(franja.data)) perDia.set(franja.data, []);
    perDia.get(franja.data).push(franja);
  }

  const problemes = [];
  for (const [data, sessions] of [...perDia].sort()) {
    const dia = data.slice(8, 10) + '/' + data.slice(5, 7);

    // El mateix partit a dos esports el mateix dia. Pesa més si tots dos són esports amb hora
    // fixa: que futbolí i dards (que duren tota la nit) coincideixin no molesta ningú.
    const on = new Map();
    for (const sessio of sessions) for (const id of partitsDe(sessio)) {
      if (!on.has(id)) on.set(id, []);
      on.get(id).push(sessio);
    }
    for (const [id, seves] of on) {
      const quins = [...new Set(seves.map((s) => nomEsport(s.esport)))];
      if (quins.length < 2) continue;
      const ambHora = seves.filter((s) => tancada(s)).length;
      problemes.push({ pes: ambHora > 1 ? 3 : 1, text: `${dia}: ${id} es juga a ${quins.join(' i ')}` });
    }

    for (let a = 0; a < sessions.length; a++) {
      for (let b = a + 1; b < sessions.length; b++) {
        const [x, y] = [sessions[a], sessions[b]];
        // Les sessions llargues (futbolí i dards, de 20:00 a 01:00) no compten: els partits es
        // van jugant al llarg de la nit i no tots a la mateixa hora.
        if (x.esport === y.esport || x.ini >= y.fi || y.ini >= x.fi) continue;
        if (!tancada(x) || !tancada(y)) continue;
        const seus = new Set(partitsDe(x).flatMap((id) => id.split('-')));
        const xoc = [...new Set(partitsDe(y).flatMap((id) => id.split('-')))].filter((e) => seus.has(e));
        if (xoc.length) {
          problemes.push({
            pes: 5,
            text: `${dia}: ${xoc.map(nom).join(', ')} juga ${nomEsport(x.esport)} i ${nomEsport(y.esport)} a la mateixa hora`,
          });
        }
      }
    }

    const juguen = new Set(sessions.flatMap((s) => partitsDe(s).flatMap((id) => id.split('-'))));
    const fora = equips.filter((e) => !juguen.has(e));
    // Amb un sol esport aquell dia sempre n'hi ha un que descansa: això no és cap problema.
    if (fora.length && new Set(sessions.map((s) => s.esport)).size > 1) {
      problemes.push({ pes: 2, text: `${dia}: ${fora.map(nom).join(', ')} no juga res` });
    }
  }

  return problemes.sort((a, b) => b.pes - a.pes);
}

/** Prova totes les rotacions possibles i diu quina va millor. */
function buscarRotacions(files) {
  const { franges } = franjesFemenines(files);
  const esports = [...new Set(franges.map((f) => f.esport))];
  const jornades = LLIGA_FEMENINA.partits.length / LLIGA_FEMENINA.perJornada;
  const total = jornades ** esports.length;
  if (total > 5e6) return null;

  let millor = null;
  for (let n = 0; n < total; n++) {
    const rotacio = {};
    let x = n;
    for (const esport of esports) { rotacio[esport] = x % jornades; x = Math.floor(x / jornades); }
    const problemes = repassarLligaFemenina(franges, repartirLliga(franges, rotacio), null);
    const punts = [
      problemes.reduce((total, p) => total + p.pes, 0),
      problemes.length,
      Object.values(rotacio).reduce((a, b) => a + b, 0),
    ];
    if (!millor || punts.some((p, i) => p !== millor.punts[i] && p < millor.punts[i] && punts.slice(0, i).every((q, j) => q === millor.punts[j]))) {
      millor = { rotacio, punts, problemes };
    }
  }
  return millor;
}

/**
 * Avisa si la pestanya Calendari encara no té la lliga femenina repartida. Passa cada cop que
 * es baixa el calendari de Google: si el CSV repartit no s'ha importat al full, el que hi ha
 * allà mana i tornaria a deixar tots els esports jugant les mateixes jornades els mateixos dies.
 */
function comprovarLligaFemenina(files, avisos) {
  const { franges } = franjesFemenines(files);
  const toca = repartirLliga(franges, LLIGA_FEMENINA.rotacio);

  let fora = 0;
  for (const franja of franges) {
    toca.get(franja).forEach((id, n) => { if (id !== franja.partits[n]) fora++; });
  }
  if (fora) {
    avisos.push(
      `La pestanya "${FULL.pestanyes.calendari}" té ${fora} partits de la lliga femenina fora de lloc: ` +
      `no segueix la "rotacion" de datos/femenino.json. Passa --lliga-femenina i importa el CSV al full ` +
      `(apartat 5 del README); mentre no ho facis, la web ensenya el repartiment del full.`
    );
  }
  return fora;
}

/* -------------------------------------------------------------------- Marxa */

/** Guarda la xarxa de seguretat: el mateix calendari, en el format que llegeix la web. */
function guardarJSON(files, avisos) {
  const dades = { torneig: json('torneo.json'), femeni: json('femenino.json') };
  const horaris = horarisDelFull(files, { dades, pestanya: 'Calendari', any: FULL.any }, avisos);
  writeFileSync(`${ARREL}datos/horarios.json`, `${JSON.stringify(horaris ?? [], null, 2)}\n`);
  return horaris ?? [];
}

function guardarCSV(files) {
  const carpeta = `${ARREL}datos/plantilla-full`;
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(`${carpeta}/calendari.csv`, csv(files));
}

const avisos = [];

if (process.argv.includes('--json')) {
  // Torna a fer datos/horarios.json amb el que hi hagi ara mateix a la pestanya Calendari.
  const calendari = await baixarCalendari();
  comprovarLligaFemenina(calendari, avisos);
  const horaris = guardarJSON(calendari, avisos);
  console.log(`Fet: datos/horarios.json · ${horaris.length} franges`);
} else if (process.argv.includes('--qui-juga')) {
  // Agafa la pestanya Calendari tal com està i només hi refà la columna "Qui juga".
  const calendari = await baixarCalendari();
  comprovarLligaFemenina(calendari, avisos);
  const files = ambQuiJuga(calendari, await nomsEquips(), json('cuadros.json'), avisos);
  guardarCSV(files);
  guardarJSON(files, []); // els problemes d'aquestes files ja surten més amunt
  const on = files[0].indexOf('Qui juga');
  const omplertes = files.slice(1).filter((f) => f[on]).length;
  console.log(`Fet: datos/plantilla-full/calendari.csv i datos/horarios.json · ${files.length - 1} files · ${omplertes} amb "Qui juga"`);
} else if (process.argv.includes('--buscar-rotacio')) {
  // No toca res: només diu quina rotació de la lliga femenina aniria millor amb aquest calendari.
  const millor = buscarRotacions(await baixarCalendari());
  if (!millor) throw new Error('Hi ha massa esports per provar-ho tot.');
  console.log('La millor rotació per a datos/femenino.json:');
  const posar = Object.entries(millor.rotacio).filter(([, gir]) => gir);
  console.log(`  "rotacion": { ${posar.map(([id, gir]) => `"${id}": ${gir}`).join(', ')} }`);
  console.log(`Amb aquesta hi queden ${millor.problemes.length} coses per mirar:`);
  for (const problema of millor.problemes) console.log('  ·', problema.text);
} else if (process.argv.includes('--lliga-femenina')) {
  // Reparteix la lliga femenina del calendari que ja hi ha i refà la columna "Qui juga".
  const noms = await nomsEquips();
  const { files: repartides, canviats } = repartirLligaFemenina(await baixarCalendari());
  const files = ambQuiJuga(repartides, noms, json('cuadros.json'), avisos);
  guardarCSV(files);
  guardarJSON(files, []); // els problemes d'aquestes files ja surten més amunt

  const gir = Object.entries(LLIGA_FEMENINA.rotacio).filter(([, quantes]) => quantes);
  console.log(`Fet: datos/plantilla-full/calendari.csv i datos/horarios.json · ${canviats} partits canviats de lloc`);
  console.log(`Desplaçats: ${gir.length ? gir.map(([id, quantes]) => `${nomEsport(id)} ${quantes} ${quantes > 1 ? 'jornades' : 'jornada'}`).join(', ') : 'cap esport'}`);
  const { franges } = franjesFemenines(files);
  const problemes = repassarLligaFemenina(franges, new Map(), noms);
  console.log(problemes.length ? `Queden ${problemes.length} coses per mirar:` : 'No queda cap partit repetit ni cap equip a dos llocs alhora.');
  for (const problema of problemes) console.log('  ·', problema.text);
} else {
  const buf = fitxerLocal ? readFileSync(fitxerLocal) : await baixarGraella();

  const { caselles, ultima } = llegirGraella(buf, 'Horaris');
  const slots = transcriure(caselles, ultima, avisos);
  assignarPartits(slots, avisos);

  const files = aFiles(slots, await nomsEquips(), json('cuadros.json'), avisos);
  guardarCSV(files);
  guardarJSON(files, []); // els problemes d'aquestes files ja surten més amunt

  const repassar = files.filter((f) => String(f[COLUMNA_NOTA]).includes('REPASSAR')).length;
  console.log(`Fet: datos/plantilla-full/calendari.csv i datos/horarios.json · ${files.length - 1} files · ${repassar} per repassar`);
}

for (const avis of avisos) console.log(`  ⚠ ${avis}`);
