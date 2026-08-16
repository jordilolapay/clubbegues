// general.js — pinta index.html: classificació general + reixa d'esports.

import {
  COMPETICIONS, acaba, adreca, buida, campioDe, carregarTorneig, celaEquip, competicioDeLaAdreca,
  diaCurt, el, franja, inicia, mostrarErrorGreu, mostrarErrors, selectorCompeticio, textIncognita,
} from './comu.js';
import { calcularGeneral, resumirEsports } from './motor.js';
import { MEDALLES, NOMS_CATEGORIES, NOMS_PARTITS, nomCategoria, nomEsport, nomGrup, ordinal } from './textos.js';

const zonaSelector = document.querySelector('#selector');
const zonaErrors = document.querySelector('#errors');
const zonaGeneral = document.querySelector('#general');
const zonaResum = document.querySelector('#resum-esports');
const zonaFiltres = document.querySelector('#filtres');
const zonaReixa = document.querySelector('#reixa');
const zonaTitol = document.querySelector('#subtitol');
const seccioAra = document.querySelector('#seccio-ara');
const zonaAra = document.querySelector('#ara');
const titolAra = document.querySelector('#titol-ara');
const enllacHoraris = document.querySelector('#enllac-horaris');

/** Quantes franges es mostren a la portada abans de remetre a la pàgina d'horaris. */
const QUANTES_ARA = 5;

const competicio = competicioDeLaAdreca();

let dades = null;
let filtre = 'tots';

init();

async function init() {
  zonaSelector.append(selectorCompeticio(competicio, 'index.html'));
  const { adjectiu } = COMPETICIONS[competicio];
  zonaTitol.textContent = `Competició ${adjectiu}`;
  document.title = `Classificació ${adjectiu} · Olimpíades 2026 - Club de Begues`;

  try {
    dades = await carregarTorneig(competicio);
  } catch (e) {
    mostrarErrorGreu(zonaErrors, e);
    buida(zonaGeneral);
    buida(zonaResum);
    buida(zonaReixa);
    return;
  }
  mostrarErrors(zonaErrors, dades.errors);
  pintarAra();
  pintarGeneral();
  pintarResum();
  pintarFiltres();
  pintarReixa();
}

/* ---------- Ara i després ---------- */

/**
 * Què s'està jugant i què ve tot seguit. Mentre el torneig no ha començat serveix de compte
 * enrere, i quan s'ha acabat la secció desapareix tota sola.
 */
function pintarAra() {
  const ara = new Date();
  enllacHoraris.href = adreca('horaris.html', competicio);

  const enJoc = dades.horaris.llista.filter((slot) => inicia(slot) <= ara && ara < acaba(slot));
  const venen = dades.horaris.llista.filter((slot) => inicia(slot) > ara);
  if (!enJoc.length && !venen.length) return; // torneig acabat (o encara sense horaris)

  titolAra.textContent = enJoc.length ? 'Ara i després' : 'Què ve ara';
  seccioAra.hidden = false;

  const mostrar = [...enJoc, ...venen.slice(0, Math.max(QUANTES_ARA - enJoc.length, 2))];
  buida(zonaAra).append(
    el('div', { class: 'ara-despres' }, mostrar.map((slot) => franjaCurta(slot, ara)))
  );
}

function franjaCurta(slot, ara) {
  const enJoc = inicia(slot) <= ara && ara < acaba(slot);
  const avui = inicia(slot).toDateString() === ara.toDateString();

  return el('article', {
    class: ['franja', enJoc && 'franja--ara', slot.tipus === 'limit' && 'franja--limit'].filter(Boolean).join(' '),
  }, [
    el('div', { class: 'franja-quan' }, [
      el('span', { class: 'hora', text: slot.tipus === 'limit' ? 'Data límit' : `${avui ? '' : `${diaCurt(slot.data)} · `}${franja(slot)}` }),
      slot.lloc && el('span', { class: 'lloc', text: slot.lloc }),
      enJoc && el('span', { class: 'ara', text: 'Ara' }),
    ]),
    el('div', { class: 'franja-que' }, queEsJuga(slot)),
  ]);
}

