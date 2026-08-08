// motor.js — lògica del torneig. Funcions pures: entren dades JSON, surt estat calculat.
// Aquest fitxer NO toca mai el DOM.

/** Els 15 partits d'un quadre, en ordre de dependència (cada un només depèn dels anteriors). */
export const ESQUEMA_PARTITS = [
  { id: 'previa1', ronda: 'previes' },
  { id: 'previa2', ronda: 'previes' },
  { id: 'qf1', ronda: 'quarts' },
  { id: 'qf2', ronda: 'quarts' },
  { id: 'qf3', ronda: 'quarts' },
  { id: 'qf4', ronda: 'quarts' },
  { id: 'sf1', ronda: 'semis' },
  { id: 'sf2', ronda: 'semis' },
  { id: 'final', ronda: 'final' },
  { id: 'tercerPuesto', ronda: 'llocs' },
  { id: 'consSf1', ronda: 'consSemis' },
  { id: 'consSf2', ronda: 'consSemis' },
  { id: 'consFinal', ronda: 'consFinal' },
  { id: 'consTercero', ronda: 'llocs' },
  { id: 'puesto9', ronda: 'llocs' },
];

/** D'on surt cada posició final: [idPartit, 'guanyador' | 'perdedor'], de la 1a a la 10a. */
export const ORIGEN_POSICIONS = [
  ['final', 'guanyador'],
  ['final', 'perdedor'],
  ['tercerPuesto', 'guanyador'],
  ['tercerPuesto', 'perdedor'],
  ['consFinal', 'guanyador'],
  ['consFinal', 'perdedor'],
  ['consTercero', 'guanyador'],
  ['consTercero', 'perdedor'],
  ['puesto9', 'guanyador'],
  ['puesto9', 'perdedor'],
];

export const TOTAL_PARTITS = ESQUEMA_PARTITS.length;
export const TOTAL_POSICIONS = ORIGEN_POSICIONS.length;

/**
 * Calcula l'estat d'un esport: participants derivats de cada partit, posicions finals i punts.
 *
 * @param {object} esport   entrada de torneo.deportes
 * @param {object} torneig  torneo.json sencer
 * @param {object} quadre   entrada de cuadros.json (o undefined)
 * @param {object} resultat entrada de resultados.json (o undefined)
 * @returns {object} estat de l'esport (mai llança: els problemes van a `errors`)
 */
export function calcularEsport(esport, torneig, quadre, resultat) {
  const errors = [];
  const equipsValids = new Set(torneig.equipos.map((e) => e.id));
  const categoria = torneig.categorias[esport.categoria];
  if (!categoria) {
    errors.push(`L'esport "${esport.id}" té la categoria desconeguda "${esport.categoria}".`);
  }
  const taulaPunts = categoria ? categoria.puntos : [];

  const base =
    esport.formato === 'clasificacion'
      ? posicionsPerClassificacio(esport, resultat, equipsValids, errors)
      : posicionsPerQuadre(esport, quadre, resultat, equipsValids, errors);

  const punts = {};
  base.posicions.forEach((idEquip, i) => {
    if (idEquip) punts[idEquip] = taulaPunts[i] ?? 0;
  });

  return {
    id: esport.id,
    esport,
    categoria: esport.categoria,
    taulaPunts,
    errors,
    punts,
    ...base,
  };
}

/** Quadre de 8 amb prèvies i consolació. */
function posicionsPerQuadre(esport, quadre, resultat, equipsValids, errors) {
  const partits = {};
  const buit = { participants: [null, null], guanyador: null, perdedor: null, marcador: '', estat: 'bloquejat' };

  if (!quadre) {
    errors.push(`Falta "${esport.id}" a datos/cuadros.json.`);
  }
  if (!resultat) {
    errors.push(`Falta "${esport.id}" a datos/resultados.json.`);
  }

  const guanyador = (id) => partits[id]?.guanyador ?? null;
  const perdedor = (id) => partits[id]?.perdedor ?? null;

  // Participants de cada partit: sempre derivats, mai escrits a mà.
  const derivar = {
    previa1: () => parella(quadre?.previa1),
    previa2: () => parella(quadre?.previa2),
    qf1: () => [guanyador('previa1'), quadre?.qf1Rival ?? null],
    qf2: () => parella(quadre?.qf2),
    qf3: () => [guanyador('previa2'), quadre?.qf3Rival ?? null],
    qf4: () => parella(quadre?.qf4),
    sf1: () => [guanyador('qf1'), guanyador('qf2')],
    sf2: () => [guanyador('qf3'), guanyador('qf4')],
    final: () => [guanyador('sf1'), guanyador('sf2')],
    tercerPuesto: () => [perdedor('sf1'), perdedor('sf2')],
    consSf1: () => [perdedor('qf1'), perdedor('qf2')],
    consSf2: () => [perdedor('qf3'), perdedor('qf4')],
    consFinal: () => [guanyador('consSf1'), guanyador('consSf2')],
    consTercero: () => [perdedor('consSf1'), perdedor('consSf2')],
    puesto9: () => [perdedor('previa1'), perdedor('previa2')],
  };

  for (const { id, ronda } of ESQUEMA_PARTITS) {
    const [a, b] = derivar[id]();
    for (const equip of [a, b]) {
      if (equip && !equipsValids.has(equip)) {
        errors.push(`El partit "${id}" de ${esport.id} fa servir l'equip desconegut "${equip}".`);
      }
    }

    const dades = resultat?.[id];
    if (resultat && !dades) errors.push(`Falta el partit "${id}" de ${esport.id} a datos/resultados.json.`);

    let guanya = dades?.ganador ?? null;
    if (guanya !== null) {
      if (!equipsValids.has(guanya)) {
        errors.push(`El guanyador "${guanya}" de ${esport.id} · ${id} no és cap equip de torneo.json.`);
        guanya = null;
      } else if (!a || !b) {
        errors.push(`${esport.id} · ${id}: hi ha guanyador però encara no se sap qui hi juga (falta un partit anterior).`);
        guanya = null;
      } else if (guanya !== a && guanya !== b) {
        errors.push(`El guanyador "${guanya}" de ${esport.id} · ${id} no és cap dels dos participants (${a} i ${b}).`);
        guanya = null;
      }
    }

    partits[id] = {
      id,
      ronda,
      participants: [a, b],
      guanyador: guanya,
      perdedor: guanya ? (guanya === a ? b : a) : null,
      marcador: typeof dades?.marcador === 'string' ? dades.marcador : '',
      estat: guanya ? 'jugat' : a && b ? 'pendent' : 'bloquejat',
    };
  }

  const posicions = ORIGEN_POSICIONS.map(([idPartit, quin]) => (partits[idPartit] ?? buit)[quin]);
  const jugats = ESQUEMA_PARTITS.filter(({ id }) => partits[id].estat === 'jugat').length;

  return { format: 'cuadro', partits, posicions, progres: { jugats, total: TOTAL_PARTITS } };
}

