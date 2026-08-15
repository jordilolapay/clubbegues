// full.js — llegeix els resultats d'un full de càlcul de Google.
//
// La web demana el full de càlcul a Google cada cop que algú obre la pàgina. Si el full
// no es pot llegir (no hi ha internet, s'ha deixat de compartir, s'ha esborrat una pestanya…),
// no passa res: es fan servir els fitxers de datos/ i surt un avís al bàner.
//
// Aquest fitxer NO toca el DOM: rep text i retorna dades, igual que motor.js.

import { FULL } from './config.js';
import { ESQUEMA_PARTITS } from './motor.js';
import { NOMS_ESPORTS, NOMS_PARTITS } from './textos.js';

/** Accepta tant l'identificador sol com l'adreça sencera enganxada del navegador. */
export function idDelFull(valor) {
  const text = String(valor ?? '').trim();
  const trobat = /\/spreadsheets\/d\/([\w-]+)/.exec(text);
  return trobat ? trobat[1] : text;
}

/**
 * Adreça de descàrrega d'una pestanya en format CSV.
 *
 * El `headers=1` és important: sense això Google endevina quantes files són la capçalera i,
 * si les primeres files d'una columna són text (com "Petanca", "Petanca"…), se les empassa
 * totes com a capçalera i les ajunta en un sol títol. Llavors la columna "Esport" passa a
 * dir-se "Esport Petanca Petanca…" i sembla que hi falti.
 */