function queEsJuga(slot) {
  if (slot.tipus === 'acte') return [el('p', { class: 'acte', text: slot.nota || 'Acte de les Olimpíades' })];

  return slot.esports.map((id) => {
    const estat = dades.perId.get(id);
    const titol = el('a', {
      class: 'franja-esport',
      href: adreca('deporte.html', competicio, { id }),
      text: estat ? nomEsport(estat.esport) : id,
    });

    if (slot.tipus === 'limit') {
      return el('div', {}, [titol, el('p', { class: 'nota', text: `Últim dia per jugar ${slot.partits.map((p) => NOMS_PARTITS[p]?.llarg ?? p).join(', ')}.` })]);
    }
    if (slot.tot || !slot.partits.length) {
      return el('div', {}, [titol, el('p', { class: 'nota', text: slot.nota || "Es juga tot l'esport." })]);
    }

    // Una franja compartida per les dues competicions porta els partits de totes dues.
    const meus = slot.partits.filter((idPartit) => estat?.partits?.[idPartit]);
    if (!meus.length) return null;

    return el('div', {}, [titol, ...meus.map((idPartit) => {
      const noms = estat.partits[idPartit].participants.map((equip, i) =>
        equip ? dades.equips.get(equip)?.nombre ?? equip : textIncognita(idPartit, i));
      return el('div', { class: 'franja-partit' }, [
        el('span', { class: 'sigla', text: NOMS_PARTITS[idPartit]?.sigla ?? '' }),
        el('span', { class: 'contra', text: noms.join(' – ') }),
      ]);
    })]);
  }).filter(Boolean);
}

/* ---------- Classificació general ---------- */

function pintarGeneral() {
  const { config, esports, equips } = dades;
  const classificacio = calcularGeneral(config, esports);
  const totalPunts = classificacio.reduce((suma, fila) => suma + fila.punts, 0);

  buida(zonaGeneral);

  if (totalPunts === 0) {
    zonaGeneral.append(
      el('div', { class: 'buit' }, [
        el('p', { text: "Encara no hi ha cap resultat apuntat. La classificació general s'anirà omplint sola a mesura que s'apuntin els partits." }),
      ])
    );
    return;
  }

  const categories = Object.keys(config.categorias);
  const capcalera = el('tr', {}, [
    el('th', { text: '#' }),
    el('th', { text: 'Equip' }),
    el('th', { class: 'num', text: 'Punts' }),
    ...categories.map((cat) => el('th', { class: 'num', text: nomCategoria(cat, true) })),
    ...MEDALLES.map((medalla) =>
      el('th', { class: `num medalla medalla--${medalla.id}`, title: medalla.titol },
        [el('span', { class: 'medalla-icona', text: medalla.icona }), el('span', { class: 'medalla-nom', text: medalla.nom })])
    ),
  ]);

  const cos = el('tbody');
  for (const fila of classificacio) {
    cos.append(
      el('tr', { class: fila.posicio === 1 ? 'lider' : null }, [
        el('td', { class: 'pos', text: ordinal(fila.posicio) }),
        el('td', {}, [celaEquip(equips, fila.equip.id)]),
        el('td', { class: 'num punts', text: String(fila.punts) }),
        ...categories.map((cat) =>
          el('td', { class: fila.perCategoria[cat] ? 'num' : 'num apagat', text: String(fila.perCategoria[cat] ?? 0) })
        ),
        ...MEDALLES.map((medalla, i) =>
          el('td', {
            class: fila.recompte[i] ? `num medalla medalla--${medalla.id}` : 'num medalla apagat',
            text: String(fila.recompte[i] ?? 0),
          })
        ),
      ])
    );
  }

  zonaGeneral.append(
    el('div', { class: 'taula-scroll' }, [el('table', {}, [el('thead', {}, [capcalera]), cos])]),
    el('p', {
      class: 'nota',
      text: "Els esports a mig fer ja sumen els llocs decidits. En cas d'empat a punts, va davant qui té més ors, després més plates, i així fins al desè lloc. Or, plata i bronze = primers, segons i tercers llocs.",
    })
  );
}

/* ---------- D'on surten els punts ---------- */

/**
 * Els esports agrupats per estat, perquè es vegi què ja compta a la general i què encara no.
 * Els que no han començat només surten si n'hi ha.
 */
function pintarResum() {
  const { esports, equips, competicio } = dades;
  const resum = resumirEsports(esports);

  const blocs = [
    {
      id: 'tancats',
      files: resum.tancats,
      titol: (n) => (n === 1 ? 'esport tancat' : 'esports tancats'),
      peu: 'Ja han repartit tots els punts i no poden canviar.',
    },
    {
      id: 'mig',
      files: resum.enJoc,
      titol: (n) => (n === 1 ? 'esport a mig fer' : 'esports a mig fer'),
      peu: 'Els quadres ja sumen els llocs decidits; les lligues no reparteixen res fins que s\'acaben.',
    },
    {
      id: 'pendents',
      files: resum.perComencar,
      titol: (n) => (n === 1 ? 'esport per començar' : 'esports per començar'),
      peu: 'Encara no sumen res a la general.',
    },
  ].filter((bloc) => bloc.files.length);

  buida(zonaResum);
  // Abans que comenci res no hi ha res a explicar: el llistat sencer d'esports ja és la reixa.
  if (!resum.tancats.length && !resum.enJoc.length) return;

  zonaResum.append(
    el('h3', { class: 'resum-titol', text: "D'on surten els punts" }),
    el('div', { class: 'resum-esports' }, blocs.map((bloc) =>
      el('article', { class: `resum-bloc resum-bloc--${bloc.id}` }, [
        el('h4', {}, [
          el('span', { class: 'resum-comptador', text: String(bloc.files.length) }),
          ` ${bloc.titol(bloc.files.length)}`,
        ]),
        el('ul', { class: 'resum-llista' }, bloc.files.map((fila) => {
          const detall = detallEsport(fila, equips);
          return el('li', {}, [
            el('a', {
              class: 'resum-esport',
              href: adreca('deporte.html', competicio, { id: fila.estat.id }),
              text: nomEsport(fila.estat.esport),
            }),
            detall && el('span', { class: 'resum-detall', text: detall }),
          ]);
        })),
        el('p', { class: 'nota', text: bloc.peu }),
      ])
    ))
  );
}

