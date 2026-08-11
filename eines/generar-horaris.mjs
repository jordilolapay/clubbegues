// Transcriu la graella visual de la pestanya "Horaris" a la pestanya "Calendari",
// que és la que llegeix la web.
//
//     node eines/generar-horaris.mjs           → datos/plantilla-full/calendari.csv
//     node eines/generar-horaris.mjs --json    → datos/horarios.json (des de la pestanya Calendari)
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
import { adrecaPestanya, horarisDelFull, llegirCSV } from '../js/full.js';
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
  const femeni = json('femenino.json');
  const partitsLliga = femeni.jornadas.flatMap((j) => j.partidos.map(([a, b]) => `${a}-${b}`));

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

  return { slots, partitsLliga };
}

/* --------------------------------- Repartir els partits entre els slots de cada ronda */

function assignarPartits(slots, partitsLliga, avisos) {
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

  // Femení: els números de la graella són els partits de la lliga en ordre de calendari.
  for (const slot of slots) {
    for (const numero of slot.lliga ?? []) {
      const partit = partitsLliga[numero - 1];
      if (!partit) {
        avisos.push(`"${slot.etiqueta}": el partit número ${numero} no existeix (la lliga en té ${partitsLliga.length}).`);
        continue;
      }
      for (const esport of slot.tipus === 'limit' ? [null] : slot.esports) {
        slot.partits = [...(slot.partits ?? []), { esport, id: partit }];
      }
    }
  }
}

/* ------------------------------------------------------------------ Sortida */

const celaCSV = (v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
const csv = (files) => `${files.map((f) => f.map(celaCSV).join(',')).join('\n')}\n`;

const CAPCALERA = ['Data', 'Hora', 'Tipus', 'Lloc', 'Competició', 'Esport', 'Partit', 'Nota'];

const dataCurta = (d) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
const nomEsport = (id) => NOMS_ESPORTS[id] ?? id;
const nomPartit = (id) => NOMS_PARTITS[id]?.llarg ?? id;
const nomCompeticio = (c) => ({ masculina: 'Masculí', femenina: 'Femení' }[c] ?? '');

function aFiles(slots, avisos) {
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
      files.push([
        data, '', 'Límit', '', competicio,
        slot.esports.map(nomEsport).join(', '),
        (slot.partits ?? []).map((p) => nomPartit(p.id)).join(', '),
        [slot.etiqueta, ...(slot.sobrant?.length ? slot.sobrant : [])].join(' · '),
      ]);
      continue;
    }

    const hora = `${slot.inici}-${slot.fi}`;

    // Actes: el que no és cap esport (reunió, tardeo, sopar…).
    if (!slot.esports.length) {
      files.push([data, hora, 'Acte', slot.lloc, competicio, '', '', slot.etiqueta]);
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
        [(slot.repassar || implicit || barrejat) && '⚠ REPASSAR', ...notes].filter(Boolean).join(' · '),
      ]);
    }
  }

  return files;
}

/* -------------------------------------------------------------------- Marxa */

/** Guarda la xarxa de seguretat: el mateix calendari, en el format que llegeix la web. */
function guardarJSON(files, avisos) {
  const dades = { torneig: json('torneo.json'), femeni: json('femenino.json') };
  const horaris = horarisDelFull(files, { dades, pestanya: 'Calendari', any: FULL.any }, avisos);
  writeFileSync(`${ARREL}datos/horarios.json`, `${JSON.stringify(horaris ?? [], null, 2)}\n`);
  return horaris ?? [];
}

const avisos = [];

if (process.argv.includes('--json')) {
  // Torna a fer datos/horarios.json amb el que hi hagi ara mateix a la pestanya Calendari.
  const resposta = await fetch(adrecaPestanya(FULL.id, FULL.pestanyes.calendari), { cache: 'no-cache' });
  if (!resposta.ok) throw new Error(`No s'ha pogut llegir la pestanya "${FULL.pestanyes.calendari}" (error ${resposta.status}).`);
  const horaris = guardarJSON(llegirCSV(await resposta.text()), avisos);
  console.log(`Fet: datos/horarios.json · ${horaris.length} franges`);
} else {
  const buf = process.argv[2] && !process.argv[2].startsWith('--')
    ? readFileSync(process.argv[2])
    : await baixarGraella();

  const { caselles, ultima } = llegirGraella(buf, 'Horaris');
  const { slots, partitsLliga } = transcriure(caselles, ultima, avisos);
  assignarPartits(slots, partitsLliga, avisos);

  const files = aFiles(slots, avisos);
  const carpeta = `${ARREL}datos/plantilla-full`;
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(`${carpeta}/calendari.csv`, csv(files));
  guardarJSON(files, []); // els problemes d'aquestes files ja surten més amunt

  const repassar = files.filter((f) => String(f[7]).includes('REPASSAR')).length;
  console.log(`Fet: datos/plantilla-full/calendari.csv i datos/horarios.json · ${files.length - 1} files · ${repassar} per repassar`);
}

for (const avis of avisos) console.log(`  ⚠ ${avis}`);
