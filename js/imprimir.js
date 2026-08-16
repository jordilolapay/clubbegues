// imprimir.js — pinta imprimir.html: fulls A4 d'una sola cara, pensats per penjar a la
// paret i anar-hi apuntant els resultats a mà.
//
// Dos fulls:
//   imprimir.html?tipus=esport&id=petanca&comp=masculina  → el quadre sencer d'un esport
//        (en femení, la graella de la lliga; als esports d'ordre d'arribada, la taula de llocs)
//   imprimir.html?tipus=dia&data=2026-08-22               → els horaris d'un dia, masculí i femení

import {
  COMPETICIONS, adreca, avuiLocal, buida, carregarTorneig, competicioDeLaAdreca, diaCurt, el, franja,
  inicia, mostrarErrorGreu, mostrarErrors, nomDia, textIncognita,
} from './comu.js';
import {
  NOMS_PARTITS, NOMS_RONDES, nomCategoria, nomEsport, nomGrup, ordinal, textosClassificacio,
} from './textos.js';

const zonaTria = document.querySelector('#tria');
const zonaErrors = document.querySelector('#errors');
const zonaFull = document.querySelector('#full');
const enllacTornar = document.querySelector('#tornar');

const params = new URLSearchParams(location.search);
const tipus = params.get('tipus') === 'dia' ? 'dia' : 'esport';
const competicio = competicioDeLaAdreca();

document.querySelector('#boto-imprimir').addEventListener('click', () => window.print());

init();

async function init() {
  try {
    if (tipus === 'dia') await pintarDia();
    else await pintarEsport();
  } catch (e) {
    mostrarErrorGreu(zonaErrors, e);
    buida(zonaFull);
  }
}

/** Diu al navegador quin paper fa servir aquest full. Un @page no es pot posar per classes. */
function paper(orientacio) {
  document.querySelector('#paper')?.remove();
  document.head.append(el('style', { id: 'paper', text: `@page { size: A4 ${orientacio}; margin: 8mm; }` }));
  document.body.setAttribute('data-orientacio', orientacio);
}

/* ---------- Barra de dalt ---------- */

/** Les dues menes de full, per poder saltar d'una a l'altra sense tornar enrere. */
function pestanyes(actiu, extra = {}) {
  const opcions = [
    { id: 'esport', text: "Quadre d'un esport" },
    { id: 'dia', text: "Horaris d'un dia" },
  ];
  return el('div', { class: 'pestanyes' }, opcions.map((opcio) =>
    el('a', {
      class: 'pestanya',
      'aria-current': opcio.id === actiu ? 'true' : null,
      href: adreca('imprimir.html', competicio, { tipus: opcio.id, ...(opcio.id === actiu ? extra : {}) }),
      text: opcio.text,
    })
  ));
}

/** Un desplegable que, en canviar, va a una altra adreça. */
function triaAdreca(etiqueta, valor, opcions) {
  const select = el('select', {}, opcions.map(([href, text, id]) =>
    el('option', { value: href, selected: id === valor ? 'selected' : null, text })
  ));
  select.addEventListener('change', () => { location.href = select.value; });
  return el('label', { class: 'tria-camp' }, [el('span', { text: etiqueta }), select]);
}

/* ---------- Trossos comuns dels fulls ---------- */

/**
 * Una cara de paper. Per defecte ocupa exactament una pàgina, i el que hi ha dins s'hi
 * estira; els fulls que poden ser més llargs (els horaris d'un dia) es marquen amb
 * `creix` i llavors continuen a la cara següent si cal.
 */
function fulla(orientacio, fills, opcions = {}) {
  paper(orientacio);
  const classes = ['full', `full--${orientacio}`, opcions.creix ? 'full--creix' : 'full--fixa'];
  return el('div', { class: classes.join(' ') }, fills);
}

function capcalera(titol, linies = []) {
  return el('header', { class: 'full-cap' }, [
    el('img', { class: 'full-logo', src: 'img/logo_club.png', alt: '' }),
    el('div', { class: 'full-titol' }, [
      el('p', { class: 'full-sobre', text: 'Olimpíades 2026 · Club de Begues' }),
      el('h1', { text: titol }),
    ]),
    el('div', { class: 'full-info' }, linies.filter(Boolean).map((linia) => el('p', { text: linia }))),
  ]);
}

