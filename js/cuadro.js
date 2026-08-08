// cuadro.js — pinta deporte.html?id=...: el quadre d'un esport i les seves posicions finals.

import {
  COMPETICIONS, adreca, buida, campioDe, carregarTorneig, celaEquip, competicioDeLaAdreca, el,
  mostrarErrorGreu, mostrarErrors, selectorCompeticio,
} from './comu.js';
import { NOMS_PARTITS, NOMS_RONDES, nomCategoria, nomEsport, nomGrup, ordinal } from './textos.js';

const zonaSelector = document.querySelector('#selector');
const zonaErrors = document.querySelector('#errors');
const zonaCap = document.querySelector('#capcalera');
const zonaCos = document.querySelector('#contingut');
const enllacTornar = document.querySelector('#tornar');

/** Quan un participant encara no se sap, d'on sortirà: [guanyador|perdedor, partit]. */
const PROCEDENCIA = {
  qf1: [['guanyador', 'previa1'], null],
  qf3: [['guanyador', 'previa2'], null],
  sf1: [['guanyador', 'qf1'], ['guanyador', 'qf2']],
  sf2: [['guanyador', 'qf3'], ['guanyador', 'qf4']],
  final: [['guanyador', 'sf1'], ['guanyador', 'sf2']],
  tercerPuesto: [['perdedor', 'sf1'], ['perdedor', 'sf2']],
  consSf1: [['perdedor', 'qf1'], ['perdedor', 'qf2']],
  consSf2: [['perdedor', 'qf3'], ['perdedor', 'qf4']],
  consFinal: [['guanyador', 'consSf1'], ['guanyador', 'consSf2']],
  consTercero: [['perdedor', 'consSf1'], ['perdedor', 'consSf2']],
  puesto9: [['perdedor', 'previa1'], ['perdedor', 'previa2']],
};

init();

async function init() {
  const id = new URLSearchParams(location.search).get('id');
  const competicio = competicioDeLaAdreca();

  zonaSelector.append(selectorCompeticio(competicio, 'deporte.html', id ? { id } : {}));
  enllacTornar.href = adreca('index.html', competicio);

  let dades;
  try {
    dades = await carregarTorneig(competicio);
  } catch (e) {
    mostrarErrorGreu(zonaErrors, e);
    return;
  }

  const estat = dades.perId.get(id);
  if (!estat) {
    document.title = 'Esport no trobat · Olimpíades 2026';
    buida(zonaCap).append(el('h1', { text: 'Esport no trobat' }));
    buida(zonaCos).append(
      el('div', { class: 'buit' }, [
        el('p', { text: id ? `No hi ha cap esport amb l'identificador "${id}".` : "Falta l'identificador de l'esport a l'adreça." }),
        el('p', {}, [el('a', { href: adreca('index.html', competicio), text: "Torna a la llista d'esports" })]),
      ])
    );
    return;
  }

  mostrarErrors(zonaErrors, estat.errors);
  pintarCapcalera(estat, dades);
  pintarContingut(estat, dades);
}

/* ---------- Capçalera ---------- */

function pintarCapcalera(estat, dades) {
  const { torneig, equips } = dades;
  const nom = nomEsport(estat.esport);
  const grup = estat.esport.grupoAfin ? torneig.gruposAfines[estat.esport.grupoAfin] : null;
  const campio = campioDe(estat);
  const etiquetaComp = COMPETICIONS[dades.competicio].etiqueta;
  document.title = `${nom} · ${etiquetaComp} · Olimpíades 2026`;

  const sobretitol = { cuadro: "Quadre de l'esport", liga: "Lliga de l'esport" }[estat.format] ?? "Classificació de l'esport";

  buida(zonaCap).append(
    el('p', { class: 'sobretitol', text: `${sobretitol} · ${etiquetaComp}` }),
    el('h1', { text: nom }),
    el('div', { class: 'etiquetes' }, [
      el('span', { class: 'etiqueta', text: nomCategoria(estat.categoria) }),
      grup && el('span', {
        class: 'etiqueta etiqueta--grup',
        style: { '--accent': grup.color },
        text: nomGrup(estat.esport.grupoAfin),
      }),
      campio && el('span', { class: 'etiqueta', text: `🏆 ${equips.get(campio)?.nombre ?? campio}` }),
    ]),
    el('p', { class: 'repartiment' }, [
      'Reparteix ',
      el('b', { text: estat.taulaPunts.join(' · ') }),
      ` punts, del 1r al ${ordinal(estat.taulaPunts.length)} lloc.`,
    ])
  );
}