/** Ciclisme, atletisme, natació: ordre d'arribada directe. */
function posicionsPerClassificacio(esport, resultat, equipsValids, errors) {
  const posicions = new Array(TOTAL_POSICIONS).fill(null);
  const llista = resultat?.clasificacion;

  if (!Array.isArray(llista)) {
    errors.push(`Falta l'array "clasificacion" de "${esport.id}" a datos/resultados.json.`);
  } else {
    if (llista.length !== TOTAL_POSICIONS) {
      errors.push(`La classificació de ${esport.id} té ${llista.length} posicions i n'hi hauria d'haver ${TOTAL_POSICIONS}.`);
    }
    const vistos = new Set();
    llista.slice(0, TOTAL_POSICIONS).forEach((idEquip, i) => {
      if (idEquip === null || idEquip === undefined || idEquip === '') return;
      if (!equipsValids.has(idEquip)) {
        errors.push(`La classificació de ${esport.id} fa servir l'equip desconegut "${idEquip}".`);
        return;
      }
      if (vistos.has(idEquip)) {
        errors.push(`L'equip "${idEquip}" surt més d'un cop a la classificació de ${esport.id}.`);
        return;
      }
      vistos.add(idEquip);
      posicions[i] = idEquip;
    });
  }

  const jugats = posicions.filter(Boolean).length;
  return { format: 'clasificacion', partits: {}, posicions, progres: { jugats, total: TOTAL_POSICIONS } };
}

/**
 * Classificació general: suma els punts de tots els esports.
 * Els esports a mig fer sumen el que ja se sap.
 */
export function calcularGeneral(torneig, esports) {
  const files = torneig.equipos.map((equip) => ({
    equip,
    punts: 0,
    perCategoria: Object.fromEntries(Object.keys(torneig.categorias).map((c) => [c, 0])),
    // recompte[i] = quantes vegades ha quedat en posició i+1 (serveix per desempatar)
    recompte: new Array(TOTAL_POSICIONS).fill(0),
  }));
  const perId = new Map(files.map((f) => [f.equip.id, f]));

  for (const estat of esports) {
    estat.posicions.forEach((idEquip, i) => {
      const fila = idEquip && perId.get(idEquip);
      if (!fila) return;
      const punts = estat.punts[idEquip] ?? 0;
      fila.punts += punts;
      if (fila.perCategoria[estat.categoria] !== undefined) fila.perCategoria[estat.categoria] += punts;
      fila.recompte[i] += 1;
    });
  }

  files.sort(comparaEquips);

  // Posició a la general, compartida quan hi ha empat exacte.
  let anterior = null;
  files.forEach((fila, i) => {
    fila.posicio = anterior && comparaEquips(anterior, fila) === 0 ? anterior.posicio : i + 1;
    anterior = fila;
  });
  return files;
}

/** Més punts; si empaten, més primers llocs, després més segons, i així fins al desè. */
function comparaEquips(a, b) {
  if (b.punts !== a.punts) return b.punts - a.punts;
  for (let i = 0; i < TOTAL_POSICIONS; i++) {
    if (b.recompte[i] !== a.recompte[i]) return b.recompte[i] - a.recompte[i];
  }
  return 0;
}

function parella(valor) {
  return Array.isArray(valor) ? [valor[0] ?? null, valor[1] ?? null] : [null, null];
}