/** "ds. 22 · 18:00 – 19:00 · Poliesportiu", per posar a dalt de cada partit. */
function quanEsJuga(estat, dades, idPartit) {
  const slot = dades.horaris.partit(estat.id, idPartit);
  if (!slot || slot.tipus !== 'partit') return '';
  return [diaCurt(slot.data), franja(slot), slot.lloc].filter(Boolean).join(' · ');
}

/** Un marcador tipus "13-8" es reparteix entre les dues caselles; la resta va al capdamunt. */
function trossosMarcador(marcador) {
  const parts = /^\s*(\d+)\s*[-–]\s*(\d+)\s*$/.exec(marcador ?? '');
  return parts ? [parts[1], parts[2]] : null;
}

/**
 * Un partit tal com surt al full: la sigla i quan es juga a dalt, i a sota els dos equips
 * amb una casella al costat per apuntar-hi el resultat a mà.
 *
 * Els equips només s'escriuen si ja se saben (el sorteig de prèvies i quarts, i els partits
 * que ja s'hagin jugat). A la resta hi va una línia buida: qui l'ompli va escrivint els
 * equips a mesura que van passant de ronda.
 */
function targetaPartit(partit, estat, dades, opcions = {}) {
  const titol = opcions.titol ?? NOMS_PARTITS[partit?.id]?.sigla ?? '';
  const costatBuit = () => el('div', { class: 'p-costat' }, [
    el('span', { class: 'p-nom p-nom--linia' }),
    el('span', { class: 'p-caixa' }),
  ]);

  if (!partit) {
    return el('div', { class: 'p-partit' }, [
      el('div', { class: 'p-cap' }, [el('span', { text: titol })]),
      costatBuit(),
      costatBuit(),
    ]);
  }

  const trossos = trossosMarcador(partit.marcador);
  const quan = opcions.quan ?? quanEsJuga(estat, dades, partit.id);

  const targeta = el('div', { class: 'p-partit' }, [
    el('div', { class: 'p-cap' }, [
      el('span', { class: 'p-sigla', text: titol }),
      el('span', { class: 'p-quan', text: [quan, !trossos && partit.marcador].filter(Boolean).join(' · ') }),
    ]),
  ]);

  partit.participants.forEach((idEquip, i) => {
    if (!idEquip) return targeta.append(costatBuit());
    const guanya = Boolean(partit.guanyador) && idEquip === partit.guanyador;
    targeta.append(
      el('div', { class: `p-costat${guanya ? ' p-costat--guanya' : ''}` }, [
        el('span', { class: 'p-nom', text: dades.equips.get(idEquip)?.nombre ?? idEquip }),
        el('span', { class: 'p-caixa', text: trossos ? trossos[i] : '' }),
      ])
    );
  });

  return targeta;
}

/** Una columna del quadre, amb les línies que la lliguen amb la següent. */
function columna(titol, caselles, estat, dades) {
  return el('div', { class: 'p-ronda' }, [
    el('h3', { text: titol }),
    el('div', { class: 'p-caselles' }, caselles.map((casella) => {
      if (casella.buida) return el('div', { class: 'p-casella' });
      const classes = ['p-casella', casella.rep && 'p-casella--rep', casella.surt && 'p-casella--surt'];
      return el('div', { class: classes.filter(Boolean).join(' ') }, [
        casella.unio && el('span', { class: 'p-unio' }),
        targetaPartit(casella.partit, estat, dades),
      ]);
    })),
  ]);
}

function blocPartit(titol, partit, estat, dades) {
  return el('div', { class: 'p-bloc' }, [
    el('h3', { text: titol }),
    targetaPartit(partit, estat, dades, { titol: NOMS_PARTITS[partit?.id]?.sigla ?? '' }),
  ]);
}

/* ---------- Full d'un esport ---------- */