/* ---------- Contingut ---------- */

function pintarContingut(estat, dades) {
  buida(zonaCos);

  if (estat.format === 'clasificacion') {
    zonaCos.append(
      el('section', { class: 'seccio' }, [
        el('h2', { text: "Ordre d'arribada" }),
        el('p', { class: 'nota', text: "En aquest esport no hi ha eliminatòries: s'apunta directament l'ordre d'arribada." }),
        taulaPosicions(estat, dades),
      ])
    );
    return;
  }

  if (estat.format === 'liga') {
    pintarLliga(estat, dades);
    return;
  }

  const p = (id) => estat.partits[id];

  zonaCos.append(
    // --- Quadre principal ---
    el('section', { class: 'seccio' }, [
      el('h2', { text: 'Quadre principal' }),
      el('div', { class: 'quadre-scroll' }, [
        el('div', { class: 'quadre' }, [
          columna(NOMS_RONDES.previes, [
            { partit: p('previa1'), surt: true },
            { buida: true },
            { partit: p('previa2'), surt: true },
            { buida: true },
          ], estat, dades),
          columna(NOMS_RONDES.quarts, [
            { partit: p('qf1'), rep: true, surt: true, unio: true },
            { partit: p('qf2'), surt: true },
            { partit: p('qf3'), rep: true, surt: true, unio: true },
            { partit: p('qf4'), surt: true },
          ], estat, dades),
          columna(NOMS_RONDES.semis, [
            { partit: p('sf1'), rep: true, surt: true, unio: true },
            { partit: p('sf2'), rep: true, surt: true },
          ], estat, dades),
          columna(NOMS_RONDES.final, [{ partit: p('final'), rep: true }], estat, dades),
        ]),
      ]),
      el('div', { class: 'partits-llocs' }, [
        blocPartit('3r i 4t lloc', p('tercerPuesto'), estat, dades),
      ]),
    ]),

    // --- Consolació ---
    el('section', { class: 'seccio' }, [
      el('h2', { text: 'Consolació · llocs 5è a 8è' }),
      el('p', { class: 'nota', text: 'Hi juguen els quatre equips que perden als quarts de final.' }),
      el('div', { class: 'quadre-scroll' }, [
        el('div', { class: 'quadre' }, [
          columna(NOMS_RONDES.consSemis, [
            { partit: p('consSf1'), surt: true, unio: true },
            { partit: p('consSf2'), surt: true },
          ], estat, dades),
          columna(NOMS_RONDES.consFinal, [{ partit: p('consFinal'), rep: true }], estat, dades),
        ]),
      ]),
      el('div', { class: 'partits-llocs' }, [
        blocPartit('7è i 8è lloc', p('consTercero'), estat, dades),
      ]),
    ]),

    // --- Places 9 i 10 ---
    el('section', { class: 'seccio' }, [
      el('h2', { text: '9è i 10è lloc' }),
      el('p', { class: 'nota', text: 'Hi juguen els dos equips que perden les eliminatòries prèvies.' }),
      el('div', { class: 'partits-llocs' }, [blocPartit(null, p('puesto9'), estat, dades)]),
    ]),

    // --- Taula final ---
    el('section', { class: 'seccio' }, [
      el('h2', { text: "Classificació de l'esport" }),
      taulaPosicions(estat, dades),
    ])
  );
}

