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
 * Calcula l'estat d'un esport: participants de cada partit, posicions finals i punts.
 *
 * @param {object} esport entrada de deportes (torneo.json)
 * @param {object} config competició: { equipos, categorias, ... }. És torneo.json per a la
 *                        masculina i femenino.json per a la femenina.
 * @param {object} fonts  { format, quadre, resultat, jornades, puntsLliga }
 * @returns {object} estat de l'esport (mai llança: els problemes van a `errors`)
 */
export function calcularEsport(esport, config, fonts = {}) {
  const errors = [];
  const equipsValids = new Set(config.equipos.map((e) => e.id));
  const nPosicions = config.equipos.length;
  const categoria = config.categorias[esport.categoria];
  if (!categoria) {
    errors.push(`L'esport "${esport.id}" té la categoria desconeguda "${esport.categoria}".`);
  }
  const taulaPunts = categoria ? categoria.puntos : [];
  const format = fonts.format ?? esport.formato;
  const { quadre, resultat } = fonts;

  const base =
    format === 'clasificacion'
      ? posicionsPerClassificacio(esport, resultat, equipsValids, errors, nPosicions)
      : format === 'liga'
        ? posicionsPerLliga(esport, config, fonts, errors)
        : posicionsPerQuadre(esport, quadre, resultat, equipsValids, errors);

  // Els punts surten de la posició final, menys si hi ha empats a la lliga: aleshores els
  // equips empatats es reparteixen a parts iguals els punts dels llocs que ocupen.
  const puntsProvisionals = {};
  base.posicions.forEach((idEquip, i) => {
    if (idEquip) puntsProvisionals[idEquip] = taulaPunts[i] ?? 0;
  });
  for (const bloc of base.empats ?? []) {
    const suma = bloc.posicions.reduce((total, pos) => total + (taulaPunts[pos - 1] ?? 0), 0);
    const repartit = Math.round(suma / bloc.equipos.length);
    for (const idEquip of bloc.equipos) puntsProvisionals[idEquip] = repartit;
  }

  // En un quadre, un lloc decidit ja no canvia i puntua de seguida. En una lliga, en canvi,
  // qualsevol posició pot moure's fins a l'últim partit: no es reparteix res fins que s'acaba.
  const punts = base.provisional ? {} : puntsProvisionals;

  return {
    puntsProvisionals,
    id: esport.id,
    esport,
    categoria: esport.categoria,
    taulaPunts,
    errors,
    punts,
    ...base,
    format,
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

  return { partits, posicions, progres: { jugats, total: TOTAL_PARTITS } };
}

/**
 * Lliga de tots contra tots a una volta (competició femenina).
 * L'ordre és: victòries → enfrontament directe entre els empatats → ordre manual
 * (`desempate` a resultados-femenino.json). Si encara hi ha empat, comparteixen lloc i es
 * reparteixen a parts iguals els punts dels llocs que ocupen.
 */
function posicionsPerLliga(esport, config, fonts, errors) {
  const { resultat, jornades = [] } = fonts;
  const puntsLliga = fonts.puntsLliga ?? { victoria: 1, derrota: 0 };
  const equipsValids = new Set(config.equipos.map((e) => e.id));

  if (!resultat) errors.push(`Falta "${esport.id}" a datos/resultados-femenino.json.`);
  if (!jornades.length) errors.push(`Falta el calendari de jornades a datos/femenino.json.`);

  const partits = {};
  const marcador = new Map(config.equipos.map((e) => [e.id, { id: e.id, jugats: 0, victories: 0, derrotes: 0 }]));

  for (const jornada of jornades) {
    for (const [local, visitant] of jornada.partidos ?? []) {
      const clau = `${local}-${visitant}`;
      for (const equip of [local, visitant]) {
        if (!equipsValids.has(equip)) errors.push(`El partit "${clau}" de ${esport.id} fa servir l'equip desconegut "${equip}".`);
      }

      const dades = resultat?.[clau];
      if (resultat && !dades) errors.push(`Falta el partit "${clau}" de ${esport.id} a datos/resultados-femenino.json.`);

      let guanya = dades?.ganador ?? null;
      if (guanya !== null) {
        if (!equipsValids.has(guanya)) {
          errors.push(`El guanyador "${guanya}" de ${esport.id} · ${clau} no és cap equip de datos/femenino.json.`);
          guanya = null;
        } else if (guanya !== local && guanya !== visitant) {
          errors.push(`El guanyador "${guanya}" de ${esport.id} · ${clau} no és cap dels dos participants (${local} i ${visitant}).`);
          guanya = null;
        }
      }

      const perd = guanya ? (guanya === local ? visitant : local) : null;
      partits[clau] = {
        id: clau,
        jornada: jornada.jornada,
        participants: [local, visitant],
        guanyador: guanya,
        perdedor: perd,
        marcador: typeof dades?.marcador === 'string' ? dades.marcador : '',
        estat: guanya ? 'jugat' : 'pendent',
      };

      if (guanya) {
        for (const equip of [guanya, perd]) {
          const fila = marcador.get(equip);
          if (fila) fila.jugats += 1;
        }
        marcador.get(guanya).victories += 1;
        marcador.get(perd).derrotes += 1;
      }
    }
  }

  // Partits apuntats que no són al calendari.
  for (const clau of Object.keys(resultat ?? {})) {
    if (clau !== 'desempate' && !partits[clau]) {
      errors.push(`El partit "${clau}" de ${esport.id} no és al calendari de datos/femenino.json.`);
    }
  }

  for (const fila of marcador.values()) {
    fila.puntsLliga = fila.victories * puntsLliga.victoria + fila.derrotes * puntsLliga.derrota;
  }

  const desempat = Array.isArray(resultat?.desempate) ? resultat.desempate : [];
  const blocs = ordenarLliga([...marcador.keys()], marcador, partits, desempat);

  const posicions = [];
  const empats = [];
  const taula = [];
  for (const bloc of blocs) {
    const primera = posicions.length + 1;
    const llocs = bloc.map((_, i) => primera + i);
    if (bloc.length > 1) empats.push({ equipos: bloc, posicions: llocs });
    for (const idEquip of bloc) {
      posicions.push(idEquip);
      taula.push({ ...marcador.get(idEquip), posicio: primera, compartida: bloc.length > 1 });
    }
  }

  const jugats = Object.values(partits).filter((p) => p.estat === 'jugat').length;
  const total = Object.keys(partits).length;
  return {
    partits,
    posicions,
    empats,
    taulaLliga: taula,
    jornades,
    puntsLliga,
    provisional: jugats < total,
    progres: { jugats, total },
  };
}

/** Agrupa i ordena de més a menys segons una puntuació; els que empaten queden al mateix bloc. */
function agruparPer(ids, valor) {
  const grups = new Map();
  for (const id of ids) {
    const clau = valor(id);
    if (!grups.has(clau)) grups.set(clau, []);
    grups.get(clau).push(id);
  }
  return [...grups.entries()].sort((a, b) => b[0] - a[0]).map(([, grup]) => grup);
}

function ordenarLliga(ids, marcador, partits, desempat) {
  const blocs = [];
  for (const perVictories of agruparPer(ids, (id) => marcador.get(id).victories)) {
    if (perVictories.length === 1) { blocs.push(perVictories); continue; }

    // Enfrontament directe: només compten els partits entre els equips empatats.
    const directes = (id) =>
      Object.values(partits).filter(
        (p) => p.guanyador === id && p.participants.some((rival) => rival !== id && perVictories.includes(rival))
      ).length;

    for (const perDirectes of agruparPer(perVictories, directes)) {
      if (perDirectes.length === 1) { blocs.push(perDirectes); continue; }

      // Últim recurs: l'ordre que hagi decidit l'organització.
      const manual = (id) => {
        const i = desempat.indexOf(id);
        return i === -1 ? -Infinity : -i;
      };
      blocs.push(...agruparPer(perDirectes, manual));
    }
  }
  return blocs;
}

/**
 * Ciclisme, atletisme, natació i minigolf: ordre directe, sense eliminatòries.
 * `marcadores` és opcional (temps, cops…) i només es mostra al costat de cada equip.
 */
function posicionsPerClassificacio(esport, resultat, equipsValids, errors, nPosicions) {
  const posicions = new Array(nPosicions).fill(null);
  const marcadors = new Array(nPosicions).fill('');
  const llista = resultat?.clasificacion;

  const marques = resultat?.marcadores;
  if (marques !== undefined && !Array.isArray(marques)) {
    errors.push(`El camp "marcadores" de ${esport.id} hauria de ser una llista.`);
  } else if (Array.isArray(marques)) {
    marques.slice(0, nPosicions).forEach((marca, i) => {
      if (typeof marca === 'string') marcadors[i] = marca.trim();
      else if (typeof marca === 'number') marcadors[i] = String(marca);
    });
  }

  if (!Array.isArray(llista)) {
    errors.push(`Falta l'array "clasificacion" de "${esport.id}" al fitxer de resultats.`);
  } else {
    if (llista.length !== nPosicions) {
      errors.push(`La classificació de ${esport.id} té ${llista.length} posicions i n'hi hauria d'haver ${nPosicions}.`);
    }
    const vistos = new Set();
    llista.slice(0, nPosicions).forEach((idEquip, i) => {
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
  return { partits: {}, posicions, marcadors, progres: { jugats, total: nPosicions } };
}

/**
 * Classificació general: suma els punts de tots els esports.
 * Els esports a mig fer sumen el que ja se sap.
 */
export function calcularGeneral(config, esports) {
  const files = config.equipos.map((equip) => ({
    equip,
    punts: 0,
    perCategoria: Object.fromEntries(Object.keys(config.categorias).map((c) => [c, 0])),
    // recompte[i] = quantes vegades ha quedat en posició i+1 (serveix per desempatar)
    recompte: new Array(config.equipos.length).fill(0),
  }));
  const perId = new Map(files.map((f) => [f.equip.id, f]));

  for (const estat of esports) {
    // Una lliga sense acabar encara no reparteix res.
    if (estat.provisional) continue;
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
  for (let i = 0; i < a.recompte.length; i++) {
    if (b.recompte[i] !== a.recompte[i]) return b.recompte[i] - a.recompte[i];
  }
  return 0;
}

function parella(valor) {
  return Array.isArray(valor) ? [valor[0] ?? null, valor[1] ?? null] : [null, null];
}