export function adrecaPestanya(id, pestanya) {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(idDelFull(id))}/gviz/tq` +
    `?tqx=out:csv&headers=1&sheet=${encodeURIComponent(pestanya)}`;
}

/** Compara textos sense distingir majúscules, accents ni espais: "Voleibol platja" = "voleibolplatja". */
const clau = (valor) =>
  String(valor ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * Parteix un CSV en files. Respecta les cometes: una cel·la entre cometes pot tenir
 * comes i salts de línia a dins, i "" vol dir una cometa de debò.
 */
export function llegirCSV(text) {
  const files = [];
  let fila = [];
  let camp = '';
  let dins = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (dins) {
      if (c !== '"') camp += c;
      else if (text[i + 1] === '"') { camp += '"'; i++; }
      else dins = false;
    } else if (c === '"') dins = true;
    else if (c === ',') { fila.push(camp); camp = ''; }
    else if (c === '\n') { fila.push(camp); files.push(fila); fila = []; camp = ''; }
    else if (c !== '\r') camp += c;
  }
  if (camp !== '' || fila.length) { fila.push(camp); files.push(fila); }

  return files.filter((f) => f.some((cela) => cela.trim() !== ''));
}

/** Converteix les files en objectes fent servir la primera fila com a capçalera. */
function ambCapcalera(files) {
  const [capcalera = [], ...cos] = files;
  const columnes = new Map(capcalera.map((nom, i) => [clau(nom), i]));
  const llegir = (fila, nom) => (fila[columnes.get(clau(nom))] ?? '').trim();
  return { columnes, cos, llegir };
}

/* ---------- Diccionaris per reconèixer el que s'escriu a les cel·les ---------- */

function indexEsports(torneig) {
  const index = new Map();
  for (const esport of torneig.deportes) {
    for (const alias of [esport.id, esport.nombre, NOMS_ESPORTS[esport.id]]) {
      if (alias) index.set(clau(alias), esport);
    }
  }
  return index;
}

/** previa1 · "Prèvia 1" · "P1" → previa1 */
function indexPartitsQuadre() {
  const index = new Map();
  for (const { id } of ESQUEMA_PARTITS) {
    index.set(clau(id), id);
    const noms = NOMS_PARTITS[id];
    if (noms) { index.set(clau(noms.llarg), id); index.set(clau(noms.sigla), id); }
  }
  return index;
}

/** "F1-F2" i també "F2-F1", per si algú l'apunta al revés. */
function indexPartitsLliga(jornades = []) {
  const index = new Map();
  for (const jornada of jornades) {
    for (const [local, visitant] of jornada.partidos ?? []) {
      const id = `${local}-${visitant}`;
      index.set(clau(id), id);
      index.set(clau(`${visitant}-${local}`), id);
    }
  }
  return index;
}

/** Accepta l'identificador (E5) o el nom de l'equip, l'antic o el nou del full. */
function indexEquips(config, noms) {
  const index = new Map();
  for (const equip of config.equipos) {
    index.set(clau(equip.id), equip.id);
    if (equip.nombre) index.set(clau(equip.nombre), equip.id);
    const nou = noms?.get(equip.id)?.nombre;
    if (nou) index.set(clau(nou), equip.id);
  }
  return index;
}

/** "Lloc 3" · "3r" · "3" → 3 */
function llocDeTexte(text) {
  const trobat = /^(?:lloc|posicio)?(\d+)[a-z]*$/.exec(clau(text));
  return trobat ? Number(trobat[1]) : null;
}

/* ---------- Esquelet: tots els partits que hi hauria d'haver, buits ---------- */

function esquelet(torneig, nPosicions, partitsLliga) {
  const buit = () => ({ ganador: null, marcador: '' });
  const resultats = {};

  for (const esport of torneig.deportes) {
    if (esport.formato === 'clasificacion') {
      resultats[esport.id] = {
        clasificacion: new Array(nPosicions).fill(null),
        marcadores: new Array(nPosicions).fill(''),
      };
    } else if (partitsLliga) {
      resultats[esport.id] = Object.fromEntries(partitsLliga.map((id) => [id, buit()]));
    } else {
      resultats[esport.id] = Object.fromEntries(ESQUEMA_PARTITS.map(({ id }) => [id, buit()]));
    }
  }
  return resultats;
}

/* ---------- Pestanya d'equips ---------- */

/**
 * Llegeix la pestanya "Equips": columnes Id, Nom i (opcional) Color.
 * @returns {Map<string, {nombre: string, color: string|null}>}
 */
export function equipsDelFull(files, avisos, pestanya = 'Equips') {
  const { columnes, cos, llegir } = ambCapcalera(files);
  const noms = new Map();

  for (const columna of ['id', 'nom']) {
    if (!columnes.has(columna)) {
      avisos.push(`A la pestanya "${pestanya}" del full de càlcul hi falta la columna "${columna}".`);
      return noms;
    }
  }

  cos.forEach((fila, i) => {
    const id = llegir(fila, 'id');
    const nom = llegir(fila, 'nom');
    if (!id) return;
    if (!nom) {
      avisos.push(`Full de càlcul · ${pestanya}, fila ${i + 2}: l'equip "${id}" no té nom.`);
      return;
    }
    noms.set(id, { nombre: nom, color: llegir(fila, 'color') || null });
  });

  return noms;
}

/* ---------- Pestanyes de resultats ---------- */

/**
 * Converteix una pestanya de resultats en el mateix format que datos/resultados.json.
 *
 * @param {string[][]} files    files del CSV
 * @param {object} opcions      { torneig, config, pestanya, noms, jornades, nPosicions }
 * @param {string[]} avisos     s'hi apunten els problemes trobats
 */