async function pintarEsport() {
  const dades = await carregarTorneig(competicio);
  const id = params.get('id') ?? dades.esports[0]?.id;
  const estat = dades.perId.get(id);

  enllacTornar.href = adreca('deporte.html', competicio, id ? { id } : {});
  mostrarErrors(zonaErrors, dades.errors);

  buida(zonaTria).append(
    pestanyes('esport', id ? { id } : {}),
    el('div', { class: 'tria-camps' }, [
      triaAdreca('Competició', competicio, Object.values(COMPETICIONS).map((comp) =>
        [adreca('imprimir.html', comp.id, { tipus: 'esport', ...(id ? { id } : {}) }), comp.etiqueta, comp.id])),
      triaAdreca('Esport', id, dades.esports.map((altre) =>
        [adreca('imprimir.html', competicio, { tipus: 'esport', id: altre.id }), nomEsport(altre.esport), altre.id])),
    ])
  );

  if (!estat) {
    document.title = 'Esport no trobat · Olimpíades 2026';
    buida(zonaFull).append(el('div', { class: 'buit' }, [
      el('p', { text: id ? `No hi ha cap esport amb l'identificador "${id}".` : "Falta l'identificador de l'esport a l'adreça." }),
    ]));
    return;
  }

  const nom = nomEsport(estat.esport);
  document.title = `${nom} · ${COMPETICIONS[competicio].etiqueta} · Full per imprimir`;

  // Un esport pot ocupar més d'una cara: el quadre masculí en fa dues (principal i consolació).
  const fulls = [].concat(
    estat.format === 'cuadro' ? fullQuadre(estat, dades)
      : estat.format === 'liga' ? fullLliga(estat, dades)
        : fullClassificacio(estat, dades)
  );

  buida(zonaFull).append(...fulls);
}

/** Les línies d'informació que van a la dreta de la capçalera. */
function infoEsport(estat, dades) {
  const grup = estat.esport.grupoAfin ? nomGrup(estat.esport.grupoAfin) : null;
  return [
    COMPETICIONS[dades.competicio].etiqueta,
    [nomCategoria(estat.categoria), grup].filter(Boolean).join(' · '),
    `Punts: ${estat.taulaPunts.join(' · ')}`,
  ];
}

/* ---------- Full d'un esport · quadre masculí ---------- */