/* ---------- Lliga (competició femenina) ---------- */

function pintarLliga(estat, dades) {
  const acabada = estat.progres.jugats === estat.progres.total;

  zonaCos.append(
    el('section', { class: 'seccio' }, [
      el('h2', { text: 'Classificació' }),
      el('p', {
        class: 'nota',
        text: acabada
          ? 'Lliga acabada: tots els equips han jugat contra tots.'
          : `Lliga de tots contra tots a una sola volta. Portem ${estat.progres.jugats} de ${estat.progres.total} partits.`,
      }),
      taulaLliga(estat, dades),
    ]),

    el('section', { class: 'seccio' }, [
      el('h2', { text: 'Partits' }),
      el('div', { class: 'jornades' }, estat.jornades.map((jornada) => blocJornada(jornada, estat, dades))),
    ])
  );
}

/** Taula de la lliga: partits jugats, victòries, derrotes i punts que s'emporta cadascú. */
function taulaLliga(estat, dades) {
  const provisional = Boolean(estat.provisional);
  const cos = el('tbody');
  for (const fila of estat.taulaLliga ?? []) {
    cos.append(
      el('tr', { class: !provisional && fila.posicio === 1 ? 'lider' : null }, [
        el('td', { class: 'pos', text: fila.compartida ? `${ordinal(fila.posicio)}=` : ordinal(fila.posicio) }),
        el('td', {}, [celaEquip(dades.equips, fila.id)]),
        el('td', { class: 'num', text: String(fila.jugats) }),
        el('td', { class: 'num', text: String(fila.victories) }),
        el('td', { class: 'num apagat', text: String(fila.derrotes) }),
        el('td', {
          class: provisional ? 'num apagat' : 'num punts',
          text: String((provisional ? estat.puntsProvisionals : estat.punts)[fila.id] ?? 0),
        }),
      ])
    );
  }

  const hiHaEmpats = (estat.empats ?? []).length > 0;

  return el('div', {}, [
    el('div', { class: 'taula-scroll' }, [
      el('table', {}, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', { text: 'Lloc' }),
            el('th', { text: 'Equip' }),
            el('th', { class: 'num', title: 'Partits jugats', text: 'PJ' }),
            el('th', { class: 'num', title: 'Victòries', text: 'V' }),
            el('th', { class: 'num', title: 'Derrotes', text: 'D' }),
            el('th', { class: 'num', text: 'Punts' }),
          ]),
        ]),
        cos,
      ]),
    ]),
    el('p', {
      class: 'nota',
      text: provisional
        ? "Classificació provisional: els punts de la columna de la dreta són els que es repartirien si la lliga acabés ara, i no compten a la general fins que s'hagin jugat tots els partits."
        : hiHaEmpats
          ? "Els llocs marcats amb «=» estan empatats: ni les victòries ni l'enfrontament directe els separen, i per això es reparteixen els punts dels llocs que ocupen."
          : "L'ordre es decideix per victòries i, si dos equips n'empaten, pel partit que han jugat entre elles.",
    }),
  ]);
}

function blocJornada(jornada, estat, dades) {
  const partits = (jornada.partidos ?? []).map(([local, visitant]) => estat.partits[`${local}-${visitant}`]);
  const descansa = jornada.descansa ? dades.equips.get(jornada.descansa)?.nombre ?? jornada.descansa : null;

  return el('div', { class: 'jornada' }, [
    el('h3', { text: `Jornada ${jornada.jornada}` }),
    ...partits.map((partit) => targetaPartit(partit, estat, dades)),
    descansa && el('p', { class: 'descansa', text: `Descansa: ${descansa}` }),
  ]);
}