export function resultatsDelFull(files, opcions, avisos) {
  const { torneig, config, pestanya, noms, jornades, nPosicions } = opcions;
  const esLliga = Boolean(jornades);

  const partitsLliga = esLliga
    ? (jornades ?? []).flatMap((j) => (j.partidos ?? []).map(([a, b]) => `${a}-${b}`))
    : null;
  const resultats = esquelet(torneig, nPosicions, partitsLliga);

  const perEsport = indexEsports(torneig);
  const perEquip = indexEquips(config, noms);
  const perPartit = esLliga ? indexPartitsLliga(jornades) : indexPartitsQuadre();

  const { columnes, cos, llegir } = ambCapcalera(files);
  for (const columna of ['esport', 'partit', 'guanyador']) {
    if (!columnes.has(columna)) {
      avisos.push(`A la pestanya "${pestanya}" del full de càlcul hi falta la columna "${columna}".`);
      return null;
    }
  }

  cos.forEach((fila, i) => {
    const numero = i + 2; // +1 per la capçalera i +1 perquè els fulls compten des de l'1
    const avis = (text) => avisos.push(`Full de càlcul · ${pestanya}, fila ${numero}: ${text}`);

    const textEsport = llegir(fila, 'esport');
    const textPartit = llegir(fila, 'partit');
    const textGuanyador = llegir(fila, 'guanyador');
    if (!textEsport && !textPartit) return;

    const esport = perEsport.get(clau(textEsport));
    if (!esport) return avis(`l'esport "${textEsport}" no surt a datos/torneo.json.`);
    const desti = resultats[esport.id];

    // Ordre manual per desfer un empat de la lliga: "F2, F1".
    if (clau(textPartit) === 'desempat' || clau(textPartit) === 'desempate') {
      const ordre = textGuanyador.split(/[,;/]/).map((t) => perEquip.get(clau(t))).filter(Boolean);
      if (ordre.length) desti.desempate = ordre;
      return;
    }

    // Natació, atletisme, ciclisme i minigolf: una fila per lloc, del 1r a l'últim.
    // El marcador (temps, cops…) és opcional i només es mostra.
    if (esport.formato === 'clasificacion') {
      const lloc = llocDeTexte(textPartit);
      if (!lloc || lloc > nPosicions) {
        return avis(`"${textPartit}" no és cap lloc de ${esport.id} (hauria de dir de "Lloc 1" a "Lloc ${nPosicions}").`);
      }
      desti.marcadores[lloc - 1] = llegir(fila, 'marcador');
      if (!textGuanyador) return;
      const equip = perEquip.get(clau(textGuanyador));
      if (!equip) return avis(`"${textGuanyador}" no és cap equip d'aquesta competició.`);
      desti.clasificacion[lloc - 1] = equip;
      return;
    }

    const partit = perPartit.get(clau(textPartit));
    if (!partit) return avis(`"${textPartit}" no és cap partit de ${esport.id}.`);

    const marcador = llegir(fila, 'marcador');
    if (!textGuanyador) {
      desti[partit] = { ganador: null, marcador };
      return;
    }
    const equip = perEquip.get(clau(textGuanyador));
    if (!equip) return avis(`el guanyador "${textGuanyador}" no és cap equip d'aquesta competició.`);
    desti[partit] = { ganador: equip, marcador };
  });

  return resultats;
}

/* ---------- Pestanya del calendari ---------- */

/** Els tres tipus de fila del calendari, i com es poden escriure a la cel·la. */
const TIPUS = new Map([
  ['', 'partit'], ['partit', 'partit'], ['partido', 'partit'],
  ['limit', 'limit'], ['datalimit', 'limit'], ['limite', 'limit'],
  ['acte', 'acte'], ['acto', 'acte'], ['esdeveniment', 'acte'],
]);

const COMPETICIONS_FULL = new Map([
  ['', null], ['tots', null], ['totes', null], ['mixt', null],
  ['masculi', 'masculina'], ['masculina', 'masculina'], ['masculino', 'masculina'],
  ['femeni', 'femenina'], ['femenina', 'femenina'], ['femenino', 'femenina'],
]);

/**
 * Una data escrita com sigui: "22/08/2026", "22/08", "2026-08-22" o el que en surti si algú
 * la deixa com a data de Google. Torna 'AAAA-MM-DD'.
 */