/** Una línia curta per esport: qui l'ha guanyat, o quant s'ha jugat i què ja compta. */
function detallEsport(fila, equips) {
  const { estat, jugats, total, llocsAmbPunts, totalLlocs } = fila;

  if (total > 0 && jugats === total) {
    const campio = campioDe(estat);
    return campio ? `🥇 ${equips.get(campio)?.nombre ?? campio}` : 'Acabat';
  }
  if (!jugats) return ''; // el peu del bloc ja diu que encara no sumen res

  // Als esports que van per ordre d'arribada, cada lloc decidit ja és un lloc que puntua.
  if (estat.format === 'clasificacion') return `${jugats} de ${total} llocs decidits`;

  const fet = `${jugats} de ${total} partits`;
  return llocsAmbPunts
    ? `${fet} · ${llocsAmbPunts} de ${totalLlocs} llocs ja sumen`
    : `${fet} · encara no suma punts`;
}

/* ---------- Reixa d'esports ---------- */

function pintarFiltres() {
  const opcions = [
    { id: 'tots', text: 'Tots' },
    ...Object.keys(dades.config.categorias).map((cat) => ({ id: cat, text: NOMS_CATEGORIES[cat]?.llarg ?? cat })),
    { id: 'acabats', text: 'Ja tenen campió' },
  ];

  buida(zonaFiltres);
  for (const opcio of opcions) {
    const boto = el('button', { type: 'button', text: opcio.text, 'aria-pressed': String(opcio.id === filtre) });
    boto.addEventListener('click', () => {
      filtre = opcio.id;
      for (const altre of zonaFiltres.querySelectorAll('button')) {
        altre.setAttribute('aria-pressed', String(altre === boto));
      }
      pintarReixa();
    });
    zonaFiltres.append(boto);
  }
}

function pintarReixa() {
  const { torneig, esports, equips } = dades;
  const visibles = esports.filter((estat) => {
    if (filtre === 'tots') return true;
    if (filtre === 'acabats') return Boolean(campioDe(estat));
    return estat.categoria === filtre;
  });

  buida(zonaReixa);
  if (!visibles.length) {
    zonaReixa.append(el('div', { class: 'buit' }, [el('p', { text: 'Cap esport en aquest filtre.' })]));
    return;
  }

  for (const estat of visibles) {
    const grup = estat.esport.grupoAfin ? torneig.gruposAfines[estat.esport.grupoAfin] : null;
    const campio = campioDe(estat);
    const { jugats, total } = estat.progres;

    zonaReixa.append(
      el('a', {
        class: 'targeta-esport',
        href: adreca('deporte.html', dades.competicio, { id: estat.id }),
        style: { '--accent': grup?.color ?? 'var(--fosc)' },
      }, [
        el('h3', { text: nomEsport(estat.esport) }),
        el('p', {
          class: 'meta',
          text: [nomCategoria(estat.categoria, true), grup && nomGrup(estat.esport.grupoAfin)].filter(Boolean).join(' · '),
        }),
        campio
          ? el('p', { class: 'campio' }, [el('span', { text: '🏆' }), ` ${equips.get(campio)?.nombre ?? campio}`])
          : el('p', { class: 'sense-campio', text: jugats ? 'En joc' : 'Encara no ha començat' }),
        el('div', { class: 'progres' }, [
          el('div', { class: 'barra-fons' }, [
            el('div', { class: 'barra-plena', style: { width: `${total ? Math.round((jugats / total) * 100) : 0}%` } }),
          ]),
          el('p', {
            class: 'xifra',
            text: estat.format === 'clasificacion'
              ? `${jugats} de ${total} llocs decidits`
              : `${jugats} de ${total} partits jugats`,
          }),
        ]),
      ])
    );
  }
}
