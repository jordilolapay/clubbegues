// general.js — pinta index.html: classificació general + reixa d'esports.

import {
  COMPETICIONS, adreca, buida, campioDe, carregarTorneig, celaEquip, competicioDeLaAdreca, el,
  mostrarErrorGreu, mostrarErrors, selectorCompeticio,
} from './comu.js';
import { calcularGeneral } from './motor.js';
import { NOMS_CATEGORIES, nomCategoria, nomEsport, nomGrup, ordinal } from './textos.js';

const zonaSelector = document.querySelector('#selector');
const zonaErrors = document.querySelector('#errors');
const zonaGeneral = document.querySelector('#general');
const zonaFiltres = document.querySelector('#filtres');
const zonaReixa = document.querySelector('#reixa');
const zonaTitol = document.querySelector('#subtitol');

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
    buida(zonaReixa);
    return;
  }
  mostrarErrors(zonaErrors, dades.errors);
  pintarGeneral();
  pintarFiltres();
  pintarReixa();
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
    el('th', { class: 'num', text: 'Or' }),
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
        el('td', { class: fila.recompte[0] ? 'num' : 'num apagat', text: String(fila.recompte[0]) }),
      ])
    );
  }

  zonaGeneral.append(
    el('div', { class: 'taula-scroll' }, [el('table', {}, [el('thead', {}, [capcalera]), cos])]),
    el('p', {
      class: 'nota',
      text: "Els esports a mig fer ja sumen els llocs decidits. En cas d'empat a punts, va davant qui té més primers llocs. «Or» = esports guanyats.",
    })
  );
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