export function dataDelFull(text, anyPerDefecte) {
  const brut = String(text ?? '').trim();
  if (!brut) return null;

  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(brut);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  const trossos = /^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?$/.exec(brut);
  if (!trossos) return null;

  // Primer el dia (com s'escriu aquí); si no pot ser dia, és que va al revés.
  let [, dia, mes, any] = trossos;
  if (Number(mes) > 12) [dia, mes] = [mes, dia];
  if (Number(mes) > 12 || Number(dia) > 31) return null;
  const anyComplet = any ? (any.length <= 2 ? `20${any.padStart(2, '0')}` : any) : String(anyPerDefecte);
  return `${anyComplet}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

/** "20:00-21:00" · "20-21h" · "20h" → { inici, fi } */
export function horesDelFull(text) {
  const brut = String(text ?? '').trim();
  if (!brut) return { inici: null, fi: null };

  const hora = (h, m) => `${String(Number(h) % 24).padStart(2, '0')}:${(m ?? '00').padStart(2, '0')}`;
  const parts = brut.split(/\s*[-–]\s*/).map((tros) => /^(\d{1,2})(?::(\d{2}))?\s*h?$/i.exec(tros.trim()));
  if (!parts[0]) return { inici: null, fi: null };
  return {
    inici: hora(parts[0][1], parts[0][2]),
    fi: parts[1] ? hora(parts[1][1], parts[1][2]) : null,
  };
}

/**
 * Llegeix la pestanya del calendari. Una fila és una franja: dia, hora, lloc i què s'hi juga.
 * La columna Partit fa servir el mateix vocabulari que les pestanyes de resultats
 * ("Quarts 1", "F1-F2"), o la paraula "Tot" si en aquella estona es juga l'esport sencer.
 */
export function horarisDelFull(files, opcions, avisos) {
  const { dades, pestanya = 'Calendari', any = new Date().getFullYear() } = opcions;

  const perEsport = indexEsports(dades.torneig);
  const perQuadre = indexPartitsQuadre();
  const perLliga = indexPartitsLliga(dades.femeni?.jornadas ?? []);

  const { columnes, cos, llegir } = ambCapcalera(files);
  for (const columna of ['data', 'esport']) {
    if (!columnes.has(columna)) {
      // Si Google no troba la pestanya que se li demana, en torna una altra sense dir res:
      // per això el més calent és que no existeixi o que es digui d'una altra manera.
      avisos.push(
        `A la pestanya "${pestanya}" del full de càlcul hi falta la columna "${columna}". ` +
        `Comprova que la pestanya existeix i que es diu exactament així. Mentrestant els ` +
        `horaris surten de datos/horarios.json.`
      );
      return null;
    }
  }

  const horaris = [];
  cos.forEach((fila, i) => {
    const numero = i + 2;
    const avis = (text) => avisos.push(`Full de càlcul · ${pestanya}, fila ${numero}: ${text}`);

    const textData = llegir(fila, 'data');
    const textEsport = llegir(fila, 'esport');
    // "⚠ REPASSAR" és un recordatori per a qui manté el full, no per a qui mira la web.
    const nota = llegir(fila, 'nota').replace(/⚠?\s*REPASSAR\s*·?\s*/i, '').trim();
    if (!textData && !textEsport && !nota) return;

    const data = dataDelFull(textData, any);
    if (!data) return avis(`"${textData}" no és cap data (escriu-la com "22/08/2026").`);

    const tipus = TIPUS.get(clau(llegir(fila, 'tipus')));
    if (!tipus) return avis(`"${llegir(fila, 'tipus')}" no és cap tipus de fila (deixa-ho buit, o posa-hi "Límit" o "Acte").`);

    if (!COMPETICIONS_FULL.has(clau(llegir(fila, 'competicio')))) {
      return avis(`"${llegir(fila, 'competicio')}" no és cap competició (ha de dir "Masculí", "Femení", o res si són totes dues).`);
    }
    const competicio = COMPETICIONS_FULL.get(clau(llegir(fila, 'competicio')));

    // Una fila pot valer per a diversos esports: les dates límit n'afecten sis de cop.
    const esports = [];
    for (const tros of textEsport.split(/[,;]/).map((t) => t.trim()).filter(Boolean)) {
      const esport = perEsport.get(clau(tros));
      if (!esport) avis(`l'esport "${tros}" no surt a datos/torneo.json.`);
      else esports.push(esport.id);
    }
    if (tipus !== 'acte' && !esports.length) return;

    // "Tot" vol dir que en aquella estona es juga l'esport sencer: és el cas dels que van per
    // ordre d'arribada i dels que es despatxen en una sola sessió.
    const textPartit = llegir(fila, 'partit');
    const tot = !textPartit || ['tot', 'tots', 'tota', 'totes'].includes(clau(textPartit));

    const partits = [];
    if (!tot) {
      for (const tros of textPartit.split(/[,;]/).map((t) => t.trim()).filter(Boolean)) {
        const partit = competicio === 'femenina' ? perLliga.get(clau(tros))
          : competicio === 'masculina' ? perQuadre.get(clau(tros))
          : perQuadre.get(clau(tros)) ?? perLliga.get(clau(tros));
        if (!partit) avis(`"${tros}" no és cap partit d'aquesta competició.`);
        else partits.push(partit);
      }
    }

    const { inici, fi } = horesDelFull(llegir(fila, 'hora'));
    if (tipus !== 'limit' && !inici) avis(`no s'ha entès l'hora "${llegir(fila, 'hora')}".`);

    horaris.push({
      data, inici, fi, tipus, competicio, esports, partits, tot,
      lloc: llegir(fila, 'lloc'),
      nota,
    });
  });

  return horaris;
}