function fullQuadre(estat, dades) {
  const p = (id) => estat.partits[id];
  const nom = nomEsport(estat.esport);

  // Dues cares: el quadre principal ha de cabre sencer en una, i la consolació va a part.
  const principal = fulla('landscape', [
    capcalera(nom, infoEsport(estat, dades)),
    el('div', { class: 'cos cos--quadre' }, [
      el('section', { class: 'zona zona--principal' }, [
        el('h2', { text: 'Quadre principal' }),
        el('div', { class: 'p-quadre' }, [
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
      el('aside', { class: 'zona zona--taula' }, [
        el('h2', { text: 'Classificació final' }),
        taulaPosicions(estat, dades),
      ]),
      el('section', { class: 'zona zona--llocs' }, [
        el('h2', { text: 'Partits pels llocs' }),
        el('div', { class: 'p-blocs p-blocs--fila' }, [
          blocPartit('3r i 4t lloc', p('tercerPuesto'), estat, dades),
          blocPartit('9è i 10è lloc · el perden les prèvies', p('puesto9'), estat, dades),
        ]),
      ]),
    ]),
    peu('Els equips de prèvies i quarts ja hi són escrits; la resta s\'hi va apuntant. La consolació va al full següent.'),
  ]);

  const consolacio = fulla('landscape', [
    capcalera(`${nom} · consolació`, infoEsport(estat, dades)),
    el('div', { class: 'cos cos--consolacio' }, [
      el('section', { class: 'zona zona--principal' }, [
        el('h2', { text: 'Consolació · llocs 5è a 8è' }),
        el('p', { class: 'p-nota', text: 'Hi juguen els quatre equips que perden als quarts de final: apunta\'ls a les semifinals a mesura que se sàpiguen.' }),
        el('div', { class: 'p-quadre' }, [
          columna(NOMS_RONDES.consSemis, [
            { partit: p('consSf1'), surt: true, unio: true },
            { partit: p('consSf2'), surt: true },
          ], estat, dades),
          columna(NOMS_RONDES.consFinal, [{ partit: p('consFinal'), rep: true }], estat, dades),
        ]),
      ]),
      el('section', { class: 'zona zona--llocs' }, [
        el('h2', { text: 'Partits pels llocs' }),
        el('div', { class: 'p-blocs' }, [
          blocPartit('7è i 8è lloc · el perden les semifinals de consolació', p('consTercero'), estat, dades),
        ]),
      ]),
    ]),
    peu('Full 2 de 2 · el quadre principal va al full anterior.'),
  ]);

  return [principal, consolacio];
}

/** La taula de llocs finals: els que ja se saben surten escrits, la resta queden per omplir. */
function taulaPosicions(estat, dades) {
  const marcadors = estat.marcadors ?? [];
  const ambMarca = marcadors.some(Boolean);
  const textos = textosClassificacio(estat.id);

  const cos = el('tbody');
  estat.posicions.forEach((idEquip, i) => {
    cos.append(el('tr', {}, [
      el('td', { class: 'p-lloc', text: ordinal(i + 1) }),
      el('td', { class: idEquip ? '' : 'p-buida', text: idEquip ? dades.equips.get(idEquip)?.nombre ?? idEquip : '' }),
      ambMarca && el('td', { class: 'p-num p-buida', text: marcadors[i] || '' }),
      el('td', { class: 'p-num', text: String(estat.taulaPunts[i] ?? 0) }),
    ]));
  });

  return el('table', { class: 'p-taula' }, [
    el('thead', {}, [
      el('tr', {}, [
        el('th', { text: 'Lloc' }),
        el('th', { text: 'Equip' }),
        ambMarca && el('th', { class: 'p-num', text: textos.marca }),
        el('th', { class: 'p-num', text: 'Punts' }),
      ]),
    ]),
    cos,
  ]);
}

/* ---------- Full d'un esport · lliga femenina ---------- */

function fullLliga(estat, dades) {
  return fulla('portrait', [
    capcalera(nomEsport(estat.esport), infoEsport(estat, dades)),
    el('div', { class: 'cos cos--lliga' }, [
      el('section', { class: 'zona' }, [
        el('h2', { text: 'Graella de la lliga' }),
        graellaLliga(estat, dades),
      ]),
      el('section', { class: 'zona' }, [
        el('h2', { text: 'Partits, jornada a jornada' }),
        el('div', { class: 'p-jornades' }, jornadesEnOrdre(estat, dades).map((jornada) => blocJornada(jornada, estat, dades))),
      ]),
      el('section', { class: 'zona' }, [
        el('h2', { text: 'Classificació' }),
        taulaLligaBuida(estat, dades),
      ]),
    ]),
    peu('A la graella, cada partit va a la casella de la fila del primer equip. Marca qui guanya amb un ✓ i apunta-hi el resultat.'),
  ]);
}

/** Tots contra totes: una casella per parella, amb la jornada que hi toca. */
function graellaLliga(estat, dades) {
  const equips = [...dades.equips.values()];
  const partitEntre = (a, b) => estat.partits[`${a}-${b}`] ?? estat.partits[`${b}-${a}`] ?? null;

  const capcaleres = el('tr', {}, [
    el('th', { class: 'p-cantonada', text: '' }),
    ...equips.map((equip) => el('th', { class: 'p-vs', text: equip.nombre })),
  ]);

  const cos = el('tbody');
  equips.forEach((equip, fila) => {
    const tr = el('tr', {}, [el('th', { class: 'p-equip-fila', text: equip.nombre })]);
    equips.forEach((rival, columna) => {
      if (fila === columna) return tr.append(el('td', { class: 'p-cel-morta' }));
      if (columna < fila) return tr.append(el('td', { class: 'p-cel-buida' }));

      const partit = partitEntre(equip.id, rival.id);
      const guanya = partit?.guanyador;
      tr.append(el('td', { class: 'p-cel' }, [
        el('span', { class: 'p-cel-jornada', text: partit ? `J${partit.jornada}` : '' }),
        el('span', {
          class: 'p-cel-text',
          text: guanya
            ? [guanya === equip.id ? '✓' : '✗', partit.marcador].filter(Boolean).join(' ')
            : '',
        }),
      ]));
    });
    cos.append(tr);
  });

  return el('div', {}, [
    el('table', { class: 'p-graella' }, [el('thead', {}, [capcaleres]), cos]),
    el('p', { class: 'p-nota', text: '✓ = guanya l\'equip de la fila · ✗ = guanya el de la columna. Les caselles de sota la diagonal no es fan servir: cada parella només juga un cop.' }),
  ]);
}

/**
 * Les jornades en l'ordre que es juguen: cada esport comença per una de diferent, i per tant
 * la primera del full no té per què ser la número 1. Les que no tenen horari van al final.
 */
function jornadesEnOrdre(estat, dades) {
  const quan = (jornada) => {
    const moments = (jornada.partidos ?? [])
      .map(([local, visitant]) => dades.horaris.partit(estat.id, `${local}-${visitant}`))
      .filter(Boolean)
      .map((slot) => inicia(slot).getTime());
    return moments.length ? Math.min(...moments) : Infinity;
  };

  return (estat.jornades ?? [])
    .map((jornada) => ({ jornada, quan: quan(jornada) }))
    .sort((a, b) => a.quan - b.quan || a.jornada.jornada - b.jornada.jornada)
    .map((ordenada) => ordenada.jornada);
}

function blocJornada(jornada, estat, dades) {
  const descansa = jornada.descansa ? dades.equips.get(jornada.descansa)?.nombre ?? jornada.descansa : null;
  return el('div', { class: 'p-jornada' }, [
    el('h3', { text: `Jornada ${jornada.jornada}` }),
    ...(jornada.partidos ?? []).map(([local, visitant]) =>
      targetaPartit(estat.partits[`${local}-${visitant}`], estat, dades, { titol: '' })),
    descansa && el('p', { class: 'p-descansa', text: `Descansa: ${descansa}` }),
  ]);
}

/** Taula de la lliga per omplir a mà: els noms hi són, la resta es va apuntant. */
function taulaLligaBuida(estat, dades) {
  const cos = el('tbody');
  for (const equip of dades.equips.values()) {
    cos.append(el('tr', {}, [
      el('td', { text: equip.nombre }),
      el('td', { class: 'p-num p-buida' }),
      el('td', { class: 'p-num p-buida' }),
      el('td', { class: 'p-num p-buida' }),
      el('td', { class: 'p-num p-buida' }),
    ]));
  }

  return el('div', {}, [
    el('table', { class: 'p-taula' }, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'Equip' }),
          el('th', { class: 'p-num', text: 'PJ' }),
          el('th', { class: 'p-num', text: 'V' }),
          el('th', { class: 'p-num', text: 'D' }),
          el('th', { class: 'p-num', text: 'Lloc' }),
        ]),
      ]),
      cos,
    ]),
    el('p', { class: 'p-nota', text: `Cada equip juga 4 partits. Reparteix ${estat.taulaPunts.join(' · ')} punts, del 1r al ${ordinal(estat.taulaPunts.length)} lloc, quan s'hagin jugat els ${estat.progres.total} partits.` }),
  ]);
}