/** Una columna del quadre. Totes les caselles fan la mateixa alçada, així les línies quadren. */
function columna(titol, caselles, estat, dades) {
  return el('div', { class: 'ronda' }, [
    el('h3', { text: titol }),
    el('div', { class: 'caselles' }, caselles.map((casella) => {
      if (casella.buida) return el('div', { class: 'casella' });
      const classes = ['casella', casella.rep && 'casella--rep', casella.surt && 'casella--surt'].filter(Boolean);
      return el('div', { class: classes.join(' ') }, [
        casella.unio && el('span', { class: 'unio' }),
        targetaPartit(casella.partit, estat, dades),
      ]);
    })),
  ]);
}

function blocPartit(titol, partit, estat, dades) {
  return el('div', {}, [titol && el('h3', { text: titol }), targetaPartit(partit, estat, dades)]);
}

/** Una targeta de partit: sigla, marcador i els dos equips. */
function targetaPartit(partit, estat, dades) {
  if (!partit) return el('div', { class: 'partit partit--bloquejat' }, [el('div', { class: 'costat costat--incognita' }, [el('span', { class: 'nom', text: 'Sense dades' })])]);

  // Als partits de lliga la sigla seria "F1-F2", que ja es llegeix als dos noms: es deixa buida.
  const esLliga = partit.jornada !== undefined;
  const noms = NOMS_PARTITS[partit.id] ?? { llarg: partit.id, sigla: esLliga ? '' : partit.id };
  const targeta = el('div', { class: `partit partit--${partit.estat}`, title: noms.llarg }, [
    el('div', { class: 'cap' }, [
      el('span', { text: noms.sigla }),
      partit.marcador && el('span', { class: 'marcador', text: partit.marcador }),
    ]),
  ]);

  partit.participants.forEach((idEquip, i) => {
    const guanya = partit.guanyador && idEquip === partit.guanyador;
    const perd = partit.guanyador && idEquip && idEquip !== partit.guanyador;
    const classes = ['costat', !idEquip && 'costat--incognita', guanya && 'costat--guanya', perd && 'costat--perd'];

    targeta.append(
      el('div', { class: classes.filter(Boolean).join(' ') }, [
        el('span', { class: 'nom', text: idEquip ? dades.equips.get(idEquip)?.nombre ?? idEquip : textIncognita(partit.id, i) }),
      ])
    );
  });

  return targeta;
}

/** «Guanyador QF1», «Perdedor SF2»… per als partits que encara no tenen participants. */
function textIncognita(idPartit, index) {
  const origen = PROCEDENCIA[idPartit]?.[index];
  if (!origen) return '—';
  const [quin, partit] = origen;
  const sigla = NOMS_PARTITS[partit]?.sigla ?? partit;
  return `${quin === 'guanyador' ? 'Guanyador' : 'Perdedor'} ${sigla}`;
}

/** Taula de les 10 posicions finals amb els punts que s'emporta cadascú. */
function taulaPosicions(estat, dades) {
  const cos = el('tbody');
  estat.posicions.forEach((idEquip, i) => {
    const posicio = i + 1;
    const equip = idEquip ? dades.equips.get(idEquip) : null;
    cos.append(
      el('tr', { class: posicio === 1 && idEquip ? 'lider' : null }, [
        el('td', { class: 'pos', text: ordinal(posicio) }),
        idEquip
          ? el('td', {}, [
              el('span', { class: 'equip-cel' }, [
                el('span', { class: 'punt-color', style: { background: equip?.color ?? '#999' } }),
                el('span', { class: 'nom-equip', text: equip?.nombre ?? idEquip }),
              ]),
            ])
          : el('td', { class: 'apagat', text: 'Per decidir' }),
        el('td', { class: idEquip ? 'num punts' : 'num apagat', text: String(estat.taulaPunts[i] ?? 0) }),
      ])
    );
  });

  return el('div', { class: 'taula-scroll' }, [
    el('table', {}, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'Lloc' }),
          el('th', { text: 'Equip' }),
          el('th', { class: 'num', text: 'Punts' }),
        ]),
      ]),
      cos,
    ]),
  ]);
}