/* ---------- Descàrrega ---------- */

async function descarregar(pestanya, avisos) {
  let resposta;
  try {
    resposta = await fetch(adrecaPestanya(FULL.id, pestanya), { cache: 'no-cache' });
  } catch (e) {
    avisos.push(
      `No s'ha pogut llegir la pestanya "${pestanya}" del full de càlcul. Comprova que està ` +
      `compartit amb "Qualsevol amb l'enllaç: lector". Mentrestant es fan servir els fitxers de datos/.`
    );
    return null;
  }
  if (!resposta.ok) {
    avisos.push(`No s'ha pogut llegir la pestanya "${pestanya}" del full de càlcul (error ${resposta.status}). Comprova que la pestanya es diu exactament així.`);
    return null;
  }

  const text = await resposta.text();
  if (text.trimStart().startsWith('<') || text.includes('google.visualization.Query')) {
    avisos.push(`La pestanya "${pestanya}" del full de càlcul no s'ha pogut llegir com a taula. Comprova el nom de la pestanya i que el full estigui compartit.`);
    return null;
  }
  return llegirCSV(text);
}

/**
 * Llegeix el full de càlcul sencer. No llança mai: el que no es pot llegir es queda com estava
 * i el problema s'apunta a `avisos`.
 *
 * @param {object} dades { torneig, femeni }, tal com surten de datos/
 * @returns {Promise<{avisos: string[], noms?: Map, resultats?: object, resultatsFemeni?: object}>}
 */
export async function llegirFull(dades) {
  const avisos = [];
  if (!FULL.id) return { avisos };

  const { equips, masculi, femeni, calendari } = FULL.pestanyes;
  const [filesEquips, filesMasculi, filesFemeni, filesCalendari] = await Promise.all([
    descarregar(equips, avisos),
    descarregar(masculi, avisos),
    descarregar(femeni, avisos),
    descarregar(calendari, avisos),
  ]);

  const sortida = { avisos };
  const noms = filesEquips ? equipsDelFull(filesEquips, avisos, equips) : null;
  if (noms?.size) sortida.noms = noms;

  if (filesMasculi) {
    const resultats = resultatsDelFull(filesMasculi, {
      torneig: dades.torneig,
      config: dades.torneig,
      pestanya: masculi,
      noms,
      nPosicions: dades.torneig.equipos.length,
    }, avisos);
    if (resultats) sortida.resultats = resultats;
  }

  if (filesFemeni) {
    const resultats = resultatsDelFull(filesFemeni, {
      torneig: dades.torneig,
      config: dades.femeni,
      pestanya: femeni,
      noms,
      jornades: dades.femeni.jornadas ?? [],
      nPosicions: dades.femeni.equipos.length,
    }, avisos);
    if (resultats) sortida.resultatsFemeni = resultats;
  }

  if (filesCalendari) {
    const horaris = horarisDelFull(filesCalendari, { dades, pestanya: calendari, any: FULL.any }, avisos);
    if (horaris) sortida.horaris = horaris;
  }

  return sortida;
}