/* ---------- Full d'un esport · ordre d'arribada ---------- */

function fullClassificacio(estat, dades) {
  const textos = textosClassificacio(estat.id);
  const sessions = dades.horaris.esport(estat.id).filter((slot) => slot.tipus === 'partit');

  return fulla('portrait', [
    capcalera(nomEsport(estat.esport), infoEsport(estat, dades)),
    el('div', { class: 'cos cos--classificacio' }, [
      el('section', { class: 'zona' }, [
        el('h2', { text: textos.titol }),
        el('p', { class: 'p-nota', text: textos.nota }),
        taulaPosicionsBuida(estat, dades, textos),
      ]),
      sessions.length && el('section', { class: 'zona' }, [
        el('h2', { text: 'Quan es juga' }),
        el('ul', { class: 'p-llista' }, sessions.map((slot) =>
          el('li', { text: [nomDia(slot.data), franja(slot), slot.lloc, slot.nota].filter(Boolean).join(' · ') }))),
      ]),
    ]),
    peu("Apunta els equips per ordre d'arribada. Els llocs que ja se saben hi surten escrits."),
  ]);
}

/** Com la taula de llocs del quadre, però amb la columna de marques sempre oberta per escriure-hi. */
function taulaPosicionsBuida(estat, dades, textos) {
  const marcadors = estat.marcadors ?? [];
  const cos = el('tbody');

  estat.posicions.forEach((idEquip, i) => {
    cos.append(el('tr', {}, [
      el('td', { class: 'p-lloc', text: ordinal(i + 1) }),
      el('td', { class: idEquip ? '' : 'p-buida', text: idEquip ? dades.equips.get(idEquip)?.nombre ?? idEquip : '' }),
      el('td', { class: 'p-num p-buida', text: marcadors[i] || '' }),
      el('td', { class: 'p-num', text: String(estat.taulaPunts[i] ?? 0) }),
    ]));
  });

  return el('table', { class: 'p-taula p-taula--ampla' }, [
    el('thead', {}, [
      el('tr', {}, [
        el('th', { text: 'Lloc' }),
        el('th', { text: 'Equip' }),
        el('th', { class: 'p-num', text: textos.marca }),
        el('th', { class: 'p-num', text: 'Punts' }),
      ]),
    ]),
    cos,
  ]);
}

/* ---------- Full dels horaris d'un dia ---------- */

async function pintarDia() {
  // El full porta les dues competicions, o sigui que calen les dues (les dades es
  // llegeixen un sol cop: carregarDades les guarda).
  const [masculina, femenina] = await Promise.all([carregarTorneig('masculina'), carregarTorneig('femenina')]);
  const perCompeticio = { masculina, femenina };

  // Una franja sense competició surt a les dues llistes, i és el mateix objecte: el Set la deixa un cop.
  const totes = [...new Set([...masculina.horaris.llista, ...femenina.horaris.llista])]
    .sort((a, b) => inicia(a) - inicia(b));

  const dies = [...new Set(totes.map((slot) => slot.data))].sort();
  const avui = avuiLocal();
  const data = params.get('data') ?? dies.find((dia) => dia >= avui) ?? dies[0];

  enllacTornar.href = adreca('horaris.html', competicio);
  mostrarErrors(zonaErrors, [...masculina.errors, ...femenina.errors]);

  buida(zonaTria).append(
    pestanyes('dia', data ? { data } : {}),
    el('div', { class: 'tria-camps' }, [
      triaAdreca('Dia', data, dies.map((dia) =>
        [adreca('imprimir.html', competicio, { tipus: 'dia', data: dia }), nomDia(dia), dia])),
    ])
  );

  if (!data) {
    document.title = 'Horaris · Full per imprimir';
    buida(zonaFull).append(el('div', { class: 'buit' }, [
      el('p', { text: 'Encara no hi ha cap horari apuntat.' }),
    ]));
    return;
  }

  document.title = `${nomDia(data)} · Horaris · Full per imprimir`;
  const delDia = totes.filter((slot) => slot.data === data);

  buida(zonaFull).append(fulla('portrait', [
    capcalera(nomDia(data), ['Horaris del dia', 'Masculí i femení']),
    el('div', { class: 'cos' }, [
      delDia.length
        ? taulaDia(delDia, perCompeticio)
        : el('div', { class: 'buit' }, [el('p', { text: "Aquest dia no hi ha res apuntat." })]),
    ]),
    peu('M = masculí · F = femení · M+F = els dos alhora. La columna de la dreta és per apuntar-hi el resultat.'),
  ], { creix: true }));
}

/** Les competicions a què afecta una franja. Si no en diu cap, són totes dues. */
const competicionsDe = (slot) => (slot.competicio ? [slot.competicio] : ['masculina', 'femenina']);

const SIGLA_COMPETICIO = { masculina: 'M', femenina: 'F' };

/**
 * Una línia per partit: qui hi juga, on i a quina hora. Les franges compartides per les dues
 * competicions (natació, minigolf…) surten un sol cop, marcades "M+F".
 */
function liniesDe(slot, perCompeticio) {
  if (slot.tipus === 'acte') {
    return [{ sigla: '', esport: slot.nota || 'Acte de les Olimpíades', partit: '', acte: true }];
  }

  const linies = [];
  for (const id of slot.esports) {
    // Un esport que es juga sencer (o una data límit) no depèn de cap quadre: una línia i prou.
    if (slot.tot || !slot.partits.length || slot.tipus === 'limit') {
      const estat = perCompeticio[competicionsDe(slot)[0]].perId.get(id);
      const nom = estat ? nomEsport(estat.esport) : id;
      const text = slot.tipus === 'limit'
        ? `Data límit: ${slot.partits.map((p) => NOMS_PARTITS[p]?.llarg ?? p).join(', ') || "tot l'esport"}`
        : slot.nota || "Es juga tot l'esport";
      linies.push({ sigla: competicionsDe(slot).map((c) => SIGLA_COMPETICIO[c]).join('+'), esport: nom, partit: text });
      continue;
    }

    for (const competicio of competicionsDe(slot)) {
      const dades = perCompeticio[competicio];
      const estat = dades.perId.get(id);
      const meus = slot.partits.filter((idPartit) => estat?.partits?.[idPartit]);
      for (const idPartit of meus) {
        const partit = estat.partits[idPartit];
        const noms = partit.participants.map((equip, i) =>
          equip ? dades.equips.get(equip)?.nombre ?? equip : textIncognita(idPartit, i));
        linies.push({
          sigla: SIGLA_COMPETICIO[competicio],
          esport: nomEsport(estat.esport),
          partit: [NOMS_PARTITS[idPartit]?.sigla, noms.join(' – ')].filter(Boolean).join(' · '),
          resultat: partit.guanyador
            ? [dades.equips.get(partit.guanyador)?.nombre ?? partit.guanyador, partit.marcador].filter(Boolean).join(' · ')
            : '',
        });
      }
    }
  }

  // Una franja d'un esport que no és de cap de les dues competicions no ha de desaparèixer.
  if (!linies.length) linies.push({ sigla: '', esport: slot.esports.join(', '), partit: slot.nota || '' });
  return linies;
}

function taulaDia(slots, perCompeticio) {
  const cos = el('tbody');

  for (const slot of slots) {
    const linies = liniesDe(slot, perCompeticio);
    linies.forEach((linia, i) => {
      const primera = i === 0;
      cos.append(el('tr', { class: primera ? 'p-inici' : 'p-seguit' }, [
        el('td', { class: 'p-hora', text: primera ? (slot.tipus === 'limit' ? 'Data límit' : franja(slot)) : '' }),
        el('td', { class: 'p-lloc', text: primera ? slot.lloc ?? '' : '' }),
        el('td', { class: 'p-comp', text: linia.sigla }),
        el('td', { class: 'p-que' }, [
          el('span', { class: linia.acte ? 'p-acte' : 'p-esport', text: linia.esport }),
          linia.partit && el('span', { class: 'p-detall', text: linia.partit }),
        ]),
        el('td', { class: 'p-resultat', text: linia.resultat ?? '' }),
      ]));
    });
  }

  return el('table', { class: 'p-taula p-taula--dia' }, [
    el('thead', {}, [
      el('tr', {}, [
        el('th', { text: 'Hora' }),
        el('th', { text: 'Lloc' }),
        el('th', { text: '' }),
        el('th', { text: 'Esport i partit' }),
        el('th', { text: 'Resultat' }),
      ]),
    ]),
    cos,
  ]);
}

/* ---------- Peu del full ---------- */

function peu(text) {
  return el('footer', { class: 'full-peu' }, [
    el('span', { text }),
    el('span', { class: 'full-peu-web', text: 'Olimpíades 2026 · Club de Begues' }),
  ]);
}
